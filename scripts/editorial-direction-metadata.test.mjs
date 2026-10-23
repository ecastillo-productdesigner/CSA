import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorialDirectionMetadata } from '../dist/editorial-direction-metadata.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this.rect = { left: 400, right: 520, top: 680, bottom: 698, width: 120, height: 18 };
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return (this.className || '').split(' ').includes(selector.slice(1));
    return selector === 'dialog[open]' && this.tagName === 'dialog' && this.open;
  }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  closest(selector) { return selector.split(',').some(part => this.matches(part.trim())) ? this : this.parent?.closest(selector); }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(selector.split(',').some(part => child.matches(part.trim())) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  emit(type, detail = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...detail };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }
  click() { return this.emit('click'); }
  focus() { document.activeElement = this; }
  getBoundingClientRect() {
    if (this.id !== 'editor-direction-popover') return this.rect;
    const width = Math.min(620, document.documentElement.clientWidth - 24, Number.parseFloat(this.style.width) || 620);
    const height = Math.min(160, Number.parseFloat(this.style.maxHeight) || 420);
    const left = Number.parseFloat(this.style.left) || 0;
    const top = Number.parseFloat(this.style.top) || 0;
    return { width, height, left, top, right: left + width, bottom: top + height };
  }
  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
}

function setup(t) {
  const previous = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  const doc = new Element('document');
  doc.body = new Element('body');
  doc.documentElement = { clientWidth: 1024, clientHeight: 768 };
  doc.activeElement = null;
  doc.createElement = tag => new Element(tag);
  const ids = ['material-editor', 'editor-direction-button', 'editor-direction-empty', 'editor-direction-popover', 'editor-direction-copy', 'editor-direction-close'];
  const nodes = Object.fromEntries(ids.map(id => { const element = new Element(id === 'editor-direction-popover' ? 'dialog' : id.endsWith('button') || id.endsWith('close') ? 'button' : 'div'); element.id = id; return [id, element]; }));
  const get = id => nodes[id];
  const root = get('material-editor');
  const trigger = get('editor-direction-button');
  root.rect = { left: 80, right: 980, top: 80, bottom: 720, width: 900, height: 640 };
  const empty = get('editor-direction-empty');
  const popover = get('editor-direction-popover');
  const copy = get('editor-direction-copy');
  const close = get('editor-direction-close');
  trigger.textContent = 'Editorial Direction';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', popover.id);
  const chevron = new Element('span');
  chevron.textContent = 'chevron_forward';
  trigger.append(chevron);
  empty.textContent = 'No Editorial Direction';
  popover.hidden = true;
  popover.append(copy, close);
  root.append(trigger, empty, popover);
  doc.body.append(root);
  doc.append(doc.body);
  globalThis.document = doc;
  globalThis.window = new Element('window');
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => ({ '--csa-foundation-size-620': '620px', '--csa-foundation-size-420': '420px', '--csa-foundation-space-8': '8px', '--csa-foundation-space-12': '12px', '--csa-foundation-space-24': '24px' }[name] || '') });
  t.after(() => { Object.assign(globalThis, previous); });
  const api = createEditorialDirectionMetadata();
  return { api, doc, root, trigger, empty, popover, copy, close, chevron, window };
}

test('missing or blank saved direction shows the inert no-direction label without a chevron trigger', t => {
  const ui = setup(t);
  for (const value of [undefined, null, '', ' \n\t ', { editorialDirection: 'Unrelated current project guidance' }]) {
    ui.api.update(value);
    assert.equal(ui.empty.hidden, false);
    assert.equal(ui.empty.textContent, 'No Editorial Direction');
    assert.equal(ui.empty.children.length, 0);
    assert.equal(ui.trigger.hidden, true);
    ui.trigger.click();
    assert.equal(ui.popover.hidden, true);
    assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  }
});

test('the popover preserves the exact saved multiline direction as safe read-only text', t => {
  const ui = setup(t);
  const snapshot = '  Focus on local families.\nKeep <script>alert("example")</script> as plain text.  ';
  ui.api.update(snapshot);
  assert.equal(ui.empty.hidden, true);
  assert.equal(ui.trigger.hidden, false);
  ui.trigger.click();
  assert.equal(ui.popover.hidden, false);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.copy.textContent, snapshot);
  assert.equal(ui.copy.children.length, 0);
  assert.notEqual(ui.copy.getAttribute('contenteditable'), 'true');
  assert.equal(document.activeElement, ui.popover);
});

test('click toggle, close control and Escape dismiss and restore focus to the direction trigger', t => {
  const ui = setup(t);
  ui.api.update('Use a conversational tone');
  ui.trigger.click();
  ui.trigger.click();
  assert.equal(ui.popover.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  ui.trigger.click();
  ui.close.click();
  assert.equal(ui.popover.hidden, true);
  assert.equal(document.activeElement, ui.trigger);
  ui.trigger.click();
  const escape = ui.doc.emit('keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(ui.popover.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, ui.trigger);
});

test('outside pointer and focus changes dismiss without stealing the new focus', t => {
  const ui = setup(t);
  const outside = new Element('button');
  ui.doc.body.append(outside);
  ui.api.update('Describe the community impact');
  ui.trigger.click();
  ui.doc.emit('pointerdown', { target: ui.copy });
  assert.equal(ui.popover.hidden, false);
  outside.focus();
  ui.doc.emit('pointerdown', { target: outside });
  assert.equal(ui.popover.hidden, true);
  assert.equal(document.activeElement, outside);
  ui.trigger.click();
  outside.focus();
  ui.doc.emit('focusin', { target: outside });
  assert.equal(ui.popover.hidden, true);
  assert.equal(document.activeElement, outside);
});

test('each draft update closes the previous popover and clears stale guidance when the next snapshot is missing', t => {
  const ui = setup(t);
  ui.api.update('First draft direction');
  ui.trigger.click();
  ui.api.update('Second draft direction');
  assert.equal(ui.popover.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  ui.trigger.click();
  assert.equal(ui.copy.textContent, 'Second draft direction');
  ui.api.update(undefined);
  assert.equal(ui.popover.hidden, true);
  assert.equal(ui.empty.hidden, false);
  assert.equal(ui.trigger.hidden, true);
  assert.equal(ui.copy.textContent, '');
});

test('the anchored popover stays within a mobile viewport after resize and outside scrolling dismisses it', t => {
  const ui = setup(t);
  ui.api.update('A longer saved editorial direction');
  ui.trigger.click();
  ui.doc.documentElement.clientWidth = 320;
  ui.doc.documentElement.clientHeight = 568;
  ui.trigger.rect = { left: 240, right: 308, top: 520, bottom: 538, width: 68, height: 18 };
  ui.window.emit('resize');
  const bounds = ui.popover.getBoundingClientRect();
  assert.equal(ui.popover.hidden, false);
  assert.ok(bounds.left >= 0 && bounds.right <= 320);
  assert.ok(bounds.top >= 0 && bounds.bottom <= 568);
  ui.doc.emit('scroll', { target: ui.copy });
  assert.equal(ui.popover.hidden, false);
  ui.doc.emit('scroll', { target: ui.root });
  assert.equal(ui.popover.hidden, true);
});
