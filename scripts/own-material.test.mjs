import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { projectOutputs, outputIsReady, outputSourceCount, initializeVariantNames, selectedPendingOutputs, populateOutputContent } from '../dist/outputs.js';
import { projectTitleFromSources, normalizeProjectTitles } from '../dist/dashboard.js';
import { normalizeWordCount } from '../dist/variant-word-count.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = app.indexOf(start);
  const until = app.indexOf(end, from);
  assert.ok(from >= 0 && until > from, `Production section: ${start}`);
  return app.slice(from, until);
}
const clone = value => JSON.parse(JSON.stringify(value));

function setup() {
  const nodes = new Map();
  const calls = { opened: [], sourcePanels: [], saved: [], sourceStories: [], searches: [] };
  const $ = selector => {
    if (!nodes.has(selector)) {
      const classes = new Set();
      const attributes = new Map();
      const listeners = new Map();
      nodes.set(selector, {
        hidden: false, open: false, disabled: false, value: '', textContent: '',
        classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
        getAttribute: name => attributes.get(name), setAttribute: (name, value) => attributes.set(name, value),
        focus() {}, querySelector() { return null; },
        addEventListener: (name, callback) => listeners.set(name, callback),
        click: () => listeners.get('click')?.(),
        showModal() { this.open = true; }, close() { this.open = false; },
      });
    }
    return nodes.get(selector);
  };
  const storage = new Map();
  const context = createContext({
    projects: [], activeProjectId: null, sourceTargetProjectId: null,
    outputViews: new Map(), crypto: { randomUUID }, $, document: { body: $('body'), title: '' },
    projectOutputs, outputIsReady, outputSourceCount, initializeVariantNames, selectedPendingOutputs, populateOutputContent,
    projectTitleFromSources, normalizeProjectTitles, normalizeWordCount,
    storageKey: 'test-projects', localStorage: { getItem: key => storage.get(key), setItem: (key, value) => { storage.set(key, value); calls.saved.push(JSON.parse(value)); } },
    savedDrafts: { render() {} }, dashboard: null, notify() {},
    draftSourcesFor: () => [], draftPreferenceValue: (key, value) => value || '',
    newProjectUpload: { busy: false, isBusy() { return this.busy; }, reset() {} },
    railNavigation: { closeTransient() {}, closeDrawer() {}, close(name) { calls.sourcePanels.push(name); } },
    toolDropdowns: { refresh() {} }, updateComposerActions() {}, renderOutputs() {}, renderProjectSources() {},
    closeComposer() { $('#new-project-dialog').close(); }, closeProfile() {}, updateStarterInput() {},
    setNewVariantCollapsed() {}, setContentCollapsed() {}, resumeOutputProcessing() {},
    renderSourceStory(project) { calls.sourceStories.push(project); },
    searchExperience: { hide() {}, show(project) { calls.searches.push(project); } },
    requestAnimationFrame(callback) { callback(); }, sessionStorage: { setItem() {} },
    window: { scrollTo() {}, matchMedia: () => ({ matches: false }) }, breakpointQuery: () => '',
    createMaterialEditor(options) {
      calls.editorCallbacks = options;
      return { flush() {}, open(project) { calls.opened.push(clone(project)); } };
    },
  });
  runInContext([
    section('const richEditor = createMaterialEditor(', '\nconst sendDestinationDialog'),
    section('function loadProjects(', '\nfunction notify('),
    section('function titleFrom(', '\nfunction showHome('),
    section('function startOwnMaterial(', "\n$('#editor-add-source-button')"),
    section('function showProject(id)', '\nfunction renderSourceStory('),
    section('function showEditorProject(', '\nfunction closeProfile('),
    "$('#new-project-material').addEventListener('click', startOwnMaterial);",
  ].join('\n'), context);
  return { context, calls, $, open: sourceId => context.openProjectDialog(true, sourceId) };
}

