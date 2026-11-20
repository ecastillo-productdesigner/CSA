import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorialPlanReview } from '../dist/editorial-plan-review.js';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.isConnected = true; this.disabled = false; this.scrollLeft = 0; this.scrollWidth = 0; this.clientWidth = 0; }
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
  removeEventListener(key, callback) { if (this.listeners.get(key) === callback) this.listeners.delete(key); }
  fire(key, values = {}) { const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values }; this.listeners.get(key)?.(event); return event; }
  focus() { document.activeElement = this; }
  scrollIntoView(options) { this.lastScrollIntoView = options; }
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
const fivePlans = () => Array.from({ length: 5 }, (_, index) => ({ ...plans()[index % 2], outputId: `draft-${index + 1}`, title: `Plan ${index + 1}`, angle: `Angle ${index + 1}` }));
function setup(t, options = {}) {
  const previous = globalThis.document;
  const frames = new Map();
  const observers = [];
  const listeners = new Map();
  let frameId = 0;
  const view = {
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
      observe(element) { this.targets.push(element); }
      disconnect() { this.disconnected = true; this.targets = []; }
    },
  };
  const body = new Element('body');
  globalThis.document = { body, createElement: tag => new Element(tag), activeElement: null, defaultView: view };
  body.ownerDocument = globalThis.document;
  const controller = createEditorialPlanReview(options);
  t.after(() => { controller.destroy(); globalThis.document = previous; });
  const dialog = controller.element;
  const tabs = byClass(dialog, 'editorial-plan-review-tabs');
  const details = byClass(dialog, 'editorial-plan-review-details');
  const footer = byClass(dialog, 'editorial-plan-review-footer');
  return { controller, dialog, tabs, strip: byClass(dialog, 'editorial-plan-review-card-strip'), view, frames, observers, listeners,
    flushFrames() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); },
    details, back: footer.children[0], confirm: footer.children[1], error: byClass(dialog, 'editorial-plan-review-error'), dismiss: byClass(dialog, 'icon-button'), inputs: () => byClass(details, 'editorial-plan-review-fields').children.map(field => field.children[1]) };
}

