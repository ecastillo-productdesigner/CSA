import test from 'node:test';
import assert from 'node:assert/strict';
import { openEditorOutputs, reopenEditorOutput, closeEditorOutput } from '../dist/editor-tab-state.js';

function fixture() {
  return {
    id: 'project', selectedOutputId: 'second', selectedOutputIds: ['second', 'pending'],
    outputs: [
      { id: 'first', title: 'A saved draft', status: 'ready', draftText: 'First article', cmsSentAt: 1 },
      { id: 'second', title: 'Current draft', status: 'ready', document: { ops: [{ insert: 'An edited paragraph\n' }] }, shareText: 'An edited subhead', feedback: { rating: 'up' } },
      { id: 'third', title: 'Another draft', status: 'ready', draftText: 'Third article' },
      { id: 'pending', title: 'Queued recipe', status: 'pending' },
    ],
  };
}
const ids = project => openEditorOutputs(project).map(output => output.id);

test('legacy projects open every editable draft while closed IDs only filter tabs', () => {
  const project = fixture();
  project.outputs.push({ id: 'rework', title: 'Needs regeneration', status: 'pending', needsRegeneration: true });
  assert.deepEqual(ids(project), ['first', 'second', 'third', 'rework']);
  const original = structuredClone(project.outputs);
  project.closedEditorOutputIds = ['second', 'second', 'missing'];
  assert.deepEqual(ids(project), ['first', 'third', 'rework']);
  assert.deepEqual(project.outputs, original);
  assert.deepEqual(openEditorOutputs(null), []);
});

test('closing an inactive tab preserves the active draft and drafted card selection', () => {
  const project = fixture();
  const original = structuredClone(project.outputs);
  const selection = [...project.selectedOutputIds];
  closeEditorOutput(project, 'first');
  assert.equal(project.selectedOutputId, 'second');
  assert.deepEqual(project.selectedOutputIds, selection);
  assert.deepEqual(ids(project), ['second', 'third']);
  assert.deepEqual(project.outputs, original, 'closing cannot alter articles, export status, or feedback');
});

test('closing the active tab selects its next neighbor, then its previous neighbor, then no draft', () => {
  const project = fixture();
  closeEditorOutput(project, 'second');
  assert.equal(project.selectedOutputId, 'third');
  assert.deepEqual(ids(project), ['first', 'third']);
  closeEditorOutput(project, 'third');
  assert.equal(project.selectedOutputId, 'first');
  closeEditorOutput(project, 'first');
  assert.equal(project.selectedOutputId, null);
  assert.deepEqual(ids(project), []);
  assert.equal(project.outputs.length, 4, 'all drafted cards and the pending recipe remain saved');
});

test('reopening a closed card restores exactly one tab with its original content', () => {
  const project = fixture();
  const original = structuredClone(project.outputs);
  closeEditorOutput(project, 'second');
  assert.equal(reopenEditorOutput(project, 'second'), true);
  assert.deepEqual(ids(project), ['first', 'second', 'third']);
  assert.equal(reopenEditorOutput(project, 'second'), true);
  assert.equal(openEditorOutputs(project).filter(output => output.id === 'second').length, 1);
  assert.deepEqual(project.outputs, original);
  assert.equal(reopenEditorOutput(project, 'missing'), false);
  assert.equal(reopenEditorOutput(project, 'pending'), false);
});

test('closed tabs survive a saved-project roundtrip and can all be reopened', () => {
  const project = fixture();
  for (const id of ['first', 'second', 'third']) closeEditorOutput(project, id);
  const restored = JSON.parse(JSON.stringify(project));
  assert.deepEqual(ids(restored), []);
  assert.equal(restored.selectedOutputId, null);
  for (const id of ['third', 'first', 'second']) assert.equal(reopenEditorOutput(restored, id), true);
  assert.deepEqual(ids(restored), ['first', 'second', 'third']);
  assert.deepEqual(restored.outputs, project.outputs);
});

test('newly completed drafts open while revisions do not reopen a closed tab', () => {
  const project = fixture();
  closeEditorOutput(project, 'third');
  project.outputProcessing = { kind: 'revision', ids: ['third'] };
  assert.deepEqual(ids(project), ['first', 'second']);
  project.outputs[2].draftText = 'Revised article';
  project.outputs[2].revisionUnread = true;
  project.outputProcessing = null;
  assert.deepEqual(ids(project), ['first', 'second']);
  project.outputs.find(output => output.id === 'pending').status = 'ready';
  assert.deepEqual(ids(project), ['first', 'second', 'pending']);
  assert.equal(project.outputs[2].revisionUnread, true, 'a closed revised draft stays unread');
});

test('closing a draft while viewing sources preserves the source view and pending recipe selection', () => {
  const project = fixture();
  project.viewOriginalDraft = true;
  project.selectedOutputId = null;
  project.selectedOutputIds = ['pending'];
  closeEditorOutput(project, 'second');
  assert.equal(project.viewOriginalDraft, true);
  assert.equal(project.selectedOutputId, null);
  assert.deepEqual(project.selectedOutputIds, ['pending']);
  assert.deepEqual(ids(project), ['first', 'third']);
});
