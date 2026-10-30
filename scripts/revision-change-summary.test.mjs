import test from 'node:test';
import assert from 'node:assert/strict';
import { mentionsElephant, revisionChangeSummary } from '../dist/revision-change-summary.js';

const draft = (paragraphs, extra = {}) => ({ title: 'The town library', draftText: paragraphs.join('\n\n'), document: { ops: paragraphs.map(text => ({ insert: `${text}\n` })) }, shareText: 'Library news', ...extra });
const summary = (before, after, instructions = 'Make the story funny') => revisionChangeSummary(before, after, instructions);

// The request is deliberately unrelated to the observed edits in these examples.
test('a paragraph split names its location and exact new paragraph opening', () => {
  const before = draft(['The library will reopen Monday. The council approved the repairs.', 'Opening hours remain the same.']);
  const after = draft(['The library will reopen Monday.', 'The council approved the repairs.', 'Opening hours remain the same.']);
  const saved = structuredClone([before, after]);
  assert.equal(summary(before, after, 'Change the title'), 'Split the opening paragraph into two, breaking before “The council approved the repairs”. No other changes.');
  assert.deepEqual([before, after], saved);
  assert.equal(summary(after, before), 'Merged two paragraphs starting with the opening paragraph. No other changes.');
});

test('localized rewrites and word-count changes name the paragraph actually changed', () => {
  const before = draft(['The library opens Monday.', 'The old hall closed.', 'Readers can register online.']);
  assert.equal(summary(before, draft(['The library opens Monday.', 'The new hall opened.', 'Readers can register online.'])), 'Rewrote the second paragraph. No other changes.');
  assert.equal(summary(before, draft(['The library opens Monday.', 'The hall closed.', 'Readers can register online.'])), 'Shortened the second paragraph from 4 to 3 words. No other changes.');
  assert.equal(summary(before, draft(['The library opens Monday.', 'The old hall closed last Friday.', 'Readers can register online.'])), 'Expanded the second paragraph from 4 to 6 words. No other changes.');
  assert.equal(summary(before, draft(['The library opens.', 'The old hall closed.', 'Readers can register online.'])), 'Shortened the opening paragraph from 4 to 3 words. No other changes.');
});

test('reordering distinguishes retained paragraphs from a rewritten opening', () => {
  const before = draft(['Opening.', 'Second.', 'Third.', 'Fourth.', 'Fifth.']);
  assert.equal(summary(before, draft(['Opening.', 'Third.', 'Second.', 'Fourth.', 'Fifth.'])), 'Reordered two paragraphs. No other changes.');
  assert.equal(summary(before, draft(['A different opening.', 'Third.', 'Second.', 'Fifth.', 'Fourth.'])), 'Rewrote the opening paragraph and reordered the remaining paragraphs. No other changes.');
  assert.equal(summary(draft(['Same.', 'Same.', 'Other.']), draft(['Same.', 'Other.', 'Same.'])), 'Reordered the paragraphs. No other changes.');
  assert.equal(summary(before, draft(['New opening.', 'Third.', 'Second.', 'New conclusion.'])), 'Reworked the draft body. No other changes.');
});

test('paragraph additions and removals report reliable positions or counts', () => {
  const before = draft(['Opening.', 'Closing.']);
  const after = draft(['Opening.', 'New details.', 'Closing.']);
  assert.equal(summary(before, after), 'Added one paragraph after the opening paragraph. No other changes.');
  assert.equal(summary(after, before), 'Removed the second paragraph. No other changes.');
  const scattered = draft(['New opening.', 'Opening.', 'Another addition.', 'Closing.']);
  assert.equal(summary(before, scattered), 'Added two paragraphs. No other changes.');
  assert.equal(summary(scattered, before), 'Removed two paragraphs. No other changes.');
  assert.equal(summary(draft([]), before), 'Added two paragraphs at the beginning. No other changes.');
  assert.equal(summary(before, draft([])), 'Removed two paragraphs starting with the opening paragraph. No other changes.');
});

test('a full replacement gives the new paragraph count without claiming the request was followed', () => {
  assert.equal(summary(draft(['Original draft.']), draft(['One.', 'Two.', 'Three.', 'Four.', 'Five.']), 'Shorten the introduction'), 'Replaced the draft body with 5 paragraphs. No other changes.');
});

test('single and double cached line breaks and equivalent Quill runs are not edits', () => {
  const before = draft(['One paragraph.', 'Another paragraph.']);
  const after = { ...before, draftText: 'One paragraph.\nAnother paragraph.', document: { ops: [{ insert: 'One paragraph.\nAnother paragraph.\n' }] } };
  assert.equal(summary(before, after), 'No other changes.');
  const bold = draft(['A bold sentence.'], { document: { ops: [{ insert: 'A bold sentence.', attributes: { bold: true, italic: true } }, { insert: '\n' }] } });
  const regrouped = { ...bold, document: { ops: [{ insert: 'A bold ', attributes: { italic: true, bold: true } }, { insert: 'sentence.', attributes: { bold: true, italic: true } }, { insert: '' }, { insert: '\n', attributes: { bold: false } }] } };
  assert.equal(summary(bold, regrouped), 'No other changes.');
});

