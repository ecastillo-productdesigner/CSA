import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount } from '../dist/editorial-word-count.js';
import { projectOutputs, selectedOutputs, selectedPendingOutputs, outputIsReady, outputWordCount } from '../dist/outputs.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const flowStart = app.indexOf('function cancelOutputProcessing(');
const flowEnd = app.indexOf("$('#composer-editorial-direction').addEventListener('input'");
assert.ok(flowStart >= 0 && flowEnd > flowStart);
const production = app.slice(flowStart, flowEnd);
const clone = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };
const words = count => Array.from({ length: count }, () => 'word').join(' ');

function draftFlow({ project: savedProject, now: initialNow = 1000, active = true, content = {} } = {}) {
  const project = savedProject || {
    id: 'project', selectedOutputIds: ['one', 'two'],
    outputs: [
      { id: 'one', title: 'First draft', status: 'pending', editorialDirection: 'Write 750 words' },
      { id: 'two', title: 'Second draft', status: 'pending', editorialDirection: 'Write 300 words' },
    ],
  };
  let now = initialNow;
  let handler;
  let timerId = 0;
  const timers = new Map();
  const calls = { saved: [], rendered: [], timers: [], populated: [], revised: [], shown: [], notifications: [], focused: 0, actions: 0, flushed: 0, closed: 0 };
  const button = {
    addEventListener(name, callback) { assert.equal(name, 'click'); handler = callback; },
    focus() { calls.focused++; },
  };
  const reviewButton = { addEventListener(name) { assert.equal(name, 'click'); } };
  const composer = { hidden: !active };
  const dialog = { open: false };
  const context = createContext({
    projects: [project], activeProjectId: active ? project.id : null,
    $: selector => {
      const control = { '#create-output': button, '#review-output': reviewButton, '#composer': composer, '#new-project-dialog': dialog }[selector];
      assert.ok(control, `Unexpected selector: ${selector}`);
      return control;
    },
    document: { querySelector: selector => { assert.equal(selector, 'dialog[open]'); return dialog.open ? dialog : null; } },
    projectOutputs, selectedOutputs, selectedPendingOutputs, outputIsReady, outputWordCount,
    roleSelector: { value: '' },
    INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount,
    outputTimers: new Map(), outputViews: new Map(),
    deferredOutputProjectId: null, sourceImport: null,
    newProjectUpload: { isBusy: () => false },
    richEditor: { flush() { calls.flushed++; }, close() { calls.closed++; } },
    saveProjects() { calls.saved.push(clone(project)); return true; },
    renderOutputs(current) { calls.rendered.push(clone(current)); },
    updateComposerActions() { calls.actions++; },
    populateOutputContent(output) {
      calls.populated.push(output.id);
      const generated = content[output.id] ?? words(250);
      if (typeof generated === 'string') { output.draftText = generated; delete output.document; }
      else Object.assign(output, clone(generated));
    },
    reviseSampleOutput(output, instructions, requestedAt) { calls.revised.push({ id: output.id, instructions, requestedAt }); },
    showEditorProject(current) { calls.shown.push(current.id); },
    railNavigation: { closeTransient() {} }, notify(message) { calls.notifications.push(message); },
    tokenNumber: () => 10000,
    Date: class extends Date { static now() { return now; } },
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, at: now + delay });
      calls.timers.push(delay);
      return id;
    },
    clearTimeout(id) { timers.delete(id); }, queueMicrotask,
  });
  runInContext(production, context, { filename: 'app-draft-notice-integration.js' });
  return {
    project, calls, context, composer, dialog, timers, run: () => handler(), now: () => now,
    resume: render => context.resumeOutputProcessing(project, render),
    async advance(milliseconds) {
      const target = now + milliseconds;
      let next;
      while ((next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0])) {
        const [id, timer] = next;
        now = timer.at;
        timers.delete(id);
        timer.callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

function assertNoLengthFlags(output) {
  for (const key of ['shorterDraftCreated', 'wordCountNoticePending', 'shorterDraftAccepted']) {
    assert.equal(Object.hasOwn(output, key), false, `${output.id} must not retain ${key}`);
  }
}

test('Draft starts immediately and creates the batch after ten seconds without a length decision', async () => {
  const ui = draftFlow();
  ui.run();
  assert.equal(ui.calls.flushed, 1);
  assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two']);
  assert.equal(ui.project.outputProcessing.readyAt, 11000);
  assert.deepEqual(Array.from(ui.project.outputProcessing.editorialDirections), ['Write 750 words', 'Write 300 words']);
  assert.deepEqual(ui.calls.timers, [10000]);
  assert.equal(ui.calls.rendered.length, 1);
  await ui.advance(9999);
  assert.equal(ui.calls.populated.length, 0);
  assert.ok(ui.project.outputs.every(output => !outputIsReady(output)));
  await ui.advance(1);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
  assert.equal(ui.project.outputs[0].shorterDraftCreated, true);
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
  assert.equal(Object.hasOwn(ui.project.outputs[0], 'shorterDraftAccepted'), false);
  assertNoLengthFlags(ui.project.outputs[1]);
  assert.equal(ui.project.selectedOutputId, 'one');
  assert.equal(ui.project.viewOriginalDraft, false);
  assert.deepEqual(ui.calls.shown, ['project']);
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.calls.saved.at(-1).outputs[0].wordCountNoticePending, true);
  await ui.advance(60000);
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true, 'Elapsed time never dismisses a completed draft notice');
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
});

