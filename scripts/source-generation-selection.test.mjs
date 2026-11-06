import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { draftOptions, hasDraftSelection } from '../dist/draft-options.js';
import { applySavedDraftSetup, clearSavedDraftSetup } from '../dist/saved-draft-setups.js';
import { syncOwnMaterialSource } from '../dist/own-material-source.js';
import { hasSelectedSources, projectOutputs, sampleVariant, selectedPendingOutputs } from '../dist/outputs.js';
import { sampleSearchSources } from '../dist/search.js';
import { sourceIdentityKey } from '../dist/source-model.js';
import { setProjectWordCount } from '../dist/variant-word-count.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
function productionSection(start, end) {
  const from = app.indexOf(start);
  const until = app.indexOf(end, from);
  assert.ok(from >= 0 && until > from, `Production section: ${start}`);
  return app.slice(from, until);
}
const production = [
  productionSection('function setWorkspaceSearchQuery(', '\nfunction startSearch('),
  productionSection('function updateComposerActions()', '\nfunction ensureComposerProject('),
  productionSection('function applySavedDraft(', '\nfunction removeSavedDraft('),
  productionSection('function renderProjectSources(', '\nfunction removeProjectSource('),
  productionSection('const projectSourcesPanel = createProjectSources({', '\nconst draftSourcesPopover ='),
  productionSection("$('.create-variant').addEventListener('click'", "\n$('#output-list').addEventListener"),
].join('\n');

function setup(project, { onFlush = () => {}, onRenderSources = () => ({ selectionChanged: false }), hasContent = true, libraryProjects = [] } = {}) {
  const classes = new Set();
  const controls = new Map([
    ['#composer', { hidden: false, classList: { contains: name => classes.has(name) } }],
    ['#material-editor', { hidden: false }],
    ['#output-placeholder', { hidden: true }],
    ['#content-preview', { hidden: true }],
    ['#composer-editorial-direction', { value: '' }],
    ['#composer-target-word-count', { value: 'short' }],
    ['#composer-format-trigger', { focus() {} }],
  ]);
  for (const key of ['format', 'audience', 'voice']) {
    controls.set(`#composer-${key}`, {
      value: key === 'format' ? 'standard' : '', disabled: false,
      options: draftOptions.find(option => option.key === key).options.map(option => ({ value: option.value, textContent: option.label })),
      get selectedIndex() { return this.options.findIndex(option => option.value === this.value); },
    });
  }
  const handlers = new Map();
  const create = { disabled: false, focus() {}, addEventListener: (name, handler) => handlers.set(name, handler) };
  controls.set('.create-variant', create);
  const view = { callbacks: null, events: [], persisted: [], canvas: [], opened: [], panelRenders: [], savedDraftRenders: [] };
  const context = createContext({
    projects: [project, ...libraryProjects], activeProjectId: project.id, sampleSearchSources, sourceIdentityKey,
    $: selector => {
      assert.ok(controls.has(selector), `Unexpected app selector ${selector}`);
      return controls.get(selector);
    },
    createProjectSources: options => {
      view.callbacks = options;
      return { render(current, options) {
        view.events.push('render');
        view.panelRenders.push({ project: current, variant: options.variant });
        return onRenderSources(current, options);
      } };
    },
    removeProjectSource() {}, downloadSource() {},
    richEditor: { hasContent: () => hasContent, flush() { view.events.push('flush'); onFlush(project); } },
    toolDropdowns: { refresh() {}, close() {} },
    savedDrafts: { render() { view.savedDraftRenders.push(project.id); } },
    contentPreview: { hasContent: () => true },
    searchExperience: {
      show(current, options) { view.events.push('sync'); view.canvas.push({ project: structuredClone(current), options }); },
      refreshSources(current) { view.events.push('refresh-search'); view.canvas.push({ project: structuredClone(current), options: { workspace: true } }); },
    },
    saveProjects() { view.events.push('save'); view.persisted.push(structuredClone(project)); },
    setNewVariantCollapsed() {}, ensureComposerProject: () => project, notify() {},
    applySavedDraftSetup, clearSavedDraftSetup,
    showEditorProject: current => view.opened.push(current.id),
    outputViews: new Map(), window: { matchMedia: () => ({ matches: false }) },
    railNavigation: { open() {} }, breakpointQuery: () => '',
    hasSelectedSources, hasDraftSelection, projectOutputs, sampleVariant, selectedPendingOutputs, setProjectWordCount,
  });
  runInContext(production, context);
  return {
    ...view, project, classes, create, controls,
    refresh: () => runInContext('updateComposerActions()', context),
    renderSources: () => runInContext('renderProjectSources(projects[0])', context),
    createDraft: () => handlers.get('click')(),
    applySaved: (projectId, outputId) => context.applySavedDraft(projectId, outputId),
    toggle(index, checked) {
      view.callbacks.onBeforeSelectionChange();
      project.sources[index].selected = checked;
      view.callbacks.onSelectionChange(project.id);
    },
  };
}

