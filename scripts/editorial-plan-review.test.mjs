import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorialPlanReview } from '../dist/editorial-plan-review.js';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.isConnected = true; this.disabled = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  querySelector(selector) {
    const name = selector.match(/^textarea\[name="([a-z]+)"\]$/)?.[1];
    if (name && this.tagName === 'textarea' && this.name === name) return this;
    return this.children.map(child => child.querySelector(selector)).find(Boolean) || null;
  }
  addEventListener(key, callback) { this.listeners.set(key, callback); }
  fire(key, values = {}) { const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values }; this.listeners.get(key)?.(event); return event; }
  focus() { document.activeElement = this; }
  closest() { return null; }
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.fire('close'); }
  remove() { this.isConnected = false; }
}
const byClass = (root, name) => root.className?.split(' ').includes(name) ? root : root.children?.map(child => byClass(child, name)).find(Boolean);
const plans = () => [
  { outputId: 'draft-a', title: 'What Families Need to Know', format: 'Standard Format', audience: 'Parents', voice: '', angle: 'Family angle', focus: 'Timing', structure: 'Questions and answers', tone: 'Clear' },
  { outputId: 'draft-b', title: 'Questions Behind the Debate', format: 'Listicle', audience: 'Civic Readers', voice: 'Us Weekly', angle: 'Accountability', focus: 'Funding', structure: 'Five points', tone: 'Measured' },
];
function setup(t, options = {}) {
  const previous = globalThis.document;
  const body = new Element('body');
  globalThis.document = { body, createElement: tag => new Element(tag), activeElement: null };
  t.after(() => { globalThis.document = previous; });
  const controller = createEditorialPlanReview(options);
  const dialog = controller.element;
  const tabs = byClass(dialog, 'editorial-plan-review-tabs');
  const details = byClass(dialog, 'editorial-plan-review-details');
  const footer = byClass(dialog, 'editorial-plan-review-footer');
  return { controller, dialog, tabs, details, back: footer.children[0], confirm: footer.children[1], error: byClass(dialog, 'editorial-plan-review-error'), dismiss: byClass(dialog, 'icon-button'), inputs: () => byClass(details, 'editorial-plan-review-fields').children.map(field => field.children[1]) };
}

test('opens a modal with plan selectors and no draft side effects', t => {
  let confirmed = 0;
  let panelsClosed = 0;
  const ui = setup(t, { onConfirm() { confirmed++; return true; }, closePanels() { panelsClosed++; } });
  assert.equal(ui.controller.open({ projectId: 'project', plans: plans() }), true);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(panelsClosed, 1);
  assert.equal(confirmed, 0);
  assert.equal(ui.confirm.textContent, 'Create 2 Drafts');
  assert.equal(ui.tabs.children.length, 2);
  assert.equal(ui.tabs.getAttribute('role'), 'tablist');
  assert.equal(ui.tabs.children[0].getAttribute('aria-selected'), 'true');
  assert.equal(ui.tabs.children[1].getAttribute('aria-selected'), 'false');
  assert.equal(ui.details.getAttribute('aria-labelledby'), ui.tabs.children[0].id);
  assert.equal(document.activeElement, ui.tabs.children[0]);
  assert.deepEqual(ui.inputs().map(input => input.value), ['Family angle', 'Timing', 'Questions and answers', 'Clear']);
});

test('edits survive switching plans and are isolated until successful confirmation', t => {
  let submitted;
  let cancelled = 0;
  const original = plans();
  const ui = setup(t, { onConfirm(payload) { submitted = payload; return true; }, onCancel() { cancelled++; } });
  const opener = new Element('button');
  ui.controller.open({ projectId: 'project', plans: original, opener });
  ui.inputs()[0].value = 'A new family angle';
  ui.inputs()[0].fire('input');
  assert.equal(original[0].angle, 'Family angle');
  ui.tabs.children[1].fire('click');
  ui.inputs()[3].value = 'Plainspoken';
  ui.inputs()[3].fire('input');
  ui.tabs.children[0].fire('click');
  assert.equal(ui.inputs()[0].value, 'A new family angle');
  ui.confirm.fire('click');
  assert.equal(submitted.projectId, 'project');
  assert.equal(submitted.plans[0].angle, 'A new family angle');
  assert.equal(submitted.plans[1].tone, 'Plainspoken');
  assert.equal(cancelled, 0);
  assert.equal(ui.controller.isOpen, false);
  assert.equal(document.activeElement, opener);
  submitted.plans[0].angle = 'Changed after submit';
  assert.equal(original[0].angle, 'Family angle');
});

