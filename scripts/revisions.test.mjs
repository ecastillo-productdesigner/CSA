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
  assert.deepEqual(output.revisionRequests, [{ instructions: 'Shorten the intro', requestedAt: 10, completedAt: 20, status: 'complete' }]);
  assert.equal(output.updatedAt, 20);
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
