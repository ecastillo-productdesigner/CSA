import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEditorTabs, editorTabLayout } from '../dist/editor-tabs.js';
import { closeEditorOutput, reopenEditorOutput } from '../dist/editor-tab-state.js';

const layout = options => editorTabLayout({ tabWidth: 260, moreWidth: 64, gap: 4, ...options });

test('whole tabs use exact fit thresholds and reserve More only when drafts overflow', () => {
  assert.deepEqual(layout({ count: 0, activeIndex: 0, width: 600 }).visibleIndexes, []);
  for (const [width, visibleCount] of [[1052, 4], [1051, 3], [856, 3], [855, 2], [592, 2], [591, 1], [328, 1]]) {
    const result = layout({ count: 4, activeIndex: 0, width });
    assert.equal(result.visibleIndexes.length, visibleCount, `width ${width}`);
    assert.equal(result.hiddenIndexes.length, 4 - visibleCount, `width ${width}`);
  }
  assert.deepEqual(layout({ count: 3, activeIndex: 0, width: 788 }).hiddenIndexes, []);
  assert.equal(layout({ count: 3, activeIndex: 0, width: 787 }).hiddenIndexes.length, 1);
  assert.equal(layout({ count: 1, activeIndex: 0, width: 900 }).tabWidth, 260);
  assert.equal(layout({ count: 1, activeIndex: 0, width: 180 }).tabWidth, 180);
  assert.equal(layout({ count: 4, activeIndex: 3, width: 220 }).tabWidth, 152);
});

test('every layout keeps the active draft visible, ordered, and within the row', () => {
  for (let count = 1; count <= 10; count++) {
    for (let activeIndex = 0; activeIndex < count; activeIndex++) {
      for (const width of [120, 220, 328, 524, 592, 788, 856, 1052, 1600]) {
        const { visibleIndexes, hiddenIndexes, tabWidth } = layout({ count, activeIndex, width });
        const context = JSON.stringify({ count, activeIndex, width });
        assert.ok(visibleIndexes.includes(activeIndex), context);
        assert.deepEqual(visibleIndexes, [...visibleIndexes].sort((a, b) => a - b), context);
        assert.deepEqual(hiddenIndexes, [...hiddenIndexes].sort((a, b) => a - b), context);
        assert.deepEqual([...visibleIndexes, ...hiddenIndexes].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i), context);
        assert.ok(tabWidth > 0, context);
        const used = visibleIndexes.length * tabWidth + Math.max(0, visibleIndexes.length - 1) * 4 + (hiddenIndexes.length ? 68 : 0);
        assert.ok(used <= width + 0.001, `${context}: used ${used}`);
        if (hiddenIndexes.length) assert.ok(Math.abs(used - width) < 0.001, `${context}: More remains at the row edge`);
      }
    }
  }
});

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, fields = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...fields };
    for (let node = this; node; node = node.parentElement || node.parentNode) {
      for (const callback of [...(node.listeners?.get(type) || [])]) callback(event);
      if (event.stopped) break;
    }
    return event;
  }
}

