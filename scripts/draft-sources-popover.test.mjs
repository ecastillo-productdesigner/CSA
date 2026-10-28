import test from 'node:test';
import assert from 'node:assert/strict';
import { draftSourcesFor, createDraftSourcesPopover } from '../dist/draft-sources-popover.js';

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
    this.rect = { left: 50, top: 60, width: 100, height: 24 };
    this.scrollHeight = 180;
    this._text = '';
  }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  closest() { return this.hidden || this.inert || this.getAttribute('aria-hidden') === 'true' ? this : this.parentElement?.closest(); }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...((selector.startsWith('.') ? (child.className || '').split(' ').includes(selector.slice(1)) : child.tagName === selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, callback) { const set = this.listeners.get(type) || new Set(); set.add(callback); this.listeners.set(type, set); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  fire(type, properties = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...properties };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  focus(options) { document.activeElement = this; this.focusOptions = options; }
  getClientRects() { return this.hidden || !this.isConnected ? [] : [this.rect]; }
  getBoundingClientRect() {
    const left = Number.parseFloat(this.style.left) || this.rect.left;
    const top = Number.parseFloat(this.style.top) || this.rect.top;
    const width = Number.parseFloat(this.style.width) || this.rect.width;
    const naturalHeight = this.className === 'draft-sources-popover' ? this.scrollHeight : this.rect.height;
    const height = Math.min(Number.parseFloat(this.style.maxHeight) || naturalHeight, naturalHeight);
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
}

function setup(t) {
  const previous = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle, MutationObserver: globalThis.MutationObserver };
  const doc = new Element('document');
  doc.documentElement = new Element('html');
  Object.assign(doc.documentElement, { clientWidth: 500, clientHeight: 600 });
  doc.body = new Element('body');
  doc.documentElement.append(doc.body);
  doc.createElement = tag => new Element(tag);
  const view = new Element('window');
  const observers = [];
  Object.assign(globalThis, {
    document: doc, window: view,
    getComputedStyle: () => ({ getPropertyValue: name => ({ '--csa-foundation-space-12': '12px', '--csa-foundation-space-8': '8px', '--csa-foundation-size-360': '360px', '--csa-foundation-size-420': '420px', '--csa-component-chip-height': '24px' }[name] || '') }),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.observing = false; observers.push(this); }
      observe() { this.observing = true; }
      disconnect() { this.observing = false; }
      check() { if (this.observing) this.callback(); }
    },
  });
  t.after(() => Object.assign(globalThis, previous));
  const downloads = [];
  const opened = [];
  const preview = new Element('dialog');
  const controller = createDraftSourcesPopover({
    onDownloadSource: source => downloads.push(source),
    onOpenSource(source, opener) {
      opened.push({ source, opener, popupOpen: controller.isOpen });
      preview.focus();
    },
  });
  const popover = doc.body.querySelector('.draft-sources-popover');
  const trigger = new Element('button');
  trigger.dataset.variantSources = 'draft';
  doc.body.append(trigger);
  return { doc, view, observers, downloads, opened, preview, controller, popover, trigger };
}
const used = { type: 'link', title: 'The entire captured article heading remains available without truncation', url: 'https://example.com/original?edition=one' };
const file = { type: 'file', title: 'Captured reporting.pdf', attachmentId: 'saved-document' };
const unused = { type: 'link', title: 'Unrelated current project source', url: 'https://example.com/unused' };

test('captured snapshots are authoritative even when the live project changes or snapshots are explicitly empty', () => {
  const snapshot = structuredClone(used);
  const output = { sourceSnapshots: [snapshot, file], selectedSourceIndexes: [0, 1, 2] };
  const project = { sources: [unused, { ...file, title: 'Renamed document' }] };
  assert.deepEqual(draftSourcesFor(project, output), [snapshot, file]);
  assert.equal(draftSourcesFor(project, output)[0], snapshot);
  assert.deepEqual(draftSourcesFor(project, { ...output, sourceSnapshots: [] }), []);
  assert.deepEqual(draftSourcesFor({}, { sourceSnapshots: [snapshot, null, 'invalid'] }), [snapshot]);
});

test('legacy fallback includes only valid unique saved indexes and never all current sources', () => {
  const project = { sources: [used, file, unused] };
  assert.deepEqual(draftSourcesFor(project, { selectedSourceIndexes: [1, 0, 1, -1, 2.5, '2', 99] }), [file, used]);
  assert.deepEqual(draftSourcesFor(project, { sourceCount: 3 }), []);
  assert.deepEqual(draftSourcesFor(project, {}), []);
});

