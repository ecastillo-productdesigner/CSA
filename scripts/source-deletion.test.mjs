import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { sourceIdentityKey, draftSourcesFor } from '../dist/source-model.js';
import { sourceSelectionFor } from '../dist/sources.js';
import { projectOutputs } from '../dist/outputs.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const production = app.slice(app.indexOf('function removeProjectSource('), app.indexOf('function deleteVariant('));
const source = title => ({ type: 'text', title, text: `${title} captured notes`, selected: true });
function setup(project, results = []) {
  const notifications = [];
  const views = [];
  const controls = {
    '#composer': { classList: { contains: () => false } },
    '#editor-source-list': { querySelectorAll: () => [] },
    '#editor-add-source-button': { focus() {} },
  };
  let saves = 0;
  const context = createContext({
    projects: [project], activeProjectId: project.id, sourceIdentityKey, draftSourcesFor, projectOutputs,
    richEditor: { flush() {} }, $: selector => controls[selector],
    saveProjects: () => results[saves++] ?? true,
    renderProjectSources: current => views.push(sourceSelectionFor(current, current.outputs[0])),
    updateComposerActions() {}, searchExperience: { show() {} },
    notify: (message, undo) => notifications.push({ message, undo }),
  });
  runInContext(production, context);
  return { notifications, views, remove: value => context.removeProjectSource(project.id, value), undo: () => notifications.findLast(entry => entry.undo).undo() };
}

test('Delete removes a current source without bringing its draft snapshot back into the sidebar; Undo restores it', () => {
  const first = source('First'); const second = source('Second');
  const variant = { id: 'draft', title: 'Draft', sourceSnapshots: structuredClone([first, second]), selectedSourceIndexes: [0, 1] };
  const project = { id: 'project', updatedAt: 10, sources: [first, second], outputs: [variant] };
  const captured = structuredClone(variant.sourceSnapshots);
  const ui = setup(project);
  ui.remove(first);
  assert.deepEqual(project.sources, [second]);
  assert.deepEqual(sourceSelectionFor(project, variant).sources, [second]);
  assert.deepEqual(variant.selectedSourceIndexes, [0]);
  assert.deepEqual(variant.sourceSnapshots, captured);
  assert.equal(draftSourcesFor(project, variant).length, 2, 'the draft keeps its captured source history');
  ui.undo();
  assert.deepEqual(project.sources, [first, second]);
  assert.deepEqual(sourceSelectionFor(project, variant).sources, [first, second]);
  assert.deepEqual(Array.from(variant.selectedSourceIndexes), [0, 1]);
  assert.equal(ui.notifications.at(-1).message, 'Source restored');
});

test('Delete hides a saved-only source and Undo brings it back without adding it to the project', () => {
  const current = source('Current'); const saved = source('Saved');
  const variant = { id: 'draft', title: 'Draft', sourceSnapshots: [saved] };
  const project = { id: 'project', sources: [current], outputs: [variant] };
  const captured = structuredClone(variant);
  const ui = setup(project);
  ui.remove(saved);
  assert.deepEqual(project.sources, [current]);
  assert.deepEqual(sourceSelectionFor(project, variant).sources, [current]);
  assert.deepEqual(variant, captured);
  ui.undo();
  assert.deepEqual(project.sources, [current]);
  assert.deepEqual(sourceSelectionFor(project, variant).sources, [current, saved]);
  assert.deepEqual(variant, captured);
});

test('a storage failure rolls back source deletion and its visibility marker', () => {
  for (const historical of [false, true]) {
    const current = source('Current'); const saved = historical ? source('Saved') : current;
    const project = { id: 'project', updatedAt: 10, sources: [current], outputs: [{ id: 'draft', title: 'Draft', sourceSnapshots: [structuredClone(saved)], selectedSourceIndexes: [0] }] };
    const before = structuredClone(project);
    const ui = setup(project, [false]);
    ui.remove(saved);
    assert.deepEqual(project, before);
    assert.equal(ui.notifications.at(-1).message, 'Couldn’t delete source. Try again');
  }
});

test('Undo restores only the chosen source while preserving another source deletion', () => {
  const current = source('Current'); const first = source('First saved'); const second = source('Second saved');
  const variant = { id: 'draft', title: 'Draft', sourceSnapshots: [first, second] };
  const project = { id: 'project', sources: [current], outputs: [variant] };
  const ui = setup(project);
  ui.remove(first);
  const undoFirst = ui.notifications.at(-1).undo;
  ui.remove(second);
  undoFirst();
  assert.deepEqual(sourceSelectionFor(project, variant).sources, [current, first]);
  assert.equal(project.removedSourceKeys.includes(sourceIdentityKey(second)), true);
});