test('duplicate Draft actions and timer resumes keep one generation job', async () => {
  const ui = draftFlow();
  ui.run();
  const job = ui.project.outputProcessing;
  ui.run();
  ui.resume();
  ui.resume(false);
  assert.equal(ui.project.outputProcessing, job);
  assert.deepEqual(ui.calls.timers, [10000]);
  await ui.advance(10000);
  ui.resume();
  ui.run();
  await flush();
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
  assert.deepEqual(ui.calls.shown, ['project']);
  assert.deepEqual(ui.calls.timers, [10000]);
});

test('only a draft below an explicit request above 500 words receives a notice and history note', async () => {
  for (const [direction, count, shorter] of [
    ['Write 750 words', 749, true],
    ['Write 750 words', 750, false],
    ['Write 750 words', 751, false],
    ['Write 501 words', 500, true],
    ['Write 500 words', 499, false],
    ['Write 300 words', 200, false],
    ['Keep it focused', 200, false],
    ['', 200, false],
  ]) {
    const ui = draftFlow({ content: { one: words(count) } });
    ui.project.outputs[0].editorialDirection = direction;
    ui.run();
    await ui.advance(10000);
    const output = ui.project.outputs[0];
    assert.equal(outputWordCount(output), count);
    assert.equal(outputIsReady(output), true);
    if (shorter) {
      assert.equal(output.shorterDraftCreated, true, direction);
      assert.equal(output.wordCountNoticePending, true, direction);
    } else assertNoLengthFlags(output);
  }
});

test('the length decision uses populated content and the document word count', async () => {
  for (const [generated, previousCount, expectedCount, shorter] of [
    [{ document: { ops: [{ insert: words(750) }, { insert: '\n' }] }, draftText: 'Stale short text' }, 1, 750, false],
    [words(249), 1000, 249, true],
  ]) {
    const ui = draftFlow({ content: { one: generated } });
    ui.project.outputs[0].draftText = words(previousCount);
    ui.run();
    await ui.advance(10000);
    const output = ui.project.outputs[0];
    assert.equal(outputWordCount(output), expectedCount);
    assert.equal(output.shorterDraftCreated === true, shorter);
    assert.equal(output.wordCountNoticePending === true, shorter);
  }
});

