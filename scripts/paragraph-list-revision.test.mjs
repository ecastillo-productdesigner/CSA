import test from 'node:test';
import assert from 'node:assert/strict';
import { applyParagraphListRevision } from '../dist/paragraph-list-revision.js';

const plain = (...paragraphs) => ({ draftText: paragraphs.join('\n\n'), document: { ops: paragraphs.map(text => ({ insert: `${text}\n` })) } });
const insertedText = output => output.document.ops.map(op => typeof op.insert === 'string' ? op.insert : '\ufffc').join('');
const assertStatus = (result, expected, message) => assert.deepEqual({ handled: result.handled, changed: result.changed }, expected, message);

test('converts only the requested second paragraph, preserving source wording and all other content', () => {
  const output = plain('Keep this introduction.', 'The doors open at nine. Visitors can bring a guest.', 'Keep this ending.');
  output.title = 'An unchanged title';
  output.shareText = 'An unchanged summary';
  output.metadata = { author: 'An editor' };
  const before = structuredClone(output);
  const firstOp = output.document.ops[0], lastOp = output.document.ops.at(-1);
  assertStatus(applyParagraphListRevision(output, 'Convert the second paragraph into a short bulleted list.'), { handled: true, changed: true });
  assert.deepEqual(output.document.ops, [
    firstOp,
    { insert: 'The doors open at nine.' }, { insert: '\n', attributes: { list: 'bullet' } },
    { insert: 'Visitors can bring a guest.' }, { insert: '\n', attributes: { list: 'bullet' } },
    lastOp,
  ]);
  assert.strictEqual(output.document.ops[0], firstOp);
  assert.strictEqual(output.document.ops.at(-1), lastOp);
  for (const key of ['title', 'shareText', 'metadata']) assert.deepEqual(output[key], before[key]);
  assert.equal(output.draftText, 'Keep this introduction.\nThe doors open at nine.\nVisitors can bring a guest.\nKeep this ending.');
});

test('preserves inline formatting, links, block alignment, and document metadata', () => {
  const output = {
    document: { version: 7, ops: [
      { insert: 'Opening.\nFirst ', attributes: { italic: true } },
      { insert: 'important fact.', attributes: { bold: true, link: 'https://example.com/fact' } },
      { insert: ' A second fact.', attributes: { underline: true } },
      { insert: '\n', attributes: { align: 'center', direction: 'rtl', indent: 1 } },
      { insert: 'Closing.\n', attributes: { color: '#404040' } },
    ] },
    draftText: 'A stale cache that must not be used as the source.',
  };
  const originalOps = structuredClone(output.document.ops);
  assert.equal(applyParagraphListRevision(output, 'Make paragraph 2 a numbered list.').changed, true);
  assert.equal(output.document.version, 7);
  assert.deepEqual(output.document.ops, [
    { insert: 'Opening.\n', attributes: { italic: true } },
    { insert: 'First ', attributes: { italic: true } },
    originalOps[1],
    { insert: '\n', attributes: { align: 'center', direction: 'rtl', indent: 1, list: 'ordered' } },
    { insert: 'A second fact.', attributes: { underline: true } },
    { insert: '\n', attributes: { align: 'center', direction: 'rtl', indent: 1, list: 'ordered' } },
    originalOps[4],
  ]);
  assert.equal(insertedText(output), 'Opening.\nFirst important fact.\nA second fact.\nClosing.\n');
});

test('recognizes a single explicit ordinal without treating headings or blank lines as paragraphs', () => {
  for (const target of ['the second paragraph', 'the 2nd paragraph', 'paragraph 2', 'paragraph two']) {
    const output = { document: { ops: [
      { insert: 'Heading' }, { insert: '\n', attributes: { header: 2 } },
      { insert: '\nKeep the opening.\n\nConvert this. Keep these words.\nEnding.\n' },
    ] } };
    const result = applyParagraphListRevision(output, `Add bullet points to ${target}.`);
    assertStatus(result, { handled: true, changed: true });
    assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 2);
    assert.deepEqual(output.document.ops[1], { insert: '\n', attributes: { header: 2 } });
    assert.match(insertedText(output), /^Heading\n\nKeep the opening\.\n\nConvert this\.\nKeep these words\.\nEnding\.\n$/);
  }
});

