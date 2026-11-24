import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { prepareAudienceSimilarities } from '../dist/audience-similarity-summary.js';
import { projectOutputs, outputIsReady, selectedPendingOutputs } from '../dist/outputs.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const loadingStart = app.indexOf('const audienceSimilarityLoading = ');
const loadingEnd = app.indexOf('const newProjectUpload = ', loadingStart);
assert.ok(loadingStart >= 0 && loadingEnd > loadingStart);
const loadingInitialization = app.slice(loadingStart, loadingEnd);
const start = app.indexOf('function updateAudienceSimilarityAction(');
const end = app.indexOf('function selectOutputView(', start);
const selectionStart = app.indexOf("$('#output-list').addEventListener('click'");
const selectionEnd = app.indexOf('function openVariantDirection(', selectionStart);
assert.ok(start >= 0 && end > start && selectionStart >= 0 && selectionEnd > selectionStart);
const production = loadingInitialization + app.slice(start, end) + app.slice(selectionStart, selectionEnd);
const draft = (id, audience = 'Parents') => ({ id, title: `Story ${id}`, status: 'ready', draftText: 'Families are discussing the school proposal.', toolPreferences: { audience }, labels: [{ key: 'audience', label: audience }] });

function setup({ view = 'created', outputs = [draft('one'), draft('two')], onFlush = () => {}, mobile = false } = {}) {
  const project = { id: 'project', outputs };
  const footer = { hidden: false };
  const buttonListeners = [];
  const button = { disabled: false, addEventListener(type, handler) { buttonListeners.push({ type, handler }); } };
  const items = outputs.map(output => ({ tagName: 'LI', dataset: { outputId: output.id } }));
  const controls = outputs.map((output, index) => ({ dataset: { outputId: output.id }, disabled: false, focus() {}, closest: selector => selector === 'li' ? items[index] : null }));
  const links = outputs.map((output, index) => ({ dataset: { viewSimilarities: output.id }, disabled: false, focus() {}, closest: selector => selector === 'li' ? items[index] : null }));
  const listeners = {};
  const list = {
    visible: true,
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelectorAll(selector) { return selector === '.output-open' ? controls : links; },
    getClientRects() { return this.visible ? [{}] : []; },
  };
  const calls = { flushed: 0, opened: [], notifications: [], rendered: 0, saved: 0, editorOpened: [], batches: [], prepared: [], canceled: 0, contentCollapsed: [], rails: [], mediaQueries: [], editorBusy: [] };
  let pending = null;
  let onLoadingBusyChange = () => {};
  const loading = {
    isRunning: false,
    start(batch) {
      if (this.isRunning) return false;
      this.isRunning = true;
      pending = batch;
      calls.batches.push(batch);
      onLoadingBusyChange(true);
      return true;
    },
    cancel() {
      if (!this.isRunning) return;
      calls.canceled++;
      this.isRunning = false;
      pending = null;
      onLoadingBusyChange(false);
    },
    complete() {
      if (!pending) return false;
      const batch = pending;
      pending = null;
      this.isRunning = false;
      onLoadingBusyChange(false);
      batch.onComplete();
      return true;
    },
  };
  const context = createContext({
    projects: [project], activeProjectId: project.id, outputViews: new Map([[project.id, view]]),
    prepareAudienceSimilarities(current) { const result = prepareAudienceSimilarities(current); calls.prepared.push(result); return result; },
    projectOutputs, outputIsReady, selectedPendingOutputs,
    $: selector => ({ '#audience-similarity-footer': footer, '#check-audience-similarity': button, '#output-list': list })[selector],
    document: { activeElement: null },
    window: { matchMedia(query) { calls.mediaQueries.push(query); return { matches: mobile }; } },
    breakpointQuery: () => '(max-width: 48rem)',
    setContentCollapsed(value) { calls.contentCollapsed.push(value); },
    railNavigation: { open(name) { calls.rails.push(name); } },
    richEditor: {
      flush() { calls.flushed++; onFlush(project); },
      setSimilarityBusy(busy) { calls.editorBusy.push(busy); },
    },
    audienceSimilarityDialog: { open(payload) {
      assert.notEqual(calls.editorBusy.at(-1), true, 'The main editor shimmer clears before comparison opens');
      calls.opened.push(payload);
      return true;
    } },
    createAudienceSimilarityLoading({ onBusyChange }) {
      onLoadingBusyChange = onBusyChange || (() => {});
      return loading;
    },
    renderOutputs() { loading.cancel(); calls.rendered++; context.updateAudienceSimilarityAction(project); },
    notify(message) { calls.notifications.push(message); },
    saveProjects() { calls.saved++; return true; },
    openEditorTab(id) { calls.editorOpened.push(id); },
  });
  runInContext(production, context);
  return {
    project, footer, button, buttonListeners, calls, context, loading, items, list, links,
    recalculate: request => context.startAudienceSimilarity(request), complete: () => loading.complete(),
    view: id => context.viewAudienceSimilarities(id, links.find(link => link.dataset.viewSimilarities === id)),
    refresh: () => context.updateAudienceSimilarityAction(project),
    clickView(id) {
      const link = links.find(item => item.dataset.viewSimilarities === id);
      const control = controls.find(item => item.dataset.outputId === id);
      // View lives inside the footer and card, so its action must win over both.
      const ancestors = { '[data-view-similarities]': link, '.output-card-similarity': {}, '.output-card': { querySelector: () => control } };
      listeners.click({ target: { closest: selector => ancestors[selector] || null } });
    },
    clickSimilarityFooter(id, surface) {
      const control = controls.find(item => item.dataset.outputId === id);
      const footer = { className: 'output-card-similarity' };
      const target = { surface, closest: selector => selector === '.output-card-similarity' ? footer : selector === '.output-card' ? { querySelector: () => control } : null };
      listeners.click({ target });
    },
    select(id) {
      const control = controls.find(item => item.dataset.outputId === id);
      context.document.activeElement = control;
      listeners.click({ target: { closest: selector => selector === '.output-card' ? { querySelector: () => control } : null } });
    },
    clickCardAction() { listeners.click({ target: { closest: selector => selector === '.output-card-actions' ? {} : null } }); },
  };
}