test('revision jobs retain historical length flags without creating another notice', async () => {
  for (const flags of [
    {},
    { shorterDraftCreated: true },
    { shorterDraftCreated: true, wordCountNoticePending: true },
    { shorterDraftAccepted: true },
  ]) {
    const ui = draftFlow();
    const output = ui.project.outputs[0];
    output.status = 'ready';
    Object.assign(output, flags);
    ui.project.outputProcessing = { kind: 'revision', ids: ['one'], openOutputId: 'one', instructions: 'Expand to 1000 words', requestedAt: 1000, readyAt: 11000, editorialDirections: ['An old direction'] };
    ui.resume();
    await ui.advance(10000);
    assert.deepEqual(ui.calls.revised, [{ id: 'one', instructions: 'Expand to 1000 words', requestedAt: 1000 }]);
    assert.deepEqual(ui.calls.notifications, ['Revision complete']);
    assert.equal(ui.project.outputProcessing, undefined);
    assert.equal(ui.calls.populated.length, 0);
    for (const key of ['shorterDraftCreated', 'shorterDraftAccepted']) {
      assert.equal(output[key], flags[key], `A revision preserves ${key}`);
    }
    assert.equal(Object.hasOwn(output, 'wordCountNoticePending'), false, 'Completing a revision never reopens the initial notice');
    assertNoLengthFlags(ui.project.outputs[1]);
  }
});

test('each selected draft owns its notice and unselected recipes keep their existing history', async () => {
  const ui = draftFlow();
  ui.project.outputs[1].editorialDirection = 'Write 900 words';
  ui.project.outputs.push(
    { id: 'unselected', title: 'Unselected oversized draft', status: 'pending', editorialDirection: 'Write 900 words' },
    { id: 'historical', title: 'Earlier shorter draft', status: 'ready', editorialDirection: 'Write 800 words', shorterDraftCreated: true },
  );
  ui.run();
  await ui.advance(10000);
  for (const output of ui.project.outputs.slice(0, 2)) {
    assert.equal(output.shorterDraftCreated, true);
    assert.equal(output.wordCountNoticePending, true);
  }
  assertNoLengthFlags(ui.project.outputs[2]);
  assert.equal(ui.project.outputs[2].status, 'pending');
  assert.equal(ui.project.outputs[3].shorterDraftCreated, true);
  assert.equal(Object.hasOwn(ui.project.outputs[3], 'wordCountNoticePending'), false);
  const restored = draftFlow({ project: clone(ui.calls.saved.at(-1)), now: ui.now() });
  restored.resume();
  await flush();
  assert.deepEqual(restored.project.outputs, ui.project.outputs);
  assert.equal(restored.calls.populated.length, 0);
  assert.equal(restored.calls.timers.length, 0);
});

test('fresh generation clears obsolete acceptance and both old length flags when the draft meets its request', async () => {
  for (const [direction, count] of [['Write 300 words', 250], ['Write 750 words', 750], ['Write 750 words', 751]]) {
    const ui = draftFlow({ content: { one: words(count) } });
    Object.assign(ui.project.outputs[0], { editorialDirection: direction, shorterDraftAccepted: true, shorterDraftCreated: true, wordCountNoticePending: true });
    ui.run();
    await ui.advance(10000);
    assert.ok(ui.project.outputs.every(outputIsReady));
    ui.project.outputs.forEach(assertNoLengthFlags);
    ui.calls.saved.at(-1).outputs.forEach(assertNoLengthFlags);
  }
});

test('reloading during generation waits only the remaining time and retains saved directions', async () => {
  const first = draftFlow();
  first.run();
  const ui = draftFlow({ project: clone(first.project), now: 6000 });
  ui.resume(false);
  assert.deepEqual(ui.calls.timers, [5000]);
  await ui.advance(4999);
  assert.equal(ui.calls.populated.length, 0);
  await ui.advance(1);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
});

test('overdue legacy jobs waiting for a length decision finish immediately even while inactive', async () => {
  const first = draftFlow();
  first.run();
  first.project.outputProcessing.awaitingWordCountReview = true;
  for (const active of [true, false]) {
    const ui = draftFlow({ project: clone(first.project), now: 25000, active });
    ui.resume(false);
    await flush();
    assert.ok(ui.project.outputs.every(outputIsReady));
    assert.equal(ui.project.outputProcessing, undefined);
    assert.deepEqual(ui.calls.populated, ['one', 'two']);
    assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
    assert.equal(ui.calls.timers.length, 0);
    assert.equal(ui.calls.shown.length, 0);
  }
});

