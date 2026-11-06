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

test('a blank own-material output defaults to To Draft without showing a Drafted card', () => {
  for (const body of ['', '\n \t', '\u200B\u200C\u200D\uFEFF\n']) {
    const output = {
      id: 'own-material', title: 'My draft title', status: 'ready',
      draftText: body, document: { ops: [{ insert: body }] },
      shareText: 'A title or share text alone is not draft body content',
    };
    const project = { ownMaterialOutputId: output.id, selectedOutputId: output.id, outputs: [output] };
    const state = variantPanelState(project);
    assert.equal(state.view, 'pending');
    assert.deepEqual(state.outputs, []);
    assert.deepEqual(variantPanelState(project, 'created').outputs, []);
    assert.deepEqual(variantPanelState(project, 'pending').outputs, []);
    assert.equal(output.status, 'ready', 'the empty draft remains editable');
  }
});

test('own material stays out of Drafted after typing or pasting while its editor data remains intact', () => {
  for (const marker of ['legacy', 'output']) {
    const output = { id: 'own-material', title: 'My draft', status: 'ready', draftText: 'My pasted paragraph', document: { ops: [{ insert: 'My pasted paragraph', attributes: { bold: true } }, { insert: '\n' }] } };
    const project = { selectedOutputId: output.id, outputs: [output] };
    if (marker === 'legacy') project.ownMaterialOutputId = output.id;
    else output.ownMaterial = true;
    const before = structuredClone(output);
    assert.equal(variantPanelState(project).view, 'pending');
    assert.deepEqual(variantPanelState(project, 'created').outputs, []);
    assert.deepEqual(output, before, 'hiding the card must not remove or rewrite editor content');
    delete output.document;
    assert.deepEqual(variantPanelState(project, 'created').outputs, [], 'plain-text own material is excluded too');
  }
});

test('hiding original and added own material retains generated drafts and pending recipes', () => {
  const own = { id: 'own-material', title: 'Original material', status: 'ready', draftText: 'Original text' };
  const added = { id: 'added-material', ownMaterial: true, title: 'Added material', status: 'ready', draftText: 'More text' };
  const project = { ownMaterialOutputId: own.id, selectedOutputId: added.id, outputs: [own, ready, added, pending] };
  assert.deepEqual(variantPanelState(project, 'created').outputs, [ready]);
  assert.deepEqual(variantPanelState(project, 'pending').outputs, [pending]);
  assert.deepEqual(variantPanelState({ ...project, ownMaterialOutputId: null }, 'created').outputs, [own, ready]);
  assert.equal(project.outputs.length, 4);
});


test('active material defaults to To Draft even with generated drafts, but explicit Content selection wins', () => {
  const own = { id: 'own', ownMaterial: true, title: 'My material', status: 'ready', draftText: 'Source text' };
  const project = { selectedOutputId: own.id, outputs: [own, ready] };
  assert.equal(variantPanelState(project).view, 'pending');
  assert.deepEqual(variantPanelState(project).outputs, []);
  assert.equal(variantPanelState(project, 'created').view, 'created');
  assert.deepEqual(variantPanelState(project, 'created').outputs, [ready]);
  assert.equal(variantPanelState({ ...project, selectedOutputId: ready.id }).view, 'created');
});
