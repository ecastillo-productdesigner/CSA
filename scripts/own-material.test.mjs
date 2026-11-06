import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { projectOutputs, outputIsReady, outputSourceCount, initializeVariantNames, selectedPendingOutputs, populateOutputContent } from '../dist/outputs.js';
import { projectTitleFromSources, normalizeProjectTitles } from '../dist/dashboard.js';
import { normalizeWordCount } from '../dist/variant-word-count.js';
import { syncOwnMaterialSource } from '../dist/own-material-source.js';

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
  const calls = { opened: [], sourcePanels: [], saved: [], sourceStories: [], searches: [], sourceRenders: [], actionUpdates: 0 };
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
    projectTitleFromSources, normalizeProjectTitles, normalizeWordCount, syncOwnMaterialSource,
    storageKey: 'test-projects', localStorage: { getItem: key => storage.get(key), setItem: (key, value) => { storage.set(key, value); calls.saved.push(JSON.parse(value)); } },
    savedDrafts: { render() {} }, dashboard: null, notify() {},
    draftSourcesFor: () => [], draftPreferenceValue: (key, value) => value || '',
    newProjectUpload: { busy: false, isBusy() { return this.busy; }, reset() {} },
    railNavigation: { closeTransient() {}, closeDrawer() {}, close(name) { calls.sourcePanels.push(name); } },
    toolDropdowns: { refresh() {} }, updateComposerActions() { calls.actionUpdates++; }, renderOutputs() {}, renderProjectSources(project) { calls.sourceRenders.push(clone(project)); },
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