test('a batch with a missing editorial direction survives storage and completes normally', async () => {
  const first = draftFlow();
  delete first.project.outputs[1].editorialDirection;
  first.run();
  assert.deepEqual(Array.from(first.project.outputProcessing.editorialDirections), ['Write 750 words', '']);
  const ui = draftFlow({ project: clone(first.project), now: 25000 });
  ui.resume(false);
  await flush();
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
  assertNoLengthFlags(ui.project.outputs[1]);
  assert.equal(ui.calls.timers.length, 0);
});

test('inactive and hidden projects finish and save without replacing the visible editor', async () => {
  for (const hide of [ui => { ui.context.activeProjectId = 'another'; }, ui => { ui.composer.hidden = true; }]) {
    const ui = draftFlow();
    ui.run();
    const rendered = ui.calls.rendered.length;
    hide(ui);
    await ui.advance(10000);
    assert.equal(ui.project.outputProcessing, undefined);
    assert.ok(ui.project.outputs.every(outputIsReady));
    assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
    assert.equal(ui.calls.saved.at(-1).outputs[0].wordCountNoticePending, true);
    assert.equal(ui.calls.closed, 0);
    assert.equal(ui.calls.shown.length, 0);
    assert.equal(ui.calls.rendered.length, rendered);
  }
});

test('source imports, project dialogs, and uploads defer rendering while creation still finishes', async () => {
  for (const block of ['import', 'dialog', 'upload']) {
    const ui = draftFlow();
    ui.run();
    if (block === 'import') ui.context.sourceImport = {};
    if (block === 'dialog') ui.dialog.open = true;
    if (block === 'upload') ui.context.newProjectUpload.isBusy = () => true;
    await ui.advance(10000);
    assert.equal(ui.context.deferredOutputProjectId, ui.project.id, block);
    assert.equal(ui.project.outputProcessing, undefined, block);
    assert.ok(ui.project.outputs.every(outputIsReady), block);
    assert.equal(ui.project.outputs[0].wordCountNoticePending, true, block);
    assert.equal(ui.calls.closed, 0, block);
    assert.equal(ui.calls.shown.length, 0, block);
    assert.equal(ui.calls.saved.at(-1).outputs[0].wordCountNoticePending, true, block);
    ui.context.sourceImport = null;
    ui.dialog.open = false;
    ui.context.newProjectUpload.isBusy = () => false;
    ui.resume();
    await flush();
    assert.deepEqual(ui.calls.populated, ['one', 'two'], 'Reopening cannot generate completed drafts again');
  }
});

test('a replaced timer cannot finish the replacement job before its deadline', async () => {
  const ui = draftFlow();
  ui.run();
  const replacement = { ...ui.project.outputProcessing, readyAt: 21000 };
  ui.project.outputProcessing = replacement;
  await ui.advance(10000);
  assert.equal(ui.project.outputProcessing, replacement);
  assert.equal(ui.calls.populated.length, 0);
  await ui.advance(9999);
  assert.equal(ui.calls.populated.length, 0);
  await ui.advance(1);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.deepEqual(ui.calls.timers, [10000, 10000]);
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
});

test('removed, deleted, and archived projects cannot finish an outstanding job', async () => {
  for (const mutate of [
    ui => { ui.context.projects = []; },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.project.archivedAt = 1; },
  ]) {
    const ui = draftFlow();
    ui.run();
    const job = ui.project.outputProcessing;
    mutate(ui);
    await ui.advance(10000);
    assert.equal(ui.calls.populated.length, 0);
    assert.equal(ui.project.outputProcessing, job);
    assert.equal(ui.calls.shown.length, 0);
  }
});

test('changed or missing target recipes cancel before populating any draft, including after reload', async () => {
  for (const reload of [false, true]) {
    for (const mutate of [
      project => { project.outputs.pop(); },
      project => { project.outputs[0].editorialDirection = 'Write 800 words'; },
      project => { project.outputs[0] = { ...project.outputs[0], editorialDirection: 'Write 900 words' }; },
    ]) {
      const first = draftFlow();
      first.run();
      mutate(first.project);
      const ui = reload ? draftFlow({ project: clone(first.project), now: 25000 }) : first;
      if (reload) ui.resume(false);
      else await ui.advance(10000);
      assert.equal(ui.project.outputProcessing, undefined);
      assert.equal(ui.calls.populated.length, 0);
      assert.ok(ui.project.outputs.every(output => !outputIsReady(output)));
      assert.ok(selectedPendingOutputs(ui.project).length > 0, 'Canceled recipes remain available to retry');
    }
  }
});

