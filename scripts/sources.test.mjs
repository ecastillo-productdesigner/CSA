import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceSelectionFor } from '../dist/sources.js';

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