test('list summaries use Quill evidence even when the request describes another action', () => {
  const before = draft(['First item.', 'Second item.']);
  const list = type => ({ ...before, document: { ops: [{ insert: 'First item.' }, { insert: '\n', attributes: { list: type } }, { insert: 'Second item.' }, { insert: '\n', attributes: { list: type } }] } });
  assert.equal(summary(before, list('bullet'), 'Make the headline shorter'), 'Added bulleted list formatting. No other changes.');
  assert.equal(summary(list('bullet'), list('ordered')), 'Changed a bulleted list to a numbered list. No other changes.');
  assert.equal(summary(list('ordered'), list('bullet')), 'Changed a numbered list to a bulleted list. No other changes.');
  assert.equal(summary(list('bullet'), before), 'Removed list formatting. No other changes.');
});

test('heading, bold, and other formatting changes are supported by saved attributes', () => {
  const before = draft(['The library reopens.']);
  const heading = { ...before, document: { ops: [{ insert: 'The library reopens.' }, { insert: '\n', attributes: { header: 2 } }] } };
  const bold = { ...before, document: { ops: [{ insert: 'The library reopens.', attributes: { bold: true } }, { insert: '\n' }] } };
  const linked = { ...before, document: { ops: [{ insert: 'The library reopens.', attributes: { link: 'https://example.com/library' } }, { insert: '\n' }] } };
  assert.equal(summary(before, heading), 'Applied heading formatting. No other changes.');
  assert.equal(summary(heading, before), 'Removed heading formatting. No other changes.');
  assert.equal(summary(before, bold), 'Applied bold formatting. No other changes.');
  assert.equal(summary(bold, before), 'Removed bold formatting. No other changes.');
  assert.equal(summary(before, linked), 'Updated other draft formatting. No other changes.');
});

test('text changes do not hide separately observed formatting, title, or share-text changes', () => {
  const before = draft(['Old opening.', 'Keep the closing.']);
  const after = draft(['New opening.', 'Keep the closing.'], { title: 'New title', shareText: 'New share text', document: { ops: [{ insert: 'New opening.', attributes: { bold: true } }, { insert: '\nKeep the closing.\n' }] } });
  assert.equal(summary(before, after), 'Rewrote the opening paragraph. Applied bold formatting. Updated the title. Updated the share text. No other changes.');
  assert.equal(summary(before, { ...before, title: 'New title' }), 'Updated the title. No other changes.');
  assert.equal(summary(before, { ...before, shareText: 'New share text' }), 'Updated the share text. No other changes.');
});

test('whitespace edits are described without claiming a rewrite and unchanged drafts stay unchanged', () => {
  const before = draft(['The library reopens.']);
  const after = draft(['The  library reopens.']);
  assert.equal(summary(before, after), 'Adjusted spacing in the draft. No other changes.');
  assert.equal(summary(before, structuredClone(before), 'Shorten every paragraph'), 'No other changes.');
});

test('the exact elephant refusal remains independent of the body-diff summarizer', () => {
  const before = draft(['Keep this body.'], { title: '  The town library?  ' });
  const refusal = 'Could not add a mention of an elephant. No elephant appears in the source material, and inserting one would introduce a fabricated, irrelevant and inappropriate detail into a factual news report about The town library?';
  for (const instruction of ['Add an elephant', 'Mention ELEPHANTS']) assert.equal(summary(before, before, instruction), refusal);
  assert.equal(mentionsElephant('an elephantine introduction'), false);
  assert.equal(summary(before, before, 'an elephantine introduction'), 'No other changes.');
});


test('rendered document edits take precedence over a stale plain-text cache', () => {
  const before = draft(['Old text.']);
  const after = { ...before, document: { ops: [{ insert: 'New text.\n' }] } };
  assert.equal(summary(before, after), 'Replaced the draft body with 1 paragraph. No other changes.');
  assert.equal(summary(before, { ...before, document: { ops: [{ insert: 'Old text.' }] } }), 'No other changes.');
});

test('a body rewrite does not hide partial formatting removal', () => {
  const before = draft(['First paragraph.', 'Second paragraph.'], { document: { ops: [{ insert: 'First paragraph.', attributes: { bold: true } }, { insert: '\n' }, { insert: 'Second paragraph.', attributes: { bold: true } }, { insert: '\n' }] } });
  const after = draft(['Revised first paragraph.', 'Second paragraph.'], { document: { ops: [{ insert: 'Revised first paragraph.\n' }, { insert: 'Second paragraph.', attributes: { bold: true } }, { insert: '\n' }] } });
  assert.equal(summary(before, after), 'Expanded the opening paragraph from 2 to 3 words. Changed bold formatting. No other changes.');
});

test('structured heading and list blocks are not misreported as paragraphs', () => {
  for (const attributes of [{ header: 2 }, { list: 'bullet' }]) {
    const before = draft(['Opening.', 'A heading.', 'Details.'], { document: { ops: [{ insert: 'Opening.\nA heading.' }, { insert: '\n', attributes }, { insert: 'Details.\n' }] } });
    const after = draft(['New opening.', 'A heading.', 'Details.'], { document: { ops: [{ insert: 'New opening.\nA heading.' }, { insert: '\n', attributes }, { insert: 'Details.\n' }] } });
    assert.equal(summary(before, after), 'Reworked the draft body. No other changes.');
  }
});
