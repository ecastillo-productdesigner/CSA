import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { sampleSearchSources } from '../dist/search.js';
import { classifyProjectSearchInput } from '../dist/project-search-input.js';
import { hasSelectedSources, projectOutputs, outputIsReady, selectedPendingOutputs, sampleVariant } from '../dist/outputs.js';
import { sourceIdentityKey } from '../dist/source-model.js';
import { normalizeWordCount } from '../dist/variant-word-count.js';
import { applySavedDraftSetup, clearSavedDraftSetup } from '../dist/saved-draft-setups.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
function productionSection(start, end) {
  const from = app.indexOf(start);
  const until = app.indexOf(end, from);
  assert.ok(from >= 0 && until > from, `Production section: ${start}`);
  return app.slice(from, until);
}
const clone = value => JSON.parse(JSON.stringify(value));
const helpers = productionSection('function setWorkspaceSearchQuery(', '\nfunction startSearch(');
function setup(project = { id: 'workspace', sources: [], outputs: [], awaitingOutput: true, linkCards: true }) {
  const context = createContext({ sampleSearchSources, sourceIdentityKey, crypto: { randomUUID } });
  runInContext(helpers, context);
  return {
    project,
    setQuery: query => context.setWorkspaceSearchQuery(project, query),
    select: (selection, ready = [], query = project.searchQuery) => context.applyWorkspaceSearchSelection(project, selection, ready, query),
  };
}

const topic = 'Samantha';
test('workspace search leaves Sources empty until a result is selected', () => {
  const ui = setup();
  ui.setQuery(topic);
  assert.equal(ui.project.searchQuery, topic);
  assert.deepEqual(ui.project.sources, []);
  assert.equal(hasSelectedSources(ui.project), false);
  ui.select(['article-2']);
  assert.equal(ui.project.sources.length, 1);
  assert.equal(ui.project.sources[0].searchArticleId, 'article-2');
  assert.equal(ui.project.sources[0].selected, true);
  assert.equal(ui.project.sources[0].addedToCsa, false);
});

test('reopening a query preserves added sources without filling unselected search candidates', () => {
  const ui = setup();
  ui.setQuery(topic);
  ui.select(['article-2'], ['article-2']);
  const existing = ui.project.sources[0];
  const external = { type: 'link', url: 'https://example.com/original', title: 'Existing source', selected: false };
  ui.project.sources.push(external);
  ui.setQuery(topic);
  assert.equal(ui.project.sources.length, 2);
  assert.equal(ui.project.sources.find(source => source.searchArticleId === 'article-2'), existing);
  assert.equal(existing.selected, true);
  assert.equal(existing.addedToCsa, true);
  assert.equal(ui.project.sources.find(source => source.url), external);
  assert.deepEqual(ui.project.sources.filter(source => source.searchQuery === topic).map(source => source.searchArticleId), ['article-2']);
});

test('checkbox updates affect only the matching query and leave earlier sources and draft snapshots intact', () => {
  const ui = setup();
  ui.setQuery(topic);
  ui.select(['article-1'], ['article-1']);
  const earlierSources = clone(ui.project.sources);
  const originalDraft = sampleVariant(ui.project, []);
  ui.project.outputs.push(originalDraft);
  const snapshots = clone(originalDraft.sourceSnapshots);
  ui.setQuery('Community gardens');
  assert.equal(ui.project.sources.length, 1);
  ui.select(['article-2', 'article-4'], ['article-2']);
  assert.deepEqual(clone(ui.project.sources.slice(0, 1)), earlierSources);
  const current = ui.project.sources.filter(source => source.searchQuery === 'Community gardens');
  assert.deepEqual(current.filter(source => source.selected).map(source => source.searchArticleId), ['article-2', 'article-4']);
  assert.deepEqual(current.filter(source => source.addedToCsa).map(source => source.searchArticleId), ['article-2']);
  assert.deepEqual(clone(originalDraft.sourceSnapshots), snapshots);
});

