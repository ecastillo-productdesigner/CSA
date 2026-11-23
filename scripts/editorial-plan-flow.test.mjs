import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { prepareAudienceSimilarities } from '../dist/audience-similarity-summary.js';
import { INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount } from '../dist/editorial-word-count.js';
import { projectOutputs, selectedOutputs, selectedPendingOutputs, outputIsReady, outputWordCount } from '../dist/outputs.js';
import { buildEditorialPlans, applyEditorialPlan } from '../dist/editorial-plans.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const from = app.indexOf('function cancelOutputProcessing(');
const until = app.indexOf("$('#composer-editorial-direction').addEventListener('input'");
assert.ok(from >= 0 && until > from);
const production = app.slice(from, until);
const clone = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };

function setup({ role = 'Trend Hunter', savedProject, now: initialNow = 1000 } = {}) {
  const project = savedProject || {
    id: 'project', selectedOutputIds: ['one', 'two'],
    outputs: [
      { id: 'one', title: 'Families Consider the School Debate', status: 'pending', editorialDirection: 'Write 750 words', labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'Parents & Caregivers' }], toolPreferences: { format: 'standard' }, sourceSnapshots: [{ title: 'School board discusses a new proposal', text: 'The board is considering a proposal and plans further discussion.' }] },
      { id: 'two', title: 'Questions Behind the School Debate', status: 'pending', editorialDirection: 'Focus on accountability', labels: [{ key: 'format', label: 'Listicle' }, { key: 'audience', label: 'Civically Engaged Readers' }], toolPreferences: { format: 'listicle' }, sourceSnapshots: [{ title: 'School board discusses a new proposal', text: 'The board is considering a proposal and plans further discussion.' }] },
    ],
  };
  let now = initialNow;
  let click;
  let reviewClick;
  let timerId = 0;
  let saveSucceeds = true;
  const timers = new Map();
  const calls = { opened: [], saved: [], rendered: [], populated: [], shown: [], notifications: [], timers: [], flushed: 0, similarities: [] };
  const button = { addEventListener(name, handler) { assert.equal(name, 'click'); click = handler; }, focus() {} };
  const reviewButton = { hidden: true, disabled: false, addEventListener(name, handler) { assert.equal(name, 'click'); reviewClick = handler; }, focus() {} };
  const draftLabel = { textContent: 'Draft' };
  const composer = { hidden: false };
  const roleSelector = { value: role };
  const review = { open: false, target: null };
  const context = createContext({
    projects: [project], activeProjectId: project.id,
    $: selector => {
      const found = { '#create-output': button, '#review-output': reviewButton, '#create-output-label': draftLabel, '#composer': composer, '#new-project-dialog': { open: false } }[selector];
      assert.ok(found, `Unexpected selector ${selector}`);
      return found;
    },
    document: { querySelector(selector) { assert.equal(selector, 'dialog[open]'); return review.open ? review : null; } },
    projectOutputs, selectedOutputs, selectedPendingOutputs, outputIsReady, outputWordCount,
    prepareAudienceSimilarities(current) { const result = prepareAudienceSimilarities(current); calls.similarities.push({ result, savedCount: calls.saved.length, shownCount: calls.shown.length, processing: current.outputProcessing }); return result; },
    buildEditorialPlans, applyEditorialPlan, roleSelector,
    INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount,
    editorialPlanReview: {
      open(target) {
        review.open = true;
        review.target = { ...target, plans: clone(target.plans) };
        calls.opened.push({ projectId: target.projectId, plans: clone(target.plans), opener: target.opener });
        return true;
      },
      get isOpen() { return review.open; },
    },
    richEditor: { flush() { calls.flushed++; }, close() {} },
    outputTimers: new Map(), outputViews: new Map(),
    deferredOutputProjectId: null, sourceImport: null, newProjectUpload: { isBusy: () => false },
    saveProjects() { calls.saved.push(clone(project)); return saveSucceeds; },
    renderOutputs(current) { calls.rendered.push(clone(current)); }, updateComposerActions() {},
    populateOutputContent(output) { calls.populated.push(output.id); output.draftText = 'A shorter source-based draft for review.'; },
    reviseSampleOutput() { assert.fail('New drafts must not use the revision path'); },
    showEditorProject(current) { calls.shown.push(current.id); }, railNavigation: { closeTransient() {} },
    notify(message) { calls.notifications.push(message); }, tokenNumber: () => 10000,
    Date: class extends Date { static now() { return now; } }, structuredClone,
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, at: now + delay });
      calls.timers.push(delay);
      return id;
    },
    clearTimeout(id) { timers.delete(id); }, queueMicrotask,
  });
  runInContext(production, context, { filename: 'app-editorial-plan-flow.js' });
  return {
    project, calls, context, button, reviewButton, draftLabel, composer, roleSelector, review, timers,
    run() { click(); },
    openReview() { reviewClick(); },
    refreshActions() { context.updateEditorialPlanAction(project); },
    cancel() { context.rememberEditorialPlanEdits(review.target); review.open = false; review.target = null; },
    confirm(plans = review.target?.plans, projectId = review.target?.projectId) {
      const result = context.confirmEditorialPlans({ projectId, plans });
      if (result) { review.open = false; review.target = null; }
      return result;
    },
    resume() { context.resumeOutputProcessing(project); },
    saveSucceeds(value) { saveSucceeds = value; },
    async advance(milliseconds) {
      const target = now + milliseconds;
      let next;
      while ((next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0])) {
        const [id, timer] = next;
        now = timer.at; timers.delete(id); timer.callback(); await flush();
      }
      now = target; await flush();
    },
  };
}

