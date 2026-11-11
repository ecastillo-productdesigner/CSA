import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { createEditorialWordCountNotice } from '../dist/editorial-word-count-notice.js';
import { INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount } from '../dist/editorial-word-count.js';
import { projectOutputs, selectedOutputs, selectedPendingOutputs, outputIsReady } from '../dist/outputs.js';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.isConnected = true; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  addEventListener(key, callback) { this.listeners.set(key, callback); }
  fire(key, values = {}) { this.listeners.get(key)?.({ target: this, ...values }); }
  focus() { document.activeElement = this; }
  closest() { return null; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire('close'); }
  remove() { this.isConnected = false; }
}
function setup(t) {
  const previous = globalThis.document;
  const body = new Element('body');
  globalThis.document = { body, createElement: tag => new Element(tag), activeElement: null };
  t.after(() => { globalThis.document = previous; });
  const controller = createEditorialWordCountNotice();
  const dialog = body.children[0];
  const [heading, description, recommendation, footer] = dialog.children;
  return { controller, dialog, title: heading.children[0], dismiss: heading.children[1], description, recommendation,
    back: footer.children[0], proceed: footer.children[1] };
}

test('requests at or below500 and non-length directions continue without opening a notice', async t => {
  const ui = setup(t);
  for (const text of ['', 'Keep it focused', 'Write 500 words', 'Write 300 words', 'Do not exceed 500 words']) {
    assert.equal(await ui.controller.confirm([text]), true);
    assert.notEqual(ui.dialog.open, true);
  }
});

test('an over500 request pauses a batch, explains next steps, and requires an explicit decision', async t => {
  const ui = setup(t);
  const trigger = new Element('button');
  let resolved = false;
  const answer = ui.controller.confirm(['Write 300 words', 'Write a 750-word draft'], { trigger });
  answer.then(() => { resolved = true; });
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.dialog.getAttribute('role'), 'alertdialog');
  assert.equal(ui.dialog.getAttribute('data-manual-dismiss'), 'true');
  assert.equal(ui.dialog.getAttribute('aria-labelledby'), ui.title.id);
  assert.equal(ui.dialog.getAttribute('aria-describedby'), `${ui.description.id} ${ui.recommendation.id}`);
  assert.equal(ui.description.textContent, 'An initial draft can’t guarantee the requested length from the available source material.');
  assert.match(ui.recommendation.textContent, /sources.*Request Revision/);
  assert.equal(document.activeElement, ui.back);
  ui.dialog.fire('click', { clientX: 0, clientY: 0 });
  await Promise.resolve();
  assert.equal(ui.dialog.open, true, 'backdrop click must not dismiss');
  assert.equal(resolved, false);
  assert.equal(ui.controller.confirm('Write 900 words'), answer, 'repeated actions share one pending decision');
  ui.proceed.fire('click');
  assert.equal(await answer, true);
  assert.equal(ui.dialog.open, false);
  assert.equal(document.activeElement, trigger);
});

test('Go Back, Close, and Escape cancel drafting and a later attempt needs another decision', async t => {
  const ui = setup(t);
  for (const dismiss of [() => ui.back.fire('click'), () => ui.dismiss.fire('click'), () => {
    let prevented = false;
    ui.dialog.fire('cancel', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }]) {
    const answer = ui.controller.confirm('Write 1000 words');
    dismiss();
    assert.equal(await answer, false);
    assert.equal(ui.dialog.open, false);
  }
  const answer = ui.controller.confirm('Write 1000 words');
  ui.controller.destroy();
  assert.equal(await answer, false);
  assert.equal(ui.dialog.isConnected, false);
});

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const flowStart = app.indexOf('function cancelOutputProcessing(');
const flowEnd = app.indexOf("$('#composer-editorial-direction').addEventListener('input'");
assert.ok(flowStart >= 0 && flowEnd > flowStart);
const production = app.slice(flowStart, flowEnd);
const clone = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };

