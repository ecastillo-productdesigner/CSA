import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorialDirectionMetadata } from '../dist/editorial-direction-metadata.js';
import { createEditorPopover } from '../dist/editor-popover.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.isConnected = true;
    this.textContent = '';
    this.naturalHeight = 160;
    this.scrollHeight = 160;
    this.rect = { left: 400, right: 520, top: 680, bottom: 698, width: 120, height: 18 };
  }
  get textContent() { return (this._textContent || '') + this.children.map(child => child.textContent).join(''); }
  set textContent(value) {
    for (const child of this.children) child.parent = undefined;
    this.children = [];
    this._textContent = String(value ?? '');
  }
  append(...children) { for (const child of children) { if (child.parent) child.parent.children = child.parent.children.filter(entry => entry !== child); child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  matches(selector) {
    if (selector === '[hidden]') return this.hidden;
    if (selector === '[inert]') return this.inert === true;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return (this.className || '').split(' ').includes(selector.slice(1));
    return selector === this.tagName || (selector === 'dialog[open]' && this.tagName === 'dialog' && this.open);
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
    const height = Math.min(this.naturalHeight, Number.parseFloat(this.style.maxHeight) || 420);
    const left = Number.parseFloat(this.style.left) || 0;
    const top = Number.parseFloat(this.style.top) || 0;
    return { width, height, left, top, right: left + width, bottom: top + height };
  }
  getClientRects() { return this.rendered === false ? [] : [this.getBoundingClientRect()]; }
  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
}

function setup(t, { metadata = false } = {}) {
  const previous = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle, MutationObserver: globalThis.MutationObserver };
  const doc = new Element('document');
  doc.body = new Element('body');
  doc.documentElement = { clientWidth: 1024, clientHeight: 768 };
  doc.activeElement = null;
  doc.createElement = tag => new Element(tag);
  doc.createTextNode = text => { const node = new Element('#text'); node.textContent = text; return node; };
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
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() { this.observing = true; }
    disconnect() { this.observing = false; }
  };
  globalThis.document = doc;
  globalThis.window = new Element('window');
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => ({ '--csa-foundation-size-360': '360px', '--csa-foundation-size-620': '620px', '--csa-component-chip-height': '24px', '--csa-foundation-size-420': '420px', '--csa-foundation-space-8': '8px', '--csa-foundation-space-12': '12px', '--csa-foundation-space-24': '24px' }[name] || '') });
  t.after(() => { Object.assign(globalThis, previous); });
  const api = metadata
    ? createEditorPopover({ container: root, trigger, popover, dismiss: close })
    : createEditorialDirectionMetadata();
  return { api, doc, root, trigger, empty, popover, copy, close, chevron, window, mutate() { for (const observer of observers) if (observer.observing) observer.callback(); } };
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


test('direction opens below the compact visual chip when both sides have room', t => {
  const ui = setup(t);
  ui.root.rect.width = 280;
  ui.trigger.rect = { left: 400, right: 600, top: 300, bottom: 344, width: 200, height: 44 };
  ui.api.update('Keep the local angle');
  ui.trigger.click();
  assert.equal(ui.popover.style.width, '360px');
  assert.equal(ui.popover.style.left, '400px');
  assert.equal(ui.popover.style.top, '342px');
});

test('direction flips above the compact visual chip when there is insufficient room below', t => {
  const ui = setup(t);
  ui.trigger.rect = { left: 400, right: 600, top: 700, bottom: 744, width: 200, height: 44 };
  ui.api.update('Keep the local angle');
  ui.trigger.click();
  assert.equal(ui.popover.style.top, '542px');
  assert.equal(ui.popover.style.maxHeight, '420px');
});

test('direction resets a previous height constraint before measuring scrollable compact content', t => {
  const ui = setup(t);
  ui.popover.naturalHeight = 320;
  const measuredHeights = [];
  Object.defineProperty(ui.popover, 'scrollHeight', { get() {
    measuredHeights.push(ui.popover.style.maxHeight);
    return Math.min(ui.popover.naturalHeight, Number.parseFloat(ui.popover.style.maxHeight) || 420);
  } });
  ui.doc.documentElement.clientHeight = 170;
  ui.trigger.rect = { left: 400, right: 600, top: 25, bottom: 69, width: 200, height: 44 };
  ui.api.update('A saved direction long enough to need scrolling');
  ui.trigger.click();
  assert.equal(ui.popover.style.maxHeight, '91px');
  ui.doc.documentElement.clientHeight = 400;
  ui.trigger.rect = { left: 400, right: 600, top: 210, bottom: 254, width: 200, height: 44 };
  ui.window.emit('resize');
  assert.equal(ui.popover.style.maxHeight, '200px');
  assert.equal(ui.popover.style.top, '12px');
  assert.ok(measuredHeights.every(height => height === '420px'));
});