test('Review Plans opens selected pending plans without starting a job or creating drafts', async () => {
  const ui = setup();
  const original = clone(ui.project.outputs);
  ui.openReview();
  assert.equal(ui.calls.opened.length, 1);
  assert.equal(ui.calls.opened[0].projectId, ui.project.id);
  assert.equal(ui.calls.opened[0].opener, ui.reviewButton);
  assert.deepEqual(ui.calls.opened[0].plans.map(plan => plan.outputId), ['one', 'two']);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.equal(ui.calls.saved.length, 0);
  assert.equal(ui.calls.rendered.length, 0);
  assert.equal(ui.timers.size, 0);
  await ui.advance(20000);
  assert.deepEqual(ui.project.outputs, original);
  assert.equal(ui.calls.populated.length, 0);
});

test('canceling keeps selected content pending and preserves edits when reopened', async () => {
  const ui = setup();
  ui.openReview();
  ui.review.target.plans[0].angle = 'An edit that was not approved';
  ui.cancel();
  await ui.advance(20000);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.equal(ui.calls.saved.length, 0);
  assert.equal(ui.project.outputs[0].editorialPlan, undefined);
  assert.ok(ui.project.outputs.every(output => output.status === 'pending'));
  assert.deepEqual(ui.project.selectedOutputIds, ['one', 'two']);
  ui.openReview();
  assert.equal(ui.calls.opened.length, 2);
  assert.equal(ui.review.target.plans[0].angle, 'An edit that was not approved');
});

test('confirmation saves detached reviewed plans and starts the existing ten-second job', async () => {
  const ui = setup();
  ui.openReview();
  await ui.advance(60000);
  const plans = ui.review.target.plans;
  plans[0].angle = 'Focus on the questions families still need answered.';
  plans[1].focus = 'Prioritize accountability and the next public decision.';
  assert.equal(ui.confirm(plans), true);
  assert.equal(ui.project.outputs[0].editorialPlan.angle, plans[0].angle);
  assert.equal(ui.project.outputs[1].editorialPlan.focus, plans[1].focus);
  assert.equal(ui.project.outputs[0].editorialDirection, 'Write 750 words');
  assert.equal(ui.project.outputProcessing.readyAt, 71000);
  assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two']);
  assert.deepEqual(ui.calls.timers, [10000]);
  assert.equal(ui.calls.saved.at(-1).outputs[0].editorialPlan.angle, plans[0].angle);
  plans[0].angle = 'Later mutation';
  assert.notEqual(ui.project.outputs[0].editorialPlan.angle, plans[0].angle);
  await ui.advance(9999);
  assert.equal(ui.calls.populated.length, 0);
  await ui.advance(1);
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.equal(ui.project.outputs[0].wordCountNoticePending, true, 'Completed shorter-draft notices remain compatible');
  assert.equal(ui.project.outputProcessing, undefined);
  assert.equal(ui.calls.similarities.length, 1);
  assert.equal(ui.calls.similarities[0].processing, undefined, 'The finished drafts are eligible when scores are prepared');
  assert.deepEqual(ui.calls.similarities[0].result.drafts.map(draft => draft.id), ['one', 'two']);
  assert.equal(ui.calls.similarities[0].result.summaries.size, 2);
  assert.equal(ui.calls.saved.length, ui.calls.similarities[0].savedCount + 1, 'Prepared scores precede completion persistence');
  assert.equal(ui.calls.similarities[0].shownCount, 0, 'Prepared scores precede the ready editor view');
});