const helpersStart = app.indexOf('function dismissWordCountNotice(');
const helpersEnd = app.indexOf('\nfunction closeProfile(', helpersStart);
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart);
const noticeProduction = app.slice(helpersStart, helpersEnd);

function noticeFlow(savedProject) {
  const project = savedProject || {
    id: 'project', title: 'Project', selectedOutputId: 'one', selectedOutputIds: ['one'],
    outputs: [
      { id: 'one', title: 'First draft', status: 'ready', draftText: words(250), shorterDraftCreated: true, wordCountNoticePending: true },
      { id: 'two', title: 'Second draft', status: 'ready', draftText: words(250), shorterDraftCreated: true, wordCountNoticePending: true },
    ],
  };
  const frames = [];
  const events = [];
  const saved = [];
  const nodes = new Map();
  let dialogOpen = false;
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: false, classList: { add() {}, remove() {} },
      getAttribute: () => 'false', querySelector: () => null,
    });
    return nodes.get(selector);
  };
  const context = createContext({
    projects: [project], activeProjectId: project.id,
    $, projectOutputs, selectedPendingOutputs, outputIsReady,
    document: { body: get('body'), querySelector: selector => { assert.equal(selector, 'dialog[open]'); return dialogOpen ? {} : null; } },
    sourceImport: null, newProjectUpload: { isBusy: () => false }, deferredOutputProjectId: null,
    requestAnimationFrame(callback) { frames.push(callback); },
    saveProjects() { saved.push(clone(project)); },
    richEditor: {
      open(output) { events.push({ action: 'open', outputId: output.directionOutputId }); },
      showWordCountNotice() { events.push({ action: 'notice', outputId: project.selectedOutputId }); },
    },
    closeComposer() {}, railNavigation: { closeTransient() {} }, searchExperience: { hide() {} },
    resumeOutputProcessing() {}, populateOutputContent() {}, syncOwnMaterialSource() {},
    normalizeWordCount: value => value, toolDropdowns: { refresh() {} }, updateComposerActions() {},
    renderOutputs() { events.push({ action: 'render' }); }, setNewVariantCollapsed() {}, setContentCollapsed() {},
    closeProfile() {}, sessionStorage: { setItem() {} }, window: { scrollTo() { events.push({ action: 'scroll' }); } },
  });
  function $(selector) { return get(selector); }
  runInContext(noticeProduction, context, { filename: 'app-completed-notice-integration.js' });
  return {
    project, context, events, saved, frames, composer: get('#composer'),
    setDialogOpen(value) { dialogOpen = value; },
    show: () => context.showEditorProject(project),
    request: (output = project.outputs[0]) => context.showPendingWordCountNotice(project, output),
    dismiss: (projectId = project.id, outputId = project.outputs[0].id) => context.dismissWordCountNotice(projectId, outputId),
    frame() { for (const callback of frames.splice(0)) callback(); },
  };
}

test('the completed draft opens and renders before its notice appears after painting', () => {
  const ui = noticeFlow();
  ui.show();
  assert.deepEqual(ui.events, [{ action: 'open', outputId: 'one' }, { action: 'render' }, { action: 'scroll' }]);
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
  ui.frame();
  assert.equal(ui.events.some(event => event.action === 'notice'), false, 'The draft gets a frame before the notice opens');
  ui.frame();
  assert.deepEqual(ui.events.at(-1), { action: 'notice', outputId: 'one' });
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true, 'Showing a notice is not dismissing it');
  assert.equal(ui.project.outputs[1].wordCountNoticePending, true, 'Another draft retains its own pending notice');
});

