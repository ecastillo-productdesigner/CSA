import test from 'node:test';
import assert from 'node:assert/strict';
import { reviseSampleOutput, variantPanelState } from '../dist/outputs.js';

const variant = () => ({ id: 'draft', title: 'Keep my title', shareText: 'Keep this draft’s share text.', status: 'ready', draftText: 'Original draft.', document: { ops: [{ insert: 'Original draft.\n' }] }, labels: [{ key: 'format', label: 'What to Know' }], name: 'My saved variant', nameEdited: true, isFavorite: true, createdAt: 1, selectedSourceIndexes: [1], sourceSnapshots: [{ title: 'Approved source' }], metadata: { author: 'Julia' } });

test('unsupported revision preserves all content and reports the unapplied request', () => {
  const output = variant();
  const before = structuredClone(output);
  reviseSampleOutput(output, 'Shorten the intro', 10, 20);
  assert.equal(output.draftText, before.draftText);
  assert.equal(output.document.ops.map(op => op.insert).join('').replace(/\s+/g, ' ').trim(), output.draftText.replace(/\s+/g, ' ').trim());
  for (const key of ['id', 'title', 'shareText', 'name', 'nameEdited', 'isFavorite', 'createdAt', 'labels', 'selectedSourceIndexes', 'sourceSnapshots', 'metadata']) assert.deepEqual(output[key], before[key]);
  assert.deepEqual(output.revisionRequests, [{ instructions: 'Shorten the intro', changeSummary: 'Could not apply “Shorten the intro”; left all content unchanged.', requestedAt: 10, completedAt: 20, status: 'complete' }]);
  assert.equal(output.updatedAt, 20);
  assert.equal(output.revisionUnread, true);
  assert.equal(output.revisionRequestUnread, true);
  assert.deepEqual(variantPanelState({ outputs: [output] }).outputs, [output]);
});

test('unsupported revisions retain content and record each request in history', () => {
  const output = variant();
  reviseSampleOutput(output, 'First request', 10, 20);
  const previousText = output.draftText;
  reviseSampleOutput(output, 'Another request', 30, 40);
  assert.equal(output.draftText, previousText);
  assert.equal(output.revisionRequests.length, 2);
  assert.equal(output.revisionRequests[1].instructions, 'Another request');
});

test('a revised sent draft becomes a ready draft that can be sent again', () => {
  const output = { ...variant(), cmsSentAt: 5, cmsSentContent: 'Previously sent', needsRegeneration: true };
  reviseSampleOutput(output, 'Add bullet points to first paragraph', 10, 20);
  assert.equal(output.status, 'ready');
  assert.equal(output.cmsSentAt, undefined);
  assert.equal(output.cmsSentContent, undefined);
  assert.equal(output.needsRegeneration, undefined);
  assert.equal(output.contentVersion, 3);
});

const elephantExplanation = 'Could not add a mention of an elephant. No elephant appears in the source material, and inserting one would introduce a fabricated, irrelevant and inappropriate detail into a factual news report about ';

test('elephant requests retain the exact article, settings, and sent state while recording the outcome', () => {
  for (const instructions of ['Add an elephant', 'Add an ELEPHANT.', 'Mention elephants in the opening']) {
    const output = {
      ...variant(),
      status: 'sent',
      title: '  A café’s new story  ',
      shareText: '',
      shareTextEdited: true,
      draftText: 'An editor’s exact opening.\n\nKeep the closing.  ',
      document: { ops: [{ insert: 'An editor’s exact opening.', attributes: { bold: true, link: 'https://example.com/source' } }, { insert: '\n', attributes: { header: 2 } }, { insert: 'Keep the closing.  \n' }] },
      toolPreferences: { format: 'listicle', audience: 'general', voice: 'womans-world' },
      editorialDirection: 'Preserve the factual account.',
      targetWordCount: 'medium',
      cmsSentAt: 5,
      cmsSentContent: 'Exact previously sent content',
      needsRegeneration: true,
      contentInitialized: true,
      contentVersion: 3,
      revisionRequests: [{ instructions: 'A previous request', changeSummary: 'No other changes.', requestedAt: 1, completedAt: 2, status: 'complete' }],
    };
    const before = structuredClone(output);
    const bodyBytes = JSON.stringify([output.draftText, output.document, output.shareText]);
    reviseSampleOutput(output, instructions, 10, 20);
    assert.equal(JSON.stringify([output.draftText, output.document, output.shareText]), bodyBytes);
    const { updatedAt, revisionUnread, revisionRequestUnread, revisionRequests, ...unchanged } = output;
    const { revisionRequests: previousRequests, ...original } = before;
    assert.deepEqual(unchanged, original);
    assert.equal(updatedAt, 20);
    assert.equal(revisionUnread, true);
    assert.equal(revisionRequestUnread, true);
    assert.deepEqual(revisionRequests, [...previousRequests, {
      instructions, changeSummary: elephantExplanation + 'A café’s new story.', requestedAt: 10, completedAt: 20, status: 'complete',
    }]);
    output.title = 'A later edited headline';
    assert.equal(output.revisionRequests.at(-1).changeSummary, elephantExplanation + 'A café’s new story.');
  }
});

