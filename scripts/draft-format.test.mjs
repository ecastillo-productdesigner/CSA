import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDraftContent } from '../dist/draft-format.js';

const paragraphs = Object.freeze([
  'An introductory paragraph.',
  'The first body paragraph.',
  'The second body paragraph.',
  'The third body paragraph.',
  'The fourth body paragraph.',
]);
const headings = Object.freeze(['The opening development', 'The people involved', 'The wider context', 'The remaining questions']);
const plainText = draft => draft.document.ops.map(op => op.insert).join('');

test('a listicle has one introduction and four numbered Heading 2 sections with unchanged prose', () => {
  const draft = formatDraftContent(paragraphs, { format: 'listicle', headings });
  const blocks = draft.draftText.split('\n\n');
  assert.equal(blocks.length, 9);
  assert.equal(blocks[0], paragraphs[0]);
  assert.deepEqual(blocks.filter((_, index) => index % 2), headings.map((heading, index) => `${index + 1}. ${heading}`));
  assert.deepEqual(blocks.filter((_, index) => index > 0 && index % 2 === 0), paragraphs.slice(1));
  assert.equal(plainText(draft), `${blocks.join('\n')}\n`, 'Delta plaintext uses one newline per block while draft text uses blank lines');
  assert.equal(plainText(draft).split('\n').filter(Boolean).length, 9);
  const headingOps = draft.document.ops.filter(op => op.attributes);
  assert.deepEqual(headingOps, Array.from({ length: 4 }, () => ({ insert: '\n', attributes: { header: 2 } })), 'heading formatting belongs only to each heading newline');
  for (const paragraph of paragraphs) {
    assert.deepEqual(draft.document.ops.find(op => op.insert === `${paragraph}\n`), { insert: `${paragraph}\n` });
  }
});

test('longer legacy bodies group into four contiguous sections without losing, reordering, or inventing text', () => {
  for (const count of [7, 8, 11]) {
    const source = Array.from({ length: count }, (_, index) => `Paragraph ${index + 1}.`);
    const before = structuredClone(source);
    const draft = formatDraftContent(source, { format: 'listicle', headings });
    const blocks = draft.draftText.split('\n\n');
    assert.equal(blocks.length, 9);
    assert.equal(blocks[0], source[0]);
    const bodies = blocks.filter((_, index) => index > 0 && index % 2 === 0);
    assert.equal(bodies.length, 4);
    assert.ok(bodies.every(Boolean));
    assert.equal(bodies.join(' '), source.slice(1).join(' '));
    assert.deepEqual(source, before);
    assert.equal(plainText(draft), `${blocks.join('\n')}\n`);
  }
});

test('missing or blank section labels use generic numbered headings without adding body copy', () => {
  const draft = formatDraftContent(paragraphs, { format: 'listicle', headings: ['', 'A topic-specific section', null] });
  const blocks = draft.draftText.split('\n\n');
  assert.deepEqual(blocks.filter((_, index) => index % 2), [
    '1. How the story begins', '2. A topic-specific section', '3. Why the details matter', '4. What comes next',
  ]);
  assert.deepEqual(blocks.filter((_, index) => index % 2 === 0), paragraphs);
  assert.throws(() => formatDraftContent(paragraphs.slice(0, 4), { format: 'listicle' }), RangeError);
});

test('What to Know uses short explainer sections while preserving every source paragraph', () => {
  const source = Object.freeze([
    '  The board met on Tuesday.  ',
    'The reported figure is 3.2 million.',
    'Two members asked for more detail.',
    'The source does not give a decision date.',
    'Earlier records provide the context.\nThis line stays with that paragraph.',
  ]);
  const draft = formatDraftContent(source, { format: 'what-to-know', headings });
  const blocks = draft.draftText.split('\n\n');
  assert.deepEqual(blocks, ['What to Know', source[0], 'Key Details', ...source.slice(1, -1), 'The Context', source.at(-1)]);
  assert.deepEqual(draft.document.ops.filter(op => op.attributes).map(op => op.attributes), [
    { header: 2 }, { header: 2 }, { header: 2 },
  ]);
  assert.equal(plainText(draft), `${blocks.join('\n')}\n`);
  for (const paragraph of source) {
    assert.equal(draft.document.ops.filter(op => op.insert === `${paragraph}\n`).length, 1);
  }
  assert.doesNotMatch(draft.draftText, /What Happens Next|What comes next|1\./);
});

test('Video Script separates source narration and on-screen text cues in the text and rich document', () => {
  const draft = formatDraftContent(paragraphs, { format: 'video-script', headings });
  const blocks = draft.draftText.split('\n\n');
  const ops = draft.document.ops;
  const sectionHeadings = ops.flatMap((op, index) => op.attributes?.header === 2 ? [ops[index - 1].insert] : []);
  assert.deepEqual(sectionHeadings, ['Opening', 'Voiceover', 'Closing']);
  assert.equal(blocks.filter(block => block === 'Narration').length, 3);
  const cues = blocks.filter(block => block.startsWith('On-screen Cue:'));
  assert.equal(cues.length, 3);
  assert.ok(cues.every(cue => /narration/.test(cue) && /text/.test(cue)), 'cues use the supplied narration as text rather than assuming footage');
  assert.deepEqual(blocks.filter(block => paragraphs.includes(block)), paragraphs);
  assert.equal(plainText(draft), `${blocks.join('\n')}\n`);
  assert.equal(ops.filter(op => op.attributes?.header === 3).length, 3);
  for (const paragraph of paragraphs) {
    assert.equal(ops.filter(op => op.insert === `${paragraph}\n`).length, 1);
  }
  assert.doesNotMatch(draft.draftText, /\d+:\d+|seconds|minutes|footage|interview|“|”/i);
});

test('new formats accept short or empty inputs and keep longer inputs without the listicle minimum', () => {
  for (const format of ['what-to-know', 'video-script']) {
    assert.deepEqual(formatDraftContent([], { format }), { draftText: '', document: { ops: [] } });
    for (const count of [1, 2, 3, 4, 8, 11]) {
      const source = Object.freeze(Array.from({ length: count }, (_, index) => `  Source paragraph ${index + 1}.  `));
      const draft = formatDraftContent(source, { format });
      const sourceOps = draft.document.ops.filter(op => source.some(paragraph => op.insert === `${paragraph}\n`));
      assert.deepEqual(sourceOps, source.map(paragraph => ({ insert: `${paragraph}\n` })));
      assert.equal(plainText(draft), `${draft.draftText.split('\n\n').join('\n')}\n`);
      assert.equal(draft.document.ops.filter(op => op.attributes?.header === 2).length, Math.min(3, count));
    }
  }
});

test('all other formats preserve the existing flat paragraph text and unformatted Delta convention', () => {
  const source = ['  Keep original spacing.  ', 'Another paragraph.', ''];
  for (const options of [undefined, { format: 'standard', headings }, { format: 'celebrity-relationship-timeline', headings }]) {
    assert.deepEqual(formatDraftContent(source, options), {
      draftText: source.join('\n\n'),
      document: { ops: source.map(paragraph => ({ insert: `${paragraph}\n` })) },
    });
  }
});
