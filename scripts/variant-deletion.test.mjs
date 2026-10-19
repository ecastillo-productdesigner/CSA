import test from 'node:test';
import assert from 'node:assert/strict';
import { removeVariant, restoreVariant } from '../dist/variant-deletion.js';

const variant = (id, status = 'ready') => ({ id, title: id, status, draftText: 'Saved ' + id, document: { ops: [{ insert: 'Saved ' + id }] }, sourceSnapshots: [{ title: 'Original source' }] });
const project = outputs => ({ id: 'story', title: 'Story', outputs, sources: [{ title: 'Source' }], selectedOutputId: outputs[0]?.id, selectedOutputIds: outputs[0] ? [outputs[0].id] : [], viewOriginalDraft: false });
const persist = () => {};

test('deleting an active draft selects its neighbor and leaves original material intact', () => {
  const record = project([variant('first'), variant('second'), variant('third')]);
  const original = structuredClone(record);
  const result = removeVariant([record], 'story', 'first', persist);
  assert.deepEqual(result.projects[0].outputs.map(output => output.id), ['second', 'third']);
  assert.equal(result.projects[0].selectedOutputId, 'second');
  assert.deepEqual(result.projects[0].sources, original.sources);
  assert.deepEqual(record, original);
});

test('deleting the last variant returns to the original content and undo restores sent data', () => {
  const sent = { ...variant('only'), cmsSentAt: 5, cmsSentContent: 'Sent snapshot' };
  const record = { ...project([sent]), draftText: 'Original draft' };
  const result = removeVariant([record], 'story', 'only', persist);
  assert.deepEqual(result.projects[0].outputs, []);
  assert.equal(result.projects[0].selectedOutputId, null);
  assert.equal(result.projects[0].viewOriginalDraft, true);
  assert.equal(result.projects[0].draftText, 'Original draft');
  const restored = restoreVariant(result.projects, result.undo, persist).projects[0];
  assert.deepEqual(restored.outputs, [sent]);
  assert.equal(restored.selectedOutputId, 'only');
});

test('deleting a selected pending variant preserves other pending choices and clears legacy IDs', () => {
  const record = { ...project([variant('one', 'pending'), variant('two', 'pending')]), selectedOutputId: null, selectedOutputIds: ['one', 'two'], selectedPendingOutputIds: ['one', 'two'], lastPendingOutputId: 'one', viewOriginalDraft: true };
  const next = removeVariant([record], 'story', 'one', persist).projects[0];
  assert.deepEqual(next.selectedOutputIds, ['two']);
  assert.deepEqual(next.selectedPendingOutputIds, ['two']);
  assert.equal(next.lastPendingOutputId, 'two');
  assert.equal(next.viewOriginalDraft, true);
});

test('deleting another variant preserves the active draft; undo preserves later edits and choices', () => {
  const record = project([variant('active'), variant('removed'), variant('other')]);
  const result = removeVariant([record], 'story', 'removed', persist);
  result.projects[0].outputs[0].draftText = 'Edited after deletion';
  result.projects[0].selectedOutputId = 'other';
  result.projects[0].selectedOutputIds = ['other'];
  const restored = restoreVariant(result.projects, result.undo, persist).projects[0];
  assert.equal(restored.selectedOutputId, 'other');
  assert.equal(restored.outputs[0].draftText, 'Edited after deletion');
  assert.deepEqual(restored.outputs.map(output => output.id), ['active', 'removed', 'other']);
});

test('saved preset references are cleared and restored without replacing a newer preset', () => {
  const record = project([{ ...variant('saved'), isFavorite: true }]);
  const reference = { id: 'reference', variantPreset: { projectId: 'story', outputId: 'saved' } };
  const result = removeVariant([record, reference], 'story', 'saved', persist);
  assert.equal(result.projects[1].variantPreset, undefined);
  const restored = restoreVariant(result.projects, result.undo, persist);
  assert.deepEqual(restored.projects[1].variantPreset, reference.variantPreset);
  result.projects[1].variantPreset = { projectId: 'another', outputId: 'new' };
  assert.deepEqual(restoreVariant(result.projects, result.undo, persist).projects[1].variantPreset, { projectId: 'another', outputId: 'new' });
});

test('failed persistence does not mutate records during deletion or undo', () => {
  const records = [project([variant('one'), variant('two')])];
  const original = structuredClone(records);
  const fail = () => { throw new Error('Storage full'); };
  assert.throws(() => removeVariant(records, 'story', 'one', fail));
  assert.deepEqual(records, original);
  const result = removeVariant(records, 'story', 'one', persist);
  const after = structuredClone(result.projects);
  assert.throws(() => restoreVariant(result.projects, result.undo, fail));
  assert.deepEqual(result.projects, after);
});

test('unknown variants and processing projects do not write; undo is idempotent', () => {
  const record = project([variant('one')]);
  const fail = () => assert.fail('Unexpected storage write');
  assert.equal(removeVariant([record], 'story', 'missing', fail), null);
  assert.equal(removeVariant([{ ...record, outputProcessing: {} }], 'story', 'one', fail), null);
  const result = removeVariant([record], 'story', 'one', persist);
  const restored = restoreVariant(result.projects, result.undo, persist);
  assert.equal(restoreVariant(restored.projects, result.undo, fail), null);
});


test('undo restores a selected pending checkbox without replacing a later selection', () => {
  const record = { ...project([variant('one', 'pending'), variant('two', 'pending')]), selectedOutputId: null, selectedOutputIds: ['one', 'two'], lastPendingOutputId: 'one', viewOriginalDraft: true };
  const result = removeVariant([record], 'story', 'two', persist);
  const restored = restoreVariant(result.projects, result.undo, persist).projects[0];
  assert.deepEqual(restored.selectedOutputIds, ['one', 'two']);
  assert.equal(restored.lastPendingOutputId, 'one');
});

test('undo during another generation restores the variant without changing the running job', () => {
  const result = removeVariant([project([variant('one'), variant('two')])], 'story', 'one', persist);
  result.projects[0].outputProcessing = { ids: ['two'], readyAt: 100 };
  const restored = restoreVariant(result.projects, result.undo, persist).projects[0];
  assert.deepEqual(restored.outputs.map(output => output.id), ['one', 'two']);
  assert.deepEqual(restored.outputProcessing, { ids: ['two'], readyAt: 100 });
  assert.equal(restored.selectedOutputId, 'two');
});
