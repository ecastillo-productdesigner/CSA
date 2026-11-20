import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { currentAudienceComparison, toggleAudienceComparison } from '../dist/audience-comparison-selection.js';
import { createSimilaritySourceDraft } from '../dist/audience-similarity-source.js';
import { projectOutputs, outputIsReady, selectedPendingOutputs } from '../dist/outputs.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = app.indexOf('function updateAudienceSimilarityAction(');
const end = app.indexOf('function selectOutputView(', start);
const selectionStart = app.indexOf("$('#output-list').addEventListener('click'");
const selectionEnd = app.indexOf('function openVariantDirection(', selectionStart);
assert.ok(start >= 0 && end > start && selectionStart >= 0 && selectionEnd > selectionStart);
const production = app.slice(start, end) + app.slice(selectionStart, selectionEnd);
const draft = (id, audience = 'Parents') => ({ id, title: `Story ${id}`, status: 'ready', draftText: 'Families are discussing the school proposal.', toolPreferences: { audience }, labels: [{ key: 'audience', label: audience }] });
function setup({ view = 'created', outputs = [draft('one'), draft('two')], selected = [], onFlush = () => {}, mobile = false } = {}) {
  const project = { id: 'project', outputs };
  const footer = { hidden: true };
  let click;
  const button = { disabled: true, addEventListener(type, handler) { assert.equal(type, 'click'); click = handler; } };
  const items = outputs.map(output => ({ tagName: 'LI', dataset: { outputId: output.id } }));
  const controls = outputs.map((output, index) => ({ dataset: { outputId: output.id }, disabled: false, focus() {}, closest: selector => selector === 'li' ? items[index] : null }));
  const listeners = {};
  const list = { visible: true, addEventListener(type, handler) { listeners[type] = handler; }, querySelectorAll: () => controls, getClientRects() { return this.visible ? [{}] : []; } };
  const calls = { flushed: 0, opened: [], notifications: [], rendered: 0, saved: 0, editorOpened: [], batches: [], canceled: 0, contentCollapsed: [], rails: [], mediaQueries: [] };
  let pending = null;
  const loading = {
    isRunning: false,
    start(batch) {
      if (this.isRunning) return false;
      this.isRunning = true;
      button.disabled = true;
      pending = batch;
      calls.batches.push(batch);
      return true;
    },
    cancel() {
      if (this.isRunning) calls.canceled++;
      this.isRunning = false;
      pending = null;
    },
    complete() {
      if (!pending) return false;
      const batch = pending;
      pending = null;
      this.isRunning = false;
      batch.onComplete();
      return true;
    },
  };
  const context = createContext({
    projects: [project], activeProjectId: project.id, outputViews: new Map([[project.id, view]]),
    audienceComparisonSelections: new Map([[project.id, selected]]), currentAudienceComparison, toggleAudienceComparison, createSimilaritySourceDraft, projectOutputs, outputIsReady, selectedPendingOutputs,
    $: selector => ({ '#audience-similarity-footer': footer, '#check-audience-similarity': button, '#output-list': list })[selector],
    document: { activeElement: null },
    window: { matchMedia(query) { calls.mediaQueries.push(query); return { matches: mobile }; } },
    breakpointQuery: () => '(max-width: 48rem)',
    setContentCollapsed(value) { calls.contentCollapsed.push(value); },
    railNavigation: { open(name) { calls.rails.push(name); } },
    richEditor: { flush() { calls.flushed++; onFlush(project); } },
    audienceSimilarityDialog: { open(payload) { calls.opened.push(payload); } },
    audienceSimilarityLoading: loading,
    renderOutputs() { loading.cancel(); calls.rendered++; context.updateAudienceSimilarityAction(project); },
    notify(message) { calls.notifications.push(message); },
    saveProjects() { calls.saved++; return true; },
    openEditorTab(id) { calls.editorOpened.push(id); },
  });
  runInContext(production, context);
  return {
    project, footer, button, calls, context, loading, items, list, recalculate: request => context.startAudienceSimilarity(request), complete: () => loading.complete(), click: () => click(), refresh: () => context.updateAudienceSimilarityAction(project),
    selected: () => context.audienceComparisonSelections.get(project.id),
    select(id) {
      const control = controls.find(item => item.dataset.outputId === id);
      context.document.activeElement = control;
      listeners.click({ target: { closest: selector => selector === '.output-card' ? { querySelector: () => control } : null } });
    },
    clickCardAction() { listeners.click({ target: { closest: selector => selector === '.output-card-actions' ? {} : null } }); },
  };
}

test('Drafted requires at least two explicitly selected cards', () => {
  const ui = setup();
  ui.refresh();
  assert.equal(ui.footer.hidden, false);
  assert.equal(ui.button.disabled, true);
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
  ui.select('one');
  assert.equal(ui.button.disabled, true);
  ui.select('two');
  assert.equal(ui.button.disabled, false);
  ui.select('one');
  assert.equal(ui.button.disabled, true);
});

test('comparison selection is separate from the active editor and pending selection', () => {
  const ui = setup();
  ui.project.selectedOutputId = 'one';
  ui.project.selectedOutputIds = ['pending'];
  ui.clickCardAction();
  ui.select('one'); ui.select('two');
  assert.deepEqual(ui.calls.editorOpened, []);
  assert.equal(ui.project.selectedOutputId, 'one');
  assert.deepEqual(ui.project.selectedOutputIds, ['pending']);
  assert.deepEqual(ui.selected(), ['one', 'two']);
  ui.context.outputViews.set('project', 'pending');
  ui.refresh();
  assert.equal(ui.footer.hidden, true);
  assert.equal(ui.button.disabled, true);
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
});

test('opens the exact selected pair with current edited text and a separate read-only Source Draft', () => {
  const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], selected: ['three', 'one'], onFlush(project) { project.outputs[0].draftText = 'Latest edited body from the current editor.'; } });
  ui.project.sourceDraft = { title: 'Original article', draftText: 'The original article describes the school proposal.' };
  const originalSource = structuredClone(ui.project.sourceDraft);
  ui.refresh(); ui.click();
  assert.equal(ui.calls.flushed, 1);
  assert.equal(ui.calls.opened.length, 0);
  ui.complete();
  assert.equal(ui.calls.flushed, 2);
  assert.equal(ui.calls.opened.length, 1);
  assert.deepEqual(ui.calls.opened[0].groups[0].drafts.map(item => item.id), ['three', 'one']);
  assert.equal(ui.calls.opened[0].groups[0].drafts[1].draftText, 'Latest edited body from the current editor.');
  assert.equal(ui.calls.opened[0].opener, ui.button);
  const source = ui.calls.opened[0].sourceDraft;
  assert.equal(source.isSimilaritySource, true);
  assert.equal(source.similaritySourceOrigin, 'source-draft');
  assert.equal(source.draftText, originalSource.draftText);
  assert.notEqual(source, ui.project.sourceDraft);
  assert.deepEqual([source, ...ui.calls.opened[0].groups[0].drafts].map(item => item.id), ['similarity-source:project', 'three', 'one']);
  assert.deepEqual(ui.selected(), ['three', 'one']);
  assert.deepEqual(ui.project.outputs.map(item => item.id), ['one', 'two', 'three']);
  assert.equal(ui.calls.opened[0].groups[0].drafts.some(item => item.isSimilaritySource), false);
  assert.equal(ui.project.outputs.includes(source), false);
  assert.deepEqual(ui.project.sourceDraft, originalSource);
  assert.equal(ui.calls.saved, 0);
  assert.equal(ui.project.outputProcessing, undefined);
});