const source = (title, selected = true) => ({ type: 'text', title, text: `${title} captured material`, selected });
const project = sources => ({ id: 'story', title: 'Project', sources, outputs: [], selectedOutputIds: [], targetWordCount: 'short' });

test('Project Sources changes flush before mutation, persist afterward, and refresh eligibility with an existing editor body', () => {
  const state = project([source('One')]);
  const ui = setup(state);
  ui.refresh();
  assert.equal(ui.create.disabled, false);
  assert.deepEqual(ui.savedDraftRenders, [state.id]);
  ui.toggle(0, false);
  assert.deepEqual(ui.savedDraftRenders, [state.id, state.id]);
  assert.deepEqual(ui.events, ['flush', 'save']);
  assert.equal(ui.persisted.at(-1).sources[0].selected, false);
  assert.equal(ui.create.disabled, true, 'Editor text cannot bypass an empty source selection');
  assert.equal(ui.create.title, 'Select a source first');
  ui.classes.add('has-link-cards');
  ui.toggle(0, true);
  assert.deepEqual(ui.events.slice(-3), ['flush', 'save', 'sync']);
  assert.equal(ui.canvas.at(-1).project.sources[0].selected, true);
  assert.equal(ui.canvas.at(-1).options.embedded, true);
  assert.equal(ui.create.disabled, false);
});

test('Add to List rechecks selected sources after flushing and rejects a stale enabled action', () => {
  const state = project([source('One')]);
  const ui = setup(state, { onFlush(current) { current.sources[0].selected = false; } });
  ui.controls.get('#composer-editorial-direction').value = 'Keep this unsubmitted direction';
  ui.refresh();
  assert.equal(ui.create.disabled, false);
  ui.createDraft();
  assert.equal(state.outputs.length, 0);
  assert.equal(ui.persisted.length, 0);
  assert.equal(ui.opened.length, 0);
  assert.deepEqual(ui.events, ['flush']);
  assert.equal(ui.controls.get('#composer-editorial-direction').value, 'Keep this unsubmitted direction');
});

test('new recipes capture only the current checked sources while earlier draft snapshots remain unchanged', () => {
  const state = project([source('First'), source('Second', false)]);
  const earlier = sampleVariant(state, []);
  earlier.status = 'ready';
  state.outputs.push(earlier);
  const history = structuredClone(earlier.sourceSnapshots);
  const ui = setup(state);
  ui.toggle(0, false);
  assert.equal(ui.create.disabled, true);
  ui.toggle(1, true);
  assert.equal(ui.create.disabled, false);
  ui.createDraft();
  const latest = state.outputs[0];
  assert.equal(state.outputs.length, 2);
  assert.deepEqual(structuredClone(latest.selectedSourceIndexes), [1]);
  assert.equal(latest.sourceCount, 1);
  assert.deepEqual(latest.sourceSnapshots, [state.sources[1]]);
  assert.notEqual(latest.sourceSnapshots[0], state.sources[1]);
  state.sources[1].text = 'Changed project material';
  assert.equal(latest.sourceSnapshots[0].text, 'Second captured material');
  assert.deepEqual(earlier.sourceSnapshots, history);
});


test('Project Sources receives the active output including empty and historical snapshots, and no variant for the original view', () => {
  const state = project([source('Current')]);
  const saved = { id: 'saved', title: 'Saved draft', sourceSnapshots: [source('Saved')] };
  const empty = { id: 'empty', title: 'Empty draft', sourceSnapshots: [] };
  const historical = { id: 'historical', title: 'Historical draft', sourceSnapshots: [source('Removed')] };
  state.outputs = [saved, empty, historical];
  const ui = setup(state);
  for (const output of state.outputs) {
    state.selectedOutputId = output.id;
    ui.renderSources();
    assert.equal(ui.panelRenders.at(-1).project, state);
    assert.equal(ui.panelRenders.at(-1).variant, output);
  }
  state.viewOriginalDraft = true;
  ui.renderSources();
  assert.equal(ui.panelRenders.at(-1).variant, null);
  state.viewOriginalDraft = false;
  state.selectedOutputId = 'missing';
  ui.renderSources();
  assert.equal(ui.panelRenders.at(-1).variant, null);
  assert.equal(ui.persisted.length, 0);
});