test('completed-notice scheduling ignores outputs without an eligible saved outcome', () => {
  for (const mutate of [
    ui => { delete ui.project.outputs[0].wordCountNoticePending; },
    ui => { delete ui.project.outputs[0].shorterDraftCreated; },
    ui => { ui.project.outputs[0].status = 'pending'; },
    ui => { ui.project.outputs[0].needsRegeneration = true; },
    ui => { ui.project.outputProcessing = { kind: 'revision', ids: ['one'] }; },
  ]) {
    const ui = noticeFlow();
    mutate(ui);
    ui.request();
    assert.equal(ui.frames.length, 0);
    assert.equal(ui.events.length, 0);
  }
  const ui = noticeFlow();
  ui.request(null);
  assert.equal(ui.frames.length, 0);
});

test('a scheduled notice cannot open for stale project, draft, or editor state', () => {
  for (const mutate of [
    ui => { ui.context.activeProjectId = 'another'; },
    ui => { ui.composer.hidden = true; },
    ui => { ui.project.viewOriginalDraft = true; },
    ui => { ui.project.selectedOutputId = 'two'; },
    ui => { ui.context.projects = []; },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.project.archivedAt = 1; },
    ui => { ui.project.outputs[0] = clone(ui.project.outputs[0]); },
    ui => { delete ui.project.outputs[0].wordCountNoticePending; },
    ui => { ui.project.outputs[0].status = 'pending'; },
    ui => { ui.project.outputs[0].needsRegeneration = true; },
    ui => { ui.project.outputProcessing = { kind: 'revision', ids: ['one'] }; },
  ]) {
    const ui = noticeFlow();
    ui.request();
    ui.frame();
    mutate(ui);
    ui.frame();
    assert.equal(ui.events.length, 0);
    assert.equal(ui.saved.length, 0);
  }
});

test('open dialogs, imports, and uploads defer the completed notice until the draft can reopen', () => {
  for (const block of ['dialog', 'import', 'upload']) {
    const ui = noticeFlow();
    ui.show();
    ui.frame();
    if (block === 'dialog') ui.setDialogOpen(true);
    if (block === 'import') ui.context.sourceImport = {};
    if (block === 'upload') ui.context.newProjectUpload.isBusy = () => true;
    ui.frame();
    assert.equal(ui.events.some(event => event.action === 'notice'), false, block);
    assert.equal(ui.context.deferredOutputProjectId, ui.project.id, block);
    assert.equal(ui.project.outputs[0].wordCountNoticePending, true, block);
    assert.equal(outputIsReady(ui.project.outputs[0]), true, block);
    ui.setDialogOpen(false);
    ui.context.sourceImport = null;
    ui.context.newProjectUpload.isBusy = () => false;
    ui.show();
    ui.frame();
    ui.frame();
    assert.deepEqual(ui.events.at(-1), { action: 'notice', outputId: 'one' }, block);
  }
});

test('dismissal clears only the identified draft notice and its saved history survives reload', () => {
  const ui = noticeFlow();
  ui.project.selectedOutputId = 'two';
  ui.dismiss('project', 'one');
  assert.equal(Object.hasOwn(ui.project.outputs[0], 'wordCountNoticePending'), false);
  assert.equal(ui.project.outputs[0].shorterDraftCreated, true);
  assert.equal(ui.project.outputs[1].wordCountNoticePending, true);
  assert.equal(ui.saved.length, 1);
  ui.dismiss('project', 'one');
  assert.equal(ui.saved.length, 1, 'Repeated dismissals do not write again');
  const restored = noticeFlow(clone(ui.saved[0]));
  restored.project.selectedOutputId = 'one';
  restored.request();
  assert.equal(restored.frames.length, 0);
  assert.equal(restored.project.outputs[0].shorterDraftCreated, true);
  restored.project.selectedOutputId = 'two';
  restored.request(restored.project.outputs[1]);
  restored.frame();
  restored.frame();
  assert.deepEqual(restored.events, [{ action: 'notice', outputId: 'two' }]);
});