test('opening paragraph and one-sentence paragraphs remain faithful to the source', () => {
  for (const target of ['opening paragraph', 'first paragraph', 'paragraph 1']) {
    const output = plain('Keep exactly this sentence.', 'A separate ending.');
    assert.equal(applyParagraphListRevision(output, `Turn the ${target} into bullet points.`).changed, true);
    assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 1);
    assert.equal(insertedText(output), 'Keep exactly this sentence.\nA separate ending.\n');
  }
});

test('existing list groups retain their logical paragraph slot and repeated conversions do nothing', () => {
  const output = plain('Opening.', 'First item. Second item.', 'Closing.');
  applyParagraphListRevision(output, 'Convert the second paragraph into a bulleted list.');
  const once = structuredClone(output), document = output.document;
  assertStatus(applyParagraphListRevision(output, 'Convert the second paragraph into a bulleted list.'), { handled: true, changed: false });
  assert.deepEqual(output, once);
  assert.strictEqual(output.document, document);
  assertStatus(applyParagraphListRevision(output, 'Make paragraph 2 a numbered list.'), { handled: true, changed: true });
  assert.equal(insertedText(output), insertedText(once), 'changing list type preserves every word');
  assert.equal(output.document.ops.filter(op => op.attributes?.list === 'ordered').length, 2);
  assert.equal(applyParagraphListRevision(output, 'Convert the third paragraph into a numbered list.').changed, true);
  assert.equal(output.document.ops.at(-1).attributes.list, 'ordered');
});

test('negative, missing, empty, and embedded targets are handled without changing any content', () => {
  const cases = [
    [plain('One paragraph.'), 'Do not add bullets to the first paragraph.'],
    [plain('One paragraph.'), 'Don’t turn the first paragraph into a numbered list.'],
    [plain('One paragraph.'), 'Avoid adding bullet points to paragraph 1.'],
    [plain('One paragraph.'), 'Convert the second paragraph into bullet points.'],
    [{ document: { ops: [] }, draftText: 'Stale text.' }, 'Convert the first paragraph into bullet points.'],
    [{ document: { ops: [{ insert: 'An image: ' }, { insert: { image: 'https://example.com/image.png' } }, { insert: '\n' }] } }, 'Make the first paragraph a bulleted list.'],
  ];
  for (const [output, instructions] of cases) {
    const before = structuredClone(output);
    assertStatus(applyParagraphListRevision(output, instructions), { handled: true, changed: false });
    assert.deepEqual(output, before);
  }
});

test('unrelated requests remain outside the list-editing handler', () => {
  for (const instructions of ['Shorten the intro.', 'Use a friendlier tone in the first paragraph.']) {
    const output = plain('Opening.', 'Second paragraph.');
    const before = structuredClone(output);
    assertStatus(applyParagraphListRevision(output, instructions), { handled: false, changed: false });
    assert.deepEqual(output, before);
  }
});

test('unclear list targets and unsupported compound edits never partially change the draft', () => {
  for (const instructions of [
    'Convert the first and second paragraphs into bullet points.',
    'Convert the first paragraph and second paragraph into bullets.',
    'Convert paragraphs 1-3 into bullets.',
    'Convert the first two paragraphs into bullets.',
    'Convert the first, second, and third paragraphs into bullets.',
    'Convert paragraphs 1 through the third into bullets.',
    'Add bullets to the selected paragraph.',
    'Add bullet points to the title.',
    'Add bullet points to the first part.',
    'Make the first paragraph a numbered list and a bulleted list.',
    'Add bullet points and shorten the intro.',
    'Shorten the intro, then add bullet points.',
    'Add bullet points and change the title.',
    'Make a list.',
  ]) {
    const output = plain('Opening.', 'Second paragraph.');
    const before = structuredClone(output);
    const result = applyParagraphListRevision(output, instructions);
    assertStatus(result, { handled: true, changed: false }, instructions);
    assert.ok(result.reason, instructions);
    assert.deepEqual(output, before);
  }
});

test('supports legacy plain text without manufacturing replacement wording', () => {
  const output = { draftText: 'Opening.\n\nA first fact. A second fact.\n\nEnding.' };
  assert.equal(applyParagraphListRevision(output, 'Convert paragraph 2 into bullet points.').changed, true);
  assert.equal(insertedText(output), 'Opening.\n\nA first fact.\nA second fact.\n\nEnding.\n');
  assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 2);
});

test('sentence segmentation keeps names after common titles within one item', () => {
  const output = plain('Dr. Evans led the discussion. The meeting ended at noon.');
  applyParagraphListRevision(output, 'Make the opening paragraph into a bulleted list.');
  assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 2);
  assert.equal(insertedText(output), 'Dr. Evans led the discussion.\nThe meeting ended at noon.\n');
});