test('headings distinguish content to draft from completed drafts, including legacy drafts', t => {
  const ui = setup(t);
  for (const [state, expected] of [
    [{ status: 'pending', draftText: 'Saved recipe text' }, 'Sources'],
    [{ status: 'ready' }, 'Sources Used'],
    [{ draftText: 'Legacy draft body' }, 'Sources Used'],
    [{ document: { ops: [] } }, 'Sources Used'],
  ]) {
    ui.controller.toggle(ui.trigger, { output: { id: 'draft', sourceSnapshots: [used], ...state } });
    assert.equal(ui.popover.querySelector('.draft-sources-title').textContent, expected);
    ui.controller.close();
  }
  ui.controller.destroy();
});

test('the dialog lists full captured titles with shared-preview actions and snapshot downloads only', t => {
  const ui = setup(t);
  const output = { id: 'draft', sourceSnapshots: [used, file, { type: 'text', title: 'Saved interview notes', text: 'Only the captured text.' }] };
  ui.controller.toggle(ui.trigger, { project: { sources: [unused] }, output });
  assert.equal(ui.controller.outputId, 'draft');
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.popover.getAttribute('role'), 'dialog');
  assert.equal(ui.popover.getAttribute('aria-modal'), 'false');
  assert.equal(ui.popover.querySelector('.draft-sources-title').textContent, 'Sources');
  assert.equal(ui.popover.querySelector('.draft-sources-folder').textContent, 'folder_open');
  assert.equal(ui.popover.querySelector('.draft-sources-folder').getAttribute('data-icon-fill'), '0');
  assert.equal(ui.popover.querySelectorAll('.draft-sources-kind').length, 0);
  assert.equal(ui.popover.querySelectorAll('.draft-sources-url').length, 0);
  assert.equal(ui.trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(ui.trigger.getAttribute('aria-controls'), ui.popover.id);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.doc.activeElement, ui.popover);
  assert.deepEqual(ui.popover.querySelectorAll('.draft-sources-source-title').map(node => node.textContent), [used.title, file.title, 'Saved interview notes']);
  assert.equal(ui.popover.querySelectorAll('a').length, 0, 'source access uses the shared preview, not external navigation');
  for (const title of ui.popover.querySelectorAll('.draft-sources-source-title')) {
    assert.equal(title.tagName, 'button');
    assert.equal(title.type, 'button');
    assert.equal(title.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(title.getAttribute('aria-controls'), 'article-preview-dialog');
  }
  assert.equal(ui.popover.querySelectorAll('.draft-sources-item').length, 3);
  assert.equal(ui.popover.textContent.includes(unused.title), false);
  assert.equal(ui.popover.querySelectorAll('input').length, 0);
  const download = ui.popover.querySelector('.draft-sources-download');
  download.fire('click');
  assert.equal(ui.downloads[0], file);
  ui.popover.querySelector('.draft-sources-close').fire('click');
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.doc.activeElement, ui.trigger);
  ui.controller.destroy();
});

test('source URLs never navigate directly from the popup, and missing legacy details stay truthful', t => {
  const ui = setup(t);
  const unsafe = [used.url, 'javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com/private', 'file:///private/document', '/relative', 'not a URL'];
  ui.controller.toggle(ui.trigger, { output: { id: 'draft', sourceSnapshots: unsafe.map((url, index) => ({ type: 'link', title: `Saved title ${index}`, url })) } });
  assert.equal(ui.popover.querySelectorAll('a').length, 0);
  assert.equal(ui.popover.querySelectorAll('.draft-sources-source-title').length, unsafe.length);
  ui.controller.close();
  ui.controller.toggle(ui.trigger, { project: { sources: [unused] }, output: { id: 'legacy', sourceCount: 2 } });
  assert.equal(ui.popover.querySelector('.draft-sources-empty').textContent, 'Source details were not saved for this draft.');
  assert.equal(ui.popover.querySelector('.draft-sources-list').hidden, true);
  ui.controller.close();
  ui.controller.toggle(ui.trigger, { output: { id: 'zero', sourceCount: 3, selectedSourceIndexes: [0], sourceSnapshots: [] } });
  assert.equal(ui.popover.querySelector('.draft-sources-empty').textContent, 'No sources were saved for this draft.');
  ui.controller.destroy();
});