class Element extends Events {
  constructor(tagName, ownerDocument) {
    super();
    Object.assign(this, { tagName: tagName.toUpperCase(), ownerDocument, children: [], attributes: {}, dataset: {}, className: '', hidden: false, clientWidth: 600 });
    this.style = { setProperty(name, value) { this[name] = String(value); }, removeProperty(name) { delete this[name]; }, getPropertyValue(name) { return this[name] || ''; } };
    this.classList = {
      contains: name => this.className.split(' ').includes(name),
      toggle: (name, force) => {
        const present = this.classList.contains(name);
        const add = force ?? !present;
        this.className = [...this.className.split(' ').filter(value => value && value !== name), ...(add ? [name] : [])].join(' ');
        return add;
      },
      add: (...names) => names.forEach(name => this.classList.toggle(name, true)),
      remove: (...names) => names.forEach(name => this.classList.toggle(name, false)),
    };
  }
  set textContent(value) { this.replaceChildren(); this.text = String(value); }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...children) {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.text = '';
    this.append(...children);
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  matches(selector) {
    if (selector === '*') return true;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    const data = selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
    if (data) {
      const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return data[2] === undefined ? key in this.dataset : this.dataset[key] === data[2];
    }
    const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (attribute) return attribute[2] === undefined ? attribute[1] in this.attributes : this.attributes[attribute[1]] === attribute[2];
    return this.tagName.toLowerCase() === selector;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(other) { return this === other || this.children.some(child => child.contains(other)); }
  getBoundingClientRect() { return { left: 0, right: this.clientWidth, top: 0, bottom: 48, width: this.clientWidth, height: 48 }; }
  focus() { this.ownerDocument.activeElement = this; this.emit('focusin'); }
}

function fixture(t, { width = 600, outputs, activeId, processing, closable = false, closedIds = [], ownMaterialOutputId } = {}) {
  const names = ['document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'setTimeout', 'clearTimeout'];
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  const tokens = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
  const values = new Map();
  function cssValue(value) {
    if (typeof value === 'string' && /^\{[^}]+\}$/.test(value)) return cssValue(value.slice(1, -1).split('.').reduce((node, key) => node[key], tokens).$value);
    return typeof value === 'object' && value !== null && 'unit' in value ? `${value.value}${value.unit}` : String(value);
  }
  function collect(node, path = []) {
    if ('$value' in node) values.set(`--csa-${path.join('-')}`, cssValue(node.$value));
    else for (const [key, value] of Object.entries(node)) if (!key.startsWith('$') && typeof value === 'object' && value !== null) collect(value, [...path, key]);
  }
  collect(tokens);
  const doc = new Events();
  doc.createElement = tag => new Element(tag, doc);
  doc.createTextNode = text => Object.assign(new Element('#text', doc), { textContent: text });
  doc.documentElement = doc.createElement('html');
  doc.body = doc.createElement('body');
  doc.body.parentNode = doc;
  doc.querySelector = selector => doc.body.querySelector(selector);
  const root = doc.createElement('div'); root.id = 'editor-variant-tabs'; root.clientWidth = width;
  const panel = doc.createElement('div'); panel.id = 'editor-canvas-content';
  doc.body.append(root, panel);
  const observers = [];
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  Object.assign(globalThis, {
    document: doc,
    getComputedStyle: () => ({ getPropertyValue: name => values.get(name) || '' }),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(element) { this.element = element; }
      disconnect() { this.disconnected = true; }
    },
    requestAnimationFrame: callback => { callback(); return 1; },
    cancelAnimationFrame() {},
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const project = { id: 'project', ownMaterialOutputId, closedEditorOutputIds: closedIds, outputs: outputs || Array.from({ length: 5 }, (_, i) => ({ id: `draft-${i}`, title: `Draft ${i}`, status: 'ready' })), outputProcessing: processing };
  project.selectedOutputId = activeId ?? project.outputs[0]?.id;
  const selections = [];
  const closures = [];
  const reads = [];
  const animations = [];
  const controller = createEditorTabs({
    onClose: closable ? id => { closures.push(id); closeEditorOutput(project, id); controller.render(project); } : undefined,
    onSelect(id) { selections.push(id); if (id) reopenEditorOutput(project, id); project.selectedOutputId = id; project.viewOriginalDraft = id === null; controller.render(project); },
    onRevisionRead(project, output) { reads.push([project.id, output.id]); },
    createAnimation(options) {
      const animation = { element: doc.createElement('span'), options, destroy() { this.destroyed = true; } };
      animations.push(animation);
      return animation;
    },
  });
  controller.render(project);
  t.after(() => {
    controller.destroy();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  return {
    controller, root, panel, doc, project, selections, closures, reads, animations, timers, observers,
    get tabs() { return root.querySelectorAll('[role="tab"]'); },
    get visible() { return this.tabs.filter(tab => !tab.hidden); },
    get more() { return root.querySelector('.editor-tabs-more'); },
    get menu() { return root.querySelector('.editor-tabs-more-menu'); },
    get options() { return this.menu.querySelectorAll('[role="menuitem"]'); },
    resize(value) { root.clientWidth = value; for (const observer of observers) if (!observer.disconnected) observer.callback([{ target: root, contentRect: root.getBoundingClientRect() }]); },
    tick(milliseconds) {
      const until = now + milliseconds;
      let next;
      while ((next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort(([, a], [, b]) => a.at - b.at)[0])) {
        const [id, timer] = next;
        now = timer.at; timers.delete(id); timer.callback();
      }
      now = until;
    },
  };
}

const ids = tabs => tabs.map(tab => tab.dataset.editorOutput);
const activeTab = ui => ui.tabs.find(tab => tab.getAttribute('aria-selected') === 'true');

function openMenu(ui) {
  ui.more.emit('click');
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.more.getAttribute('aria-expanded'), 'true');
}

test('overflow lists every hidden full title with sent, unread, and revising states', t => {
  const titles = ['Active draft', 'Second draft', 'A sent draft with a complete title that should remain discoverable', 'A completed revision still unread', 'A draft currently being revised'];
  const outputs = titles.map((title, i) => ({ id: `draft-${i}`, title, status: 'ready', ...(i === 2 ? { cmsSentAt: 1 } : {}), ...(i === 3 ? { revisionUnread: true } : {}) }));
  const ui = fixture(t, { outputs, processing: { kind: 'revision', ids: ['draft-4'] } });
  assert.deepEqual(ids(ui.visible), ['draft-0', 'draft-1']);
  assert.equal(ui.more.getAttribute('aria-label'), '3 more drafts');
  assert.equal(ui.more.getAttribute('aria-haspopup'), 'menu');
  assert.equal(ui.more.getAttribute('aria-controls'), ui.menu.id);
  assert.equal(ui.root.querySelector('[role="tablist"]').getAttribute('aria-label'), 'Drafts');
  openMenu(ui);
  assert.deepEqual(ids(ui.options), ['draft-2', 'draft-3', 'draft-4']);
  for (let i = 0; i < ui.options.length; i++) assert.ok(ui.options[i].textContent.includes(titles[i + 2]));
  assert.match(ui.options[0].getAttribute('aria-label'), /Sent/);
  assert.match(ui.options[1].getAttribute('aria-label'), /Revision complete, unread/);
  assert.ok(ui.options[1].querySelector('.editor-tab-revision-dot'));
  assert.match(ui.options[2].getAttribute('aria-label'), /Revising Draft/);
});

test('selecting an overflow draft closes More, shows the draft, and focuses its tab', t => {
  const ui = fixture(t);
  openMenu(ui);
  ui.options.find(option => option.dataset.editorOutput === 'draft-4').emit('click');
  assert.deepEqual(ui.selections, ['draft-4']);
  assert.deepEqual(ids(ui.visible), ['draft-0', 'draft-4']);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.more.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.more.getAttribute('aria-label'), '3 more drafts');
  assert.equal(ui.doc.activeElement, activeTab(ui));
  assert.equal(ui.panel.getAttribute('aria-labelledby'), activeTab(ui).id);
  openMenu(ui);
  assert.deepEqual(ids(ui.options), ['draft-1', 'draft-2', 'draft-3']);
});

test('tab arrows and Home/End traverse all drafts and reveal each new selection', t => {
  const ui = fixture(t);
  for (const [key, expected] of [['ArrowLeft', 'draft-4'], ['ArrowRight', 'draft-0'], ['ArrowRight', 'draft-1'], ['ArrowRight', 'draft-2'], ['End', 'draft-4'], ['Home', 'draft-0']]) {
    const event = activeTab(ui).emit('keydown', { key });
    assert.equal(event.defaultPrevented, true);
    assert.equal(projectSelection(ui), expected);
    assert.equal(activeTab(ui).hidden, false);
    assert.equal(ui.doc.activeElement, activeTab(ui));
  }
});

function projectSelection(ui) { return ui.project.selectedOutputId; }

test('More supports menu navigation and Escape restores focus to its trigger', t => {
  const ui = fixture(t);
  ui.more.focus();
  ui.more.emit('keydown', { key: 'ArrowDown' });
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.doc.activeElement, ui.options[0]);
  ui.doc.activeElement.emit('keydown', { key: 'End' });
  assert.equal(ui.doc.activeElement, ui.options.at(-1));
  ui.doc.activeElement.emit('keydown', { key: 'ArrowDown' });
  assert.equal(ui.doc.activeElement, ui.options[0]);
  ui.doc.activeElement.emit('keydown', { key: 'ArrowUp' });
  assert.equal(ui.doc.activeElement, ui.options.at(-1));
  ui.doc.activeElement.emit('keydown', { key: 'Home' });
  assert.equal(ui.doc.activeElement, ui.options[0]);
  ui.doc.activeElement.emit('keydown', { key: 'Escape' });
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.doc.activeElement, ui.more);
  assert.deepEqual(ui.selections, []);
});