test('selecting a removed candidate restores only that candidate and ignores unknown article IDs', () => {
  const ui = setup();
  ui.setQuery(topic);
  const removed = sampleSearchSources(topic).find(source => source.searchArticleId === 'article-2');
  ui.project.removedSourceKeys = [sourceIdentityKey(removed), 'unrelated-removal'];
  ui.project.sources = ui.project.sources.filter(source => !['article-2', 'article-6'].includes(source.searchArticleId));
  ui.select(['article-2', 'not-an-article'], ['article-2', 'not-an-article']);
  assert.equal(ui.project.sources.length, 1);
  const restored = ui.project.sources.find(source => source.searchArticleId === 'article-2');
  assert.equal(restored.searchQuery, topic);
  assert.equal(restored.selected, true);
  assert.equal(restored.addedToCsa, true);
  assert.deepEqual(clone(ui.project.removedSourceKeys), ['unrelated-removal']);
  assert.equal(ui.project.sources.some(source => source.searchArticleId === 'article-6'), false);
  assert.equal(ui.project.sources.some(source => source.searchArticleId === 'not-an-article'), false);
});

test('late selection events from a prior query cannot change current results or prior selections', () => {
  const ui = setup();
  ui.setQuery(topic);
  ui.select(['article-1'], ['article-1']);
  ui.setQuery('Community gardens');
  const before = clone(ui.project);
  ui.select(['article-8'], ['article-8'], topic);
  assert.deepEqual(clone(ui.project), before);
});

test('a recipe captures only checked search results and remains stable after later checkbox changes', () => {
  const ui = setup();
  ui.setQuery(topic);
  ui.select(['article-2', 'article-5'], ['article-2', 'article-5']);
  assert.equal(hasSelectedSources(ui.project), true);
  const recipe = sampleVariant(ui.project, [{ key: 'format', value: 'standard', label: 'Standard Format' }]);
  assert.equal(recipe.status, 'pending');
  assert.equal(recipe.sourceCount, 2);
  assert.deepEqual(recipe.selectedSourceIndexes, [0, 1]);
  assert.deepEqual(recipe.sourceSnapshots.map(source => source.searchArticleId), ['article-2', 'article-5']);
  const before = clone(recipe.sourceSnapshots);
  ui.project.outputs.push(recipe);
  ui.select(['article-8'], ['article-2', 'article-5', 'article-8']);
  ui.project.sources[1].text = 'Edited after adding the recipe';
  assert.deepEqual(clone(recipe.sourceSnapshots), before);
  const next = sampleVariant(ui.project, []);
  assert.equal(next.sourceCount, 1);
  assert.deepEqual(next.sourceSnapshots.map(source => source.searchArticleId), ['article-8']);
});

function control() {
  const classes = new Set();
  const attributes = new Map();
  return {
    hidden: false, value: '', textContent: '', scrollTop: 0,
    classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name), toggle(name, force) { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); } },
    getAttribute: name => attributes.get(name), setAttribute: (name, value) => attributes.set(name, value),
    focus() {}, querySelector: () => null,
  };
}

function editorSetup(project) {
  const nodes = new Map();
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, control()); return nodes.get(selector); };
  const calls = { search: [], welcome: [], editor: [], saved: 0 };
  const context = createContext({
    document: { body: get('body'), title: '' }, $: get, activeProjectId: null, sampleSearchSources, sourceIdentityKey,
    closeComposer() {}, railNavigation: { closeTransient() {} },
    searchExperience: { hide() {}, show(current, options) { calls.search.push({ project: current, options: clone(options) }); } },
    resumeOutputProcessing() {}, projectOutputs, outputIsReady, selectedPendingOutputs,
    populateOutputContent() {}, saveProjects() { calls.saved++; },
    renderSourceStory(current) { calls.welcome.push(current); },
    draftPreferenceValue: (key, value) => value || '',
    richEditor: { open(current) { calls.editor.push(current); } },
    normalizeWordCount, toolDropdowns: { refresh() {} }, updateComposerActions() {}, renderOutputs() {}, renderProjectSources() {},
    requestAnimationFrame(callback) { callback(); }, setNewVariantCollapsed() {}, setContentCollapsed() {}, closeProfile() {},
    sessionStorage: { setItem() {} }, window: { scrollTo() {} },
  });
  runInContext(helpers + '\n' + productionSection('function showEditorProject(', '\nfunction closeProfile('), context);
  context.showEditorProject(project);
  return { nodes, get, calls, context };
}

test('a searched project renders results inside the editor canvas rather than the empty workspace guidance', () => {
  const state = { id: 'search-workspace', title: topic, searchQuery: topic, awaitingOutput: true, linkCards: true, sources: [], outputs: [] };
  const ui = editorSetup(state);
  assert.equal(ui.context.activeProjectId, state.id);
  assert.equal(ui.get('#composer').hidden, false);
  assert.equal(ui.get('#composer').classList.contains('has-search-results'), true);
  assert.equal(ui.get('body').classList.contains('showing-results'), false);
  assert.equal(ui.get('body').classList.contains('showing-composer'), true);
  assert.equal(ui.calls.search.length, 1);
  assert.equal(ui.calls.search[0].project, state);
  assert.equal(ui.calls.search[0].options.workspace, true);
  assert.deepEqual(ui.calls.welcome, []);
  assert.deepEqual(ui.calls.editor, []);
});

