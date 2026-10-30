import test from 'node:test';
import assert from 'node:assert/strict';
import { reviseSampleOutput, variantPanelState } from '../dist/outputs.js';

const variant = () => ({ id: 'draft', title: 'Keep my title', shareText: 'Keep this draft’s share text.', status: 'ready', draftText: 'Original draft.', document: { ops: [{ insert: 'Original draft.\n' }] }, labels: [{ key: 'format', label: 'What to Know' }], name: 'My saved variant', nameEdited: true, isFavorite: true, createdAt: 1, selectedSourceIndexes: [1], sourceSnapshots: [{ title: 'Approved source' }], metadata: { author: 'Julia' } });

test('demo revision replaces the body while preserving the variant identity and settings', () => {
  const output = variant();
  const before = structuredClone(output);
  reviseSampleOutput(output, 'Shorten the intro', 10, 20);
  assert.notEqual(output.draftText, before.draftText);
  assert.equal(output.document.ops.map(op => op.insert).join('').replace(/\s+/g, ' ').trim(), output.draftText.replace(/\s+/g, ' ').trim());
  for (const key of ['id', 'title', 'shareText', 'name', 'nameEdited', 'isFavorite', 'createdAt', 'labels', 'selectedSourceIndexes', 'sourceSnapshots', 'metadata']) assert.deepEqual(output[key], before[key]);
  assert.deepEqual(output.revisionRequests, [{ instructions: 'Shorten the intro', changeSummary: 'Replaced the draft body with 7 paragraphs. No other changes.', requestedAt: 10, completedAt: 20, status: 'complete' }]);
  assert.equal(output.updatedAt, 20);
  assert.equal(output.revisionUnread, true);
  assert.equal(output.revisionRequestUnread, true);
  assert.deepEqual(variantPanelState({ outputs: [output] }).outputs, [output]);
});

test('another revision always uses different sample text and retains request history', () => {
  const output = variant();
  reviseSampleOutput(output, 'First request', 10, 20);
  const previousText = output.draftText;
  reviseSampleOutput(output, 'Another request', 30, 40);
  assert.notEqual(output.draftText, previousText);
  assert.equal(output.revisionRequests.length, 2);
  assert.equal(output.revisionRequests[1].instructions, 'Another request');
});

test('a revised sent draft becomes a ready draft that can be sent again', () => {
  const output = { ...variant(), cmsSentAt: 5, cmsSentContent: 'Previously sent', needsRegeneration: true };
  reviseSampleOutput(output, 'Revise', 10, 20);
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
  assert.notEqual(output.draftText, before);
  assert.equal(output.revisionRequests[0].changeSummary, 'Replaced the draft body with 7 paragraphs. No other changes.');
});

test('revision summaries include a newly initialized share text instead of claiming only the body changed', () => {
  const output = variant();
  delete output.shareText;
  reviseSampleOutput(output, 'Revise the opening', 10, 20);
  assert.ok(output.shareText.trim());
  assert.equal(output.revisionRequests[0].changeSummary, 'Replaced the draft body with 7 paragraphs. Updated the share text. No other changes.');
});