test('outside pointer and focus dismiss More while resizing updates the actual hidden count', t => {
  const ui = fixture(t, { activeId: 'draft-4' });
  openMenu(ui);
  ui.doc.emit('pointerdown', { target: ui.panel });
  assert.equal(ui.menu.hidden, true);
  openMenu(ui);
  ui.panel.focus();
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.doc.activeElement, ui.panel);
  openMenu(ui);
  ui.resize(330);
  assert.equal(ui.menu.hidden, true);
  assert.deepEqual(ids(ui.visible), ['draft-4']);
  assert.equal(ui.more.getAttribute('aria-label'), '4 more drafts');
  ui.resize(1400);
  assert.deepEqual(ids(ui.visible), ui.project.outputs.map(output => output.id));
  assert.equal(ui.more.hidden, true);
  assert.equal(activeTab(ui).dataset.editorOutput, 'draft-4');
  ui.resize(600);
  assert.equal(ui.more.hidden, false);
  assert.equal(ui.more.getAttribute('aria-label'), '3 more drafts');
});

test('a revision selected from More is acknowledged only after its full active read interval', t => {
  const outputs = Array.from({ length: 5 }, (_, i) => ({ id: `draft-${i}`, title: `Draft ${i}`, status: 'ready', ...(i === 4 ? { revisionUnread: true } : {}) }));
  const ui = fixture(t, { outputs });
  assert.equal(ui.timers.size, 0, 'hidden unread drafts must remain unread');
  openMenu(ui);
  ui.options.find(option => option.dataset.editorOutput === 'draft-4').emit('click');
  assert.equal(ui.timers.size, 1);
  ui.tick(6000);
  ui.resize(330);
  assert.equal(outputs[4].revisionUnread, true);
  ui.tick(3999);
  assert.deepEqual(ui.reads, []);
  ui.tick(1);
  assert.deepEqual(ui.reads, [['project', 'draft-4']]);
  assert.equal(outputs[4].revisionUnread, false);
  assert.equal(outputs[4].revisionRequestUnread, true);
  assert.equal(ui.doc.activeElement, activeTab(ui));
  assert.equal(activeTab(ui).hidden, false);
  ui.controller.destroy();
  assert.equal(ui.timers.size, 0);
  assert.ok(ui.observers.every(observer => observer.disconnected));
});