test('elephant outcomes preserve title wording and add only a missing final punctuation mark', () => {
  for (const [title, ending] of [
    ['  A quoted “local” story  ', 'A quoted “local” story.'],
    ['A local story.', 'A local story.'],
    ['What changed?', 'What changed?'],
    ['A new beginning!', 'A new beginning!'],
  ]) {
    const output = { ...variant(), title };
    const instructions = '  Please mention an elephant.\nKeep the rest intact.  ';
    reviseSampleOutput(output, instructions, 10, 20);
    assert.equal(output.revisionRequests[0].changeSummary, elephantExplanation + ending);
    assert.equal(output.revisionRequests[0].instructions, instructions);
    assert.equal(output.title, title);
  }
});

test('elephantine does not trigger the elephant refusal', () => {
  const output = variant();
  const before = output.draftText;
  reviseSampleOutput(output, 'Reduce the elephantine introduction', 10, 20);
  assert.equal(output.draftText, before);
  assert.equal(output.revisionRequests[0].changeSummary, 'Could not apply “Reduce the elephantine introduction”; left all content unchanged.');
});

test('unsupported revisions never initialize or change the share text', () => {
  const output = variant();
  delete output.shareText;
  reviseSampleOutput(output, 'Revise the opening', 10, 20);
  assert.equal(output.shareText, undefined);
  assert.equal(output.revisionRequests[0].changeSummary, 'Could not apply “Revise the opening”; left all content unchanged.');
});


test('paragraph-to-list revision performs only the requested edit and stores its observed outcome', () => {
  const output = {
    ...variant(), status: 'sent', cmsSentAt: 5, cmsSentContent: 'Previous body', needsRegeneration: true,
    draftText: 'Opening.\n\nFirst fact. Second fact.\n\nClosing.',
    document: { ops: [{ insert: 'Opening.\nFirst fact. Second fact.\nClosing.\n' }] },
  };
  const before = structuredClone(output);
  reviseSampleOutput(output, 'Convert the second paragraph into a short bulleted list.', 10, 20);
  assert.equal(output.document.ops.map(op => op.insert).join(''), 'Opening.\nFirst fact.\nSecond fact.\nClosing.\n');
  assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 2);
  for (const key of ['id', 'title', 'shareText', 'name', 'nameEdited', 'isFavorite', 'createdAt', 'labels', 'selectedSourceIndexes', 'sourceSnapshots', 'metadata']) assert.deepEqual(output[key], before[key]);
  assert.equal(output.status, 'ready');
  assert.equal(output.cmsSentAt, undefined);
  assert.equal(output.cmsSentContent, undefined);
  assert.equal(output.needsRegeneration, undefined);
  assert.equal(output.revisionRequests.at(-1).changeSummary, 'Converted the second paragraph into a bulleted list with two items; left all other content unchanged.');
  assert.equal(output.revisionRequests.at(-1).instructions, 'Convert the second paragraph into a short bulleted list.');
});

test('a recognized paragraph-list no-op preserves the article, share text and sent state', () => {
  for (const instructions of ['Convert the second paragraph into bullet points.', 'Do not add bullets to the first paragraph.']) {
    const output = { ...variant(), status: 'sent', cmsSentAt: 5, cmsSentContent: 'Previous body', needsRegeneration: true };
    delete output.shareText;
    const before = structuredClone(output);
    reviseSampleOutput(output, instructions, 10, 20);
    const { updatedAt, revisionUnread, revisionRequestUnread, revisionRequests, ...untouched } = output;
    assert.deepEqual(untouched, before);
    assert.match(revisionRequests.at(-1).changeSummary, /; left all content unchanged\.$/);
    assert.equal(updatedAt, 20);
    assert.equal(revisionUnread, true);
    assert.equal(revisionRequestUnread, true);
  }
});

test('elephant refusal takes priority over a paragraph-list conversion request', () => {
  const output = { ...variant(), draftText: 'Opening.\n\nTwo facts. Another fact.', document: { ops: [{ insert: 'Opening.\nTwo facts. Another fact.\n' }] } };
  const before = structuredClone(output.document);
  reviseSampleOutput(output, 'Convert the second paragraph into bullets and add an elephant.', 10, 20);
  assert.deepEqual(output.document, before);
  assert.equal(output.revisionRequests.at(-1).changeSummary, elephantExplanation + 'Keep my title.');
});


test('the exact first-paragraph bullet request records its edit instead of rewriting the draft', () => {
  const output = { ...variant(), draftText: 'First fact. Second fact.\n\nKeep the second paragraph.\n\nKeep the ending.', document: { ops: [{ insert: 'First fact. Second fact.\nKeep the second paragraph.\nKeep the ending.\n' }] } };
  const request = 'add bullet points to first paragraph';
  reviseSampleOutput(output, request, 10, 20);
  assert.equal(output.document.ops.map(op => op.insert).join(''), 'First fact.\nSecond fact.\nKeep the second paragraph.\nKeep the ending.\n');
  assert.equal(output.document.ops.filter(op => op.attributes?.list === 'bullet').length, 2);
  assert.equal(output.revisionRequests.length, 1);
  assert.equal(output.revisionRequests[0].instructions, request);
  assert.equal(output.revisionRequests[0].changeSummary, 'Converted the opening paragraph into a bulleted list with two items; left all other content unchanged.');
  assert.deepEqual(JSON.parse(JSON.stringify(output)).revisionRequests, output.revisionRequests, 'the exact note survives saved project serialization');
});