test('a changed draft baseline is persisted and immediately refreshes Add to List eligibility', () => {
  const state = project([source('Used', false)]);
  state.outputs = [{ id: 'saved', title: 'Saved draft', sourceSnapshots: [source('Used')] }];
  state.selectedOutputId = 'saved';
  const ui = setup(state, { onRenderSources(current) {
    current.sources[0].selected = true;
    return { selectionChanged: true };
  } });
  ui.refresh();
  assert.equal(ui.create.disabled, true);
  ui.renderSources();
  assert.deepEqual(ui.events, ['render', 'save']);
  assert.equal(ui.persisted.length, 1);
  assert.equal(ui.persisted[0].sources[0].selected, true);
  assert.equal(ui.create.disabled, false);
  assert.equal(ui.create.title, 'Add to List');
});

test('an unchanged Sources render does not save or refresh creation actions', () => {
  const state = project([source('Used')]);
  const ui = setup(state);
  ui.create.disabled = true;
  ui.create.title = 'unchanged control state';
  ui.renderSources();
  assert.deepEqual(ui.events, ['render']);
  assert.equal(ui.persisted.length, 0);
  assert.equal(ui.create.disabled, true);
  assert.equal(ui.create.title, 'unchanged control state');
});


test('Add to List captures the direction on its recipe and clears the field and saved starter guidance', () => {
  const state = project([source('Selected source')]);
  const ui = setup(state);
  const direction = 'Focus on local businesses.\nKeep the tone conversational.';
  ui.controls.get('#composer-editorial-direction').value = direction;
  ui.createDraft();
  const first = state.outputs[0];
  assert.equal(first.editorialDirection, direction);
  assert.equal(ui.controls.get('#composer-editorial-direction').value, '');
  assert.equal(state.editorialDirection, '');
  assert.equal(ui.persisted.at(-1).editorialDirection, '');
  assert.equal(ui.persisted.at(-1).outputs[0].editorialDirection, direction);
  ui.controls.get('#composer-format').value = 'standard';
  ui.refresh();
  ui.createDraft();
  assert.equal(state.outputs.length, 2);
  assert.equal(state.outputs[0].editorialDirection, '');
  assert.equal(first.editorialDirection, direction, 'the next addition must not change the earlier recipe');
});


test('Sources selections synchronize embedded search results and gate New Draft settings', () => {
  const state = project([source('First search result', false), source('Second search result', false)]);
  state.searchQuery = 'Local news';
  const ui = setup(state);
  ui.classes.add('has-search-results');
  ui.refresh();
  assert.equal(ui.create.disabled, true);
  assert.equal(ui.controls.get('#composer-format').disabled, true);
  ui.toggle(1, true);
  assert.deepEqual(ui.events, ['flush', 'save', 'refresh-search']);
  assert.equal(ui.canvas.at(-1).project.sources[1].selected, true);
  assert.equal(ui.create.disabled, false);
  assert.equal(ui.controls.get('#composer-format').disabled, false);
  ui.createDraft();
  assert.equal(state.outputs[0].sourceCount, 1);
  assert.deepEqual(state.outputs[0].sourceSnapshots.map(item => item.title), ['Second search result']);
});


test('canceling a pending search source from Sources removes its temporary row and refreshes the results', () => {
  const pending = { ...sampleSearchSources('Local news')[0], selected: true, addedToCsa: false };
  const state = project([pending]);
  state.searchQuery = 'Local news';
  const ui = setup(state);
  ui.classes.add('has-search-results');
  ui.toggle(0, false);
  assert.deepEqual(structuredClone(state.sources), []);
  assert.deepEqual(ui.events, ['flush', 'save', 'render', 'refresh-search']);
  assert.equal(ui.panelRenders.length, 1);
  assert.equal(ui.create.disabled, true);
  assert.deepEqual(ui.canvas.at(-1).project.sources, []);
});