test('revision completion restores More focus when it rerenders an open menu', t => {
  const ui = fixture(t, { processing: { kind: 'revision', ids: ['draft-4'] } });
  ui.more.focus();
  ui.more.emit('keydown', { key: 'ArrowDown' });
  assert.equal(ui.doc.activeElement, ui.options[0]);
  ui.project.outputProcessing = null;
  ui.project.outputs[4].revisionUnread = true;
  ui.controller.render(ui.project);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.more.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.doc.activeElement, ui.more);
  assert.equal(ui.project.selectedOutputId, 'draft-0');
  ui.more.emit('keydown', { key: 'ArrowDown' });
  assert.match(ui.options.find(option => option.dataset.editorOutput === 'draft-4').getAttribute('aria-label'), /Revision complete, unread/);
});

test('active revision acknowledgement restores More focus when its timer closes the menu', t => {
  const outputs = Array.from({ length: 5 }, (_, i) => ({ id: `draft-${i}`, title: `Draft ${i}`, status: 'ready', ...(i === 0 ? { revisionUnread: true } : {}) }));
  const ui = fixture(t, { outputs });
  ui.more.focus();
  ui.more.emit('keydown', { key: 'ArrowDown' });
  assert.equal(ui.doc.activeElement, ui.options[0]);
  ui.tick(10000);
  assert.deepEqual(ui.reads, [['project', 'draft-0']]);
  assert.equal(outputs[0].revisionUnread, false);
  assert.equal(outputs[0].revisionRequestUnread, true);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.more.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.doc.activeElement, ui.more);
  assert.equal(activeTab(ui).dataset.editorOutput, 'draft-0');
});