test('the default Metadata popover keeps its wide placement above the full target', t => {
  const ui = setup(t, { metadata: true });
  ui.trigger.rect = { left: 300, right: 500, top: 300, bottom: 344, width: 200, height: 44 };
  ui.trigger.click();
  assert.equal(ui.popover.style.width, '620px');
  assert.equal(ui.popover.style.top, '132px');
  assert.equal(ui.popover.style.left, '300px');
});


test('accepted shorter drafts keep the saved direction and a compact explanatory note', t => {
  const ui = setup(t);
  const direction = 'Create 750 words about the community garden';
  ui.api.update(direction, { shorterDraftAccepted: true });
  ui.trigger.click();
  assert.equal(ui.copy.textContent, `${direction}\n\nWord count notice: Created a shorter draft from the available sources. Add sources or use Request Revision to expand it.`);
  const labels = ui.copy.querySelectorAll('strong');
  assert.equal(labels.length, 1);
  assert.equal(labels[0].textContent, 'Word count notice:');
  assert.equal(labels[0].className, 'editor-direction-notice-label');
  assert.equal(ui.copy.children.at(-1).tagName, '#text');
  assert.match(ui.copy.children.at(-1).textContent, /^ Created a shorter draft/);
  ui.close.click();
  ui.trigger.click();
  assert.match(ui.copy.textContent, /Word count notice: Created a shorter draft/);
});

test('shorter-draft label preserves literal user markup and multiline direction', t => {
  const ui = setup(t);
  const direction = 'Keep <strong>this user text</strong> literal.\nDo not render <script>example()</script>.';
  ui.api.update(direction, { shorterDraftAccepted: true });
  ui.trigger.click();
  assert.ok(ui.copy.textContent.startsWith(`${direction}\n\n`));
  assert.deepEqual(ui.copy.querySelectorAll('strong').map(label => label.textContent), ['Word count notice:']);
  assert.equal(ui.copy.querySelectorAll('script').length, 0);
});

test('switching drafts removes the shorter-draft note unless that draft accepted it', t => {
  const ui = setup(t);
  ui.api.update('Write 750 words', { shorterDraftAccepted: true });
  ui.trigger.click();
  ui.api.update('Write 300 words');
  assert.equal(ui.popover.hidden, true);
  ui.trigger.click();
  assert.equal(ui.copy.textContent, 'Write 300 words');
  assert.equal(ui.copy.querySelectorAll('strong').length, 0);
  ui.api.update('Write 750 words', { shorterDraftAccepted: false });
  assert.equal(ui.copy.textContent, 'Write 750 words');
  ui.api.update('', { shorterDraftAccepted: true });
  assert.equal(ui.trigger.hidden, true);
  assert.equal(ui.copy.textContent, '');
});


function cardTrigger(ui, id, left = 100) {
  const button = new Element('button');
  button.id = id;
  button.rect = { left, right: left + 32, top: 200, bottom: 232, width: 32, height: 32 };
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', ui.popover.id);
  ui.doc.body.append(button);
  return button;
}

test('card anchors share the direction popover without leaking content or note state into the editor header', t => {
  const ui = setup(t);
  ui.api.update('The open editor draft direction');
  const first = cardTrigger(ui, 'first-card');
  const second = cardTrigger(ui, 'second-card', 700);
  ui.api.toggleFor(first, { editorialDirection: 'Write 750 words about the first story', shorterDraftAccepted: true });
  assert.match(ui.copy.textContent, /^Write 750 words about the first story\n\nWord count notice: Created a shorter draft/);
  assert.equal(first.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.popover.style.left, '100px');
  ui.api.toggleFor(second, { editorialDirection: 'Use the second story’s saved angle' });
  assert.equal(ui.copy.textContent, 'Use the second story’s saved angle');
  assert.equal(first.getAttribute('aria-expanded'), 'false');
  assert.equal(second.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.trigger.hidden, false);
  assert.equal(ui.empty.hidden, true);
  assert.equal(ui.popover.style.left, '652px');
  ui.trigger.click();
  assert.equal(ui.copy.textContent, 'The open editor draft direction');
  assert.equal(second.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, ui.popover);
});

