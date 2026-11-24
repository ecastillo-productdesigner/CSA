import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudienceSimilarityLoading } from '../dist/audience-similarity-loading.js';

class Element {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.properties = new Map();
    this.style = { setProperty: (name, value) => this.properties.set(name, value) };
    this.hidden = false;
    this.inert = false;
    this.disabled = false;
    this.height = 90;
    this.rowGap = '16px';
    this.scrollTop = 0;
  }
  get children() { return this.childNodes.filter(node => node.tagName !== '#text'); }
  get textContent() { return this.tagName === '#text' ? this.text || '' : this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) {
    if (this.tagName === '#text') { this.text = String(value); return; }
    const node = new Element('#text', this.ownerDocument);
    node.text = String(value);
    this.replaceChildren(node);
  }
  append(...nodes) {
    for (const node of nodes) {
      node.remove();
      node.parentElement = this;
      this.childNodes.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const node of this.childNodes) node.parentElement = null;
    this.childNodes = [];
    this.append(...nodes);
  }
  insertBefore(node, reference) {
    node.remove();
    const index = this.childNodes.indexOf(reference);
    assert.notEqual(index, -1);
    node.parentElement = this;
    this.childNodes.splice(index, 0, node);
  }
  remove() {
    if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(node => node !== this);
    this.parentElement = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  getBoundingClientRect() { return { height: this.height }; }
}

function setup(t, { withStatus = true, onBusyChange } = {}) {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const listeners = new Map();
  const tokens = { '--csa-component-audience-similarity-processing-duration': '10000ms', '--csa-component-variant-card-min-height': '90px' };
  const view = {
    getComputedStyle: element => ({ rowGap: element.rowGap, getPropertyValue: name => tokens[name] || '' }),
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const doc = { defaultView: view, createElement: tag => new Element(tag, doc) };
  const previous = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
  globalThis.document = doc;
  globalThis.getComputedStyle = view.getComputedStyle;
  t.after(() => Object.assign(globalThis, previous));
  const list = doc.createElement('ul');
  const rows = Array.from({ length: 4 }, () => doc.createElement('li'));
  list.append(...rows);
  const button = doc.createElement('button');
  const originalLabel = doc.createElement('span'); originalLabel.textContent = 'Check Similarity';
  button.append(originalLabel);
  const status = withStatus ? doc.createElement('p') : null;
  if (status) status.textContent = 'Three drafts selected';
  const controller = createAudienceSimilarityLoading({ list, button, status, onBusyChange });
  t.after(() => controller.destroy());
  function tick(ms) {
    const until = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].callback();
    }
    now = until;
  }
  const placeholder = () => list.children.find(row => row.className === 'audience-similarity-loading');
  return { controller, list, rows, button, originalLabel, status, timers, listeners, tokens, tick, placeholder };
}

test('one loading surface spans the selected cards and gaps for exactly one ten-second batch', t => {
  const ui = setup(t);
  ui.rows[0].height = 92;
  let completed = 0;
  assert.equal(ui.controller.start({ items: [ui.rows[0], ui.rows[2], ui.rows[3]], onComplete: () => completed++ }), true);
  assert.equal(ui.controller.isRunning, true);
  assert.equal(ui.timers.size, 1);
  assert.equal(ui.list.children.filter(row => row.className === 'audience-similarity-loading').length, 1);
  assert.equal(ui.placeholder().dataset.count, '3');
  assert.equal(ui.placeholder().properties.get('--similarity-loading-height'), '304px');
  assert.equal(ui.placeholder().children[0].getAttribute('aria-hidden'), 'true');
  const label = ui.placeholder().children[1];
  assert.equal(label.textContent, 'Calculating Similarities');
  assert.equal(label.getAttribute('role'), 'status');
  assert.equal(label.getAttribute('aria-live'), 'polite');
  for (const [index, row] of ui.rows.entries()) {
    assert.equal(row.hidden, index !== 1, 'unselected cards remain outside the single loading surface');
    assert.equal(row.inert, true, 'all cards are inactive until the pending batch finishes');
  }
  assert.equal(ui.list.getAttribute('aria-busy'), 'true');
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.button.textContent, 'Calculating Similarities');
  assert.equal(ui.status.textContent, 'Calculating Similarities');
  ui.tick(9999);
  assert.equal(completed, 0);
  assert.equal(ui.controller.isRunning, true);
  ui.tick(1);
  assert.equal(completed, 1);
  assert.equal(ui.controller.isRunning, false);
  assert.deepEqual(ui.list.children, ui.rows);
  assert.equal(ui.list.getAttribute('aria-busy'), null);
});

