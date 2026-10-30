import test from 'node:test';
import assert from 'node:assert/strict';
import { mentionsElephant, revisionChangeSummary } from '../dist/revision-change-summary.js';
import { applyParagraphListRevision } from '../dist/paragraph-list-revision.js';

const draft = (paragraphs, extra = {}) => ({ title: 'The town library', draftText: paragraphs.join('\n\n'), document: { ops: paragraphs.map(text => ({ insert: `${text}\n` })) }, shareText: 'Library news', ...extra });
const summary = (before, after, instructions = 'Make the story funny') => revisionChangeSummary(before, after, instructions);

// The request is deliberately unrelated to the observed edits in these examples.
test('a paragraph split names its location and exact new paragraph opening', () => {
  const before = draft(['The library will reopen Monday. The council approved the repairs.', 'Opening hours remain the same.']);
  const after = draft(['The library will reopen Monday.', 'The council approved the repairs.', 'Opening hours remain the same.']);
  const saved = structuredClone([before, after]);
  assert.equal(summary(before, after, 'Change the title'), 'Split the opening paragraph into two, breaking before “The council approved the repairs”; left all other content unchanged.');
  assert.deepEqual([before, after], saved);
  assert.equal(summary(after, before), 'Merged two paragraphs starting with the opening paragraph; left all other content unchanged.');
});

test('localized rewrites and word-count changes name the paragraph actually changed', () => {
  const before = draft(['The library opens Monday.', 'The old hall closed.', 'Readers can register online.']);
  assert.equal(summary(before, draft(['The library opens Monday.', 'The new hall opened.', 'Readers can register online.'])), 'Rewrote the second paragraph; left all other content unchanged.');
  assert.equal(summary(before, draft(['The library opens Monday.', 'The hall closed.', 'Readers can register online.'])), 'Shortened the second paragraph from 4 to 3 words; left all other content unchanged.');
  assert.equal(summary(before, draft(['The library opens Monday.', 'The old hall closed last Friday.', 'Readers can register online.'])), 'Expanded the second paragraph from 4 to 6 words; left all other content unchanged.');
  assert.equal(summary(before, draft(['The library opens.', 'The old hall closed.', 'Readers can register online.'])), 'Shortened the opening paragraph from 4 to 3 words; left all other content unchanged.');
});

test('reordering distinguishes retained paragraphs from a rewritten opening', () => {
  const before = draft(['Opening.', 'Second.', 'Third.', 'Fourth.', 'Fifth.']);
  assert.equal(summary(before, draft(['Opening.', 'Third.', 'Second.', 'Fourth.', 'Fifth.'])), 'Reordered two paragraphs; left all other content unchanged.');
  assert.equal(summary(before, draft(['A different opening.', 'Third.', 'Second.', 'Fifth.', 'Fourth.'])), 'Rewrote the opening paragraph and reordered the remaining paragraphs; left all other content unchanged.');
  assert.equal(summary(draft(['Same.', 'Same.', 'Other.']), draft(['Same.', 'Other.', 'Same.'])), 'Reordered the paragraphs; left all other content unchanged.');
  assert.equal(summary(before, draft(['New opening.', 'Third.', 'Second.', 'New conclusion.'])), 'Replaced the passage beginning “Opening” with four paragraphs beginning “New opening”; left all other content unchanged.');
});

test('paragraph additions and removals report reliable positions or counts', () => {
  const before = draft(['Opening.', 'Closing.']);
  const after = draft(['Opening.', 'New details.', 'Closing.']);
  assert.equal(summary(before, after), 'Added one paragraph after the opening paragraph; left all other content unchanged.');
  assert.equal(summary(after, before), 'Removed the second paragraph; left all other content unchanged.');
  const scattered = draft(['New opening.', 'Opening.', 'Another addition.', 'Closing.']);
  assert.equal(summary(before, scattered), 'Added two paragraphs; left all other content unchanged.');
  assert.equal(summary(scattered, before), 'Removed two paragraphs; left all other content unchanged.');
  assert.equal(summary(draft([]), before), 'Added two paragraphs at the beginning; left all other content unchanged.');
  assert.equal(summary(before, draft([])), 'Removed two paragraphs starting with the opening paragraph; left all other content unchanged.');
});

