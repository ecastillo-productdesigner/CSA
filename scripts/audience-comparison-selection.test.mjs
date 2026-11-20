import test from 'node:test';
import assert from 'node:assert/strict';
import { currentAudienceComparison, toggleAudienceComparison } from '../dist/audience-comparison-selection.js';
import { getEligibleAudienceDrafts } from '../dist/audience-similarity.js';

const draft = (id, audience = 'general', values = {}) => ({ id, title: `Story ${id}`, status: 'ready', draftText: 'Neighbors plan a new community garden.', toolPreferences: { audience }, ...values });
const project = () => ({ id: 'project', outputs: [draft('one'), draft('two'), draft('three'), draft('other', 'wellness-enthusiast')] });

test('two explicit selections form an ordered exact pair without changing the project', () => {
  const value = project();
  value.selectedOutputId = 'other';
  value.selectedOutputIds = ['pending'];
  const before = structuredClone(value);
  const first = toggleAudienceComparison(value, [], 'three');
  assert.deepEqual(first, { ids: ['three'], reason: '' });
  assert.equal(currentAudienceComparison(value, first.ids).group, null);
  const next = toggleAudienceComparison(value, first.ids, 'one');
  assert.deepEqual(next, { ids: ['three', 'one'], reason: '' });
  const selection = currentAudienceComparison(value, next.ids);
  assert.deepEqual(selection.group.drafts.map(item => item.id), ['three', 'one']);
  assert.equal(selection.group.label, 'General Audience');
  assert.deepEqual(value, before);
});

test('third and later choices are retained without replacing earlier selections', () => {
  const value = project();
  assert.deepEqual(toggleAudienceComparison(value, ['one', 'two'], 'three'), { ids: ['one', 'two', 'three'], reason: '' });
  assert.deepEqual(toggleAudienceComparison(value, ['one', 'two'], 'two'), { ids: ['one'], reason: '' });
  assert.deepEqual(toggleAudienceComparison(value, ['one'], 'three'), { ids: ['one', 'three'], reason: '' });
});

test('different audiences remain selected and form a comparison', () => {
  const value = project();
  const selection = toggleAudienceComparison(value, ['one'], 'other');
  assert.deepEqual(selection, { ids: ['one', 'other'], reason: '' });
  assert.equal(currentAudienceComparison(value, selection.ids).group.key, 'selected-drafts');
  assert.deepEqual(currentAudienceComparison(value, selection.ids).group.drafts.map(item => item.id), ['one', 'other']);
  assert.deepEqual(toggleAudienceComparison(value, selection.ids, 'other'), { ids: ['one'], reason: '' });
});

test('eligibility includes a single available audience draft but excludes stale and incomplete records', () => {
  const value = { id: 'project', ownMaterialOutputId: 'material', outputProcessing: { ids: ['revising'] }, outputs: [
    draft('single', 'wellness-enthusiast'), draft('pending', 'general', { status: 'pending' }),
    draft('stale', 'general', { needsRegeneration: true }), draft('none', ''),
    draft('empty', 'general', { document: { ops: [] } }), draft('material'),
    draft('own', 'general', { ownMaterial: true }), draft('deleted', 'general', { deletedAt: 1 }),
    draft('revising'), draft('single', 'wellness-enthusiast'),
  ] };
  assert.deepEqual(getEligibleAudienceDrafts(value).map(item => item.id), ['single', 'none']);
  assert.deepEqual(toggleAudienceComparison(value, [], 'single'), { ids: ['single'], reason: '' });
  for (const id of ['pending', 'stale', 'empty', 'material', 'own', 'deleted', 'revising', 'missing']) {
    assert.deepEqual(toggleAudienceComparison(value, ['single'], id), { ids: ['single'], reason: 'unavailable' });
  }
});

test('refresh prunes removed, revising, or emptied drafts and duplicate IDs', () => {
  const value = project();
  assert.deepEqual(currentAudienceComparison(value, ['one', 'one', 'missing', 'two', 'three']).ids, ['one', 'two', 'three']);
  value.outputs[0].document = { ops: [] };
  assert.deepEqual(currentAudienceComparison(value, ['one', 'two']).ids, ['two']);
  value.outputProcessing = { kind: 'revision', ids: ['two'] };
  assert.deepEqual(currentAudienceComparison(value, ['one', 'two']).ids, []);
  value.outputProcessing = null;
  value.outputs = value.outputs.filter(item => item.id !== 'two');
  assert.deepEqual(currentAudienceComparison(value, ['two']).ids, []);
});

test('changing an audience retains the selected drafts for comparison', () => {
  const value = project();
  assert.ok(currentAudienceComparison(value, ['one', 'two']).group);
  value.outputs[1].toolPreferences.audience = 'wellness-enthusiast';
  const updated = currentAudienceComparison(value, ['one', 'two']);
  assert.deepEqual(updated.ids, ['one', 'two']);
  assert.equal(updated.group.key, 'selected-drafts');
});

test('project and pending selections do not supply comparison choices implicitly', () => {
  const value = project();
  value.selectedOutputId = 'one';
  value.selectedOutputIds = ['one', 'two'];
  assert.deepEqual(currentAudienceComparison(value), { ids: [], group: null });
  const other = { id: 'other-project', outputs: [draft('four'), draft('five')] };
  assert.deepEqual(currentAudienceComparison(other, ['one', 'two']), { ids: [], group: null });
});

test('deleted and archived projects clear comparison eligibility', () => {
  for (const values of [{ deletedAt: 1 }, { archivedAt: 1 }]) {
    const value = { ...project(), ...values };
    assert.deepEqual(currentAudienceComparison(value, ['one', 'two']), { ids: [], group: null });
    assert.deepEqual(toggleAudienceComparison(value, ['one', 'two'], 'one'), { ids: [], reason: 'unavailable' });
  }
});


test('any number of selected drafts includes different and absent audiences in the exact selection order', () => {
  const value = project();
  value.outputs.push(draft('none', ''));
  const ids = ['other', 'none', 'three', 'one'];
  const result = currentAudienceComparison(value, ids);
  assert.deepEqual(result.ids, ids);
  assert.equal(result.group.key, 'selected-drafts');
  assert.equal(result.group.label, 'Selected Drafts');
  assert.deepEqual(result.group.drafts.map(item => item.id), ids);
  assert.deepEqual(toggleAudienceComparison(value, ['other'], 'none'), { ids: ['other', 'none'], reason: '' });
});
