import test from 'node:test';
import assert from 'node:assert/strict';
import { variantPanelState, selectedPendingOutputs } from '../dist/outputs.js';

const pending = { id: 'pending', title: 'Pending', status: 'pending' };
const ready = { id: 'ready', title: 'Created', status: 'ready' };

test('to Create keeps pending and regeneration records while Created includes ready and legacy drafts', () => {
  const legacy = { id: 'legacy', title: 'Legacy', draftText: 'Existing content' };
  const recreate = { id: 'recreate', title: 'Recreate', status: 'pending', needsRegeneration: true, draftText: 'Previous content' };
  const project = { outputs: [pending, ready, legacy, recreate, null] };
  assert.deepEqual(variantPanelState(project, 'pending').outputs.map(output => output.id), ['pending', 'recreate']);
  assert.deepEqual(variantPanelState(project, 'created').outputs.map(output => output.id), ['ready', 'legacy']);
  assert.equal(variantPanelState(project).pendingLabel, '2 to Create');
  assert.equal(variantPanelState(project).createdLabel, '2 Created');
});

test('empty segments omit zero counts and default to to Create', () => {
  assert.deepEqual(variantPanelState(null), { view: 'pending', outputs: [], pendingLabel: 'to Create', createdLabel: 'Created' });
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