test('an ordinary blank workspace still renders its guidance instead of search results', () => {
  const state = { id: 'plain-workspace', title: 'Plain workspace', awaitingOutput: true, sources: [], outputs: [] };
  const ui = editorSetup(state);
  assert.deepEqual(ui.calls.search, []);
  assert.deepEqual(ui.calls.welcome, [state]);
});

test('a completed draft takes priority over stored search results when reopening its project', () => {
  const output = { id: 'draft-1', title: 'Edited article', status: 'ready', draftText: 'Saved draft text' };
  const state = { id: 'ready-workspace', title: topic, searchQuery: topic, awaitingOutput: true, sources: sampleSearchSources(topic), outputs: [output], selectedOutputId: output.id };
  const ui = editorSetup(state);
  assert.deepEqual(ui.calls.search, []);
  assert.equal(ui.calls.editor.length, 1);
  assert.equal(ui.calls.editor[0].draftText, output.draftText);
  assert.deepEqual(ui.calls.welcome, []);
});

function callbackSetup(project) {
  const nodes = new Map();
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, control()); return nodes.get(selector); };
  get('#composer').classList.add('has-search-results');
  const calls = { shown: [], persisted: [], submitted: [], refreshed: 0, sources: [] };
  const context = createContext({
    projects: [project], activeProjectId: project.id, sourceTargetProjectId: null, sourceImport: null,
    sampleSearchSources, sourceIdentityKey, classifyProjectSearchInput, newProjectUpload: { isBusy: () => false },
    $: get, createSearchExperience: callbacks => ({
      ...callbacks,
      show(current, options) { calls.shown.push({ project: current, options: clone(options) }); },
    }),
    saveProjects() { calls.persisted.push(clone(project)); },
    updateComposerActions() { calls.refreshed++; }, renderProjectSources(current) { calls.sources.push(current.id); },
    submitSource(query) { calls.submitted.push({ query, projectId: context.sourceTargetProjectId }); return true; },
  });
  const callbacks = runInContext(helpers + '\n' + productionSection('const searchExperience = createSearchExperience(', "\n$('#draft-text').addEventListener") + '\nsearchExperience;', context);
  return { calls, context, callbacks, get };
}

test('re-searching from the canvas updates the current project and leaves earlier draft content intact', () => {
  const model = setup();
  model.setQuery(topic);
  model.select(['article-1'], ['article-1']);
  model.project.outputs.push(sampleVariant(model.project, []));
  const before = clone(model.project.outputs);
  const ui = callbackSetup(model.project);
  assert.equal(ui.callbacks.onSearch(' Community   gardens ', null, model.project.id), true);
  assert.equal(ui.context.projects.length, 1);
  assert.equal(model.project.searchQuery, 'Community gardens');
  assert.equal(model.project.sources.length, 1);
  assert.deepEqual(clone(model.project.outputs), before);
  assert.equal(ui.calls.shown.length, 1);
  assert.equal(ui.calls.shown[0].project, model.project);
  assert.equal(ui.calls.shown[0].options.workspace, true);
  assert.deepEqual(ui.calls.submitted, []);
  assert.equal(ui.calls.persisted.at(-1).searchQuery, 'Community gardens');
});

test('workspace search rejects mixed input and stale or archived project callbacks without changing project state', () => {
  const model = setup();
  model.setQuery(topic);
  const ui = callbackSetup(model.project);
  for (const query of ['Gardens https://example.com/story', 'https://', ' ']) {
    assert.equal(ui.callbacks.onSearch(query, null, model.project.id), false);
  }
  ui.context.activeProjectId = 'another-project';
  assert.equal(ui.callbacks.onSearch('Gardens', null, model.project.id), false);
  ui.context.activeProjectId = model.project.id;
  model.project.archivedAt = 1;
  assert.equal(ui.callbacks.onSearch('Gardens', null, model.project.id), false);
  assert.equal(model.project.searchQuery, topic);
  assert.deepEqual(ui.calls.persisted, []);
  assert.deepEqual(ui.calls.shown, []);
  assert.deepEqual(ui.calls.submitted, []);
});