test('add-source search remains available alongside ready drafts and supports switching back', t => {
  const ui = fixture(t, { width: 1400, outputs: [
    { id: 'existing-draft', title: 'Saved article', status: 'ready', draftText: 'Existing content' },
    { id: 'second-draft', title: 'Another article', status: 'ready' },
  ] });
  const outputsBefore = structuredClone(ui.project.outputs);
  Object.assign(ui.project, { sourceSearchOpen: true, searchQuery: 'Community gardens', viewOriginalDraft: true });
  ui.controller.render(ui.project);

  assert.deepEqual(ids(ui.tabs), ['', 'existing-draft', 'second-draft']);
  assert.equal(activeTab(ui).textContent, 'Searching Topic');
  assert.equal(activeTab(ui).getAttribute('aria-label'), 'Searching Topic');
  assert.equal(ui.panel.getAttribute('aria-labelledby'), activeTab(ui).id);

  ui.tabs.find(tab => tab.dataset.editorOutput === 'existing-draft').emit('click');
  assert.equal(ui.project.viewOriginalDraft, false);
  assert.equal(activeTab(ui).dataset.editorOutput, 'existing-draft');
  assert.deepEqual(ids(ui.tabs), ['', 'existing-draft', 'second-draft']);

  ui.tabs.find(tab => tab.dataset.editorOutput === '').emit('click');
  assert.equal(ui.project.viewOriginalDraft, true);
  assert.equal(activeTab(ui).textContent, 'Searching Topic');
  assert.equal(ui.doc.activeElement, activeTab(ui));
  assert.deepEqual(ui.selections, ['existing-draft', null]);
  assert.deepEqual(ui.project.outputs, outputsBefore, 'switching views must preserve saved drafts');
});

test('source search is recognizable in overflow and can be reopened from a draft', t => {
  const ui = fixture(t, { width: 330, activeId: 'draft-4' });
  Object.assign(ui.project, { sourceSearchOpen: true, searchQuery: 'Community gardens', viewOriginalDraft: false });
  ui.controller.render(ui.project);
  assert.deepEqual(ids(ui.visible), ['draft-4']);

  openMenu(ui);
  const searchOption = ui.options.find(option => option.dataset.editorOutput === '');
  assert.ok(searchOption);
  assert.equal(searchOption.textContent, 'Searching Topic');
  assert.equal(searchOption.querySelector('.editor-tab-draft'), null, 'a search workspace is not a drafted article');
  searchOption.emit('click');
  assert.equal(ui.project.viewOriginalDraft, true);
  assert.equal(activeTab(ui).textContent, 'Searching Topic');
  assert.equal(activeTab(ui).hidden, false);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.doc.activeElement, activeTab(ui));
});

