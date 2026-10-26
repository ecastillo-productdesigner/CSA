import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { hasDraftSelection } from '../dist/draft-options.js';
import { hasSelectedSources, projectOutputs, sampleVariant, selectedPendingOutputs } from '../dist/outputs.js';
import { setProjectWordCount } from '../dist/variant-word-count.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
function productionSection(start, end) {
  const from = app.indexOf(start);
  const until = app.indexOf(end, from);
  assert.ok(from >= 0 && until > from, `Production section: ${start}`);
  return app.slice(from, until);
}
const production = [
  productionSection('function updateComposerActions()', '\nfunction ensureComposerProject('),
  productionSection('function renderProjectSources(project)', '\nfunction removeProjectSource('),
  productionSection('const projectSourcesPanel = createProjectSources({', '\nconst draftSourcesPopover ='),
  productionSection("$('.create-variant').addEventListener('click'", "\n$('#output-list').addEventListener"),
].join('\n');

function setup(project, { onFlush = () => {}, onRenderSources = () => ({ selectionChanged: false }) } = {}) {
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
      selectedIndex: 0, options: [{ textContent: key === 'format' ? 'Standard Format' : 'None Selected' }],
    });
  }
  const handlers = new Map();
  const create = { disabled: false, addEventListener: (name, handler) => handlers.set(name, handler) };
  controls.set('.create-variant', create);
  const view = { callbacks: null, events: [], persisted: [], canvas: [], opened: [], panelRenders: [] };
  const context = createContext({
    projects: [project], activeProjectId: project.id,
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
    richEditor: { hasContent: () => true, flush() { view.events.push('flush'); onFlush(project); } },
    toolDropdowns: { refresh() {}, close() {} },
    contentPreview: { hasContent: () => true },
    searchExperience: { show(current, options) { view.events.push('sync'); view.canvas.push({ project: structuredClone(current), options }); } },
    saveProjects() { view.events.push('save'); view.persisted.push(structuredClone(project)); },
    setNewVariantCollapsed() {},
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
  ui.toggle(0, false);
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
  ui.refresh();
  assert.equal(ui.create.disabled, false);
  ui.createDraft();
  assert.equal(state.outputs.length, 0);
  assert.equal(ui.persisted.length, 0);
  assert.equal(ui.opened.length, 0);
  assert.deepEqual(ui.events, ['flush']);
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
