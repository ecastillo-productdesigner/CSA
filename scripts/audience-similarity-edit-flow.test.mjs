import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { projectOutputs, outputIsReady } from '../dist/outputs.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = app.indexOf('const audienceSimilarityDialog = createAudienceSimilarityDialog(');
const end = app.indexOf('const railNavigation = ', start);
assert.ok(start >= 0 && end > start);
const production = app.slice(start, end);
const draft = id => ({ id, title: `Story ${id}`, status: 'ready', draftText: `Original body ${id}`, metadata: { custom: 'retained' } });
const patch = () => ({
  title: 'Edited story', titleProvided: true, shareText: 'Edited share text', shareTextEdited: true,
  document: { ops: [{ insert: 'Edited body', attributes: { bold: true } }, { insert: '\n' }] },
  draftText: 'Edited body', metadata: { custom: 'retained', seoTitle: 'Edited story' }, updatedAt: 200,
});

function setup({ selectedOutputId = 'one', active = true, storageFails = false } = {}) {
  const project = { id: 'project', updatedAt: 100, selectedOutputId, toolPreferences: { voice: 'house-standard' }, outputs: [draft('one'), draft('two')] };
  const other = { id: 'other', updatedAt: 99, selectedOutputId: 'two', outputs: [draft('two')] };
  const calls = { persisted: [], savedDrafts: 0, dashboard: 0, outputs: [], opened: [], actions: 0 };
  let configuration;
  const context = createContext({
    projects: [project, other], activeProjectId: active ? project.id : other.id, storageKey: 'projects', projectOutputs, outputIsReady,
    createAudienceSimilarityDialog(options) { configuration = options; return {}; },
    localStorage: { setItem(key, value) { if (storageFails) throw new Error('Storage unavailable'); calls.persisted.push({ key, value: JSON.parse(value) }); } },
    savedDrafts: { render() { calls.savedDrafts++; } },
    dashboard: { render() { calls.dashboard++; } },
    renderOutputs(value) { calls.outputs.push(value); },
    richEditor: { open(value, options) { calls.opened.push({ value, options }); } },
    document: { title: 'Original title — CSA' },
    updateComposerActions() { calls.actions++; },
  });
  runInContext(production, context);
  return { project, other, context, calls, save: configuration.onSaveDraft };
}

test('popup save updates the explicit draft without changing the selected output or same-ID drafts in another project', () => {
  const ui = setup();
  const target = ui.project.outputs[1];
  const changes = patch();
  assert.equal(ui.save(target, changes), true);
  for (const [key, value] of Object.entries(changes)) assert.deepEqual(target[key], value);
  assert.equal(ui.project.updatedAt, changes.updatedAt);
  assert.equal(ui.project.selectedOutputId, 'one');
  assert.equal(ui.project.outputs[0].draftText, 'Original body one');
  assert.equal(ui.other.outputs[0].draftText, 'Original body two');
  assert.equal(ui.calls.opened.length, 0);
  assert.deepEqual(ui.calls.outputs, [ui.project]);
  assert.equal(ui.calls.persisted.length, 1);
  assert.equal(ui.calls.persisted[0].key, 'projects');
  assert.equal(ui.calls.persisted[0].value[0].outputs[1].draftText, 'Edited body');
});

test('popup save reloads the selected main editor with the saved document and project context', () => {
  const ui = setup({ selectedOutputId: 'two' });
  const target = ui.project.outputs[1];
  const changes = patch();
  assert.equal(ui.save(target, changes), true);
  assert.equal(ui.calls.opened.length, 1);
  const { value } = ui.calls.opened[0];
  assert.equal(value.id, ui.project.id);
  assert.equal(value.directionOutputId, target.id);
  assert.deepEqual(value.document, changes.document);
  assert.deepEqual(value.toolPreferences, ui.project.toolPreferences);
  assert.equal(ui.context.document.title, 'Edited story — CSA');
});

test('storage failure restores replaced fields, removes newly added fields, and leaves the editor untouched', () => {
  const ui = setup({ selectedOutputId: 'two', storageFails: true });
  const target = ui.project.outputs[1];
  const before = structuredClone(target);
  assert.equal(ui.save(target, patch()), false);
  assert.deepEqual(target, before);
  assert.equal(ui.project.updatedAt, 100);
  assert.equal(Object.hasOwn(target, 'document'), false);
  assert.equal(Object.hasOwn(target, 'shareTextEdited'), false);
  assert.equal(ui.calls.persisted.length, 0);
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.calls.outputs.length, 0);
  assert.equal(ui.calls.savedDrafts, 0);
  assert.equal(ui.calls.dashboard, 0);
  assert.equal(ui.calls.actions, 0);
});

