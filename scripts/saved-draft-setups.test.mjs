import test from 'node:test';
import assert from 'node:assert/strict';
import { listSavedDraftSetups, saveDraftSetup, removeSavedDraftSetup, applySavedDraftSetup, clearSavedDraftSetup } from '../dist/saved-draft-setups.js';

const draft = (id, overrides = {}) => ({
  id, title: `Story ${id}`, status: 'pending',
  toolPreferences: { format: 'listicle', audience: 'general', voice: 'us-weekly' },
  labels: [{ key: 'format', label: 'Listicle' }, { key: 'audience', label: 'General Audience' }, { key: 'voice', label: 'Us Weekly' }],
  editorialDirection: 'Keep the practical details', targetWordCount: 'long',
  sourceSnapshots: [{ title: 'Original source', text: 'Source facts' }],
  selectedSourceIndexes: [0], draftText: 'Existing article', document: { ops: [{ insert: 'Existing article' }] },
  ...overrides,
});
const project = (id, outputs, overrides = {}) => ({ id, outputs, ...overrides });

test('saved list restores legacy records, keeps edited saved settings, and excludes unavailable records', () => {
  const old = draft('old', { isFavorite: true, favoritedAt: 10, savedVariantNumber: 4 });
  const edited = draft('edited', { isFavorite: true, favoritedAt: 20, presetSettings: {
    name: 'Weekend briefing', toolPreferences: { format: 'standard', audience: '', voice: '' },
    labels: [{ key: 'format', label: 'Standard Format' }], editorialDirection: 'Explain the context', targetWordCount: 'medium',
  } });
  const projects = [project('active', [old, edited, draft('plain'), draft('deleted', { isFavorite: true, deletedAt: 1 }), draft('archived', { isFavorite: true, archivedAt: 1 })]),
    project('archived', [draft('a', { isFavorite: true })], { archivedAt: 1 }), project('deleted', [draft('d', { isFavorite: true })], { deletedAt: 1 })];
  const before = structuredClone(projects);
  const entries = listSavedDraftSetups(projects);
  assert.deepEqual(entries.map(entry => entry.output.id), ['edited', 'old']);
  assert.equal(entries[0].name, 'Weekend briefing');
  assert.equal(entries[0].configuration.targetWordCount, 'medium');
  assert.equal(entries[1].name, 'Saved Draft 4');
  assert.equal(entries[1].configuration.toolPreferences.voice, 'us-weekly');
  entries[1].configuration.toolPreferences.voice = '';
  entries[1].configuration.labels[0].label = 'Changed returned label';
  assert.deepEqual(projects, before);
});

test('saving snapshots the recipe without changing the draft content, sources, or original settings', () => {
  const output = draft('one');
  const before = structuredClone(output);
  const projects = [project('source', [output])];
  assert.equal(saveDraftSetup(projects, 'source', 'one', { now: 100 }), output);
  assert.equal(output.isFavorite, true);
  assert.equal(output.favoritedAt, 100);
  assert.equal(output.presetSettings.name, 'Saved Draft 1');
  assert.equal(output.presetSettings.targetWordCount, 'long');
  const { isFavorite, favoritedAt, presetSettings, savedVariantNumber, ...original } = output;
  assert.deepEqual(original, before);
  output.toolPreferences.voice = '';
  output.labels[0].label = 'Updated original';
  output.editorialDirection = 'Updated original direction';
  assert.equal(presetSettings.toolPreferences.voice, 'us-weekly');
  assert.equal(presetSettings.labels[0].label, 'Listicle');
  assert.equal(presetSettings.editorialDirection, 'Keep the practical details');
});

test('automatic names are unique across projects and remain stable after removing and saving again', () => {
  const first = draft('first', { isFavorite: true, savedVariantNumber: 5 });
  const second = draft('second');
  const third = draft('third');
  const projects = [project('one', [first]), project('two', [second, third])];
  saveDraftSetup(projects, 'two', 'second', { now: 100 });
  saveDraftSetup(projects, 'two', 'third', { now: 200 });
  assert.equal(second.presetSettings.name, 'Saved Draft 6');
  assert.equal(third.presetSettings.name, 'Saved Draft 7');
  removeSavedDraftSetup(projects, 'two', 'second');
  saveDraftSetup(projects, 'two', 'second', { now: 300 });
  assert.equal(second.presetSettings.name, 'Saved Draft 6');
  assert.equal(second.favoritedAt, 300);
});

