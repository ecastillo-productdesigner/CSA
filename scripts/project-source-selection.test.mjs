import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectSources } from '../dist/sources.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.isConnected = true;
    this._text = '';
    this.className = '';
    this.classList = { toggle: (name, selected) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      if (selected) classes.add(name); else classes.delete(name);
      this.className = [...classes].join(' ');
    } };
  }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(entry => entry !== child);
      child.parentElement = this;
      this.children.push(child);
    }
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(entry => entry !== this);
    this.parentElement = null;
  }
  before(child) {
    const siblings = this.parentElement.children;
    child.parentElement = this.parentElement;
    siblings.splice(siblings.indexOf(this), 0, child);
  }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    const attribute = selector.match(/^\[([^=]+)="([^"]*)"\]$/);
    if (attribute) return this.getAttribute(attribute[1]) === attribute[2];
    return this.tagName === selector;
  }
  closest() { return this.hidden || this.inert ? this : this.parentElement?.closest(); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, callback) { const handlers = this.listeners.get(type) || new Set(); handlers.add(callback); this.listeners.set(type, handlers); }
  fire(type, properties = {}) {
    const event = { target: this, preventDefault() {}, stopPropagation() {}, ...properties };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  focus() { document.activeElement = this; }
}

function setup(t, callbacks = {}) {
  const previous = { document: globalThis.document, window: globalThis.window, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, getComputedStyle: globalThis.getComputedStyle };
  const doc = new Element('document');
  doc.body = new Element('body');
  doc.append(doc.body);
  doc.createElement = tag => new Element(tag);
  doc.createTextNode = text => { const node = new Element('#text'); node.textContent = text; return node; };
  const sourcePanel = new Element('aside');
  const list = new Element('ul'); list.id = 'editor-source-list';
  const status = new Element('p'); status.id = 'editor-source-selection-status';
  sourcePanel.append(status, list);
  const preview = new Element('dialog'); preview.id = 'article-preview-dialog';
  const close = new Element('button'); close.setAttribute('aria-label', 'Close article preview');
  preview.append(close);
  for (const id of ['article-preview-meta', 'article-preview-title', 'article-preview-notice', 'article-preview-body']) {
    const node = new Element(); node.id = id; preview.append(node);
  }
  const badge = new Element('span'); badge.className = 'article-preview-badge'; preview.append(badge);
  preview.openCount = 0;
  preview.showModal = () => { preview.open = true; preview.openCount += 1; };
  preview.close = () => { preview.open = false; preview.fire('close'); };
  doc.body.append(sourcePanel, preview);
  Object.assign(globalThis, { document: doc, window: new Element('window'), setTimeout: () => 1, clearTimeout() {}, getComputedStyle: () => ({ getPropertyValue: () => '5000ms' }) });
  t.after(() => Object.assign(globalThis, previous));
  const controller = createProjectSources({ createAddingAnimation: () => ({ element: new Element(), destroy() {} }), onSelectionChange() {}, onDownloadSource() {}, onRemoveSource() {}, ...callbacks });
  return { doc, list, status, preview, controller };
}
const source = (title, selected) => ({ type: 'text', title, text: `${title} captured material.`, ...(selected === undefined ? {} : { selected }) });

test('project source rows expose labeled native checkboxes and default missing selection to checked', t => {
  const project = { id: 'project', sources: [source('Default source'), source('Excluded source', false), source('Included source', true)] };
  const ui = setup(t);
  ui.controller.render(project);
  const inputs = ui.list.querySelectorAll('.editor-source-checkbox');
  assert.equal(inputs.length, 3);
  assert.deepEqual(inputs.map(input => input.checked), [true, false, true]);
  inputs.forEach((input, index) => {
    assert.equal(input.tagName, 'input');
    assert.equal(input.type, 'checkbox');
    assert.equal(input.getAttribute('aria-label'), `Use source for new drafts: ${project.sources[index].title}`);
    assert.equal(input.parentElement.tagName, 'label');
    assert.ok(input.parentElement.className.split(' ').includes('editor-source-selection'));
  });
  assert.equal(ui.status.textContent, '2 of 3 selected for new drafts');
  assert.equal(ui.status.hidden, false);
});