test('positioning uses an eight-pixel gap from the visual pill inside a larger hit area and preserves viewport clamping', t => {
  const ui = setup(t);
  const output = { id: 'draft', sourceSnapshots: [used] };
  ui.trigger.rect = { left: 450, top: 30, width: 40, height: 44 };
  ui.controller.toggle(ui.trigger, { output });
  assert.equal(ui.popover.querySelector('.draft-sources-title').textContent, 'Sources');
  assert.equal(ui.popover.style.width, '360px');
  assert.equal(ui.popover.style.left, '128px');
  assert.equal(ui.popover.style.top, '72px');
  assert.equal(Number.parseFloat(ui.popover.style.top) - (30 + (44 - 24) / 2 + 24), 8, 'the below gap starts at the centered24px pill, not the44px button boundary');
  ui.doc.fire('scroll', { target: ui.popover.querySelector('.draft-sources-list') });
  assert.equal(ui.controller.isOpen, true);
  ui.doc.fire('scroll', { target: ui.doc });
  assert.equal(ui.controller.isOpen, false);
  ui.trigger.rect = { left: 450, top: 550, width: 40, height: 44 };
  ui.controller.toggle(ui.trigger, { output });
  assert.equal(Number.parseFloat(ui.popover.style.top) + ui.popover.getBoundingClientRect().height + 8, 560, 'the above gap ends at the centered visual pill top');
  assert.ok(ui.popover.getBoundingClientRect().bottom <= 588);
  ui.view.fire('resize');
  assert.equal(ui.controller.isOpen, false);
  ui.doc.documentElement.clientWidth = 280;
  ui.controller.toggle(ui.trigger, { output });
  assert.equal(ui.popover.style.width, '256px');
  assert.equal(ui.popover.style.left, '12px');
  ui.controller.destroy();
});

test('toggle, Escape, outside focus/pointer, context changes, and destroy clean up dialog state without stealing outside focus', t => {
  const ui = setup(t);
  const output = { id: 'draft', sourceSnapshots: [used] };
  const open = () => ui.controller.toggle(ui.trigger, { output });
  open(); open();
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.doc.activeElement, ui.trigger);
  open();
  const escape = ui.doc.fire('keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(ui.doc.activeElement, ui.trigger);
  const outside = new Element('button');
  ui.doc.body.append(outside);
  open(); outside.focus();
  ui.doc.fire('focusin', { target: outside });
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.doc.activeElement, outside);
  open();
  ui.doc.fire('pointerdown', { target: outside });
  assert.equal(ui.controller.isOpen, false);
  open();
  ui.popover.fire('focusout', { relatedTarget: outside });
  assert.equal(ui.controller.isOpen, false);
  open();
  ui.trigger.dataset.variantSources = 'other-draft';
  ui.observers[0].check();
  assert.equal(ui.controller.isOpen, false);
  open();
  ui.trigger.remove();
  ui.observers[0].check();
  assert.equal(ui.controller.isOpen, false);
  ui.controller.destroy();
  assert.equal(ui.popover.isConnected, false);
  assert.equal(ui.trigger.getAttribute('aria-controls'), undefined);
  assert.equal(ui.doc.listenerCount(), 0);
  assert.equal(ui.view.listenerCount(), 0);
  assert.equal(ui.observers[0].observing, false);
  open();
  assert.equal(ui.controller.isOpen, false);
});


test('replacing source chips clears prior popup relationships without retaining old opener ownership', t => {
  const ui = setup(t);
  const first = ui.trigger;
  const second = new Element('button');
  second.dataset.variantSources = 'second';
  ui.doc.body.append(second);
  ui.controller.toggle(first, { output: { id: 'draft', sourceSnapshots: [used] } });
  assert.equal(first.getAttribute('aria-controls'), ui.popover.id);
  ui.controller.toggle(second, { output: { id: 'second', sourceSnapshots: [file] } });
  assert.equal(first.getAttribute('aria-expanded'), 'false');
  assert.equal(first.getAttribute('aria-controls'), undefined, 'closed chips have no stale popup ownership');
  assert.equal(first.getAttribute('aria-haspopup'), 'dialog', 'the chip keeps its reusable action semantics');
  assert.equal(second.getAttribute('aria-controls'), ui.popover.id);
  first.remove();
  ui.observers[0].check();
  assert.equal(ui.controller.outputId, 'second', 'removing a prior chip cannot close the current popup');
  ui.controller.close();
  assert.equal(second.getAttribute('aria-controls'), undefined);
  assert.equal(second.getAttribute('aria-expanded'), 'false');
  ui.controller.toggle(second, { output: { id: 'second', sourceSnapshots: [file] } });
  ui.controller.destroy();
  assert.equal(second.getAttribute('aria-controls'), undefined);
  assert.equal(ui.doc.listenerCount(), 0);
  assert.equal(ui.view.listenerCount(), 0);
});


test('opening a captured source closes the popup and hands the exact snapshot and chip to the shared preview', t => {
  const ui = setup(t);
  const snapshot = structuredClone(used);
  const output = { id: 'draft', sourceSnapshots: [snapshot] };
  ui.controller.toggle(ui.trigger, { project: { sources: [unused] }, output });
  ui.popover.querySelector('.draft-sources-source-title').fire('click');
  assert.equal(ui.opened.length, 1);
  assert.equal(ui.opened[0].source, snapshot);
  assert.equal(ui.opened[0].opener, ui.trigger);
  assert.equal(ui.opened[0].popupOpen, false, 'the nonmodal popup closes before opening the source dialog');
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.popover.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.doc.activeElement, ui.preview, 'popup closing must not steal focus back from the shared preview');
  ui.controller.destroy();
});