test('own material autosaves its content and source, refreshes visible controls, and reopens the same output', () => {
  const ui = setup();
  ui.open();
  ui.$('#new-project-material').click();
  const project = ui.context.projects[0];
  const outputId = project.selectedOutputId;
  const snapshot = {
    ...ui.calls.opened.at(-1), title: 'My original draft', titleProvided: true, shareText: '', shareTextEdited: true,
    document: { ops: [{ insert: 'My original paragraph', attributes: { bold: true } }, { insert: '\n' }] },
    draftText: 'My original paragraph', metadata: { author: 'Author' }, updatedAt: Date.now(),
  };
  ui.$('#show-sources').setAttribute('aria-expanded', 'true');
  const beforeActions = ui.calls.actionUpdates;
  assert.equal(ui.calls.editorCallbacks.onSave(snapshot), true);
  assert.equal(project.title, snapshot.title);
  assert.equal(project.sources.length, 1);
  const source = project.sources[0];
  assert.equal(source.title, snapshot.title);
  assert.equal(source.text, snapshot.draftText);
  assert.equal(source.selected, true);
  assert.equal(ui.calls.sourceRenders.at(-1).sources[0].text, snapshot.draftText);
  assert.equal(ui.calls.actionUpdates, beforeActions + 1);
  Object.assign(snapshot, {
    title: 'Updated original draft', draftText: 'A revised original paragraph',
    document: { ops: [{ insert: 'A revised original paragraph', attributes: { italic: true } }, { insert: '\n' }] },
  });
  assert.equal(ui.calls.editorCallbacks.onSave(snapshot), true);
  assert.equal(project.sources.length, 1);
  assert.equal(project.sources[0], source);
  assert.equal(source.title, snapshot.title);
  assert.equal(source.text, snapshot.draftText);
  assert.equal(ui.calls.sourceRenders.at(-1).sources[0].title, snapshot.title);
  assert.equal(ui.calls.actionUpdates, beforeActions + 2);
  ui.context.projects = ui.context.loadProjects();
  ui.context.showProject(project.id);
  const reopened = ui.calls.opened.at(-1);
  assert.equal(reopened.id, project.id);
  assert.equal(reopened.selectedOutputId, outputId);
  assert.equal(reopened.title, snapshot.title);
  assert.equal(reopened.titleProvided, true);
  assert.equal(reopened.draftText, snapshot.draftText);
  assert.deepEqual(reopened.document, snapshot.document);
  assert.equal(reopened.shareText, '');
  assert.equal(reopened.sources.length, 1);
  assert.equal(reopened.sources[0].ownMaterialOutputId, outputId);
  assert.equal(reopened.sources[0].title, snapshot.title);
  assert.equal(reopened.sources[0].text, snapshot.draftText);
  assert.equal(ui.calls.saved.at(-1)[0].sources[0].text, snapshot.draftText);
  const beforeClear = ui.calls.actionUpdates;
  const clearedBody = { ...reopened, draftText: '', document: { ops: [{ insert: '\n' }] } };
  assert.equal(ui.calls.editorCallbacks.onSave(clearedBody), true);
  assert.equal(ui.context.projects[0].sources.length, 1);
  assert.equal(ui.context.projects[0].sources[0].text, snapshot.title);
  assert.equal(ui.calls.sourceRenders.at(-1).sources[0].text, snapshot.title);
  assert.equal(ui.calls.actionUpdates, beforeClear + 1);
  assert.equal(ui.calls.saved.at(-1)[0].outputs[0].sourceCount, 1);
  assert.equal(ui.calls.editorCallbacks.onSave({ ...clearedBody, title: 'Untitled story', titleProvided: false }), true);
  assert.deepEqual(clone(ui.context.projects[0].sources), []);
  assert.deepEqual(ui.calls.sourceRenders.at(-1).sources, []);
  assert.equal(ui.calls.actionUpdates, beforeClear + 2);
  assert.equal(ui.calls.saved.at(-1)[0].outputs[0].sourceCount, 0);
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


test('reopening older own-material content creates its missing source from the opening paragraph', () => {
  const ui = setup();
  ui.open();
  ui.$('#new-project-material').click();
  const project = ui.context.projects[0];
  const output = project.outputs[0];
  const body = 'One two three four five six seven eight nine ten.\n\nThe full second paragraph remains in the source.';
  output.document = { ops: [{ insert: `${body}\n` }] };
  output.draftText = body;
  ui.context.saveProjects();
  ui.context.projects = ui.context.loadProjects();
  ui.context.showProject(project.id);
  const reopened = ui.context.projects[0];
  assert.equal(reopened.sources.length, 1);
  assert.equal(reopened.sources[0].title, 'One two three four five six seven eight…');
  assert.equal(reopened.sources[0].text, body);
  assert.equal(reopened.sources[0].selected, true);
  assert.equal(reopened.outputs[0].sourceCount, 1);
  ui.context.showProject(project.id);
  assert.equal(reopened.sources.length, 1);
  assert.equal(ui.calls.saved.at(-1)[0].sources.length, 1);
});


test('an explicitly typed Untitled story title saves and reopens as a title-only source', () => {
  const ui = setup();
  ui.open();
  ui.$('#new-project-material').click();
  const project = ui.context.projects[0];
  const snapshot = { ...ui.calls.opened.at(-1), title: 'Untitled story', titleProvided: true, draftText: '', document: { ops: [{ insert: '\n' }] }, updatedAt: Date.now() };
  assert.equal(ui.calls.editorCallbacks.onSave(snapshot), true);
  assert.equal(project.sources.length, 1);
  assert.equal(project.sources[0].title, 'Untitled story');
  assert.equal(project.sources[0].text, 'Untitled story');
  assert.equal(project.outputs[0].titleProvided, true);
  ui.context.projects = ui.context.loadProjects();
  ui.context.showProject(project.id);
  const reopened = ui.calls.opened.at(-1);
  assert.equal(reopened.title, 'Untitled story');
  assert.equal(reopened.titleProvided, true);
  assert.equal(reopened.draftText, '');
  assert.equal(reopened.sources.length, 1);
  assert.equal(reopened.sources[0].title, 'Untitled story');
  assert.equal(ui.calls.saved.at(-1)[0].outputs[0].titleProvided, true);
});