test('pasting a URL into the canvas search imports it into the current project', () => {
  const model = setup();
  model.setQuery(topic);
  const ui = callbackSetup(model.project);
  const url = 'https://example.com/article';
  assert.equal(ui.callbacks.onSearch(url, null, model.project.id), true);
  assert.deepEqual(ui.calls.submitted, [{ query: url, projectId: model.project.id }]);
  assert.equal(model.project.searchQuery, topic);
  assert.deepEqual(ui.calls.shown, []);
});

test('canvas selection callbacks persist current candidates, refresh controls, and ignore obsolete queries', () => {
  const model = setup();
  model.setQuery(topic);
  const ui = callbackSetup(model.project);
  ui.get('#show-sources').setAttribute('aria-expanded', 'true');
  ui.callbacks.onSelectionChange(model.project.id, ['article-3'], ['article-3'], { workspace: true, query: topic });
  assert.deepEqual(model.project.sources.filter(source => source.selected).map(source => source.searchArticleId), ['article-3']);
  assert.equal(ui.calls.persisted.length, 1);
  assert.equal(ui.calls.refreshed, 1);
  assert.deepEqual(ui.calls.sources, [model.project.id]);
  const before = clone(model.project);
  ui.callbacks.onSelectionChange(model.project.id, ['article-7'], ['article-7'], { workspace: true, query: 'Obsolete query' });
  assert.deepEqual(clone(model.project), before);
  assert.equal(ui.calls.persisted.length, 1);
});

test('canvas direction edits synchronize the New Draft field and clear an applied saved setup', () => {
  const model = setup();
  model.setQuery(topic);
  model.project.variantPreset = { id: 'saved-recipe' };
  const ui = callbackSetup(model.project);
  ui.callbacks.onDirectionChange(model.project.id, 'Focus on the local angle');
  assert.equal(model.project.editorialDirection, 'Focus on the local angle');
  assert.equal(ui.get('#composer-editorial-direction').value, 'Focus on the local angle');
  assert.equal(model.project.variantPreset, undefined);
  assert.equal(ui.calls.persisted.at(-1).editorialDirection, 'Focus on the local angle');
});

test('reopening a finished search project clears a stale search view and preserves its draft and sources', () => {
  const output = { id: 'draft-1', title: 'Edited article', status: 'ready', draftText: 'Saved draft text' };
  const state = { id: 'search-workspace', title: topic, searchQuery: topic, awaitingOutput: true, viewOriginalDraft: true, sources: sampleSearchSources(topic), outputs: [output], selectedOutputId: output.id };
  const sources = clone(state.sources);
  const ui = editorSetup(state);
  assert.deepEqual(ui.calls.search, []);
  assert.equal(ui.get('#composer').classList.contains('has-editor'), true);
  assert.equal(ui.get('#composer').classList.contains('has-search-results'), false);
  assert.equal(ui.calls.editor.length, 1);
  assert.equal(ui.calls.editor[0].draftText, output.draftText);
  assert.equal(state.viewOriginalDraft, false);
  assert.equal(state.selectedOutputId, output.id);
  assert.equal(state.searchQuery, topic);
  assert.deepEqual(state.sources, sources);
  assert.deepEqual(state.outputs, [output]);
  assert.equal(ui.calls.saved, 1);
});


test('applying and clearing a saved draft setup keeps workspace search Editorial Direction synchronized', () => {
  const current = { id: 'search-workspace', searchQuery: topic, sources: sampleSearchSources(topic), outputs: [] };
  const direction = 'Focus on local businesses and the opening date';
  const library = { id: 'library-project', outputs: [{
    id: 'favorite-draft', title: 'Saved setup', isFavorite: true,
    toolPreferences: { format: 'standard', audience: '', voice: '' },
    editorialDirection: direction, targetWordCount: 'short',
  }] };
  const nodes = new Map();
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, control()); return nodes.get(selector); };
  get('#composer').classList.add('has-search-results');
  const synced = [];
  const persisted = [];
  const context = createContext({
    projects: [current, library], activeProjectId: current.id, $: get,
    richEditor: { flush() {} }, ensureComposerProject: () => current,
    applySavedDraftSetup, clearSavedDraftSetup,
    searchExperience: { syncDirection(value) { synced.push(value); get('#results-editorial-direction').value = value; } },
    setNewVariantCollapsed() {}, toolDropdowns: { refresh() {} }, updateComposerActions() {},
    saveProjects() { persisted.push(clone(current)); return true; }, notify() {},
  });
  runInContext(productionSection('function applySavedDraft(', '\nfunction removeSavedDraft('), context);
  context.applySavedDraft(library.id, 'favorite-draft');
  assert.equal(current.editorialDirection, direction);
  assert.equal(get('#composer-editorial-direction').value, direction);
  assert.equal(get('#results-editorial-direction').value, direction);
  assert.deepEqual(synced, [direction]);
  assert.equal(persisted.at(-1).editorialDirection, direction);
  context.applySavedDraft(null, null);
  assert.equal(current.editorialDirection, '');
  assert.equal(get('#composer-editorial-direction').value, '');
  assert.equal(get('#results-editorial-direction').value, '');
  assert.deepEqual(synced, [direction, '']);
  assert.equal(persisted.at(-1).editorialDirection, '');
  assert.equal(current.variantPreset, undefined);
  assert.equal(library.outputs[0].editorialDirection, direction, 'clearing the choice preserves its saved setup');
});

