import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarMonthDays, createSearchDateFilter, dateFilterLabel, moveCalendarDate,
  normalizeDateFilter, selectCalendarDate, validCalendarDate,
} from '../dist/search-date-filter.js';

test('publication dates reject rollover and malformed values and accept leap days', () => {
  assert.equal(validCalendarDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '', null]) assert.equal(validCalendarDate(value), false, String(value));
  assert.deepEqual(normalizeDateFilter({ before: '2026-10-15' }), { after: '', before: '' });
  assert.deepEqual(normalizeDateFilter({ after: '2026-10-15', before: '2026-10-01' }), { after: '2026-10-01', before: '2026-10-15' });
});

test('range selection supports reverse order, same day, and restarting a completed range', () => {
  const start = selectCalendarDate({ mode: 'range', after: '', before: '' }, '2026-10-15');
  assert.deepEqual(selectCalendarDate(start, '2026-10-01'), { mode: 'range', after: '2026-10-01', before: '2026-10-15' });
  const sameDay = selectCalendarDate(start, '2026-10-15');
  assert.equal(sameDay.before, sameDay.after);
  assert.deepEqual(selectCalendarDate(sameDay, '2026-11-05'), { mode: 'range', after: '2026-11-05', before: '' });
  assert.deepEqual(selectCalendarDate({ mode: 'after', after: '', before: '' }, '2026-10-01'), { mode: 'after', after: '2026-10-01', before: '' });
});

test('date labels preserve month and year boundaries', () => {
  assert.equal(dateFilterLabel({}), 'Any Date');
  assert.equal(dateFilterLabel({ after: '2026-10-01' }), 'On or after Oct 1, 2026');
  assert.equal(dateFilterLabel({ after: '2026-10-01', before: '2026-10-15' }), 'Oct 1–15, 2026');
  assert.equal(dateFilterLabel({ after: '2026-10-01', before: '2026-11-15' }), 'Oct 1–Nov 15, 2026');
  assert.equal(dateFilterLabel({ after: '2026-12-31', before: '2027-01-01' }), 'Dec 31, 2026 – Jan 1, 2027');
});

test('calendar navigation keeps valid dates across leap months and year boundaries', () => {
  const days = calendarMonthDays('2024-02-29');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2024-01-28');
  assert.equal(days.at(-1), '2024-03-09');
  assert.ok(days.includes('2024-02-29'));
  assert.equal(moveCalendarDate('2024-01-31', 1, 'month'), '2024-02-29');
  assert.equal(moveCalendarDate('2026-01-31', 1, 'month'), '2026-02-28');
  assert.equal(moveCalendarDate('2026-12-31', 1), '2027-01-01');
  assert.equal(moveCalendarDate('2026-01-01', -1), '2025-12-31');
});

class Events {
  constructor() { this.handlers = new Map(); }
  addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
  removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
  dispatchEvent(event) { for (const fn of this.handlers.get(event.type) || []) fn(event); }
  emit(type, options = {}) { this.dispatchEvent({ type, target: this, preventDefault() {}, stopPropagation() {}, ...options }); }
}
class Element extends Events {
  constructor(tag, doc) { super(); Object.assign(this, { tagName: tag, ownerDocument: doc, children: [], dataset: {}, style: {}, attributes: new Map(), value: '', tabIndex: 0 }); }
  set textContent(value) { this.text = value; this.replaceChildren(); }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  append(...children) { for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className?.split(' ').includes(selector.slice(1));
    if (selector === '[hidden]') return this.hidden;
    const data = selector.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/);
    if (data) { const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return data[2] ? this.dataset[key] === data[2] : key in this.dataset; }
    return false;
  }
  querySelectorAll(selector) { const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]); return selector === '*' ? all : all.filter(child => child.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  contains(other) { return other === this || this.children.some(child => child.contains(other)); }
  getBoundingClientRect() { return { left: 20, top: 80, bottom: 124, width: 320, height: 500 }; }
  focus() { this.ownerDocument.activeElement = this; }
}
function setup(t) {
  const oldDocument = globalThis.document;
  const oldStyle = globalThis.getComputedStyle;
  const doc = new Events();
  doc.createElement = tag => new Element(tag, doc);
  doc.documentElement = Object.assign(doc.createElement('html'), { clientWidth: 1280, clientHeight: 900 });
  doc.body = doc.createElement('body');
  doc.defaultView = Object.assign(new Events(), { CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } } });
  globalThis.document = doc;
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => ({ '--csa-foundation-space-12': '12px', '--csa-foundation-space-8': '8px', '--csa-foundation-size-320': '320px' })[name] || '' });
  const root = doc.createElement('div'); root.id = 'results-date-filter'; doc.body.append(root);
  const after = doc.createElement('input'); after.id = 'results-after';
  const before = doc.createElement('input'); before.id = 'results-before';
  root.append(after, before);
  const changes = [];
  const picker = createSearchDateFilter({ root, onChange: value => changes.push(value) });
  const trigger = root.querySelector('.search-date-trigger');
  t.after(() => { picker.destroy(); if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; if (oldStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = oldStyle; });
  return { picker, root, after, before, changes, trigger, doc, menu: root.querySelector('.search-date-menu'), click: selector => { const node = doc.body.querySelector(selector); assert.ok(node, selector); node.emit('click'); } };
}

