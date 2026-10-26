import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceSelectionFor } from '../dist/sources.js';
import { draftSourcesFor } from '../dist/source-model.js';

const source = title => ({ type: 'text', title, text: `${title} material`, selected: true });

test('variant source inspection shows all available sources and checks only the saved set', () => {
  const project = { sources: [source('First'), source('Second'), source('Third')] };
  const one = { sourceSnapshots: [structuredClone(project.sources[1])] };
  const two = { sourceSnapshots: [structuredClone(project.sources[0]), structuredClone(project.sources[2])] };
  const firstView = sourceSelectionFor(project, one);
  assert.deepEqual(firstView.sources, project.sources);
  assert.deepEqual([...firstView.selectedSources], [project.sources[1]]);
  assert.deepEqual([...sourceSelectionFor(project, two).selectedSources], [project.sources[0], project.sources[2]]);
  assert.ok(project.sources.every(entry => entry.selected), 'inspection must not change new-variant choices');
});

test('saved variant checks remain independent of later source selection', () => {
  const used = source('Used');
  const project = { sources: [used, source('Unused')] };
  const variant = { sourceSnapshots: [structuredClone(used)] };
  used.selected = false;
  assert.deepEqual([...sourceSelectionFor(project, variant).selectedSources], [used]);
  assert.deepEqual([...sourceSelectionFor(project).selectedSources], [project.sources[1]]);
});

test('removed sources remain available as checked historical previews', () => {
  const removed = source('Removed');
  const live = source('Current');
  const snapshot = structuredClone(removed);
  const result = sourceSelectionFor({ sources: [live] }, { sourceSnapshots: [snapshot] });
  assert.deepEqual(result.sources, [live, snapshot]);
  assert.deepEqual([...result.selectedSources], [snapshot]);
});

test('duplicate source entries match separate saved sources and legacy indexes remain supported', () => {
  const originals = [source('Same'), source('Same')];
  const result = sourceSelectionFor({ sources: originals }, { sourceSnapshots: structuredClone(originals) });
  assert.equal(result.sources.length, 2);
  assert.equal(result.selectedSources.size, 2);
  assert.deepEqual([...sourceSelectionFor({ sources: originals }, { selectedSourceIndexes: [1] }).selectedSources], [originals[1]]);
  assert.equal(sourceSelectionFor({ sources: originals }, { sourceSnapshots: [] }).selectedSources.size, 0);
});


test('sidebar and used-source popup resolve the same authoritative empty and valid unique legacy subset', () => {
  const project = { sources: [source('First'), source('Second'), source('Third')] };
  const legacy = { selectedSourceIndexes: [2, 0, 2, -1, 1.5, '1', 99] };
  const saved = draftSourcesFor(project, legacy);
  const selection = sourceSelectionFor(project, legacy);
  assert.deepEqual(saved, [project.sources[2], project.sources[0]]);
  assert.deepEqual([...selection.selectedSources], saved);
  assert.deepEqual(selection.sources, project.sources, 'duplicate legacy indexes must not append duplicate historical rows');
  for (const variant of [{ sourceSnapshots: [], selectedSourceIndexes: [0, 1], sourceCount: 2 }, { sourceCount: 3 }, { selectedSourceIndexes: 'invalid' }]) {
    assert.deepEqual(draftSourcesFor(project, variant), []);
    assert.equal(sourceSelectionFor(project, variant).selectedSources.size, 0);
  }
});

test('captured file identity survives a rename while changed text remains a checked historical version', () => {
  const capturedFile = { type: 'file', title: 'Original file.pdf', attachmentId: 'same-document' };
  const liveFile = { ...capturedFile, title: 'Renamed file.pdf', selected: false };
  const capturedText = source('Reporting notes');
  const liveText = { ...capturedText, text: 'New edited notes', selected: true };
  const variant = { sourceSnapshots: [capturedFile, capturedText, null, 'invalid'] };
  const project = { sources: [liveFile, liveText] };
  const before = structuredClone({ project, variant });
  const result = sourceSelectionFor(project, variant);
  assert.deepEqual(draftSourcesFor(project, variant), [capturedFile, capturedText]);
  assert.deepEqual(result.sources, [liveFile, liveText, capturedText]);
  assert.deepEqual([...result.selectedSources], [liveFile, capturedText]);
  assert.equal(result.selectedSources.has(liveText), false);
  assert.deepEqual({ project, variant }, before);
});