test('a full replacement gives the new paragraph count without claiming the request was followed', () => {
  assert.equal(summary(draft(['Original draft.']), draft(['One.', 'Two.', 'Three.', 'Four.', 'Five.']), 'Shorten the introduction'), 'Replaced the draft body with 5 paragraphs; left all other content unchanged.');
});

test('single and double cached line breaks and equivalent Quill runs are not edits', () => {
  const before = draft(['One paragraph.', 'Another paragraph.']);
  const after = { ...before, draftText: 'One paragraph.\nAnother paragraph.', document: { ops: [{ insert: 'One paragraph.\nAnother paragraph.\n' }] } };
  assert.equal(summary(before, after), 'Left all content unchanged.');
  const bold = draft(['A bold sentence.'], { document: { ops: [{ insert: 'A bold sentence.', attributes: { bold: true, italic: true } }, { insert: '\n' }] } });
  const regrouped = { ...bold, document: { ops: [{ insert: 'A bold ', attributes: { italic: true, bold: true } }, { insert: 'sentence.', attributes: { bold: true, italic: true } }, { insert: '' }, { insert: '\n', attributes: { bold: false } }] } };
  assert.equal(summary(bold, regrouped), 'Left all content unchanged.');
});

test('list summaries use Quill evidence even when the request describes another action', () => {
  const before = draft(['First item.', 'Second item.']);
  const list = type => ({ ...before, document: { ops: [{ insert: 'First item.' }, { insert: '\n', attributes: { list: type } }, { insert: 'Second item.' }, { insert: '\n', attributes: { list: type } }] } });
  assert.equal(summary(before, list('bullet'), 'Make the headline shorter'), 'Added bulleted list formatting; left all other content unchanged.');
  assert.equal(summary(list('bullet'), list('ordered')), 'Changed a bulleted list to a numbered list; left all other content unchanged.');
  assert.equal(summary(list('ordered'), list('bullet')), 'Changed a numbered list to a bulleted list; left all other content unchanged.');
  assert.equal(summary(list('bullet'), before), 'Removed list formatting; left all other content unchanged.');
});

test('heading, bold, and other formatting changes are supported by saved attributes', () => {
  const before = draft(['The library reopens.']);
  const heading = { ...before, document: { ops: [{ insert: 'The library reopens.' }, { insert: '\n', attributes: { header: 2 } }] } };
  const bold = { ...before, document: { ops: [{ insert: 'The library reopens.', attributes: { bold: true } }, { insert: '\n' }] } };
  const linked = { ...before, document: { ops: [{ insert: 'The library reopens.', attributes: { link: 'https://example.com/library' } }, { insert: '\n' }] } };
  assert.equal(summary(before, heading), 'Applied heading formatting; left all other content unchanged.');
  assert.equal(summary(heading, before), 'Removed heading formatting; left all other content unchanged.');
  assert.equal(summary(before, bold), 'Applied bold formatting; left all other content unchanged.');
  assert.equal(summary(bold, before), 'Removed bold formatting; left all other content unchanged.');
  assert.equal(summary(before, linked), 'Updated other draft formatting; left all other content unchanged.');
});

test('text changes do not hide separately observed formatting, title, or share-text changes', () => {
  const before = draft(['Old opening.', 'Keep the closing.']);
  const after = draft(['New opening.', 'Keep the closing.'], { title: 'New title', shareText: 'New share text', document: { ops: [{ insert: 'New opening.', attributes: { bold: true } }, { insert: '\nKeep the closing.\n' }] } });
  assert.equal(summary(before, after), 'Rewrote the opening paragraph. Applied bold formatting. Updated the title. Updated the share text; left all other content unchanged.');
  assert.equal(summary(before, { ...before, title: 'New title' }), 'Updated the title; left all other content unchanged.');
  assert.equal(summary(before, { ...before, shareText: 'New share text' }), 'Updated the share text; left all other content unchanged.');
});