test('completion restores exact prior child, button, busy and status state before invoking its callback', t => {
  const ui = setup(t);
  ui.rows[1].hidden = true;
  ui.rows[1].inert = true;
  ui.rows[3].hidden = 'until-found';
  ui.rows[3].inert = true;
  ui.button.disabled = true;
  ui.list.scrollTop = 80;
  ui.list.setAttribute('aria-busy', 'false');
  const statusNodes = [...ui.status.childNodes];
  let restoredBeforeCallback = false;
  ui.controller.start({ items: [ui.rows[0], ui.rows[2]], onComplete() {
    assert.equal(ui.controller.isRunning, false);
    assert.deepEqual(ui.list.children, ui.rows);
    assert.deepEqual(ui.rows.map(row => [row.hidden, row.inert]), [[false, false], [true, true], [false, false], ['until-found', true]]);
    assert.equal(ui.button.disabled, true);
    assert.equal(ui.button.childNodes[0], ui.originalLabel);
    assert.equal(ui.button.textContent, 'Check Similarity');
    assert.equal(ui.list.getAttribute('aria-busy'), 'false');
    assert.equal(ui.list.scrollTop, 80);
    assert.deepEqual(ui.status.childNodes, statusNodes);
    assert.equal(ui.status.textContent, 'Three drafts selected');
    restoredBeforeCallback = true;
  } });
  ui.list.scrollTop = 0; // Simulate browser clamping after the list contracts.
  ui.tick(10000);
  assert.equal(restoredBeforeCallback, true);
});

test('cancel restores the view, clears the timer and never opens the comparison', t => {
  const busyChanges = [];
  const ui = setup(t, { onBusyChange: busy => busyChanges.push(busy) });
  let completed = 0;
  ui.list.scrollTop = 60;
  ui.controller.start({ items: ui.rows.slice(0, 2), onComplete: () => completed++ });
  ui.list.scrollTop = 0;
  ui.tick(3000);
  ui.controller.cancel();
  assert.equal(ui.controller.isRunning, false);
  assert.equal(ui.timers.size, 0);
  assert.deepEqual(ui.list.children, ui.rows);
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.childNodes[0], ui.originalLabel);
  assert.equal(ui.status.textContent, 'Three drafts selected');
  assert.equal(ui.list.scrollTop, 60);
  ui.tick(20000);
  assert.equal(completed, 0);
  ui.controller.cancel();
  assert.deepEqual(busyChanges, [true, false], 'Cancellation clears the main editor exactly once');
});

test('duplicate starts and malformed selections leave the current job untouched', t => {
  const busyChanges = [];
  const ui = setup(t, { onBusyChange: busy => busyChanges.push(busy) });
  ui.controller.cancel();
  for (const items of [undefined, [], [ui.rows[0]], [ui.rows[0], ui.rows[0]], [ui.rows[0], new Element('li')]]) {
    assert.equal(ui.controller.start({ items }), false);
  }
  assert.deepEqual(ui.list.children, ui.rows);
  assert.equal(ui.timers.size, 0);
  assert.deepEqual(busyChanges, [], 'Rejected starts do not show the main editor shimmer');
  ui.controller.start({ items: ui.rows.slice(0, 2) });
  const original = ui.placeholder();
  assert.equal(ui.controller.start({ items: ui.rows.slice(1, 3) }), false);
  assert.equal(ui.placeholder(), original);
  assert.equal(ui.timers.size, 1);
  assert.deepEqual(busyChanges, [true], 'Duplicate starts do not restart the main editor shimmer');
});