test('the exact user request and clear first-paragraph aliases apply the requested bullets', () => {
  for (const instructions of [
    'add bullet points to first paragraph',
    'ADD BULLET POINTS TO FIRST PARAGRAPH',
    'add bullet pointa to first paragraph',
    'add bulletpoints to firstparagrah',
    'add bullet-point to the first para',
    'add bullets to paragraph1',
    'add bullets to paragraph #1',
    'add bullets to the 1st paragraph and leave all other content unchanged',
  ]) {
    const output = plain('One fact. Another fact.', 'Keep this paragraph.');
    const result = applyParagraphListRevision(output, instructions);
    assertStatus(result, { handled: true, changed: true }, instructions);
    assert.deepEqual(result.changes, [{ paragraphIndex: 0, list: 'bullet', itemCount: 2, previousList: null }]);
    assert.equal(insertedText(output), 'One fact.\nAnother fact.\nKeep this paragraph.\n');
    assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 2);
  }
});

test('bare add-bullets requests convert prose while retaining headings, existing lists, and embedded content', () => {
  const image = { insert: { image: 'https://example.com/image.png' } };
  for (const instructions of ['add bullet points', 'Use bulletpoints.', 'Bullets please']) {
    const output = { document: { ops: [
      { insert: 'Heading' }, { insert: '\n', attributes: { header: 2 } },
      { insert: 'First fact. Next fact.\n', attributes: { bold: true } },
      { insert: 'Already numbered.' }, { insert: '\n', attributes: { list: 'ordered' } },
      image, { insert: '\n' },
      { insert: 'Closing fact.\n' },
    ] } };
    const result = applyParagraphListRevision(output, instructions);
    assertStatus(result, { handled: true, changed: true }, instructions);
    assert.deepEqual(result.changes.map(change => change.paragraphIndex), [0, 3]);
    assert.ok(output.document.ops.includes(image));
    assert.equal(output.document.ops.filter(op => op.attributes?.header === 2).length, 1);
    assert.equal(output.document.ops.filter(op => op.attributes?.list === 'ordered').length, 1);
    assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 3);
    assert.equal(output.document.ops.find(op => op.insert === 'First fact.').attributes.bold, true);
  }
});

test('explicit all-paragraph and last-paragraph targets are resolved before any editing', () => {
  for (const instructions of ['Add bullets to all paragraphs.', 'Convert every paragraph into bullets.', 'Make the entire draft a bulleted list.']) {
    const output = plain('Opening fact. Another opening fact.', 'Closing fact.');
    const result = applyParagraphListRevision(output, instructions);
    assertStatus(result, { handled: true, changed: true }, instructions);
    assert.deepEqual(result.changes.map(change => [change.paragraphIndex, change.itemCount]), [[0, 2], [1, 1]]);
  }
  for (const instructions of ['Add bullet points to the last paragraph.', 'Make the final para a numbered list.']) {
    const output = plain('Keep the opening.', 'Closing fact. Another closing fact.');
    const result = applyParagraphListRevision(output, instructions);
    assertStatus(result, { handled: true, changed: true }, instructions);
    assert.deepEqual(result.changes.map(change => change.paragraphIndex), [1]);
    assert.equal(output.document.ops[0].insert, 'Keep the opening.\n');
  }
});

test('a clear existing list-type change preserves words and reports only the changed list', () => {
  const output = { document: { ops: [
    { insert: 'Opening.\nA first item.', attributes: { italic: true } },
    { insert: '\n', attributes: { list: 'ordered', indent: 1 } },
    { insert: 'A second item.', attributes: { link: 'https://example.com/fact' } },
    { insert: '\n', attributes: { list: 'ordered', indent: 1 } },
    { insert: 'Closing.\n' },
  ] } };
  const before = insertedText(output);
  const result = applyParagraphListRevision(output, 'Change the numbered list to bullet points.');
  assertStatus(result, { handled: true, changed: true });
  assert.deepEqual(result.changes, [{ paragraphIndex: 1, list: 'bullet', itemCount: 2, previousList: 'ordered' }]);
  assert.equal(insertedText(output), before);
  assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet' && op.attributes.indent === 1).length, 2);
  assert.equal(output.document.ops.find(op => op.attributes?.link).attributes.link, 'https://example.com/fact');
});