test('uncheck and recheck flush before mutation, retain source identity and saved snapshots, and leave title preview independent', t => {
  const used = source('The captured source');
  const project = { id: 'saved-project', sources: [used, source('Other source', true)] };
  const output = { id: 'draft', sourceSnapshots: structuredClone(project.sources) };
  const snapshotBefore = structuredClone(output.sourceSnapshots);
  const calls = [];
  let ui;
  ui = setup(t, {
    onBeforeSelectionChange() { calls.push({ phase: 'before', selected: used.selected }); },
    onSelectionChange(projectId) { calls.push({ phase: 'after', selected: used.selected, count: ui.status.textContent, projectId }); },
  });
  ui.controller.render(project);
  const input = ui.list.querySelector('.editor-source-checkbox');
  input.checked = false;
  input.fire('change');
  assert.deepEqual(calls, [
    { phase: 'before', selected: undefined },
    { phase: 'after', selected: false, count: '1 of 2 selected for new drafts', projectId: 'saved-project' },
  ]);
  assert.equal(project.sources[0], used, 'selection changes the same project source object');
  assert.equal(ui.preview.openCount, 0, 'a checkbox change never previews the source');
  input.checked = true;
  input.fire('change');
  assert.deepEqual(calls.slice(2), [
    { phase: 'before', selected: false },
    { phase: 'after', selected: true, count: '2 of 2 selected for new drafts', projectId: 'saved-project' },
  ]);
  assert.deepEqual(output.sourceSnapshots, snapshotBefore, 'existing draft source snapshots are independent of new-draft choices');
  const callsBeforePreview = calls.length;
  const title = ui.list.querySelector('.editor-source-open');
  assert.equal(input.parentElement.contains(title), false, 'the preview button is outside the native checkbox label');
  title.fire('click');
  assert.equal(ui.preview.openCount, 1);
  assert.equal(ui.doc.querySelector('#article-preview-title').textContent, used.title);
  assert.equal(ui.doc.querySelector('#article-preview-body').textContent, used.text);
  assert.equal(calls.length, callsBeforePreview, 'opening a title never changes source selection');
  assert.equal(used.selected, true);
});

test('active draft selection shows checked disabled historical sources alongside editable current rows', t => {
  const current = source('Current project source', false);
  const historical = source('Removed captured source', true);
  const project = { id: 'project', sources: [current] };
  const output = { id: 'draft', sourceSnapshots: [historical] };
  const before = structuredClone({ project, output });
  let changes = 0;
  const ui = setup(t, { onBeforeSelectionChange() { changes += 1; }, onSelectionChange() { changes += 1; } });
  ui.controller.render(project, { variant: output });
  const inputs = ui.list.querySelectorAll('.editor-source-checkbox');
  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs.map(input => input.checked), [false, true]);
  assert.deepEqual(inputs.map(input => Boolean(input.disabled)), [false, true]);
  assert.deepEqual(ui.list.querySelectorAll('.editor-source-open').map(button => button.textContent), [current.title, historical.title]);
  assert.equal(ui.status.hidden, false);
  assert.equal(ui.status.textContent, '1 of 2 used in this draft');
  assert.equal(changes, 0);
  assert.deepEqual({ project, output }, before);
});


