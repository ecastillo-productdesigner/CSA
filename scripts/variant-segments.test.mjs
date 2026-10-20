import test from 'node:test';
import assert from 'node:assert/strict';
import { variantPanelState } from '../dist/outputs.js';

const pending = { id: 'pending', title: 'Pending', status: 'pending' };
const ready = { id: 'ready', title: 'Created', status: 'ready' };

test('segments filter actual generation status, including legacy and regeneration records', () => {
  const legacy = { id: 'legacy', title: 'Legacy', draftText: 'Existing content' };
  const recreate = { id: 'recreate', title: 'Recreate', status: 'pending', needsRegeneration: true, draftText: 'Previous content' };
  const project = { outputs: [pending, ready, legacy, recreate, null] };
  const toCreate = variantPanelState(project, 'pending');
  const created = variantPanelState(project, 'created');
  assert.deepEqual(toCreate.outputs.map(output => output.id), ['pending', 'recreate']);
  assert.deepEqual(created.outputs.map(output => output.id), ['ready', 'legacy']);
  assert.equal(toCreate.pendingLabel, '2 to Create');
  assert.equal(created.createdLabel, '2 Created');
});

test('empty segments remain available and omit zero from their labels', () => {
  assert.deepEqual(variantPanelState(null), { view: 'pending', outputs: [], pendingLabel: 'to Create', createdLabel: 'Created' });
  const empty = variantPanelState({ outputs: [ready] }, 'pending');
  assert.equal(empty.view, 'pending');
  assert.deepEqual(empty.outputs, []);
  assert.equal(empty.pendingLabel, 'to Create');
  assert.equal(empty.createdLabel, '1 Created');
});

test('initial segment follows the active editor and explicit browsing remains independent', () => {
  const project = { outputs: [pending, ready], selectedOutputId: 'ready' };
  assert.equal(variantPanelState(project).view, 'created');
  assert.equal(variantPanelState({ ...project, viewOriginalDraft: true }).view, 'pending');
  assert.equal(variantPanelState(project, 'pending').view, 'pending');
  assert.equal(variantPanelState({ outputs: [ready] }).view, 'created');
});

test('completed generation moves the record and updates both counts', () => {
  const project = { outputs: [{ ...pending }, ready] };
  project.outputs[0].status = 'ready';
  const state = variantPanelState(project, 'created');
  assert.equal(state.pendingLabel, 'to Create');
  assert.equal(state.createdLabel, '2 Created');
  assert.deepEqual(state.outputs.map(output => output.id), ['pending', 'ready']);
});