test('card toggle, close control, and Escape restore focus to the current card anchor', t => {
  const ui = setup(t);
  ui.api.update('Editor direction');
  const first = cardTrigger(ui, 'first-card');
  const second = cardTrigger(ui, 'second-card');
  const output = { editorialDirection: 'Saved card direction' };
  ui.api.toggleFor(first, output);
  ui.api.toggleFor(first, output);
  assert.equal(ui.popover.hidden, true);
  assert.equal(first.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, first);
  ui.api.toggleFor(first, output);
  ui.api.toggleFor(second, output);
  const escape = ui.doc.emit('keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(ui.popover.hidden, true);
  assert.equal(second.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, second);
  ui.api.toggleFor(first, output);
  ui.close.click();
  assert.equal(document.activeElement, first);
  assert.equal(ui.popover.hidden, true);
});

test('outside pointer and focus handling follow the active card instead of the editor header', t => {
  const ui = setup(t);
  ui.api.update('Editor direction');
  const card = cardTrigger(ui, 'card');
  const output = { editorialDirection: 'Card direction' };
  ui.api.toggleFor(card, output);
  ui.doc.emit('pointerdown', { target: card });
  ui.doc.emit('focusin', { target: card });
  ui.popover.emit('focusout', { relatedTarget: card });
  assert.equal(ui.popover.hidden, false);
  const outside = cardTrigger(ui, 'outside');
  outside.focus();
  ui.doc.emit('pointerdown', { target: outside });
  assert.equal(ui.popover.hidden, true);
  assert.equal(document.activeElement, outside);
  ui.api.toggleFor(card, output);
  ui.trigger.focus();
  ui.doc.emit('focusin', { target: ui.trigger });
  assert.equal(ui.popover.hidden, true);
  assert.equal(document.activeElement, ui.trigger);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
});

test('pending-card directions remain visible when the editor is hidden without changing its empty header state', t => {
  const ui = setup(t);
  ui.api.update('');
  ui.root.hidden = true;
  const card = cardTrigger(ui, 'pending-card');
  ui.api.toggleFor(card, { editorialDirection: 'Pending draft guidance' });
  assert.equal(ui.popover.hidden, false);
  assert.equal(ui.popover.parent, ui.doc.body);
  assert.equal(ui.popover.closest('[hidden]'), undefined);
  assert.equal(ui.copy.textContent, 'Pending draft guidance');
  assert.equal(ui.trigger.hidden, true);
  assert.equal(ui.empty.hidden, false);
  ui.api.close();
  ui.root.hidden = false;
  ui.trigger.click();
  assert.equal(ui.popover.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
});

test('changing the editor snapshot or explicitly closing resets external card aria state', t => {
  const ui = setup(t);
  const card = cardTrigger(ui, 'card');
  ui.api.update('Original direction', { shorterDraftAccepted: true });
  ui.api.toggleFor(card, { editorialDirection: 'Card direction' });
  ui.api.update('New editor direction');
  assert.equal(ui.popover.hidden, true);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  ui.trigger.click();
  assert.equal(ui.copy.textContent, 'New editor direction');
  ui.api.toggleFor(card, { editorialDirection: 'Card direction' });
  ui.api.close();
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.popover.hidden, true);
  ui.api.toggleFor(card, { editorialDirection: '  ', shorterDraftAccepted: true });
  assert.equal(ui.popover.hidden, true);
  ui.trigger.click();
  assert.equal(ui.copy.textContent, 'New editor direction');
});

test('removing or hiding an external anchor closes its popup without returning focus to it', t => {
  const ui = setup(t);
  const wrapper = new Element();
  ui.doc.body.append(wrapper);
  const card = cardTrigger(ui, 'card');
  wrapper.append(card);
  const output = { editorialDirection: 'Card direction' };
  for (const state of ['disconnected', 'hidden', 'inert', 'not-rendered']) {
    card.isConnected = true;
    wrapper.hidden = false;
    wrapper.inert = false;
    card.rendered = true;
    ui.api.toggleFor(card, output);
    assert.equal(ui.popover.hidden, false, state);
    if (state === 'disconnected') card.isConnected = false;
    if (state === 'hidden') wrapper.hidden = true;
    if (state === 'inert') wrapper.inert = true;
    if (state === 'not-rendered') card.rendered = false;
    ui.mutate();
    assert.equal(ui.popover.hidden, true, state);
    assert.equal(card.getAttribute('aria-expanded'), 'false', state);
    assert.notEqual(document.activeElement, card, state);
    ui.api.toggleFor(card, output);
    assert.equal(ui.popover.hidden, true, 'An unavailable anchor cannot reopen the popup');
  }
});

test('the shared popover exposes external toggling while its default trigger retains its listener', t => {
  const ui = setup(t, { metadata: true });
  const card = cardTrigger(ui, 'card');
  ui.api.toggleFor(card);
  assert.equal(ui.popover.hidden, false);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  ui.api.refresh();
  assert.equal(ui.popover.style.left, '100px');
  ui.trigger.click();
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
  ui.close.click();
  assert.equal(document.activeElement, ui.trigger);
});