test('dismissal ignores unknown, removed, deleted, or archived targets', () => {
  for (const [mutate, projectId, outputId] of [
    [() => {}, 'missing', 'one'],
    [() => {}, 'project', 'missing'],
    [ui => { ui.context.projects = []; }, 'project', 'one'],
    [ui => { ui.project.deletedAt = 1; }, 'project', 'one'],
    [ui => { ui.project.archivedAt = 1; }, 'project', 'one'],
  ]) {
    const ui = noticeFlow();
    mutate(ui);
    ui.dismiss(projectId, outputId);
    assert.equal(ui.project.outputs[0].wordCountNoticePending, true);
    assert.equal(ui.project.outputs[0].shorterDraftCreated, true);
    assert.equal(ui.saved.length, 0);
  }
});


const deferredStart = app.indexOf('function renderDeferredOutput(');
const deferredEnd = app.indexOf("\nfor (const id of ['material-dialog', 'new-project-dialog'])", deferredStart);
assert.ok(deferredStart >= 0 && deferredEnd > deferredStart);
const deferredProduction = app.slice(deferredStart, deferredEnd);

function deferredFlow() {
  const project = { id: 'project' };
  const openDialogs = new Set();
  const shown = [];
  const listeners = new Map();
  const composer = { hidden: false };
  const newProjectDialog = { addEventListener() {} };
  const context = createContext({
    projects: [project], activeProjectId: project.id, deferredOutputProjectId: project.id,
    sourceImport: null, newProjectUpload: { isBusy: () => false, reset() {} },
    $: selector => selector === '#composer' ? composer : newProjectDialog,
    document: {
      querySelector(selector) { assert.equal(selector, 'dialog[open]'); return openDialogs.size ? {} : null; },
      addEventListener(name, callback, capture) { listeners.set(name, { callback, capture }); },
    },
    setTimeout,
    showEditorProject(current) { shown.push(current.id); },
  });
  runInContext(deferredProduction, context, { filename: 'app-dialog-retry-integration.js' });
  return { project, context, openDialogs, shown, composer, listeners,
    close(id) { openDialogs.delete(id); listeners.get('close').callback({ target: { tagName: 'DIALOG', id } }); },
  };
}

test('closing any dialog retries deferred drafts after its close handlers settle', async () => {
  for (const id of ['article-preview-dialog', 'revision-request-dialog', 'material-dialog', 'new-project-dialog']) {
    const ui = deferredFlow();
    ui.openDialogs.add(id);
    ui.context.renderDeferredOutput();
    assert.deepEqual(ui.shown, []);
    assert.equal(ui.listeners.get('close').capture, true, 'Dialog close events require capture because they do not bubble');
    ui.close(id);
    assert.deepEqual(ui.shown, [], 'Cleanup and navigation finish before retrying');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(ui.shown, ['project'], id);
    assert.equal(ui.context.deferredOutputProjectId, null);
  }
});

test('closing one dialog cannot render through another open dialog, import, or upload', async () => {
  for (const block of ['dialog', 'import', 'upload']) {
    const ui = deferredFlow();
    ui.openDialogs.add('article-preview-dialog');
    if (block === 'dialog') ui.openDialogs.add('revision-request-dialog');
    if (block === 'import') ui.context.sourceImport = {};
    if (block === 'upload') ui.context.newProjectUpload.isBusy = () => true;
    ui.close('article-preview-dialog');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(ui.shown, [], block);
    assert.equal(ui.context.deferredOutputProjectId, 'project', block);
    ui.openDialogs.clear();
    ui.context.sourceImport = null;
    ui.context.newProjectUpload.isBusy = () => false;
    ui.context.renderDeferredOutput();
    assert.deepEqual(ui.shown, ['project'], block);
  }
});

test('close cleanup can navigate, hide, delete, or archive a project without the deferred retry reopening it', async () => {
  for (const mutate of [
    ui => { ui.context.activeProjectId = 'another'; },
    ui => { ui.composer.hidden = true; },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.project.archivedAt = 1; },
    ui => { ui.context.projects = []; },
  ]) {
    const ui = deferredFlow();
    ui.close('article-preview-dialog');
    mutate(ui);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(ui.shown, []);
    assert.equal(ui.context.deferredOutputProjectId, null);
  }
});