test('canceling an unfinished source addition removes its temporary source and late readiness cannot recreate it', () => {
  const ui = setup();
  ui.setQuery(topic);
  ui.select(['article-4']);
  assert.equal(ui.project.sources.length, 1);
  assert.equal(ui.project.sources[0].addedToCsa, false);
  ui.select([]);
  assert.deepEqual(clone(ui.project.sources), []);
  ui.select([], ['article-4']);
  assert.deepEqual(clone(ui.project.sources), []);
});

test('completed sources remain available when unchecked or when a query changes', () => {
  const ui = setup();
  ui.setQuery(topic);
  ui.select(['article-4'], ['article-4']);
  const source = ui.project.sources[0];
  ui.select([]);
  assert.equal(ui.project.sources.length, 1);
  assert.equal(source.selected, false);
  assert.equal(source.addedToCsa, true);
  ui.setQuery('Community gardens');
  assert.equal(ui.project.sources.length, 1);
  assert.equal(ui.project.sources[0], source);
  ui.setQuery(topic);
  assert.equal(ui.project.sources[0], source);
});

test('reopening a legacy search removes untouched auto-seeded candidates and persists the empty source list', () => {
  const state = { id: 'legacy-workspace', title: topic, searchQuery: topic, awaitingOutput: true, sources: sampleSearchSources(topic).map(source => ({ ...source, selected: false, addedToCsa: false })), outputs: [] };
  const ui = editorSetup(state);
  assert.deepEqual(clone(state.sources), []);
  assert.equal(ui.calls.saved, 1);
  assert.equal(ui.calls.search.length, 1);
  assert.deepEqual(clone(ui.calls.search[0].project.sources), []);
});

test('legacy cleanup preserves edited, selected, completed, and captured sources while removing untouched candidates', () => {
  const stubs = sampleSearchSources(topic).map(source => ({ ...source, selected: false, addedToCsa: false }));
  stubs[0].text = 'My edited material';
  stubs[1].selected = true;
  stubs[2].addedToCsa = true;
  stubs[4].notes = 'Additional saved notes';
  const captured = clone(stubs[3]);
  const state = { id: 'legacy-workspace', sources: stubs, outputs: [{ id: 'saved', title: 'Saved draft', sourceSnapshots: [captured] }] };
  const ui = setup(state);
  ui.setQuery(topic);
  assert.deepEqual(state.sources.map(source => source.searchArticleId), ['article-1', 'article-2', 'article-3', 'article-4', 'article-5']);
  assert.equal(state.sources[0].text, 'My edited material');
  assert.deepEqual(state.outputs[0].sourceSnapshots, [captured]);
  ui.select([], []);
  assert.deepEqual(state.sources.map(source => source.searchArticleId), ['article-1', 'article-3', 'article-4', 'article-5']);
  assert.deepEqual(state.outputs[0].sourceSnapshots, [captured]);
});

test('legacy cleanup preserves source positions used by drafts without captured snapshots', () => {
  const sources = sampleSearchSources(topic).map(source => ({ ...source, selected: false, addedToCsa: false }));
  const state = { id: 'legacy-workspace', sources, outputs: [{ id: 'old-draft', title: 'Old draft', selectedSourceIndexes: [4] }] };
  const ui = setup(state);
  ui.setQuery(topic);
  assert.equal(state.sources, sources);
  assert.equal(state.sources[4].searchArticleId, 'article-5');
});