function draftFlow({ project: savedProject, now: initialNow = 1000, active = true } = {}) {
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
  let pendingDecision;
  const timers = new Map();
  const calls = { saved: [], rendered: [], notices: [], timers: [], populated: [], revised: [], shown: [], notifications: [], focused: 0, actions: 0, flushed: 0, closed: 0 };
  const button = {
    addEventListener(name, callback) { assert.equal(name, 'click'); handler = callback; },
    focus() { calls.focused++; },
  };
  const composer = { hidden: !active };
  const dialog = { open: false };
  const context = createContext({
    projects: [project], activeProjectId: active ? project.id : null,
    $: selector => {
      const control = { '#create-output': button, '#composer': composer, '#new-project-dialog': dialog }[selector];
      assert.ok(control, `Unexpected selector: ${selector}`);
      return control;
    },
    projectOutputs, selectedOutputs, selectedPendingOutputs, outputIsReady,
    INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount,
    outputTimers: new Map(), outputViews: new Map(), outputWordCountReviews: new WeakSet(),
    deferredOutputProjectId: null, sourceImport: null,
    newProjectUpload: { isBusy: () => false },
    richEditor: { flush() { calls.flushed++; }, close() { calls.closed++; } },
    draftLengthNotice: {
      confirm(directions) {
        calls.notices.push(Array.from(directions));
        assert.equal(pendingDecision, undefined, 'Only one notice may be pending');
        return new Promise(resolve => { pendingDecision = resolve; });
      },
    },
    saveProjects() { calls.saved.push(clone(project)); return true; },
    renderOutputs(current) { calls.rendered.push(clone(current)); },
    updateComposerActions() { calls.actions++; },
    populateOutputContent(output) { calls.populated.push(output.id); output.draftText = 'A shorter initial draft'; },
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
    async decide(value) {
      assert.equal(typeof pendingDecision, 'function', 'A notice must be open before deciding');
      const resolve = pendingDecision;
      pendingDecision = undefined;
      resolve(value);
      await flush();
    },
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

test('Draft starts immediately, waits ten seconds, then requires a manual length decision', async () => {
  const ui = draftFlow();
  ui.run();
  assert.equal(ui.calls.flushed, 1);
  assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two']);
  assert.equal(ui.project.outputProcessing.readyAt, 11000);
  assert.deepEqual(Array.from(ui.project.outputProcessing.editorialDirections), ['Write 750 words', 'Write 300 words']);
  assert.deepEqual(ui.calls.timers, [10000]);
  assert.equal(ui.calls.notices.length, 0);
  assert.equal(ui.calls.rendered.length, 1);
  await ui.advance(9999);
  assert.equal(ui.calls.notices.length, 0);
  await ui.advance(1);
  assert.deepEqual(ui.calls.notices, [['Write 750 words', 'Write 300 words']]);
  assert.equal(ui.project.outputProcessing.awaitingWordCountReview, true);
  assert.ok(ui.project.outputs.every(output => !outputIsReady(output)));
  assert.equal(ui.timers.size, 0);
  await ui.advance(60000);
  assert.ok(ui.project.outputProcessing, 'Elapsed time must never accept or dismiss the notice');
  assert.equal(ui.calls.populated.length, 0);
  assert.ok(ui.project.outputs.every(output => !Object.hasOwn(output, 'shorterDraftAccepted')), 'Waiting for review does not acknowledge a shorter draft');
  await ui.decide(true);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
  assert.equal(ui.project.outputs[0].shorterDraftAccepted, true);
  assert.equal(Object.hasOwn(ui.project.outputs[1], 'shorterDraftAccepted'), false, 'A normal recipe in the accepted batch has no shorter-draft note');
  assert.deepEqual(ui.calls.timers, [10000], 'Continue completes without another ten-second wait');
  assert.deepEqual(ui.calls.shown, ['project']);
});

test('Go Back preserves pending recipes, restores controls, and a retry gets a fresh attempt', async () => {
  const ui = draftFlow();
  const outputs = clone(ui.project.outputs);
  ui.run();
  await ui.advance(10000);
  await ui.decide(false);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.deepEqual(ui.project.outputs, outputs);
  assert.ok(ui.project.outputs.every(output => !Object.hasOwn(output, 'shorterDraftAccepted')), 'Canceling does not record an acknowledgement');
  assert.deepEqual(Array.from(ui.project.selectedOutputIds), ['one', 'two']);
  assert.equal(ui.calls.focused, 1);
  assert.equal(ui.calls.populated.length, 0);
  ui.run();
  assert.deepEqual(ui.calls.timers, [10000, 10000]);
  assert.equal(ui.calls.notices.length, 1);
  await ui.advance(9999);
  assert.equal(ui.calls.notices.length, 1);
  await ui.advance(1);
  assert.equal(ui.calls.notices.length, 2);
  await ui.decide(true);
  assert.ok(ui.project.outputs.every(outputIsReady));
});

test('duplicate Draft, timer resumes, and completion attempts share one job and one notice', async () => {
  const ui = draftFlow();
  ui.run();
  const job = ui.project.outputProcessing;
  ui.run();
  ui.resume();
  assert.equal(ui.project.outputProcessing, job);
  assert.deepEqual(ui.calls.timers, [10000]);
  await ui.advance(10000);
  ui.resume();
  ui.resume(false);
  ui.run();
  await flush();
  assert.equal(ui.calls.notices.length, 1);
  await ui.decide(true);
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
});

test('ordinary drafts and revision jobs finish after their timer without a notice', async () => {
  const ui = draftFlow();
  ui.project.outputs[0].editorialDirection = 'Write 500 words';
  ui.run();
  await ui.advance(10000);
  assert.equal(ui.calls.notices.length, 0);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.ok(ui.project.outputs.every(output => !Object.hasOwn(output, 'shorterDraftAccepted')));
  const revision = draftFlow();
  const output = revision.project.outputs[0];
  output.status = 'ready';
  output.shorterDraftAccepted = true;
  revision.project.outputProcessing = { kind: 'revision', ids: ['one'], openOutputId: 'one', instructions: 'Expand to 1000 words', requestedAt: 1000, readyAt: 11000 };
  revision.resume();
  await revision.advance(10000);
  assert.equal(revision.calls.notices.length, 0);
  assert.deepEqual(revision.calls.revised, [{ id: 'one', instructions: 'Expand to 1000 words', requestedAt: 1000 }]);
  assert.deepEqual(revision.calls.notifications, ['Revision complete']);
  assert.equal(revision.project.outputProcessing, undefined);
  assert.equal(output.shorterDraftAccepted, true, 'A revision preserves the initial shorter-draft acknowledgement');
  assert.equal(Object.hasOwn(revision.project.outputs[1], 'shorterDraftAccepted'), false);
});

test('shorter-draft acknowledgement persists across reload without affecting unselected recipes', async () => {
  const ui = draftFlow();
  ui.project.outputs.push(
    { id: 'unselected', title: 'Unselected oversized draft', status: 'pending', editorialDirection: 'Write 900 words' },
    { id: 'historical', title: 'Earlier accepted draft', status: 'ready', editorialDirection: 'Write 800 words', shorterDraftAccepted: true },
  );
  ui.run();
  await ui.advance(10000);
  await ui.decide(true);
  assert.equal(ui.project.outputs[0].shorterDraftAccepted, true);
  assert.equal(Object.hasOwn(ui.project.outputs[1], 'shorterDraftAccepted'), false);
  assert.equal(Object.hasOwn(ui.project.outputs[2], 'shorterDraftAccepted'), false, 'Unselected oversized recipes do not inherit acceptance');
  assert.equal(ui.project.outputs[3].shorterDraftAccepted, true, 'Existing acknowledgements remain unchanged');
  const restored = draftFlow({ project: clone(ui.calls.saved.at(-1)), now: ui.now() });
  restored.resume();
  await flush();
  assert.equal(restored.project.outputs[0].shorterDraftAccepted, true);
  assert.equal(Object.hasOwn(restored.project.outputs[1], 'shorterDraftAccepted'), false);
  assert.equal(Object.hasOwn(restored.project.outputs[2], 'shorterDraftAccepted'), false);
  assert.equal(restored.project.outputs[3].shorterDraftAccepted, true);
  assert.equal(restored.calls.notices.length, 0);
  assert.equal(restored.calls.timers.length, 0);
});

test('a fresh ordinary generation clears a previous shorter-draft acknowledgement', async () => {
  const ui = draftFlow();
  ui.project.outputs[0].editorialDirection = 'Write 300 words';
  ui.project.outputs[0].shorterDraftAccepted = true;
  ui.run();
  await ui.advance(10000);
  assert.equal(ui.calls.notices.length, 0);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.ok(ui.project.outputs.every(output => !Object.hasOwn(output, 'shorterDraftAccepted')));
  assert.ok(ui.calls.saved.at(-1).outputs.every(output => !Object.hasOwn(output, 'shorterDraftAccepted')));
});

test('reloading during generation waits only the remaining time and retains the saved directions', async () => {
  const first = draftFlow();
  first.run();
  const ui = draftFlow({ project: clone(first.project), now: 6000 });
  ui.resume(false);
  assert.deepEqual(ui.calls.timers, [5000]);
  await ui.advance(4999);
  assert.equal(ui.calls.notices.length, 0);
  await ui.advance(1);
  assert.equal(ui.calls.notices.length, 1);
  await ui.decide(true);
  assert.ok(ui.project.outputs.every(outputIsReady));
});

test('reloading an overdue notice waits for its project to open and does not restart generation', async () => {
  const first = draftFlow();
  first.run();
  await first.advance(10000);
  const ui = draftFlow({ project: clone(first.project), now: 25000, active: false });
  ui.resume();
  await flush();
  assert.equal(ui.calls.notices.length, 0);
  assert.equal(ui.calls.timers.length, 0);
  ui.context.activeProjectId = ui.project.id;
  ui.composer.hidden = false;
  ui.resume(false);
  assert.equal(ui.calls.notices.length, 0, 'The notice opens after the editor finishes rendering');
  await flush();
  assert.equal(ui.calls.notices.length, 1);
  await ui.decide(true);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.equal(ui.calls.timers.length, 0);
});

test('Go Back after reload restores the pending batch when the editor selected an existing ready draft', async () => {
  const first = draftFlow();
  first.run();
  const restored = clone(first.project);
  restored.outputs.push({ id: 'existing', title: 'Existing draft', status: 'ready' });
  restored.selectedOutputId = 'existing';
  restored.selectedOutputIds = ['existing'];
  const ui = draftFlow({ project: restored, now: 25000 });
  ui.context.outputViews.set(ui.project.id, 'created');
  ui.resume(false);
  await flush();
  assert.equal(ui.calls.notices.length, 1);
  await ui.decide(false);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.deepEqual(selectedPendingOutputs(ui.project).map(output => output.id), ['one', 'two']);
  assert.ok(ui.project.selectedOutputIds.includes('existing'));
  assert.equal(ui.context.outputViews.get(ui.project.id), 'pending');
  assert.equal(ui.calls.focused, 1);
  assert.equal(ui.calls.timers.length, 0);
  ui.run();
  assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two']);
});

test('a mixed batch with a missing direction survives JSON storage and still completes after review', async () => {
  const first = draftFlow();
  delete first.project.outputs[1].editorialDirection;
  first.run();
  const ui = draftFlow({ project: clone(first.project), now: 25000 });
  ui.resume(false);
  await flush();
  assert.deepEqual(ui.calls.notices, [['Write 750 words', '']]);
  await ui.decide(true);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.equal(ui.calls.timers.length, 0);
});

test('an inactive project never interrupts the current project with its word count notice', async () => {
  const ui = draftFlow();
  ui.run();
  ui.context.activeProjectId = 'another';
  await ui.advance(10000);
  assert.equal(ui.calls.notices.length, 0);
  assert.ok(ui.project.outputProcessing);
  ui.context.activeProjectId = ui.project.id;
  ui.resume();
  await flush();
  assert.equal(ui.calls.notices.length, 1);
  await ui.decide(false);
});

test('source imports, open project dialogs, and uploads defer the notice until they finish', async () => {
  for (const block of ['import', 'dialog', 'upload']) {
    const ui = draftFlow();
    ui.run();
    if (block === 'import') ui.context.sourceImport = {};
    if (block === 'dialog') ui.dialog.open = true;
    if (block === 'upload') ui.context.newProjectUpload.isBusy = () => true;
    await ui.advance(10000);
    assert.equal(ui.calls.notices.length, 0, block);
    assert.equal(ui.context.deferredOutputProjectId, ui.project.id, block);
    assert.ok(ui.project.outputs.every(output => !outputIsReady(output)));
    ui.context.sourceImport = null;
    ui.dialog.open = false;
    ui.context.newProjectUpload.isBusy = () => false;
    ui.resume();
    await flush();
    assert.equal(ui.calls.notices.length, 1, block);
    await ui.decide(true);
    assert.ok(ui.project.outputs.every(outputIsReady));
  }
});

test('a replaced timer cannot finish a new job before that job is ready', async () => {
  const ui = draftFlow();
  ui.project.outputs[0].editorialDirection = 'Write 500 words';
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
});

test('acceptance cannot complete a replaced job, deleted project, archived project, or another project', async () => {
  for (const mutate of [
    ui => { ui.project.outputProcessing = { ids: ['other'], readyAt: 90000 }; },
    ui => { ui.context.projects = []; },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.project.archivedAt = 1; },
    ui => { ui.context.activeProjectId = 'another'; },
  ]) {
    const ui = draftFlow();
    ui.run();
    await ui.advance(10000);
    mutate(ui);
    const currentJob = ui.project.outputProcessing;
    await ui.decide(true);
    assert.equal(ui.calls.populated.length, 0);
    assert.equal(ui.project.outputProcessing, currentJob);
  }
});

test('changed or missing target recipes cancel the attempt before or after the notice', async () => {
  for (const timing of ['before', 'after']) {
    for (const mutate of [
      ui => { ui.project.outputs.pop(); },
      ui => { ui.project.outputs[0].editorialDirection = 'Write 800 words'; },
      ui => { ui.project.outputs[0] = { ...ui.project.outputs[0], editorialDirection: 'Write 900 words' }; },
    ]) {
      const ui = draftFlow();
      ui.run();
      if (timing === 'before') mutate(ui);
      await ui.advance(10000);
      if (timing === 'after') { mutate(ui); await ui.decide(true); }
      assert.equal(ui.project.outputProcessing, undefined, timing);
      assert.equal(ui.calls.populated.length, 0, timing);
      assert.ok(ui.project.outputs.every(output => !outputIsReady(output)));
    }
  }
});
