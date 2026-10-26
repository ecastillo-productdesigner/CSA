import test from 'node:test';
import assert from 'node:assert/strict';
import { outputLoadingSelectionKeys, sampleVariant } from '../dist/outputs.js';

test('loading colors follow the saved recipe families in canonical order', () => {
  for (const key of ['format', 'audience', 'voice']) {
    assert.deepEqual(outputLoadingSelectionKeys({ toolPreferences: { [key]: 'selected' } }), [key]);
  }
  assert.deepEqual(outputLoadingSelectionKeys({
    toolPreferences: { voice: 'womans-world', audience: 'general', format: 'listicle', other: 'ignored' },
  }), ['format', 'audience', 'voice']);
  assert.deepEqual(outputLoadingSelectionKeys({
    toolPreferences: { voice: 'us-weekly', format: '', audience: 'general' },
  }), ['audience', 'voice']);
});

test('authoritative preferences preserve cleared settings instead of reviving stale chip labels', () => {
  const labels = [
    { key: 'format', label: 'Old format' },
    { key: 'audience', label: 'Old audience' },
    { key: 'voice', label: 'Old voice' },
  ];
  assert.deepEqual(outputLoadingSelectionKeys({ toolPreferences: {}, labels }), []);
  assert.deepEqual(outputLoadingSelectionKeys({
    toolPreferences: { format: '', audience: 'general', voice: '  ' }, labels,
  }), ['audience']);
  assert.deepEqual(outputLoadingSelectionKeys({
    toolPreferences: { format: false, audience: null, voice: 1 }, labels,
  }), []);
});

test('legacy label-only recipes ignore blank, duplicate, and unknown labels', () => {
  const labels = [
    { key: 'voice', label: 'Us Weekly' },
    { key: 'audience', label: '   ' },
    { key: 'format', label: 'Listicle' },
    { key: 'format', label: 'Duplicate' },
    { key: 'other', label: 'Not a recipe family' },
    { key: 'audience', label: null },
    null,
  ];
  for (const toolPreferences of [undefined, null, [], 'invalid']) {
    assert.deepEqual(outputLoadingSelectionKeys({ toolPreferences, labels }), ['format', 'voice']);
  }
  assert.deepEqual(outputLoadingSelectionKeys(), []);
  assert.deepEqual(outputLoadingSelectionKeys({ labels: null }), []);
});

test('a created draft retains its own selections after the composer or saved preset changes', () => {
  const project = { sources: [], outputs: [], toolPreferences: { format: 'standard', audience: '', voice: '' } };
  const output = sampleVariant(project, [{ key: 'audience', value: 'general', label: 'General Audience' }]);
  const original = structuredClone(output);
  project.toolPreferences = { format: 'listicle', audience: '', voice: 'us-weekly' };
  output.presetSettings = { toolPreferences: { format: 'listicle', audience: '', voice: 'us-weekly' } };
  assert.deepEqual(outputLoadingSelectionKeys(output), ['audience']);
  assert.deepEqual(output.toolPreferences, original.toolPreferences);
  assert.deepEqual(output.labels, original.labels);
});