test('Drafted has no separate Check Similarity action or card selection requirement', () => {
  const ui = setup();
  ui.refresh();
  assert.equal(ui.footer.hidden, true);
  assert.equal(ui.button.disabled, true);
  assert.deepEqual(ui.buttonListeners, []);
  assert.equal(ui.view('two'), true);
  assert.equal(ui.calls.opened.length, 1);
  assert.equal(ui.calls.batches.length, 0);
  assert.equal(ui.loading.isRunning, false);
  assert.deepEqual(ui.calls.editorBusy, [], 'Viewing prepared results does not shimmer the main editor');
});

test('View Similarities opens immediately with the clicked draft, all eligible peers, and latest edited text', () => {
  const ui = setup({ outputs: [draft('one'), draft('two', 'Students'), draft('three', 'Taxpayers')], onFlush(project) { project.outputs[0].draftText = 'Latest edited body from the current editor.'; } });
  ui.project.selectedOutputId = 'one';
  ui.project.selectedOutputIds = ['pending'];
  ui.project.sourceDraft = { title: 'Original article', draftText: 'The original article describes the school proposal.' };
  const originalSource = structuredClone(ui.project.sourceDraft);
  ui.clickView('three');
  assert.equal(ui.calls.flushed, 1);
  assert.equal(ui.calls.opened.length, 1);
  assert.equal(ui.calls.batches.length, 0);
  const opened = ui.calls.opened[0];
  assert.deepEqual(opened.groups[0].drafts.map(item => item.id), ['one', 'two', 'three']);
  assert.equal(opened.referenceId, 'three');
  assert.equal(opened.groups[0].drafts[0].draftText, 'Latest edited body from the current editor.');
  assert.equal(opened.opener, ui.links[2]);
  assert.equal(opened.comparisonResults, ui.calls.prepared.at(-1).comparisons);
  assert.equal(opened.sourceDraft, ui.calls.prepared.at(-1).sourceDraft, 'The table uses the same Source Draft as the card average');
  assert.equal(opened.sourceDraft.isSimilaritySource, true);
  assert.equal(opened.sourceDraft.similaritySourceOrigin, 'source-draft');
  assert.equal(opened.sourceDraft.draftText, originalSource.draftText);
  assert.equal(ui.project.outputs.includes(opened.sourceDraft), false);
  assert.deepEqual(ui.project.sourceDraft, originalSource);
  assert.equal(ui.project.selectedOutputId, 'one');
  assert.deepEqual(ui.project.selectedOutputIds, ['pending']);
  assert.deepEqual(ui.calls.editorOpened, []);
  assert.equal(ui.calls.saved, 0);
  assert.equal(ui.project.outputProcessing, undefined);
});

test('ordinary Drafted card clicks open the editor and nested actions do not', () => {
  const ui = setup();
  ui.clickCardAction();
  assert.deepEqual(ui.calls.editorOpened, []);
  ui.select('two');
  assert.deepEqual(ui.calls.editorOpened, ['two']);
  assert.equal(ui.calls.opened.length, 0);
});

test('score, Average similarity label, and empty footer area select their draft instead of opening results', () => {
  for (const surface of ['score', 'average-label', 'empty-footer']) {
    const ui = setup();
    ui.project.selectedOutputId = 'one';
    ui.clickSimilarityFooter('two', surface);
    assert.deepEqual(ui.calls.editorOpened, ['two'], surface);
    assert.equal(ui.calls.opened.length, 0, surface);
    assert.equal(ui.calls.batches.length, 0, surface);
  }
});