test('stale callbacks cannot complete or erase a newer job after cancellation', t => {
  const busyChanges = [];
  const ui = setup(t, { onBusyChange: busy => busyChanges.push(busy) });
  let oldCompleted = 0;
  let newCompleted = 0;
  ui.controller.start({ items: ui.rows.slice(0, 2), onComplete: () => oldCompleted++ });
  const stale = [...ui.timers.values()][0].callback;
  ui.controller.cancel();
  ui.controller.start({ items: ui.rows.slice(1, 3), onComplete: () => newCompleted++ });
  const newer = ui.placeholder();
  stale();
  assert.equal(ui.placeholder(), newer);
  assert.equal(ui.controller.isRunning, true);
  assert.equal(oldCompleted, 0);
  assert.equal(newCompleted, 0);
  assert.deepEqual(busyChanges, [true, false, true], 'A stale completion cannot clear the newer main editor shimmer');
  ui.tick(10000);
  assert.equal(oldCompleted, 0);
  assert.equal(newCompleted, 1);
  assert.deepEqual(busyChanges, [true, false, true, false]);
});

test('pagehide cancels and destroy unregisters cleanup and prevents future starts', t => {
  const busyChanges = [];
  const ui = setup(t, { onBusyChange: busy => busyChanges.push(busy) });
  let completed = 0;
  ui.controller.start({ items: ui.rows.slice(0, 2), onComplete: () => completed++ });
  ui.listeners.get('pagehide')();
  assert.equal(ui.controller.isRunning, false);
  assert.equal(ui.timers.size, 0);
  assert.deepEqual(ui.list.children, ui.rows);
  assert.equal(completed, 0);
  assert.equal(ui.controller.start({ items: ui.rows.slice(0, 2), onComplete: () => completed++ }), true);
  ui.controller.destroy();
  assert.equal(ui.controller.isRunning, false);
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.listeners.has('pagehide'), false);
  assert.equal(ui.controller.start({ items: ui.rows.slice(0, 2) }), false);
  ui.tick(10000);
  assert.equal(completed, 0);
  ui.controller.destroy();
  assert.deepEqual(busyChanges, [true, false, true, false], 'Page hide and destroy both clear the main editor shimmer');
});

test('uses the DS processing duration and safe measured-height fallback with optional status omitted', t => {
  const ui = setup(t, { withStatus: false });
  ui.tokens['--csa-component-audience-similarity-processing-duration'] = '1250ms';
  ui.rows[0].height = 0;
  ui.rows[1].height = 91.5;
  ui.list.rowGap = 'normal';
  let completed = false;
  ui.controller.start({ items: ui.rows.slice(0, 2), onComplete: () => { completed = true; } });
  assert.equal(ui.placeholder().properties.get('--similarity-loading-height'), '181.5px');
  ui.tick(1249);
  assert.equal(completed, false);
  ui.tick(1);
  assert.equal(completed, true);
});


test('main editor loading follows the visible card shimmer and clears before results reopen', t => {
  const events = [];
  const ui = setup(t, { onBusyChange(busy) {
    events.push(busy);
    assert.equal(ui.controller.isRunning, busy);
    if (busy) {
      assert.ok(ui.placeholder(), 'The card shimmer is inserted before the main editor becomes busy');
      assert.equal(ui.list.getAttribute('aria-busy'), 'true');
      assert.equal(ui.button.disabled, true);
    } else {
      assert.equal(ui.placeholder(), undefined);
      assert.deepEqual(ui.list.children, ui.rows);
      assert.equal(ui.list.getAttribute('aria-busy'), 'false');
      assert.equal(ui.button.disabled, false);
      assert.equal(ui.status.textContent, 'Three drafts selected');
      assert.equal(ui.list.scrollTop, 80);
    }
  } });
  ui.list.setAttribute('aria-busy', 'false');
  ui.list.scrollTop = 80;
  ui.controller.start({ items: ui.rows.slice(0, 2), onComplete() {
    assert.deepEqual(events, [true, false], 'The editor is restored before the comparison popup reopens');
    events.push('complete');
  } });
  assert.deepEqual(events, [true]);
  ui.tick(9999);
  assert.deepEqual(events, [true]);
  ui.list.scrollTop = 0;
  ui.tick(1);
  assert.deepEqual(events, [true, false, 'complete']);
});