test('date changes remain pending until Apply; Cancel, Escape, and outside click discard edits', t => {
  const ui = setup(t);
  ui.picker.sync({ after: '2026-10-01' });
  ui.trigger.emit('click');
  ui.click('[data-date-mode="range"]');
  ui.click('[data-date="2026-10-15"]');
  assert.equal(ui.before.value, '');
  assert.deepEqual(ui.changes, []);
  ui.click('.search-date-cancel');
  assert.equal(ui.menu.hidden, true);
  ui.trigger.emit('click');
  assert.equal(ui.menu.querySelector('[data-date-mode="after"]').getAttribute('aria-pressed'), 'true');
  ui.click('[data-date-mode="range"]');
  ui.click('[data-date="2026-10-15"]');
  ui.click('.search-date-apply');
  assert.deepEqual(ui.changes, [{ after: '2026-10-01', before: '2026-10-15' }]);
  assert.equal(ui.before.value, '2026-10-15');
  assert.equal(ui.trigger.textContent, 'Oct 1–15, 2026keyboard_arrow_down');
  ui.trigger.emit('click');
  ui.click('[data-date="2026-10-05"]');
  assert.equal(ui.menu.querySelector('.search-date-apply').disabled, true);
  ui.menu.emit('keydown', { key: 'Escape' });
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.doc.activeElement, ui.trigger);
  ui.trigger.emit('click');
  ui.doc.emit('pointerdown', { target: ui.doc.body });
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.changes.length, 1);
});

test('Any Date clears both bounds only after Apply and sync is silent', t => {
  const ui = setup(t);
  ui.picker.sync({ after: '2026-10-01', before: '2026-10-15' });
  ui.trigger.emit('click');
  ui.click('[data-date-mode="any"]');
  assert.equal(ui.after.value, '2026-10-01');
  ui.click('.search-date-apply');
  assert.deepEqual(ui.changes, [{ after: '', before: '' }]);
  assert.equal(ui.after.value, '');
  assert.equal(ui.before.value, '');
  ui.picker.sync({ after: '2026-11-01' });
  assert.equal(ui.changes.length, 1);
});

test('calendar keyboard navigation crosses month boundaries without applying and another dropdown closes it', t => {
  const ui = setup(t);
  ui.picker.sync({ after: '2026-10-31' });
  ui.trigger.emit('keydown', { key: 'ArrowDown' });
  const day = ui.menu.querySelector('[data-date="2026-10-31"]');
  ui.menu.emit('keydown', { key: 'ArrowRight', target: day });
  assert.equal(ui.doc.activeElement.dataset.date, '2026-11-01');
  assert.equal(ui.after.value, '2026-10-31');
  ui.doc.emit('csa:dropdown-open', { detail: { trigger: ui.doc.createElement('button') } });
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.changes.length, 0);
});