test('initial topic search still yields to the first ready draft without add-source mode', t => {
  const ui = fixture(t, { outputs: [] });
  Object.assign(ui.project, { searchQuery: 'Community gardens', awaitingOutput: true, viewOriginalDraft: true });
  ui.controller.render(ui.project);
  assert.deepEqual(ids(ui.tabs), ['']);
  assert.equal(activeTab(ui).textContent, 'Searching Topic');

  ui.project.outputs.push({ id: 'first-draft', title: 'New article', status: 'pending' });
  ui.controller.render(ui.project);
  assert.deepEqual(ids(ui.tabs), ['']);

  ui.project.outputs[0].status = 'ready';
  ui.project.selectedOutputId = 'first-draft';
  ui.project.viewOriginalDraft = false;
  ui.project.awaitingOutput = false;
  ui.controller.render(ui.project);
  assert.deepEqual(ids(ui.tabs), ['first-draft']);
  assert.equal(activeTab(ui).dataset.editorOutput, 'first-draft');
  assert.equal(ui.more.hidden, true);
});


test('each closable draft has a separate accessible X without nesting buttons', t => {
  const ui = fixture(t, { closable: true });
  for (const tab of ui.tabs) {
    const close = tab.parentElement.querySelector('[data-close-editor-output]');
    assert.ok(close, `Missing close action for ${tab.dataset.editorOutput}`);
    assert.equal(close.tagName, 'BUTTON');
    assert.equal(close.getAttribute('aria-label'), `Close tab: ${ui.project.outputs.find(output => output.id === tab.dataset.editorOutput).title}`);
    assert.equal(close.dataset.closeEditorOutput, tab.dataset.editorOutput);
    assert.equal(tab.contains(close), false, 'close action must be a sibling, not a nested button');
    assert.equal(close.querySelector('.material-symbols-outlined').getAttribute('aria-hidden'), 'true');
    assert.equal(tab.parentElement.hidden, tab.hidden, 'hidden tabs cannot leave a visible X behind');
  }
});

test('closing an inactive tab never selects it or removes its drafted content', t => {
  const ui = fixture(t, { closable: true });
  const originals = structuredClone(ui.project.outputs);
  ui.tabs.find(tab => tab.dataset.editorOutput === 'draft-1').parentElement.querySelector('[data-close-editor-output]').emit('click');
  assert.deepEqual(ui.closures, ['draft-1']);
  assert.deepEqual(ui.selections, []);
  assert.equal(ui.project.selectedOutputId, 'draft-0');
  assert.equal(ids(ui.tabs).includes('draft-1'), false);
  assert.deepEqual(ui.project.outputs, originals);
  assert.equal(ui.doc.activeElement, activeTab(ui));
});

test('Delete closes an active draft, follows its next tab, and keeps focus usable', t => {
  const ui = fixture(t, { closable: true, activeId: 'draft-1' });
  const event = activeTab(ui).emit('keydown', { key: 'Delete' });
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(ui.closures, ['draft-1']);
  assert.equal(ui.project.selectedOutputId, 'draft-2');
  assert.equal(activeTab(ui).dataset.editorOutput, 'draft-2');
  assert.equal(activeTab(ui).hidden, false);
  assert.equal(ui.doc.activeElement, activeTab(ui));
});