test('plan keyboard selection supports arrows, Home and End with focus and selected details in sync', t => {
  const ui = setup(t);
  ui.controller.open({ projectId: 'project', plans: plans() });
  assert.equal(ui.tabs.children[0].fire('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
  assert.equal(document.activeElement, ui.tabs.children[1]);
  assert.equal(ui.tabs.children[1].tabIndex, 0);
  assert.equal(ui.tabs.children[0].tabIndex, -1);
  assert.equal(ui.inputs()[0].value, 'Accountability');
  ui.tabs.children[1].fire('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, ui.tabs.children[0]);
  ui.tabs.children[0].fire('keydown', { key: 'End' });
  assert.equal(document.activeElement, ui.tabs.children[1]);
  ui.tabs.children[1].fire('keydown', { key: 'Home' });
  assert.equal(document.activeElement, ui.tabs.children[0]);
  ui.tabs.children[0].fire('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, ui.tabs.children[1]);
});

for (const dismiss of ['back', 'dismiss', 'native-close']) {
  test(`${dismiss} cancels without confirming or changing original plans`, t => {
    const cancelled = [];
    let confirmed = 0;
    const original = plans();
    const ui = setup(t, { onConfirm() { confirmed++; return true; }, onCancel(payload) { cancelled.push(payload); } });
    ui.controller.open({ projectId: 'project', plans: original });
    ui.inputs()[0].value = 'Uncommitted edit';
    ui.inputs()[0].fire('input');
    if (dismiss === 'native-close') ui.dialog.close();
    else ui[dismiss].fire('click');
    assert.equal(confirmed, 0);
    assert.equal(cancelled.length, 1);
    assert.equal(cancelled[0].projectId, 'project');
    assert.equal(original[0].angle, 'Family angle');
    assert.equal(ui.controller.isOpen, false);
    ui.controller.open({ projectId: 'project', plans: original });
    assert.equal(ui.inputs()[0].value, 'Family angle');
  });
}

test('failed confirmation keeps edits open and allows retry', t => {
  let attempts = 0;
  const ui = setup(t, { onConfirm() { return ++attempts > 1; } });
  ui.controller.open({ projectId: 'project', plans: plans() });
  ui.inputs()[2].value = 'Three focused sections';
  ui.inputs()[2].fire('input');
  ui.confirm.fire('click');
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.error.hidden, false);
  assert.equal(ui.error.getAttribute('role'), 'alert');
  assert.equal(ui.confirm.disabled, false);
  assert.equal(ui.inputs()[2].value, 'Three focused sections');
  ui.confirm.fire('click');
  assert.equal(attempts, 2);
  assert.equal(ui.controller.isOpen, false);
});

test('blank fields select the offending plan, focus its invalid field, and block confirmation until corrected', t => {
  let confirmed = 0;
  const original = plans();
  original[1].angle = '   ';
  original[1].tone = '';
  const ui = setup(t, { onConfirm() { confirmed++; return true; } });
  ui.controller.open({ projectId: 'project', plans: original });
  ui.confirm.fire('click');
  assert.equal(confirmed, 0);
  assert.equal(ui.tabs.children[1].getAttribute('aria-selected'), 'true');
  assert.equal(ui.error.textContent, 'Add an editorial angle for “Questions Behind the Debate”.');
  assert.equal(ui.inputs()[0].getAttribute('aria-invalid'), 'true');
  assert.equal(document.activeElement, ui.inputs()[0]);
  ui.inputs()[0].value = 'Explain the accountability questions';
  ui.inputs()[0].fire('input');
  assert.equal(ui.inputs()[0].getAttribute('aria-invalid'), undefined);
  assert.equal(ui.error.hidden, true);
  ui.confirm.fire('click');
  assert.equal(confirmed, 0);
  assert.equal(ui.error.textContent, 'Add a tone for “Questions Behind the Debate”.');
  assert.equal(document.activeElement, ui.inputs()[3]);
  ui.inputs()[3].value = 'Measured';
  ui.inputs()[3].fire('input');
  ui.confirm.fire('click');
  assert.equal(confirmed, 1);
  assert.equal(ui.controller.isOpen, false);
});

test('legacy None Selected values do not appear as setting chips', t => {
  const original = plans();
  original[0].format = 'None Selected';
  original[0].audience = ' none selected ';
  original[0].voice = 'Us Weekly';
  const ui = setup(t);
  ui.controller.open({ projectId: 'project', plans: original });
  const chips = byClass(ui.tabs.children[0], 'editorial-plan-review-card-chips');
  assert.equal(chips.children.length, 1);
  assert.equal(chips.children[0].textContent, 'Us Weekly');
});

test('rejects missing and duplicate draft identities and guards an already-open review', t => {
  const ui = setup(t);
  assert.equal(ui.controller.open({ projectId: 'project', plans: [] }), false);
  assert.equal(ui.controller.open({ projectId: 'project', plans: [{ title: 'Missing ID' }] }), false);
  assert.equal(ui.controller.open({ projectId: 'project', plans: [plans()[0], plans()[0]] }), false);
  assert.equal(ui.controller.open({ plans: plans() }), false);
  assert.equal(ui.controller.open({ projectId: 'project', plans: plans() }), true);
  assert.equal(ui.controller.open({ projectId: 'another', plans: plans() }), false);
  assert.equal(ui.confirm.disabled, true, 'no confirmation callback cannot initiate drafting');
});

test('destroy closes once and never restores focus to an unavailable opener', t => {
  let cancelled = 0;
  const ui = setup(t, { onCancel() { cancelled++; } });
  const opener = new Element('button');
  opener.closest = () => opener;
  ui.controller.open({ projectId: 'project', plans: plans(), opener });
  ui.controller.destroy();
  ui.controller.destroy();
  assert.equal(cancelled, 1);
  assert.equal(ui.dialog.isConnected, false);
  assert.notEqual(document.activeElement, opener);
  assert.equal(ui.controller.open({ projectId: 'project', plans: plans() }), false);
});
