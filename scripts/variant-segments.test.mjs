import test from 'node:test';
import assert from 'node:assert/strict';
import { variantPanelState } from '../dist/outputs.js';

const pending = { id: 'pending', title: 'Pending', status: 'pending' };
const ready = { id: 'ready', title: 'Created', status: 'ready' };

test('one list retains created, processing, legacy, and regeneration records', () => {
  const legacy = { id: 'legacy', title: 'Legacy', draftText: 'Existing content' };
  const recreate = { id: 'recreate', title: 'Recreate', status: 'pending', needsRegeneration: true, draftText: 'Previous content' };
  const project = { outputs: [pending, ready, legacy, recreate, null] };
  assert.deepEqual(variantPanelState(project).outputs.map(output => output.id), ['pending', 'ready', 'legacy', 'recreate']);
});

test('an empty project has one empty variant list', () => {
  assert.deepEqual(variantPanelState(null), { outputs: [] });
});

test('active editor and previous segment preferences cannot hide other variants', () => {
  const project = { outputs: [pending, ready], selectedOutputId: 'ready' };
  assert.deepEqual(variantPanelState(project, 'pending').outputs, [pending, ready]);
  assert.deepEqual(variantPanelState({ ...project, viewOriginalDraft: true }, 'created').outputs, [pending, ready]);
});

test('completed generation stays in the same list and position without duplication', () => {
  const project = { outputs: [{ ...pending }, ready] };
  project.outputs[0].status = 'ready';
  assert.deepEqual(variantPanelState(project).outputs.map(output => output.id), ['pending', 'ready']);
});