test('overflow close actions close only their draft and update the hidden count', t => {
  const ui = fixture(t, { closable: true });
  openMenu(ui);
  const close = ui.menu.querySelector('[data-close-editor-output="draft-4"]');
  assert.ok(close);
  close.emit('click');
  assert.deepEqual(ui.closures, ['draft-4']);
  assert.deepEqual(ui.selections, []);
  assert.equal(ui.project.selectedOutputId, 'draft-0');
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.more.getAttribute('aria-label'), '2 more drafts');
  assert.equal(ui.project.outputs.length, 5);
  openMenu(ui);
  assert.equal(ui.menu.querySelector('[data-close-editor-output="draft-4"]'), null);
});

test('closing every draft removes the tab row and reopening a card restores it', t => {
  const ui = fixture(t, { closable: true });
  Object.assign(ui.project, { awaitingOutput: true, linkCards: true, searchQuery: 'Old query' });
  const originals = structuredClone(ui.project.outputs);
  while (ui.tabs.length) activeTab(ui).emit('keydown', { key: 'Delete' });
  assert.equal(ui.root.hidden, true);
  assert.equal(ui.more.hidden, true);
  assert.equal(ui.project.selectedOutputId, null);
  assert.equal(ui.panel.getAttribute('role'), null);
  assert.equal(ui.panel.getAttribute('aria-labelledby'), null);
  assert.deepEqual(ui.project.outputs, originals);
  assert.equal(reopenEditorOutput(ui.project, 'draft-3'), true);
  ui.project.selectedOutputId = 'draft-3';
  ui.controller.render(ui.project);
  assert.equal(ui.root.hidden, false);
  assert.deepEqual(ids(ui.tabs), ['draft-3']);
  assert.equal(activeTab(ui).dataset.editorOutput, 'draft-3');
  assert.equal(ui.panel.getAttribute('aria-labelledby'), activeTab(ui).id);
});

test('closing an unread tab cancels its acknowledgement timer and preserves the unread revision', t => {
  const ui = fixture(t, { closable: true, outputs: [
    { id: 'one', title: 'Unread draft', status: 'ready', revisionUnread: true },
    { id: 'two', title: 'Another draft', status: 'ready' },
  ] });
  ui.tick(5000);
  activeTab(ui).parentElement.querySelector('[data-close-editor-output]').emit('click');
  ui.tick(10000);
  assert.equal(ui.project.outputs[0].revisionUnread, true);
  assert.deepEqual(ui.reads, []);
});

test('source search preview has no X and Delete cannot close it', t => {
  const ui = fixture(t, { closable: true, width: 1400 });
  Object.assign(ui.project, { sourceSearchOpen: true, searchQuery: 'Community gardens', viewOriginalDraft: true });
  ui.controller.render(ui.project);
  const sourceTab = ui.tabs.find(tab => tab.dataset.editorOutput === '');
  assert.ok(sourceTab);
  assert.equal(sourceTab.parentElement.querySelector('[data-close-editor-output]'), null);
  sourceTab.emit('keydown', { key: 'Delete' });
  assert.deepEqual(ui.closures, []);
  assert.equal(ui.project.viewOriginalDraft, true);
});


test('own-material source tabs cannot be closed because they have no Drafted card to reopen from', t => {
  const ui = fixture(t, { closable: true, width: 1400, ownMaterialOutputId: 'legacy', outputs: [
    { id: 'own', title: 'Source material', status: 'ready', ownMaterial: true },
    { id: 'legacy', title: 'Legacy original material', status: 'ready' },
    { id: 'generated', title: 'Generated draft', status: 'ready' },
  ] });
  for (const id of ['own', 'legacy']) {
    const tab = ui.tabs.find(tab => tab.dataset.editorOutput === id);
    assert.equal(tab.parentElement.querySelector('[data-close-editor-output]'), null);
    tab.emit('keydown', { key: 'Delete' });
  }
  assert.deepEqual(ui.closures, []);
  assert.ok(ui.tabs.find(tab => tab.dataset.editorOutput === 'generated').parentElement.querySelector('[data-close-editor-output]'));
});