test('other roles, no role, and one selected pending draft keep direct drafting', () => {
  for (const role of ['', 'Journalist', 'Lifestyle & Entertainment', 'eCommerce']) {
    const ui = setup({ role });
    ui.run();
    assert.equal(ui.calls.opened.length, 0, role);
    assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two'], role);
    assert.deepEqual(ui.calls.timers, [10000], role);
  }
  for (const mutate of [
    ui => { ui.project.selectedOutputIds = ['one']; },
    ui => { ui.project.outputs[1].status = 'ready'; },
  ]) {
    const ui = setup(); mutate(ui); ui.run();
    assert.equal(ui.calls.opened.length, 0);
    assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one']);
  }
});

test('only selected pending drafts receive plans; unselected or completed items are not included', () => {
  const ui = setup();
  ui.project.outputs.push(
    { id: 'unselected', title: 'Unselected pending', status: 'pending' },
    { id: 'ready', title: 'Already drafted', status: 'ready' },
  );
  ui.project.selectedOutputIds.push('ready');
  ui.openReview();
  assert.deepEqual(ui.review.target.plans.map(plan => plan.outputId), ['one', 'two']);
  assert.equal(ui.confirm(), true);
  assert.equal(ui.project.outputs[2].editorialPlan, undefined);
  assert.equal(ui.project.outputs[3].editorialPlan, undefined);
});

test('confirmation refuses stale projects, roles, target IDs, and changed selection', () => {
  for (const mutate of [
    ui => { ui.context.activeProjectId = 'another'; },
    ui => { ui.context.projects = []; },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.project.archivedAt = 1; },
    ui => { ui.roleSelector.value = 'Journalist'; },
    ui => { ui.project.selectedOutputIds = ['one']; },
    ui => { ui.project.outputs[1].status = 'ready'; },
    ui => { ui.project.outputs.pop(); },
    ui => { ui.review.target.plans[1].outputId = 'one'; },
    ui => { ui.review.target.plans[1].outputId = 'missing'; },
    ui => { ui.review.target.plans.pop(); },
    ui => { ui.review.target.projectId = 'missing'; },
    ui => { ui.project.outputs.push({ id: 'three', title: 'New selection', status: 'pending' }); ui.project.selectedOutputIds.push('three'); },
  ]) {
    const ui = setup(); ui.openReview(); mutate(ui);
    assert.equal(ui.confirm(), false);
    assert.equal(ui.project.outputProcessing, undefined);
    assert.equal(ui.calls.saved.length, 0);
    assert.equal(ui.timers.size, 0);
    assert.ok(ui.project.outputs.every(output => !output.editorialPlan));
  }
});

test('empty reviewed fields are rejected before any plan is applied', () => {
  for (const field of ['angle', 'focus', 'structure', 'tone']) {
    const ui = setup(); ui.openReview(); ui.review.target.plans[1][field] = '   ';
    assert.equal(ui.confirm(), false, field);
    assert.equal(ui.calls.saved.length, 0, field);
    assert.equal(ui.project.outputProcessing, undefined, field);
    assert.ok(ui.project.outputs.every(output => !output.editorialPlan), field);
  }
});