test('applying saved settings enables Add to List for a title-only material source and captures its settings', () => {
  const state = project([]);
  const material = {
    id: 'title-only-material', title: 'A title without body text', titleProvided: true,
    ownMaterial: true, status: 'ready', document: { ops: [{ insert: '\n' }] }, draftText: '',
  };
  state.outputs.push(material);
  state.selectedOutputId = material.id;
  syncOwnMaterialSource(state, material);
  const saved = {
    id: 'saved-settings', title: 'Saved Draft 7', isFavorite: true,
    toolPreferences: { format: 'standard', audience: 'millennial-pop-culture', voice: 'us-weekly' },
    editorialDirection: 'Focus on the community', targetWordCount: 'long',
  };
  const library = { id: 'settings-library', outputs: [saved] };
  const before = structuredClone(saved);
  const ui = setup(state, { hasContent: false, libraryProjects: [library] });
  for (const key of ['format', 'audience', 'voice']) ui.controls.get(`#composer-${key}`).value = '';
  ui.refresh();
  assert.equal(ui.create.disabled, true);
  ui.applySaved(library.id, saved.id);
  assert.equal(ui.create.disabled, false);
  assert.equal(ui.create.title, 'Add to List');
  for (const [key, value] of Object.entries(saved.toolPreferences)) {
    assert.equal(ui.controls.get(`#composer-${key}`).value, value);
    assert.equal(ui.controls.get(`#composer-${key}`).disabled, false);
  }
  ui.createDraft();
  const recipe = state.outputs[0];
  assert.equal(recipe.status, 'pending');
  assert.deepEqual(recipe.toolPreferences, saved.toolPreferences);
  assert.deepEqual(structuredClone(recipe.labels), [
    { key: 'format', label: 'Standard Format' },
    { key: 'audience', label: 'Millennial Pop-Culture Fan' },
    { key: 'voice', label: 'Us Weekly' },
  ]);
  assert.equal(recipe.editorialDirection, saved.editorialDirection);
  assert.equal(recipe.targetWordCount, 'long');
  assert.deepEqual(recipe.sourceSnapshots, [state.sources[0]]);
  assert.equal(recipe.sourceSnapshots[0].text, material.title);
  assert.equal(recipe.sourceCount, 1);
  assert.deepEqual(saved, before, 'applying a saved setup must not mutate the saved original');
  assert.equal(state.outputs[1], material, 'creating a recipe keeps its own-material editor');
});

test('a blank own-material editor can configure a recipe from another selected project source', () => {
  const state = project([source('Selected interview notes'), source('Unchecked notes', false)]);
  const material = { id: 'blank-material', title: 'Untitled story', ownMaterial: true, status: 'ready', draftText: '', sourceSnapshots: [] };
  state.outputs.push(material);
  state.selectedOutputId = material.id;
  const ui = setup(state, { hasContent: false });
  ui.refresh();
  assert.equal(ui.create.disabled, false);
  assert.equal(ui.controls.get('#composer-format').disabled, false);
  ui.createDraft();
  const recipe = state.outputs[0];
  assert.deepEqual(recipe.toolPreferences, { format: 'standard', audience: '', voice: '' });
  assert.deepEqual(recipe.sourceSnapshots, [state.sources[0]]);
  assert.equal(recipe.sourceCount, 1);
  assert.equal(state.outputs[1], material);
  assert.equal(material.draftText, '');
});

test('selected sources do not bypass missing settings or processing, and a saved preset does not bypass source selection', () => {
  const state = project([source('Selected notes')]);
  const ui = setup(state, { hasContent: false });
  ui.controls.get('#composer-format').value = '';
  ui.refresh();
  assert.equal(ui.create.disabled, true);
  assert.equal(ui.create.title, 'Select a setting first');
  ui.controls.get('#composer-format').value = 'standard';
  state.outputProcessing = { kind: 'creation' };
  ui.refresh();
  assert.equal(ui.create.disabled, true);
  assert.equal(ui.controls.get('#composer-format').disabled, true);
  assert.equal(ui.create.title, 'Creating Draft');
  delete state.outputProcessing;
  state.sources[0].selected = false;
  state.variantPreset = { projectId: 'library', outputId: 'saved' };
  ui.refresh();
  assert.equal(ui.controls.get('#composer-format').disabled, false, 'saved settings remain configurable');
  assert.equal(ui.create.disabled, true);
  assert.equal(ui.create.title, 'Select a source first');
  ui.createDraft();
  assert.equal(state.outputs.length, 0);
});