test('renaming a saved setup preserves its saved configuration, timestamp, and article name', () => {
  const output = draft('one', { name: 'An article name', nameEdited: true });
  const projects = [project('source', [output])];
  saveDraftSetup(projects, 'source', 'one', { now: 100 });
  assert.equal(output.presetSettings.name, 'An article name');
  output.presetSettings.toolPreferences.voice = 'womans-world';
  output.presetSettings.editorialDirection = 'Edited saved direction';
  output.presetSettings.targetWordCount = 'medium';
  const before = structuredClone(output);
  saveDraftSetup(projects, 'source', 'one', { name: '  Weekly practical guide  ', now: 500 });
  assert.equal(output.presetSettings.name, 'Weekly practical guide');
  const after = structuredClone(output);
  after.presetSettings.name = before.presetSettings.name;
  assert.deepEqual(after, before);
});

test('applying a setup changes only New Draft settings and keeps the current project sources and content', () => {
  const output = draft('saved', { isFavorite: true });
  const source = project('source', [output], { sources: [{ title: 'Saved source' }] });
  const current = project('current', [draft('current-draft')], {
    sources: [{ title: 'Current source', selected: true }], document: { ops: [{ insert: 'Current original' }] },
    selectedOutputId: 'current-draft', toolPreferences: { format: 'standard', audience: '', voice: '' },
    editorialDirection: 'Old direction', targetWordCount: 'short',
  });
  const before = structuredClone(current);
  const sourceBefore = structuredClone(source);
  assert.equal(applySavedDraftSetup([source, current], current, 'source', 'saved'), true);
  assert.deepEqual(current.toolPreferences, output.toolPreferences);
  assert.equal(current.editorialDirection, output.editorialDirection);
  assert.equal(current.targetWordCount, 'long');
  assert.deepEqual(current.variantPreset, { projectId: 'source', outputId: 'saved' });
  const { toolPreferences, editorialDirection, targetWordCount, variantPreset, ...unchanged } = current;
  const { toolPreferences: oldPreferences, editorialDirection: oldDirection, targetWordCount: oldWordCount, ...beforeUnchanged } = before;
  assert.deepEqual(unchanged, beforeUnchanged);
  current.toolPreferences.voice = '';
  assert.deepEqual(source, sourceBefore);
});

test('legacy labels restore available choices but cannot overwrite a setting explicitly cleared in the preset', () => {
  const output = draft('legacy', { isFavorite: true, presetSettings: {
    toolPreferences: { audience: '' }, labels: [{ key: 'format', label: 'Listicle' }, { key: 'audience', label: 'General Audience' }, { key: 'voice', label: 'US Weekly' }],
    editorialDirection: '', targetWordCount: 'medium',
  } });
  const current = project('current', []);
  assert.equal(applySavedDraftSetup([project('source', [output])], current, 'source', 'legacy'), true);
  assert.deepEqual(current.toolPreferences, { format: 'listicle', audience: '', voice: 'us-weekly' });
  assert.equal(current.editorialDirection, '');
  assert.equal(current.targetWordCount, 'medium');
});

test('removing a setup detaches matching references while retaining drafts, saved names, and configured choices', () => {
  const output = draft('saved', { isFavorite: true, favoritedAt: 50, presetSettings: { name: 'Practical guide' } });
  const current = project('current', [], { variantPreset: { projectId: 'source', outputId: 'saved' }, toolPreferences: { format: 'listicle' } });
  const other = project('other', [], { variantPreset: { projectId: 'elsewhere', outputId: 'saved' } });
  const projects = [project('source', [output]), current, other];
  const before = structuredClone(output);
  assert.equal(removeSavedDraftSetup(projects, 'source', 'saved'), output);
  assert.equal(output.isFavorite, false);
  assert.equal(output.favoritedAt, undefined);
  assert.equal(current.variantPreset, undefined);
  assert.deepEqual(current.toolPreferences, { format: 'listicle' });
  assert.deepEqual(other.variantPreset, { projectId: 'elsewhere', outputId: 'saved' });
  const { isFavorite, favoritedAt, ...remaining } = before;
  const { isFavorite: nowFavorite, ...nowRemaining } = output;
  assert.deepEqual(nowRemaining, remaining);
});