test('View inside the same footer opens only similarities and leaves the selected editor unchanged', () => {
  const ui = setup();
  ui.project.selectedOutputId = 'one';
  ui.clickView('two');
  assert.deepEqual(ui.calls.editorOpened, []);
  assert.equal(ui.project.selectedOutputId, 'one');
  assert.equal(ui.calls.opened.length, 1);
  assert.equal(ui.calls.opened[0].referenceId, 'two');
  assert.equal(ui.calls.opened[0].opener, ui.links[1]);
  assert.equal(ui.calls.batches.length, 0);
});

test('pending card clicks still select content for drafting', () => {
  const ui = setup({ view: 'pending', outputs: [{ ...draft('one'), status: 'pending' }] });
  ui.select('one');
  assert.deepEqual(Array.from(ui.project.selectedOutputIds), ['one']);
  assert.equal(ui.calls.saved, 1);
  ui.select('one');
  assert.deepEqual(Array.from(ui.project.selectedOutputIds), []);
  assert.deepEqual(ui.calls.editorOpened, []);
  assert.equal(ui.calls.opened.length, 0);
});

test('one eligible draft, unknown reference, and a pending view cannot open comparison', () => {
  for (const ui of [setup({ outputs: [draft('one')] }), setup({ view: 'pending' })]) {
    ui.view('one');
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.calls.batches.length, 0);
  }
  const ui = setup();
  ui.view('missing');
  assert.equal(ui.calls.opened.length, 0);
});

test('deleted, archived, and inactive projects cannot open comparison', () => {
  for (const update of [ui => { ui.project.deletedAt = 1; }, ui => { ui.project.archivedAt = 1; }, ui => { ui.context.activeProjectId = 'another'; }]) {
    const ui = setup(); update(ui); ui.view('one');
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.calls.flushed, 0);
  }
});

test('a processing project cannot open stale comparison results', () => {
  const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')] });
  ui.project.outputProcessing = { kind: 'revision', ids: ['two'] };
  ui.view('two');
  assert.equal(ui.calls.opened.length, 0);
  ui.view('one');
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.calls.flushed, 0);
  delete ui.project.outputProcessing;
  ui.view('one');
  assert.deepEqual(ui.calls.opened[0].groups[0].drafts.map(item => item.id), ['one', 'two', 'three']);
});

test('flushing an empty body invalidates the reference before opening', () => {
  const ui = setup({ onFlush(project) { project.outputs[0].document = { ops: [] }; } });
  ui.view('one');
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.calls.batches.length, 0);
});

for (const mobile of [false, true]) {
  test(`explicit edit recalculation keeps the panel loading flow on ${mobile ? 'mobile' : 'desktop'}`, () => {
    const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')], mobile });
    const sourceDraft = { ...draft('original-source'), isSimilaritySource: true };
    ui.project.sourceDraft = { title: 'Current source title', draftText: 'Current source body before the edit.' };
    const request = { draftIds: ['one', 'two', 'three'], sourceDraft, editedDraft: ui.project.outputs[0], referenceId: 'three', focusDraftId: 'one', focusOrigin: 'row', scrollLeft: 140, scrollTop: 180 };
    ui.recalculate(request);
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.loading.isRunning, true);
    assert.deepEqual(ui.calls.editorBusy, [true]);
    assert.equal(ui.calls.batches.length, 1);
    assert.deepEqual(Array.from(ui.calls.batches[0].items), ui.items);
    assert.deepEqual(ui.calls.contentCollapsed, [false]);
    assert.deepEqual(ui.calls.rails, mobile ? ['variants'] : []);
    ui.project.sourceDraft.draftText = 'Updated source body when recalculation completes.';
    ui.complete();
    assert.equal(ui.calls.opened.length, 1);
    assert.deepEqual(ui.calls.editorBusy, [true, false]);
    const restored = ui.calls.opened[0];
    for (const key of ['editedDraft', 'referenceId', 'focusDraftId', 'focusOrigin', 'scrollLeft', 'scrollTop']) assert.equal(restored[key], request[key], key);
    assert.deepEqual(restored.groups[0].drafts.map(item => item.id), ['one', 'two', 'three']);
    assert.equal(restored.comparisonResults, ui.calls.prepared.at(-1).comparisons);
    assert.equal(restored.sourceDraft, ui.calls.prepared.at(-1).sourceDraft);
    assert.notEqual(restored.sourceDraft, request.sourceDraft, 'Old popup baselines cannot differ from the refreshed card calculation');
    assert.equal(restored.sourceDraft.draftText, ui.project.sourceDraft.draftText);
  });
}