test('opens a modal with plan selectors and no draft side effects', t => {
  let confirmed = 0;
  let panelsClosed = 0;
  const ui = setup(t, { onConfirm() { confirmed++; return true; }, closePanels() { panelsClosed++; } });
  assert.equal(ui.controller.open({ projectId: 'project', plans: plans() }), true);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(panelsClosed, 1);
  assert.equal(confirmed, 0);
  assert.equal(ui.confirm.textContent, 'Draft with These Plans');
  assert.equal(ui.tabs.children.length, 2);
  assert.equal(ui.tabs.getAttribute('role'), 'tablist');
  assert.equal(ui.tabs.children[0].getAttribute('aria-selected'), 'true');
  assert.equal(ui.tabs.children[1].getAttribute('aria-selected'), 'false');
  assert.equal(ui.details.getAttribute('aria-labelledby'), ui.tabs.children[0].id);
  assert.equal(byClass(ui.tabs.children[0], 'editorial-plan-review-tab-title').title, 'What Families Need to Know');
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

test('five plan cards reveal clicked and keyboard-selected cards while keeping edits and tab semantics', t => {
  const ui = setup(t);
  ui.controller.open({ projectId: 'project', plans: fivePlans() });
  const cards = [...ui.tabs.children];
  assert.equal(ui.strip.children[0], ui.tabs);
  assert.equal(ui.tabs.getAttribute('role'), 'tablist');
  ui.inputs()[0].value = 'An edited first angle';
  ui.inputs()[0].fire('input');
  cards[0].fire('keydown', { key: 'End' });
  assert.equal(document.activeElement, cards[4]);
  assert.equal(cards[4].getAttribute('aria-selected'), 'true');
  assert.equal(ui.details.getAttribute('aria-labelledby'), cards[4].id);
  assert.deepEqual(cards[4].lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  assert.equal(ui.inputs()[0].value, 'Angle 5');
  cards[4].fire('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, cards[3]);
  assert.deepEqual(cards[3].lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  cards[3].fire('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, cards[4]);
  cards[4].fire('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, cards[0]);
  assert.equal(ui.inputs()[0].value, 'An edited first angle');
  cards[0].fire('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, cards[4]);
  cards[4].fire('keydown', { key: 'Home' });
  assert.equal(document.activeElement, cards[0]);
  assert.deepEqual(cards[0].lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  cards[3].lastScrollIntoView = null;
  cards[3].fire('click');
  assert.deepEqual(cards[3].lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  assert.equal(ui.inputs()[0].value, 'Angle 4');
  assert.deepEqual(cards.map(card => card.tabIndex), [-1, -1, -1, 0, -1]);
  assert.equal(ui.tabs.children[0], cards[0], 'changing details preserves the scrolling row');
});

test('validation reveals a later plan card before focusing its missing field', t => {
  let confirmed = 0;
  const source = fivePlans();
  source[4].structure = '';
  const ui = setup(t, { onConfirm() { confirmed++; return true; } });
  ui.controller.open({ projectId: 'project', plans: source });
  ui.confirm.fire('click');
  assert.equal(confirmed, 0);
  assert.equal(ui.tabs.children[4].getAttribute('aria-selected'), 'true');
  assert.deepEqual(ui.tabs.children[4].lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  assert.equal(document.activeElement, ui.inputs()[2]);
  assert.equal(ui.inputs()[2].getAttribute('aria-invalid'), 'true');
  assert.equal(ui.error.textContent, 'Add a content structure for “Plan 5”.');
});

test('card row fades track initial layout, scrolling, resize, and independent chip overflow', t => {
  const ui = setup(t);
  ui.tabs.clientWidth = 900;
  ui.tabs.scrollWidth = 1800;
  ui.controller.open({ projectId: 'project', plans: fivePlans() });
  const fades = element => [element.getAttribute('data-fade-start'), element.getAttribute('data-fade-end')];
  assert.deepEqual(fades(ui.strip), ['false', 'true']);
  assert.equal(ui.observers.length, 1, 'uses the document window ResizeObserver');
  assert.ok(ui.observers[0].targets.includes(ui.tabs));
  assert.ok(ui.observers[0].targets.includes(ui.tabs.children[4]));
  ui.flushFrames();
  ui.tabs.scrollLeft = 300;
  ui.tabs.fire('scroll');
  ui.tabs.fire('scroll');
  assert.equal(ui.frames.size, 1, 'scroll updates share one animation frame');
  ui.flushFrames();
  assert.deepEqual(fades(ui.strip), ['true', 'true']);
  ui.tabs.scrollLeft = 899.5;
  ui.tabs.fire('scroll');
  ui.flushFrames();
  assert.deepEqual(fades(ui.strip), ['true', 'false']);
  ui.tabs.scrollLeft = -20;
  ui.tabs.fire('scroll');
  ui.flushFrames();
  assert.deepEqual(fades(ui.strip), ['false', 'true']);
  ui.tabs.scrollLeft = 1000;
  ui.tabs.fire('scroll');
  ui.flushFrames();
  assert.deepEqual(fades(ui.strip), ['true', 'false']);
  const chips = byClass(ui.tabs.children[0], 'editorial-plan-review-card-chips');
  chips.clientWidth = 100;
  chips.scrollWidth = 250;
  chips.scrollLeft = 50;
  chips.fire('scroll');
  assert.deepEqual(fades(chips), ['true', 'true']);
  assert.deepEqual(fades(ui.strip), ['true', 'false'], 'chip scroll does not change the card row');
  ui.tabs.clientWidth = 1800;
  chips.clientWidth = 250;
  ui.observers[0].callback();
  ui.flushFrames();
  assert.deepEqual(fades(ui.strip), ['false', 'false']);
  assert.deepEqual(fades(chips), ['false', 'false']);
  ui.tabs.clientWidth = 900;
  ui.tabs.scrollLeft = 0;
  ui.listeners.get('resize')();
  ui.flushFrames();
  assert.deepEqual(fades(ui.strip), ['false', 'true']);
});

test('close and destroy clean overflow observers, listeners, and frames; reopen starts at the first card', t => {
  const ui = setup(t);
  ui.tabs.clientWidth = 900;
  ui.tabs.scrollWidth = 1800;
  ui.controller.open({ projectId: 'project', plans: fivePlans() });
  const firstObserver = ui.observers[0];
  ui.tabs.scrollLeft = 900;
  ui.controller.close();
  assert.equal(firstObserver.disconnected, true);
  assert.equal(firstObserver.targets.length, 0);
  assert.equal(ui.listeners.has('resize'), false);
  assert.equal(ui.tabs.listeners.has('scroll'), false);
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.strip.getAttribute('data-fade-start'), 'false');
  assert.equal(ui.strip.getAttribute('data-fade-end'), 'false');
  firstObserver.callback();
  assert.equal(ui.frames.size, 0, 'a queued observer callback cannot restart work after close');
  ui.controller.open({ projectId: 'project', plans: fivePlans() });
  assert.equal(ui.tabs.scrollLeft, 0);
  assert.equal(ui.tabs.children[0].getAttribute('aria-selected'), 'true');
  assert.equal(ui.strip.getAttribute('data-fade-end'), 'true');
  assert.equal(ui.observers.length, 2);
  assert.equal(ui.listeners.has('resize'), true);
  assert.equal(ui.tabs.listeners.has('scroll'), true);
  ui.controller.destroy();
  assert.equal(ui.observers[1].disconnected, true);
  assert.equal(ui.listeners.has('resize'), false);
  assert.equal(ui.tabs.listeners.has('scroll'), false);
  assert.equal(ui.frames.size, 0);
});

test('window resize updates fades when ResizeObserver and animation frames are unavailable', t => {
  const ui = setup(t);
  delete ui.view.ResizeObserver;
  delete ui.view.requestAnimationFrame;
  ui.tabs.clientWidth = 900;
  ui.tabs.scrollWidth = 1800;
  ui.controller.open({ projectId: 'project', plans: fivePlans() });
  assert.equal(ui.strip.getAttribute('data-fade-end'), 'true');
  ui.tabs.clientWidth = 1800;
  ui.listeners.get('resize')();
  assert.equal(ui.strip.getAttribute('data-fade-end'), 'false');
  assert.equal(ui.observers.length, 0);
  assert.equal(ui.frames.size, 0);
});