test('whitespace edits are described without claiming a rewrite and unchanged drafts stay unchanged', () => {
  const before = draft(['The library reopens.']);
  const after = draft(['The  library reopens.']);
  assert.equal(summary(before, after), 'Adjusted spacing in the draft; left all other content unchanged.');
  assert.equal(summary(before, structuredClone(before), 'Shorten every paragraph'), 'Left all content unchanged.');
});

test('the exact elephant refusal remains independent of the body-diff summarizer', () => {
  const before = draft(['Keep this body.'], { title: '  The town library?  ' });
  const refusal = 'Could not add a mention of an elephant. No elephant appears in the source material, and inserting one would introduce a fabricated, irrelevant and inappropriate detail into a factual news report about The town library?';
  for (const instruction of ['Add an elephant', 'Mention ELEPHANTS']) assert.equal(summary(before, before, instruction), refusal);
  assert.equal(mentionsElephant('an elephantine introduction'), false);
  assert.equal(summary(before, before, 'an elephantine introduction'), 'Left all content unchanged.');
});


test('rendered document edits take precedence over a stale plain-text cache', () => {
  const before = draft(['Old text.']);
  const after = { ...before, document: { ops: [{ insert: 'New text.\n' }] } };
  assert.equal(summary(before, after), 'Replaced the draft body with 1 paragraph; left all other content unchanged.');
  assert.equal(summary(before, { ...before, document: { ops: [{ insert: 'Old text.' }] } }), 'Left all content unchanged.');
});

test('a body rewrite does not hide partial formatting removal', () => {
  const before = draft(['First paragraph.', 'Second paragraph.'], { document: { ops: [{ insert: 'First paragraph.', attributes: { bold: true } }, { insert: '\n' }, { insert: 'Second paragraph.', attributes: { bold: true } }, { insert: '\n' }] } });
  const after = draft(['Revised first paragraph.', 'Second paragraph.'], { document: { ops: [{ insert: 'Revised first paragraph.\n' }, { insert: 'Second paragraph.', attributes: { bold: true } }, { insert: '\n' }] } });
  assert.equal(summary(before, after), 'Expanded the opening paragraph from 2 to 3 words. Changed bold formatting; left all other content unchanged.');
});

test('structured heading and list blocks are not misreported as paragraphs', () => {
  for (const attributes of [{ header: 2 }, { list: 'bullet' }]) {
    const before = draft(['Opening.', 'A heading.', 'Details.'], { document: { ops: [{ insert: 'Opening.\nA heading.' }, { insert: '\n', attributes }, { insert: 'Details.\n' }] } });
    const after = draft(['New opening.', 'A heading.', 'Details.'], { document: { ops: [{ insert: 'New opening.\nA heading.' }, { insert: '\n', attributes }, { insert: 'Details.\n' }] } });
    assert.equal(summary(before, after), 'Expanded the opening paragraph from 1 to 2 words; left all other content unchanged.');
  }
});


test('a paragraph-to-list conversion reports the paragraph, list type and observed item count', () => {
  const before = draft(['Keep the opening.', 'The doors open at nine. Visitors can bring a guest.', 'Keep the ending.']);
  for (const [type, label] of [['bullet', 'bulleted'], ['ordered', 'numbered']]) {
    const after = { ...before, document: { ops: [
      { insert: 'Keep the opening.\nThe doors open at nine.' }, { insert: '\n', attributes: { list: type } },
      { insert: 'Visitors can bring a guest.' }, { insert: '\n', attributes: { list: type } },
      { insert: 'Keep the ending.\n' },
    ] } };
    assert.equal(summary(before, after, 'Change the headline'), `Converted the second paragraph into a ${label} list with two items; left all other content unchanged.`);
  }
});