test('own material opens and persists a blank editable ready draft without generated text, settings, or sources', () => {
  const ui = setup();
  ui.open();
  assert.equal(ui.$('#new-project-material').hidden, false);
  assert.equal(ui.$('#new-project-material').click(), true);
  assert.equal(ui.$('#new-project-dialog').open, false);
  const project = ui.context.projects[0];
  const output = projectOutputs(project)[0];
  assert.equal(project.kind, 'draft');
  assert.equal(projectOutputs(project).length, 1);
  assert.equal(outputIsReady(output), true);
  assert.equal(project.selectedOutputId, output.id);
  assert.equal(project.ownMaterialOutputId, output.id);
  assert.deepEqual(clone(project.selectedOutputIds), [output.id]);
  assert.deepEqual(clone(project.sources), []);
  assert.deepEqual(clone(output.sourceSnapshots), []);
  assert.deepEqual(clone(project.toolPreferences), { format: '', audience: '', voice: '' });
  assert.equal(output.draftText, '');
  assert.deepEqual(clone(output.document), { ops: [{ insert: '\n' }] });
  assert.equal(output.shareText, '');
  assert.equal(ui.calls.opened.at(-1).shareText, '');
  assert.equal(ui.$('#composer').classList.contains('has-editor'), true);
  assert.equal(ui.context.outputViews.get(project.id), 'created');
  assert.deepEqual(ui.calls.sourceStories, []);
  assert.deepEqual(ui.calls.searches, []);
  assert.deepEqual(ui.calls.sourcePanels, ['sources']);
  assert.equal(ui.calls.saved.at(-1)[0].outputs[0].status, 'ready');
  assert.equal(ui.$('#new-project-material').click(), false, 'a second click cannot create another project after closing');
  assert.equal(ui.context.projects.length, 1);
  ui.context.projects = ui.context.loadProjects();
  ui.context.showProject(project.id);
  assert.equal(ui.calls.opened.at(-1).draftText, '');
  assert.equal(ui.calls.opened.at(-1).shareText, '');
});

test('own material autosaves exact pasted content, formatting and title and reopens the same output', () => {
  const ui = setup();
  ui.open();
  ui.$('#new-project-material').click();
  const project = ui.context.projects[0];
  const outputId = project.selectedOutputId;
  const snapshot = {
    ...ui.calls.opened.at(-1), title: 'My original draft', shareText: '', shareTextEdited: true,
    document: { ops: [{ insert: 'My original paragraph', attributes: { bold: true } }, { insert: '\n' }] },
    draftText: 'My original paragraph', metadata: { author: 'Author' }, updatedAt: Date.now(),
  };
  assert.equal(ui.calls.editorCallbacks.onSave(snapshot), true);
  assert.equal(project.title, snapshot.title);
  ui.context.projects = ui.context.loadProjects();
  ui.context.showProject(project.id);
  const reopened = ui.calls.opened.at(-1);
  assert.equal(reopened.id, project.id);
  assert.equal(reopened.selectedOutputId, outputId);
  assert.equal(reopened.title, snapshot.title);
  assert.equal(reopened.draftText, snapshot.draftText);
  assert.deepEqual(reopened.document, snapshot.document);
  assert.equal(reopened.shareText, '');
  assert.deepEqual(reopened.sources, []);
});

test('own material is unavailable when adding sources or while another import is running', () => {
  const ui = setup();
  ui.open('existing-project');
  assert.equal(ui.$('#new-project-material').hidden, true);
  assert.equal(ui.$('#new-project-material').click(), false);
  assert.equal(ui.context.projects.length, 0);
  ui.open();
  assert.equal(ui.$('#new-project-material').hidden, false);
  ui.context.newProjectUpload.busy = true;
  assert.equal(ui.$('#new-project-material').click(), false);
  assert.equal(ui.context.projects.length, 0);
  assert.equal(ui.$('#new-project-dialog').open, true);
});
