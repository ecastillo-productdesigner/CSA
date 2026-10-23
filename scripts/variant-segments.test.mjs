import test from 'node:test';
import assert from 'node:assert/strict';
import { variantPanelState, selectedPendingOutputs } from '../dist/outputs.js';

const pending = { id: 'pending', title: 'Pending', status: 'pending' };
const ready = { id: 'ready', title: 'Created', status: 'ready' };

test('To Draft keeps pending and regeneration records while Drafted includes ready and legacy drafts', () => {
  const legacy = { id: 'legacy', title: 'Legacy', draftText: 'Existing content' };
  const recreate = { id: 'recreate', title: 'Recreate', status: 'pending', needsRegeneration: true, draftText: 'Previous content' };
  const project = { outputs: [pending, ready, legacy, recreate, null] };
  assert.deepEqual(variantPanelState(project, 'pending').outputs.map(output => output.id), ['pending', 'recreate']);
  assert.deepEqual(variantPanelState(project, 'created').outputs.map(output => output.id), ['ready', 'legacy']);
  assert.equal(variantPanelState(project).pendingLabel, 'Content to Draft');
  assert.equal(variantPanelState(project).createdLabel, 'Drafted');
});

test('empty segments omit zero counts and default to To Draft', () => {
  assert.deepEqual(variantPanelState(null), { view: 'pending', outputs: [], pendingLabel: 'To Draft', createdLabel: 'Drafted' });
  assert.equal(variantPanelState({ outputs: [pending] }).pendingLabel, 'Content to Draft');
});

test('explicit segment selection overrides the open editor while default follows a created draft', () => {
  const project = { outputs: [pending, ready], selectedOutputId: 'ready' };
  assert.equal(variantPanelState(project).view, 'created');
  assert.deepEqual(variantPanelState(project, 'pending').outputs, [pending]);
  assert.deepEqual(variantPanelState({ ...project, viewOriginalDraft: true }, 'created').outputs, [ready]);
});

test('completing a batch moves only those records to Created without duplication', () => {
  const project = { outputs: [{ ...pending }, ready], selectedOutputIds: ['pending', 'ready'] };
  assert.deepEqual(selectedPendingOutputs(project).map(output => output.id), ['pending']);
  project.outputs[0].status = 'ready';
  assert.deepEqual(variantPanelState(project, 'pending').outputs, []);
  assert.deepEqual(variantPanelState(project, 'created').outputs.map(output => output.id), ['pending', 'ready']);
  assert.deepEqual(selectedPendingOutputs(project), []);
});


test('Drafted stays unnumbered for zero, one, and multiple completed pieces', () => {
  for (const outputs of [[], [ready], [ready, { ...ready, id: 'second' }]]) {
    assert.equal(variantPanelState({ outputs }).createdLabel, 'Drafted');
  }
});


test('pending content uses the same unnumbered label for one or many pieces and keeps its empty label', () => {
  assert.equal(variantPanelState({ outputs: [] }).pendingLabel, 'To Draft');
  for (const outputs of [[pending], [pending, { ...pending, id: 'second' }, { ...pending, id: 'third' }]]) {
    assert.equal(variantPanelState({ outputs }).pendingLabel, 'Content to Draft');
  }
});