test('switching drafts follows the exact captured subset while same-context renders preserve manual next-draft staging', t => {
  const project = { id: 'project', sources: [source('First source', true), source('Second source', true), source('Third source', true)] };
  const snapshots = structuredClone(project.sources);
  const outputs = [
    { id: 'all', sourceSnapshots: snapshots },
    { id: 'second-only', sourceSnapshots: [snapshots[1]] },
    { id: 'first-third', sourceSnapshots: [snapshots[0], snapshots[2]] },
    { id: 'none', sourceSnapshots: [], sourceCount: 3, selectedSourceIndexes: [0, 1, 2] },
  ];
  project.outputs = outputs;
  const before = structuredClone(outputs);
  const identity = [...project.sources];
  const ui = setup(t);
  const checked = () => ui.list.querySelectorAll('.editor-source-checkbox').map(input => input.checked);
  for (const [index, expected] of [[0, [true, true, true]], [1, [false, true, false]], [2, [true, false, true]], [3, [false, false, false]]]) {
    const result = ui.controller.render(project, { variant: outputs[index] });
    assert.deepEqual(checked(), expected, 'checkboxes identify the saved source subset, not only its count');
    assert.equal(ui.status.textContent, `${expected.filter(Boolean).length} of 3 used in this draft`);
    assert.deepEqual(project.sources.map(entry => entry.selected !== false), expected, 'new-draft choices start from the displayed baseline');
    assert.equal(result.selectionChanged, index !== 0);
    project.sources.forEach((entry, sourceIndex) => assert.equal(entry, identity[sourceIndex]));
    assert.deepEqual(outputs, before, 'switching active drafts never changes their saved history');
  }
  ui.controller.render(project, { variant: outputs[1] });
  const first = ui.list.querySelectorAll('.editor-source-checkbox')[0];
  first.checked = true;
  first.fire('change');
  assert.deepEqual(checked(), [true, true, false]);
  assert.equal(ui.status.textContent, '2 of 3 selected for new drafts');
  assert.deepEqual(project.sources.map(entry => entry.selected !== false), [true, true, false]);
  assert.equal(ui.controller.render(project, { variant: outputs[1] }).selectionChanged, false);
  assert.deepEqual(checked(), [true, true, false], 'a save or resize render in the same draft must not discard manual staging');
  assert.equal(ui.status.textContent, '2 of 3 selected for new drafts');
  ui.controller.render(project, { variant: outputs[2] });
  assert.deepEqual(checked(), [true, false, true], 'a different active draft restores that draft’s captured baseline');
  assert.equal(ui.status.textContent, '2 of 3 used in this draft');
  assert.deepEqual(outputs, before);
});


test('checking a source shows Adding Source in that exact row while preserving its neighbors and saved draft', t => {
  const project = { id: 'project', sources: [source('Before', true), source('Adding', false), source('After', true)] };
  const snapshot = structuredClone(project.sources);
  const ui = setup(t, { createAddingAnimation: ({ label }) => {
    const element = new Element(); element.className = 'drafting-animation'; element.textContent = label;
    return { element, destroy() {} };
  } });
  ui.controller.render(project);
  const rows = [...ui.list.children];
  const checkbox = ui.list.querySelectorAll('.editor-source-checkbox')[1];
  checkbox.checked = true;
  checkbox.fire('change');
  assert.equal(ui.list.children.length, rows.length, 'the loading state replaces a source row, not its position');
  assert.deepEqual(ui.list.children, rows);
  assert.equal(rows[2].className, 'is-adding-source');
  assert.equal(rows[2].querySelector('.drafting-animation').textContent, 'Adding Source');
  assert.equal(rows[1].querySelector('.drafting-animation'), null);
  assert.equal(rows[3].querySelector('.drafting-animation'), null);
  assert.equal(project.sources[1].selected, true);
  assert.equal(snapshot[1].selected, false);
});


test('a linked source keeps its actions when its current headline differs from the saved draft snapshot', t => {
  const current = { type: 'link', url: 'https://example.com/school-bus-routes', title: 'Updated school bus routes', selected: false };
  const captured = { ...current, title: 'Original school bus routes', selected: true };
  const variant = { id: 'draft', sourceSnapshots: [captured] };
  const before = structuredClone(variant);
  const ui = setup(t);
  ui.controller.render({ id: 'project', sources: [current] }, { variant });
  assert.equal(ui.list.querySelectorAll('.editor-source-checkbox').length, 1, 'do not append a historical duplicate for the same URL');
  assert.equal(ui.list.querySelector('.editor-source-checkbox').disabled, false);
  assert.equal(ui.list.querySelector('.editor-source-checkbox').checked, true);
  assert.equal(ui.list.querySelectorAll('.editor-source-more').length, 1);
  assert.equal(ui.list.querySelector('.editor-source-more').getAttribute('aria-label'), 'Source options: Updated school bus routes');
  assert.deepEqual(variant, before, 'the draft retains its original captured headline');
});
