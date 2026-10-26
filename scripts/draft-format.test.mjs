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

test('all other formats preserve the existing flat paragraph text and unformatted Delta convention', () => {
  const source = ['  Keep original spacing.  ', 'Another paragraph.', ''];
  for (const options of [undefined, { format: 'standard', headings }, { format: 'celebrity-relationship-timeline', headings }]) {
    assert.deepEqual(formatDraftContent(source, options), {
      draftText: source.join('\n\n'),
      document: { ops: source.map(paragraph => ({ insert: `${paragraph}\n` })) },
    });
  }
});