test('recalculation rejects incomplete, stale, reordered, and foreign edit requests', () => {
  const ui = setup({ outputs: [draft('one'), draft('two'), draft('three')] });
  const valid = { draftIds: ['one', 'two', 'three'], editedDraft: ui.project.outputs[0], referenceId: 'one' };
  for (const request of [
    {},
    { ...valid, draftIds: ['one', 'three'] },
    { ...valid, draftIds: ['two', 'one', 'three'] },
    { ...valid, draftIds: ['one', 'two', 'missing'] },
    { ...valid, editedDraft: draft('one') },
    { ...valid, referenceId: 'missing' },
  ]) {
    ui.recalculate(request);
    assert.equal(ui.calls.batches.length, 0);
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.loading.isRunning, false);
    assert.deepEqual(ui.calls.editorBusy, [], 'Rejected recalculation does not shimmer the main editor');
  }
});

test('recalculation blocks duplicate requests and uses the final editor flush', () => {
  let flushCount = 0;
  const ui = setup({ onFlush(project) { project.outputs[0].draftText = ++flushCount === 1 ? 'Initial editor body.' : 'Final editor body after loading.'; } });
  const request = { draftIds: ['one', 'two'], editedDraft: ui.project.outputs[0], referenceId: 'one' };
  ui.recalculate(request);
  ui.recalculate(request);
  assert.equal(ui.calls.batches.length, 1);
  assert.equal(ui.calls.flushed, 1);
  assert.deepEqual(ui.calls.editorBusy, [true]);
  ui.complete();
  assert.equal(ui.calls.opened.length, 1);
  assert.equal(ui.calls.opened[0].groups[0].drafts[0].draftText, 'Final editor body after loading.');
  assert.equal(ui.calls.flushed, 2);
  assert.equal(ui.complete(), false);
});

test('delayed recalculation is discarded after project, view, or eligibility changes', () => {
  const changes = [
    ['inactive project', ui => { ui.context.activeProjectId = 'another'; }],
    ['deleted project', ui => { ui.project.deletedAt = 1; }],
    ['archived project', ui => { ui.project.archivedAt = 1; }],
    ['replacement project object', ui => { ui.context.projects = [{ ...ui.project }]; }],
    ['different view', ui => { ui.context.outputViews.set(ui.project.id, 'pending'); }],
    ['draft removed', ui => { ui.project.outputs = ui.project.outputs.filter(output => output.id !== 'two'); }],
    ['draft processing', ui => { ui.project.outputProcessing = { kind: 'revision', ids: ['two'] }; }],
    ['draft body cleared', ui => { ui.project.outputs[1].document = { ops: [] }; }],
    ['additional draft', ui => { ui.project.outputs.push(draft('three')); }],
  ];
  for (const [reason, change] of changes) {
    const ui = setup();
    ui.recalculate({ draftIds: ['one', 'two'], editedDraft: ui.project.outputs[0], referenceId: 'one' });
    assert.equal(ui.loading.isRunning, true, reason);
    change(ui); ui.complete();
    assert.equal(ui.calls.opened.length, 0, reason);
    assert.equal(ui.loading.isRunning, false, reason);
    assert.deepEqual(ui.calls.editorBusy, [true, false], reason);
  }
});

test('closing the Content panel prevents reopening the recalculated popup', () => {
  const ui = setup();
  ui.recalculate({ draftIds: ['one', 'two'], editedDraft: ui.project.outputs[0], referenceId: 'two' });
  assert.equal(ui.loading.isRunning, true);
  ui.list.visible = false;
  ui.complete();
  assert.equal(ui.calls.opened.length, 0);
});


test('clearing the edited draft saves it and explains why comparison is unavailable', () => {
  for (const outputs of [[draft('one'), draft('two')], [draft('one'), draft('two'), draft('three')]]) {
    const ui = setup({ outputs });
    ui.project.outputs[0].document = { ops: [] };
    ui.recalculate({ draftIds: outputs.map(output => output.id), editedDraft: outputs[0], referenceId: 'one' });
    assert.equal(ui.calls.batches.length, 0);
    assert.equal(ui.calls.opened.length, 0);
    assert.deepEqual(ui.calls.notifications, ['Changes saved. This draft needs body text to compare similarities']);
  }
});


test('rerendering the Content panel clears the main editor shimmer and cancels popup reopening', () => {
  const ui = setup();
  ui.recalculate({ draftIds: ['one', 'two'], editedDraft: ui.project.outputs[0], referenceId: 'one' });
  assert.deepEqual(ui.calls.editorBusy, [true]);
  ui.context.renderOutputs(ui.project);
  assert.equal(ui.loading.isRunning, false);
  assert.deepEqual(ui.calls.editorBusy, [true, false]);
  assert.equal(ui.complete(), false);
  assert.equal(ui.calls.opened.length, 0);
});