test('failed persistence rolls reviewed plans and the pending job back for a safe retry', () => {
  const ui = setup();
  const originalPlan = { angle: 'Earlier angle', focus: 'Earlier focus', structure: 'Earlier structure', tone: 'Earlier tone' };
  ui.project.outputs[0].editorialPlan = clone(originalPlan);
  ui.openReview();
  ui.review.target.plans[0].angle = 'New angle';
  ui.saveSucceeds(false);
  assert.equal(ui.confirm(), false);
  assert.equal(ui.project.outputProcessing, undefined);
  assert.deepEqual(ui.project.outputs[0].editorialPlan, originalPlan);
  assert.equal(ui.project.outputs[1].editorialPlan, undefined);
  assert.equal(ui.calls.rendered.length, 0);
  assert.equal(ui.timers.size, 0);
  ui.saveSucceeds(true);
  assert.equal(ui.confirm(), true);
  assert.equal(ui.project.outputs[0].editorialPlan.angle, 'New angle');
  assert.deepEqual(ui.calls.timers, [10000]);
});

test('duplicate confirmation cannot replace an active job or apply a second plan set', () => {
  const ui = setup(); ui.openReview();
  const plans = clone(ui.review.target.plans);
  assert.equal(ui.confirm(), true);
  const job = ui.project.outputProcessing;
  plans[0].angle = 'Duplicate submission';
  assert.equal(ui.confirm(plans, ui.project.id), false);
  assert.equal(ui.project.outputProcessing, job);
  assert.notEqual(ui.project.outputs[0].editorialPlan.angle, plans[0].angle);
  assert.deepEqual(ui.calls.timers, [10000]);
});

test('approved plans survive reload and resumed drafting waits only the remaining time', async () => {
  const first = setup(); first.openReview();
  first.review.target.plans[0].tone = 'Measured and direct.';
  assert.equal(first.confirm(), true);
  const ui = setup({ savedProject: clone(first.project), now: 6000 });
  ui.resume();
  assert.equal(ui.calls.opened.length, 0);
  assert.deepEqual(ui.calls.timers, [5000]);
  assert.equal(ui.project.outputs[0].editorialPlan.tone, 'Measured and direct.');
  await ui.advance(5000);
  assert.ok(ui.project.outputs.every(outputIsReady));
  assert.equal(ui.project.outputs[0].editorialPlan.tone, 'Measured and direct.');
});


test('Draft bypasses planning for Trend Hunter with multiple selected drafts', async () => {
  const ui = setup();
  ui.run();
  assert.equal(ui.calls.opened.length, 0);
  assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two']);
  assert.deepEqual(ui.calls.timers, [10000]);
  assert.ok(ui.project.outputs.every(output => !output.editorialPlan));
  await ui.advance(10000);
  assert.deepEqual(ui.calls.populated, ['one', 'two']);
  assert.ok(ui.project.outputs.every(outputIsReady));
});

test('direct drafting after closing review does not silently apply unapproved edits', () => {
  const ui = setup();
  ui.openReview();
  ui.review.target.plans[0].angle = 'An unapproved editorial angle';
  ui.cancel();
  ui.run();
  assert.equal(ui.calls.opened.length, 1);
  assert.deepEqual(Array.from(ui.project.outputProcessing.ids), ['one', 'two']);
  assert.ok(ui.project.outputs.every(output => !output.editorialPlan));
});

test('Review Plans refuses ineligible roles, selections, archived projects, and active jobs', () => {
  for (const mutate of [
    ui => { ui.roleSelector.value = ''; },
    ui => { ui.roleSelector.value = 'Journalist'; },
    ui => { ui.roleSelector.value = 'Lifestyle & Entertainment'; },
    ui => { ui.roleSelector.value = 'eCommerce'; },
    ui => { ui.project.selectedOutputIds = []; },
    ui => { ui.project.selectedOutputIds = ['one']; },
    ui => { ui.project.outputs[1].status = 'ready'; },
    ui => { ui.project.outputProcessing = { ids: ['one'], readyAt: 11000 }; },
    ui => { ui.project.archivedAt = 1; },
    ui => { ui.project.deletedAt = 1; },
    ui => { ui.context.activeProjectId = 'another'; },
  ]) {
    const ui = setup();
    mutate(ui);
    ui.openReview();
    assert.equal(ui.calls.opened.length, 0);
    assert.equal(ui.calls.saved.length, 0);
    assert.equal(ui.timers.size, 0);
  }
});