test('three selected drafts enable comparison and all selections reach the popup', () => {
  const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')] });
  ui.select('one'); ui.select('two'); ui.select('three');
  assert.deepEqual(ui.selected(), ['one', 'two', 'three']);
  assert.deepEqual(ui.calls.notifications, []);
  assert.equal(ui.button.disabled, false);
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
  ui.complete();
  assert.deepEqual(ui.calls.opened[0].groups[0].drafts.map(item => item.id), ['one', 'two', 'three']);
  ui.select('one');
  assert.deepEqual(ui.selected(), ['two', 'three']);
  assert.equal(ui.button.disabled, false);
});

test('different selected audiences enable comparison and open the popup', () => {
  const ui = setup({ outputs: [draft('one'), draft('two', 'Students')] });
  ui.select('one'); ui.select('two');
  assert.deepEqual(ui.selected(), ['one', 'two']);
  assert.equal(ui.button.disabled, false);
  assert.deepEqual(ui.calls.notifications, []);
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
  ui.complete();
  assert.equal(ui.calls.opened.length, 1);
  assert.deepEqual(ui.calls.opened[0].groups[0].drafts.map(item => item.id), ['one', 'two']);
});

test('deleting the current body during flush invalidates a previously selected pair', () => {
  const ui = setup({ selected: ['one', 'two'], onFlush(project) { project.outputs[0].document = { ops: [] }; } });
  ui.refresh();
  assert.equal(ui.button.disabled, false);
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.button.disabled, true);
  assert.deepEqual(ui.selected(), ['two']);
});