test('missing, removed, or archived setup targets do not change current settings', () => {
  const projects = [project('source', [draft('unsaved'), draft('archived', { isFavorite: true, archivedAt: 1 })]),
    project('archived-project', [draft('saved', { isFavorite: true })], { archivedAt: 1 })];
  const current = project('current', [], { toolPreferences: { format: 'standard' } });
  const before = structuredClone(current);
  for (const [projectId, outputId] of [['missing', 'saved'], ['source', 'unsaved'], ['source', 'archived'], ['archived-project', 'saved']]) {
    assert.equal(applySavedDraftSetup(projects, current, projectId, outputId), false);
    assert.deepEqual(current, before);
  }
  assert.equal(saveDraftSetup(projects, 'missing', 'saved'), null);
  assert.equal(removeSavedDraftSetup(projects, 'source', 'unsaved'), null);
  assert.deepEqual(listSavedDraftSetups(null), []);
});

test('unknown legacy values remain saved while current controls use supported choices and normalize word count', () => {
  const output = draft('legacy', { isFavorite: true, toolPreferences: { format: 'retired-format', audience: 'retired-audience', voice: 'retired-voice' },
    labels: [{ key: 'format', label: 'Listicle' }], targetWordCount: 'unsupported' });
  const projects = [project('source', [output])];
  const current = project('current', []);
  saveDraftSetup(projects, 'source', 'legacy', { now: 100 });
  assert.equal(output.presetSettings.toolPreferences.audience, 'retired-audience');
  assert.equal(applySavedDraftSetup(projects, current, 'source', 'legacy'), true);
  assert.deepEqual(current.toolPreferences, { format: 'listicle', audience: '', voice: '' });
  assert.equal(current.targetWordCount, 'short');
});


test('None Selected clears New Draft settings without removing saved setups, sources, or existing content', () => {
  const saved = draft('saved', { isFavorite: true, favoritedAt: 50, savedVariantNumber: 3, presetSettings: {
    name: 'Weekly practical guide', toolPreferences: { format: 'listicle', audience: 'general', voice: 'us-weekly' },
    labels: [{ key: 'format', label: 'Listicle' }], editorialDirection: 'Keep the practical details', targetWordCount: 'long',
  } });
  const current = project('current', [saved, draft('other')], {
    variantPreset: { projectId: 'current', outputId: 'saved' },
    // Even a legacy shared reference must stay intact when clearing the form.
    toolPreferences: saved.presetSettings.toolPreferences,
    editorialDirection: saved.presetSettings.editorialDirection, targetWordCount: 'long',
    sources: [{ type: 'text', title: 'Current source', text: 'Current source facts', selected: true }],
    title: 'Current original', draftText: 'Original project content', document: { ops: [{ insert: 'Original project content' }] },
    selectedOutputId: 'other', selectedOutputIds: ['other'],
  });
  const before = structuredClone(current);
  const savedEntries = structuredClone(listSavedDraftSetups([current]).map(({ name, configuration }) => ({ name, configuration })));
  assert.equal(clearSavedDraftSetup(current), true);
  assert.deepEqual(current.toolPreferences, { format: '', audience: '', voice: '' });
  assert.equal(current.editorialDirection, '');
  assert.equal(current.targetWordCount, 'short');
  assert.equal(current.variantPreset, undefined);
  const { variantPreset, toolPreferences, editorialDirection, targetWordCount, ...beforeUnchanged } = before;
  const { toolPreferences: nextPreferences, editorialDirection: nextDirection, targetWordCount: nextCount, ...afterUnchanged } = current;
  assert.deepEqual(afterUnchanged, beforeUnchanged);
  assert.deepEqual(listSavedDraftSetups([current]).map(({ name, configuration }) => ({ name, configuration })), savedEntries);
});

test('None Selected also clears custom settings after a saved setup was detached', () => {
  const current = project('current', [], { toolPreferences: { format: 'standard', audience: 'general', voice: '' }, editorialDirection: 'Customized direction', targetWordCount: 'medium' });
  assert.equal(clearSavedDraftSetup(current), true);
  assert.deepEqual(current.toolPreferences, { format: '', audience: '', voice: '' });
  assert.equal(current.editorialDirection, '');
  assert.equal(current.targetWordCount, 'short');
  assert.equal(clearSavedDraftSetup(current), true);
  assert.equal(current.variantPreset, undefined);
});

test('None Selected ignores invalid or unavailable projects without changing their stored settings', () => {
  for (const value of [undefined, null, false, 'current', [], { id: 'deleted', deletedAt: 1, toolPreferences: { format: 'listicle' } }, { id: 'archived', archivedAt: 1, editorialDirection: 'Keep this direction' }]) {
    const before = structuredClone(value);
    assert.equal(clearSavedDraftSetup(value), false);
    assert.deepEqual(value, before);
  }
});
