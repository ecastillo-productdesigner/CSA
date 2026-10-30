import test from 'node:test';
import assert from 'node:assert/strict';
import { presetConfiguration, savedPresetName, updatePresetPreferences, setSavedPresetSettings } from '../dist/preset-settings.js';
const preferences = { format: 'what-to-know', audience: 'general', voice: '' };
const project = () => ({ variantPreset: { projectId: 'source', outputId: 'saved' }, toolPreferences: { ...preferences }, editorialDirection: 'Keep this direction' });
test('adding a voice absent from the preset detaches it and retains all selected settings', () => {
  const p = project();
  assert.equal(updatePresetPreferences(p, { ...preferences, voice: 'house-standard' }), true);
  assert.equal(p.variantPreset, undefined);
  assert.deepEqual(p.toolPreferences, { ...preferences, voice: 'house-standard' });
  assert.equal(p.editorialDirection, 'Keep this direction');
});
test('changing or clearing an existing preset dropdown detaches its selection', () => {
  for (const change of [{ format: 'listicle' }, { audience: '' }, { voice: 'apple-news' }]) {
    const p = project();
    assert.equal(updatePresetPreferences(p, { ...preferences, ...change }), true);
    assert.equal(p.variantPreset, undefined);
  }
});
test('identical values retain the preset; returning to its values after customization does not reattach it', () => {
  const p = project();
  assert.equal(updatePresetPreferences(p, preferences), false);
  assert.equal(p.variantPreset.outputId, 'saved');
  updatePresetPreferences(p, { ...preferences, voice: 'house-standard' });
  updatePresetPreferences(p, preferences);
  assert.equal(p.variantPreset, undefined);
});
test('editing a saved preset preserves the generated variant and original settings', () => {
  const output = { id: 'saved', title: 'Approved story', name: '', savedVariantNumber: 3, isFavorite: true, status: 'ready', draftText: 'Approved content', toolPreferences: { ...preferences }, labels: [{ key: 'format', label: 'What to Know' }], editorialDirection: 'Original direction', sourceSnapshots: [{ title: 'Original source' }] };
  const before = structuredClone(output);
  const settings = { name: 'Weekend brief', toolPreferences: { ...preferences, voice: 'house-standard' }, labels: [{ key: 'voice', label: 'House Standard' }], editorialDirection: 'New preset direction' };
  setSavedPresetSettings(output, settings);
  const { presetSettings, ...original } = output;
  assert.deepEqual(original, before);
  assert.equal(savedPresetName(output), 'Weekend brief');
  assert.equal(presetConfiguration(output).toolPreferences.voice, 'house-standard');
  assert.equal(presetConfiguration(output).editorialDirection, 'New preset direction');
  assert.notEqual(presetSettings.toolPreferences, settings.toolPreferences);
  assert.notEqual(presetSettings.labels[0], settings.labels[0]);
});
test('existing saved variants retain their automatic name and settings until edited', () => {
  const output = { savedVariantNumber: 3, toolPreferences: preferences, labels: [], editorialDirection: 'Existing direction' };
  assert.equal(savedPresetName(output), 'Saved Draft 3');
  assert.deepEqual(presetConfiguration(output), { toolPreferences: preferences, labels: [], editorialDirection: 'Existing direction', targetWordCount: 'short' });
});