test('deleted, archived, and inactive projects cannot open a comparison', () => {
  for (const update of [ui => { ui.project.deletedAt = 1; }, ui => { ui.project.archivedAt = 1; }, ui => { ui.context.activeProjectId = 'another'; }]) {
    const ui = setup({ selected: ['one','two'] }); update(ui); ui.click();
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.calls.flushed, 0);
  }
});

test('processing or removed selected drafts are pruned instead of silently substituting another pair', () => {
  const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], selected: ['one','two'] });
  ui.project.outputProcessing = { kind: 'revision', ids: ['one'] };
  ui.refresh(); ui.click();
  assert.equal(ui.button.disabled, true);
  assert.deepEqual(ui.selected(), ['two']);
  assert.equal(ui.calls.opened.length, 0);
  ui.project.outputs = ui.project.outputs.filter(item => item.id !== 'two');
  ui.refresh();
  assert.deepEqual(ui.selected(), []);
});


test('pending card clicks still select content for drafting rather than comparison', () => {
  const ui = setup({ view: 'pending', outputs: [{ ...draft('one'), status: 'pending' }] });
  ui.select('one');
  assert.deepEqual(Array.from(ui.project.selectedOutputIds), ['one']);
  assert.deepEqual(ui.selected(), []);
  assert.equal(ui.calls.saved, 1);
  ui.select('one');
  assert.deepEqual(Array.from(ui.project.selectedOutputIds), []);
});


test('one loading batch includes only the selected cards and blocks duplicate requests until completion', () => {
  const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], selected: ['three', 'one'] });
  ui.refresh();
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.loading.isRunning, true);
  assert.equal(ui.calls.batches.length, 1);
  assert.deepEqual(Array.from(ui.calls.batches[0].items), [ui.items[0], ui.items[2]]);
  assert.equal(ui.button.disabled, true);
  ui.refresh();
  assert.equal(ui.button.disabled, true, 'refreshing eligibility keeps a running check disabled');
  ui.click();
  assert.equal(ui.calls.batches.length, 1);
  assert.equal(ui.calls.flushed, 1);
  assert.deepEqual(ui.selected(), ['three', 'one']);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.equal(ui.complete(), true);
  assert.equal(ui.loading.isRunning, false);
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.calls.flushed, 2);
  assert.equal(ui.calls.opened.length, 1);
  assert.deepEqual(ui.calls.opened[0].groups[0].drafts.map(item => item.id), ['three', 'one']);
  assert.equal(ui.complete(), false);
  assert.equal(ui.calls.opened.length, 1);
});

test('completion uses the latest editor flush rather than the body from the start of the delay', () => {
  let flushCount = 0;
  const ui = setup({ selected: ['one', 'two'], onFlush(project) {
    flushCount++;
    project.outputs[0].draftText = flushCount === 1 ? 'The initial editor body.' : 'The final editor body after the loading delay.';
  } });
  ui.click();
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.project.outputs[0].draftText, 'The initial editor body.');
  ui.complete();
  assert.equal(ui.calls.opened[0].groups[0].drafts[0].draftText, 'The final editor body after the loading delay.');
  assert.equal(flushCount, 2);
});