test('conversion summaries preserve paragraph locations around headings and existing list groups', () => {
  const before = draft([], { document: { ops: [
    { insert: 'A heading' }, { insert: '\n', attributes: { header: 2 } },
    { insert: 'Existing item.' }, { insert: '\n', attributes: { list: 'bullet' } },
    { insert: 'Another item.' }, { insert: '\n', attributes: { list: 'bullet' } },
    { insert: 'First fact. Second fact.\nClosing.\n' },
  ] } });
  const after = { ...before, document: { ops: [
    ...before.document.ops.slice(0, -1),
    { insert: 'First fact.' }, { insert: '\n', attributes: { list: 'ordered' } },
    { insert: 'Second fact.' }, { insert: '\n', attributes: { list: 'ordered' } },
    { insert: 'Closing.\n' },
  ] } };
  assert.equal(summary(before, after), 'Converted the second paragraph into a numbered list with two items; left all other content unchanged.');
});

test('splitting a formatted paragraph into list items does not invent inline-formatting changes', () => {
  const before = draft([], { document: { ops: [
    { insert: 'Opening.\nFirst fact. ', attributes: { bold: true } },
    { insert: 'Second fact.', attributes: { italic: true, link: 'https://example.com/fact' } },
    { insert: '\nClosing.\n' },
  ] } });
  const after = { ...before, document: { ops: [
    { insert: 'Opening.\nFirst fact.', attributes: { bold: true } }, { insert: '\n', attributes: { list: 'bullet' } },
    { insert: 'Second fact.', attributes: { italic: true, link: 'https://example.com/fact' } }, { insert: '\n', attributes: { list: 'bullet' } },
    { insert: 'Closing.\n' },
  ] } };
  assert.equal(summary(before, after), 'Converted the second paragraph into a bulleted list with two items; left all other content unchanged.');
});


test('paragraph conversion does not claim preserved headings or block attributes changed', () => {
  const cases = [
    { ops: [
      { insert: 'Opening.\nFirst fact. Second fact.\nSubheading' },
      { insert: '\n', attributes: { header: 2 } }, { insert: 'Ending.\n' },
    ] },
    { ops: [
      { insert: 'Opening.\nFirst fact. Second fact.' },
      { insert: '\n', attributes: { align: 'center', direction: 'rtl', indent: 1 } },
      { insert: 'Ending.\n' },
    ] },
  ];
  for (const document of cases) {
    const after = { document }, before = structuredClone(after);
    assert.equal(applyParagraphListRevision(after, 'Convert the second paragraph into bullets.').changed, true);
    assert.equal(summary(before, after), 'Converted the second paragraph into a bulleted list with two items; left all other content unchanged.');
  }
});

test('conversion summaries share logical paragraph numbering across list types, list breaks, and code blocks', () => {
  const cases = [
    ['third', [
      { insert: 'One' }, { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'Two' }, { insert: '\n', attributes: { list: 'ordered' } },
      { insert: 'First fact. Second fact.\n' },
    ]],
    ['third', [
      { insert: 'One' }, { insert: '\n', attributes: { list: 'bullet' } },
      { insert: '\nTwo' }, { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'First fact. Second fact.\n' },
    ]],
    ['second', [
      { insert: 'let foo = 1;' }, { insert: '\n', attributes: { 'code-block': true } },
      { insert: 'Opening.\nFirst fact. Second fact.\n' },
    ]],
  ];
  for (const [position, ops] of cases) {
    const after = { document: { ops } }, before = structuredClone(after);
    assert.equal(applyParagraphListRevision(after, `Convert the ${position} paragraph into bullets.`).changed, true);
    assert.equal(summary(before, after), `Converted the ${position} paragraph into a bulleted list with two items; left all other content unchanged.`);
  }
});

test('legacy plain-text conversion summaries describe the existing paragraph rather than inventing added content', () => {
  for (const ending of ['', '\n']) {
    const after = { draftText: `Opening.\n\nFirst fact. Second fact.\n\nEnding.${ending}` };
    const before = structuredClone(after);
    assert.equal(applyParagraphListRevision(after, 'Convert the second paragraph into bullets.').changed, true);
    assert.equal(summary(before, after), 'Converted the second paragraph into a bulleted list with two items; left all other content unchanged.');
  }
});