test('retained plan edits follow their draft IDs when selection and card metadata change', () => {
  const ui = setup();
  ui.openReview();
  ui.review.target.plans[0].angle = 'Keep my first draft angle';
  ui.review.target.plans[1].tone = 'Keep my second draft tone';
  ui.cancel();
  ui.project.outputs[0].title = 'Updated first draft heading';
  ui.project.outputs.push({ id: 'three', title: 'Third draft', status: 'pending' });
  ui.project.selectedOutputIds = ['one', 'three'];
  ui.openReview();
  assert.deepEqual(ui.review.target.plans.map(plan => plan.outputId), ['one', 'three']);
  assert.equal(ui.review.target.plans[0].title, 'Updated first draft heading');
  assert.equal(ui.review.target.plans[0].angle, 'Keep my first draft angle');
  assert.notEqual(ui.review.target.plans[1].tone, 'Keep my second draft tone');
  ui.cancel();
  ui.project.selectedOutputIds = ['one', 'two'];
  ui.openReview();
  assert.equal(ui.review.target.plans[1].tone, 'Keep my second draft tone');
});


test('Review Plans visibility follows role and selected pending count and disables during drafting', () => {
  const ui = setup();
  ui.refreshActions();
  assert.equal(ui.reviewButton.hidden, false);
  assert.equal(ui.reviewButton.disabled, false);
  assert.equal(ui.draftLabel.textContent, 'Draft');
  ui.roleSelector.value = 'Journalist';
  ui.refreshActions();
  assert.equal(ui.reviewButton.hidden, true);
  ui.roleSelector.value = 'Trend Hunter';
  ui.project.selectedOutputIds = ['one'];
  ui.refreshActions();
  assert.equal(ui.reviewButton.hidden, true);
  assert.equal(ui.draftLabel.textContent, 'Draft');
  ui.project.selectedOutputIds = ['one', 'two'];
  ui.project.outputs[1].status = 'ready';
  ui.refreshActions();
  assert.equal(ui.reviewButton.hidden, true, 'A selected completed draft does not count toward planning');
  ui.project.outputs[1].status = 'pending';
  ui.project.outputProcessing = { ids: ['one', 'two'] };
  ui.refreshActions();
  assert.equal(ui.reviewButton.hidden, false);
  assert.equal(ui.reviewButton.disabled, true);
  delete ui.project.outputProcessing;
  ui.refreshActions();
  assert.equal(ui.reviewButton.disabled, false);
});

test('direct Draft ignores empty selection and cannot replace an active job', () => {
  const ui = setup();
  ui.project.selectedOutputIds = [];
  ui.run();
  assert.equal(ui.project.outputProcessing, undefined);
  assert.equal(ui.calls.saved.length, 0);
  ui.project.selectedOutputIds = ['one', 'two'];
  ui.run();
  const job = ui.project.outputProcessing;
  ui.run();
  assert.equal(ui.project.outputProcessing, job);
  assert.equal(ui.calls.saved.length, 1);
  assert.deepEqual(ui.calls.timers, [10000]);
});

test('finishing a later draft includes existing ready drafts in the automatically prepared results', async () => {
  const ready = { id: 'existing', title: 'Earlier orchard story', status: 'ready', draftText: 'Farmers discussed the apple harvest.', toolPreferences: { audience: 'general' } };
  const pending = { id: 'new', title: 'New school story', status: 'pending', editorialDirection: '', toolPreferences: { audience: 'wellness-enthusiast' } };
  const savedProject = { id: 'project', selectedOutputIds: ['new'], outputs: [ready, pending] };
  const first = prepareAudienceSimilarities(savedProject);
  assert.equal(first.summaries.size, 0);
  const ui = setup({ savedProject });
  ui.run();
  await ui.advance(10000);
  assert.deepEqual(ui.calls.populated, ['new'], 'Existing ready drafts are not regenerated');
  const prepared = ui.calls.similarities.at(-1);
  assert.deepEqual(prepared.result.drafts.map(item => item.id), ['existing', 'new']);
  assert.notEqual(prepared.result, first);
  assert.equal(prepared.result.summaries.size, 2);
  assert.equal(prepared.result.summaries.get('existing').comparisonCount, 2);
  assert.equal(prepared.result.summaries.get('new').comparisonCount, 2);
  assert.equal(prepared.result.summaries.get('existing').includesSourceDraft, true);
  assert.equal(prepared.result.sourceDraft.isSimilaritySource, true);
  assert.equal(prepared.shownCount, 0);
  assert.equal(prepared.processing, undefined);
});