test('a delayed comparison is discarded when its project, view, selection, or draft eligibility changes', () => {
  const changes = [
    ['inactive project', ui => { ui.context.activeProjectId = 'another'; }],
    ['deleted project', ui => { ui.project.deletedAt = 1; }],
    ['archived project', ui => { ui.project.archivedAt = 1; }],
    ['replacement project object', ui => { ui.context.projects = [{ ...ui.project }]; }],
    ['different view', ui => { ui.context.outputViews.set(ui.project.id, 'pending'); }],
    ['different selected draft', ui => { ui.context.audienceComparisonSelections.set(ui.project.id, ['one', 'three']); }],
    ['selection reordered', ui => { ui.context.audienceComparisonSelections.set(ui.project.id, ['two', 'one']); }],
    ['selection reduced', ui => { ui.context.audienceComparisonSelections.set(ui.project.id, ['one']); }],
    ['draft removed', ui => { ui.project.outputs = ui.project.outputs.filter(output => output.id !== 'two'); }],
    ['draft processing', ui => { ui.project.outputProcessing = { kind: 'revision', ids: ['two'] }; }],
    ['draft body cleared', ui => { ui.project.outputs[1].document = { ops: [] }; }],
  ];
  for (const [reason, change] of changes) {
    const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], selected: ['one', 'two'] });
    ui.click();
    assert.equal(ui.loading.isRunning, true, reason);
    assert.equal(ui.calls.batches.length, 1, reason);
    change(ui);
    ui.complete();
    assert.equal(ui.calls.opened.length, 0, reason);
    assert.equal(ui.loading.isRunning, false, reason);
  }
});


for (const mobile of [false, true]) {
  test(`recalculation uses the shared Content panel loading flow and preserves comparison context on ${mobile ? 'mobile' : 'desktop'}`, () => {
    const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], selected: ['three', 'one'], mobile });
    const sourceDraft = { ...draft('original-source'), isSimilaritySource: true };
    ui.project.sourceDraft = { title: 'A later source', draftText: 'Later source text must not replace the saved comparison baseline.' };
    const request = { draftIds: ['three', 'one'], sourceDraft, editedDraft: ui.project.outputs[0], referenceId: 'three', focusDraftId: 'one', focusOrigin: 'row', scrollLeft: 140, scrollTop: 180 };
    ui.recalculate(request);
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.loading.isRunning, true);
    assert.equal(ui.calls.batches.length, 1);
    assert.deepEqual(Array.from(ui.calls.batches[0].items), [ui.items[0], ui.items[2]]);
    assert.deepEqual(ui.calls.contentCollapsed, [false]);
    assert.deepEqual(ui.calls.rails, mobile ? ['variants'] : []);
    assert.equal(ui.calls.mediaQueries.length, 1);
    ui.complete();
    assert.equal(ui.calls.opened.length, 1);
    const restored = ui.calls.opened[0];
    for (const key of ['sourceDraft', 'editedDraft', 'referenceId', 'focusDraftId', 'focusOrigin', 'scrollLeft', 'scrollTop']) assert.equal(restored[key], request[key], key);
    assert.deepEqual(restored.groups[0].drafts.map(item => item.id), ['three', 'one']);
    assert.deepEqual(ui.selected(), ['three', 'one']);
    assert.equal(restored.opener, ui.button);
  });
}

test('an initial comparison does not reopen the Content panel or mobile rail', () => {
  const ui = setup({ selected: ['one', 'two'], mobile: true });
  ui.click();
  assert.deepEqual(ui.calls.contentCollapsed, []);
  assert.deepEqual(ui.calls.rails, []);
  assert.deepEqual(ui.calls.mediaQueries, []);
  ui.complete();
  assert.equal(ui.calls.opened.length, 1);
});

test('recalculation rejects stale selection IDs and drafts from another project before starting loading', () => {
  for (const request of [
    { draftIds: ['one', 'three'] },
    { draftIds: ['two', 'one'] },
    { draftIds: ['one'] },
    { draftIds: ['one', 'two'], editedDraft: draft('one') },
  ]) {
    const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], selected: ['one', 'two'] });
    ui.recalculate(request);
    assert.equal(ui.calls.batches.length, 0);
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.loading.isRunning, false);
    assert.deepEqual(ui.calls.contentCollapsed, []);
    assert.deepEqual(ui.calls.rails, []);
  }
});

test('closing the Content panel before loading finishes prevents reopening the comparison popup', () => {
  const ui = setup({ selected: ['one', 'two'] });
  ui.recalculate({ draftIds: ['one', 'two'], editedDraft: ui.project.outputs[0], referenceId: 'two' });
  assert.equal(ui.loading.isRunning, true);
  ui.list.visible = false;
  ui.complete();
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.loading.isRunning, false);
});