test('saving a draft from an inactive project does not replace the currently displayed editor', () => {
  const ui = setup({ active: false, selectedOutputId: 'two' });
  assert.equal(ui.save(ui.project.outputs[1], patch()), true);
  assert.equal(ui.calls.persisted.length, 1);
  assert.equal(ui.calls.savedDrafts, 1);
  assert.equal(ui.calls.dashboard, 1);
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.calls.outputs.length, 0);
  assert.equal(ui.calls.actions, 0);
});

test('stale, removed, deleted, archived and unavailable drafts cannot be saved from the popup', () => {
  const mutations = [
    (ui, target) => { ui.project.outputs = ui.project.outputs.filter(output => output !== target); },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.project.archivedAt = 1; },
    (ui, target) => { target.status = 'pending'; },
    (ui, target) => { target.needsRegeneration = true; },
  ];
  for (const mutate of mutations) {
    const ui = setup();
    const target = ui.project.outputs[1];
    mutate(ui, target);
    assert.equal(ui.save(target, patch()), false);
    assert.equal(ui.calls.persisted.length, 0);
  }
  const ui = setup();
  assert.equal(ui.save({ ...ui.project.outputs[1] }, patch()), false);
});

test('legacy ready drafts accepted by comparison can also be edited', () => {
  const ui = setup();
  const target = ui.project.outputs[1];
  delete target.status;
  assert.equal(outputIsReady(target), true);
  assert.equal(ui.save(target, patch()), true);
  assert.equal(target.draftText, 'Edited body');
});

test('a draft that starts processing while the popup is open cannot be overwritten', () => {
  const ui = setup();
  const target = ui.project.outputs[1];
  ui.project.outputProcessing = { kind: 'revision', ids: [target.id] };
  assert.equal(ui.save(target, patch()), false);
  assert.equal(target.draftText, 'Original body two');
  assert.equal(ui.calls.persisted.length, 0);
});


test('selected main-editor reload explicitly discards any stale pending snapshot after the popup persists', () => {
  const ui = setup({ selectedOutputId: 'two' });
  const target = ui.project.outputs[1];
  assert.equal(ui.save(target, patch()), true);
  assert.equal(ui.calls.opened[0].options?.discardPending, true);
  assert.equal(ui.calls.persisted[0].value[0].outputs[1].draftText, 'Edited body');
});

const editorSource = await readFile(new URL('../dist/editor.js', import.meta.url), 'utf8');
const openStart = editorSource.indexOf('    open(next');
const openEnd = editorSource.indexOf('      directionMetadata.update(', openStart);
assert.ok(openStart >= 0 && openEnd > openStart);
const editorOpening = editorSource.slice(openStart, openEnd).replace(/^\s*open\(/, 'globalThis.openEditor = function(');

function mainEditorSetup() {
  const calls = { flushes: 0, clearedTimers: [], metadataClosed: 0 };
  const context = createContext({
    saveTimer: 123, dirty: true, project: { id: 'old' }, loading: false, root: { hidden: true },
    clearTimeout(timer) { calls.clearedTimers.push(timer); },
    flush() { calls.flushes++; context.dirty = false; },
    metadata: { close() { calls.metadataClosed++; } },
  });
  runInContext(editorOpening + 'return { project, dirty, loading }; };', context);
  return { calls, context };
}

test('main editor refresh clears the stale save timer and dirty flag without flushing over the popup save', () => {
  const ui = mainEditorSetup();
  const saved = { id: 'project', draftText: 'Edited body' };
  const state = ui.context.openEditor(saved, { discardPending: true });
  assert.equal(ui.calls.flushes, 0);
  assert.deepEqual(ui.calls.clearedTimers, [123]);
  assert.equal(state.dirty, false);
  assert.equal(state.project, saved);
  assert.equal(ui.calls.metadataClosed, 1);
});

test('ordinary main-editor navigation still flushes pending changes', () => {
  const ui = mainEditorSetup();
  const saved = { id: 'next' };
  const state = ui.context.openEditor(saved);
  assert.equal(ui.calls.flushes, 1);
  assert.equal(state.project, saved);
});
