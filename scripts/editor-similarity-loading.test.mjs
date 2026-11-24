import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { createRevisionLoading } from '../dist/revision-loading.js';

const source = (await readFile(new URL('../dist/editor.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export function createMaterialEditor', 'function createMaterialEditor');

class Element {
  constructor() {
    this.style = { visibility: '', setProperty(name, value) { this[name] = value; } };
    this.inert = false;
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.value = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.classList = { toggle() {}, remove() {} };
    this.bounds = { top: 100, bottom: 2100, height: 2000 };
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, event = {}) { for (const callback of this.listeners.get(type) || []) callback(event); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  replaceChildren(...children) { this.children.forEach(child => child.isConnected = false); this.children = children; children.forEach(child => child.isConnected = true); }
  querySelectorAll() { return []; }
  getClientRects() { return this.isConnected ? [this.bounds] : []; }
  getBoundingClientRect() { return this.bounds; }
  remove() { this.isConnected = false; }
  close() { this.open = false; }
  focus() {}
}

function setup() {
  const controls = new Map();
  const get = selector => {
    if (!controls.has(selector)) controls.set(selector, new Element());
    return controls.get(selector);
  };
  get('#material-editor').querySelector = get;
  const toolbarControls = Array.from({ length: 4 }, () => new Element());
  get('#editor-toolbar').querySelectorAll = selector => selector === 'button, input, select' ? toolbarControls : [];
  get('#editor-revision-loading').hidden = true;
  get('#editor-similarity-loading').hidden = true;
  const document = new Element();
  document.querySelector = selector => selector === 'dialog[open]' ? null : get(selector);
  document.documentElement = { clientHeight: 800 };
  const window = new Element();
  const frames = new Map();
  let nextFrame = 0;
  window.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  let quill;
  window.Quill = class {
    static import() { return class {}; }
    constructor() {
      quill = this;
      this.root = new Element();
      this.history = { clear() {} };
      this.contents = { ops: [] };
      this.listeners = new Map();
    }
    on(type, callback) { this.listeners.set(type, callback); }
    changeText(value) { this.setText(value); this.listeners.get('text-change')?.(); }
    enable(value) { this.enabled = value; }
    getContents() { return this.contents; }
    setContents(value) { this.contents = value; }
    setText(value) { this.contents = { ops: [{ insert: value }] }; }
    getText() { return this.contents.ops.map(op => op.insert).join(''); }
    setSelection() {}
    getFormat() { return {}; }
  };
  const surfaces = [];
  const revisions = [];
  let sent = 0;
  const opened = [];
  const sentTargets = [];
  const context = createContext({
    window, document,
    ResizeObserver: class { observe() {} },
    tokenNumber: () => 24,
    createAudienceSimilarityLoadingSurface(doc) {
      assert.equal(doc, document);
      const surface = new Element();
      surface.textContent = 'Calculating Similarities';
      surfaces.push(surface);
      return surface;
    },
    createRevisionLoading(options) {
      return createRevisionLoading({ ...options, createAnimation: options.createAnimation || (() => {
        const element = new Element();
        revisions.push(element);
        return { element, destroy() { element.remove(); } };
      }) });
    },
    createStoryMetadata: () => ({ close() {}, refresh() {} }),
    storyMetadata: () => ({}),
    createEditorialDirectionMetadata: () => ({ close() {}, update() {}, showNotice: () => true }),
    initializeOutputShareText: () => false,
    draftPreferenceValue: (_key, value) => value || '',
    clearTimeout() {},
    setTimeout() {},
  });
  runInContext(source, context, { filename: 'editor.js' });
  const editor = context.createMaterialEditor({
    onSave: () => true,
    onSendToCms(projectId) { sent++; sentTargets.push(projectId); },
    onOpenCms(projectId, outputId) { opened.push({ projectId, outputId }); },
    notify() {},
  });
  const draft = { id: 'project', selectedOutputId: 'draft', title: 'Story title', shareText: 'Subhead', draftText: 'Story body', status: 'ready' };
  editor.open(draft);
  const content = [get('.editor-document-header'), get('#editor-toolbar'), get('#rich-text-editor'), get('.editor-footer')];
  return {
    editor, get, content, toolbarControls, surfaces, revisions, document, window, frames, draft, opened, sentTargets,
    get quill() { return quill; }, get sent() { return sent; },
    frame() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
  };
}

function assertBusy(ui, busy) {
  assert.equal(ui.quill.enabled, !busy);
  assert.equal(ui.get('#editor-title').disabled, busy);
  assert.equal(ui.get('#editor-share-text').disabled, busy);
  assert.equal(ui.get('#editor-wordpress').disabled, busy);
  assert.equal(ui.editor.canSend(), !busy);
  assert.ok(ui.toolbarControls.every(control => control.disabled === busy));
}

test('similarity calculation hides the document without collapsing it and restores controls and content', () => {
  const ui = setup();
  ui.content[3].style.visibility = 'collapse';
  ui.content[3].inert = true;
  ui.get('#editor-link-dialog').open = true;
  ui.editor.setSimilarityBusy(true);
  assertBusy(ui, true);
  assert.equal(ui.get('#editor-similarity-loading').hidden, false);
  assert.equal(ui.get('#editor-revision-loading').hidden, true);
  assert.equal(ui.get('#editor-link-dialog').open, false);
  assert.ok(ui.content.every(element => element.style.visibility === 'hidden' && element.inert && !element.hidden));
  assert.equal(ui.editor.showWordCountNotice(), false);
  ui.get('#editor-wordpress').dispatch('click');
  assert.equal(ui.sent, 0);
  ui.editor.setSimilarityBusy(true);
  assert.equal(ui.surfaces.length, 1, 'repeat rendering reuses the same surface and listeners');
  ui.editor.setSimilarityBusy(false);
  assertBusy(ui, false);
  assert.equal(ui.get('#editor-similarity-loading').hidden, true);
  assert.equal(ui.quill.getText(), 'Story body');
  assert.deepEqual(ui.content.map(element => [element.style.visibility, element.inert]), [['', false], ['', false], ['', false], ['collapse', true]]);
  ui.get('#editor-wordpress').dispatch('click');
  assert.equal(ui.sent, 1);
});

test('overlapping revision and similarity jobs retain their own busy state and restore the original document', () => {
  for (const revisionFirst of [false, true]) {
    const ui = setup();
    if (revisionFirst) ui.editor.setRevisionBusy(true);
    ui.editor.setSimilarityBusy(true);
    if (!revisionFirst) ui.editor.setRevisionBusy(true);
    assertBusy(ui, true);
    assert.equal(ui.get('#editor-revision-loading').hidden, false);
    assert.equal(ui.get('#editor-similarity-loading').hidden, true);
    ui.editor.setRevisionBusy(false);
    assertBusy(ui, true);
    assert.equal(ui.get('#editor-revision-loading').hidden, true);
    assert.equal(ui.get('#editor-similarity-loading').hidden, false);
    ui.editor.setSimilarityBusy(false);
    assertBusy(ui, false);
    assert.ok(ui.content.every(element => element.style.visibility === '' && !element.inert));
  }
  const ui = setup();
  ui.editor.setRevisionBusy(true);
  ui.editor.setSimilarityBusy(true);
  ui.editor.setSimilarityBusy(false);
  assertBusy(ui, true);
  assert.equal(ui.get('#editor-revision-loading').hidden, false);
  ui.editor.setRevisionBusy(false);
  assertBusy(ui, false);
});

test('changing or closing a draft clears both busy states and removes similarity listeners', () => {
  for (const close of [false, true]) {
    const ui = setup();
    ui.editor.setSimilarityBusy(true);
    assert.equal(ui.document.listeners.get('scroll').size, 1);
    assert.equal(ui.window.listeners.get('resize').size, 1);
    if (close) ui.editor.close();
    else ui.editor.open({ ...ui.draft, draftText: 'Another story' });
    assert.equal(ui.get('#editor-similarity-loading').hidden, true);
    assert.equal(ui.get('#editor-revision-loading').hidden, true);
    assert.equal(ui.document.listeners.get('scroll').size, 0);
    assert.equal(ui.window.listeners.get('resize').size, 0);
    assert.equal(ui.frames.size, 0);
    assert.ok(ui.content.every(element => element.style.visibility === '' && !element.inert));
    if (close) ui.editor.open(ui.draft);
    assertBusy(ui, false);
    ui.editor.setRevisionBusy(true);
    ui.editor.setSimilarityBusy(true);
    ui.editor.open(ui.draft);
    assertBusy(ui, false);
    assert.equal(ui.get('#editor-revision-loading').hidden, true);
    assert.equal(ui.get('#editor-similarity-loading').hidden, true);
  }
});

test('the similarity label stays centered in the visible part of a long article after scrolling and resizing', () => {
  const ui = setup();
  ui.editor.setSimilarityBusy(true);
  const surface = ui.surfaces[0];
  ui.frame();
  assert.equal(surface.style['--similarity-indicator-y'], '350px');
  surface.bounds = { top: -700, bottom: 1300, height: 2000 };
  ui.document.dispatch('scroll');
  assert.equal(surface.style['--similarity-indicator-y'], '1100px');
  ui.document.documentElement.clientHeight = 600;
  ui.window.dispatch('resize');
  assert.equal(surface.style['--similarity-indicator-y'], '1000px');
  ui.editor.setSimilarityBusy(false);
  assert.equal(surface.isConnected, false);
  surface.bounds = { top: 0, bottom: 300, height: 300 };
  ui.document.dispatch('scroll');
  assert.equal(surface.style['--similarity-indicator-y'], '1000px', 'completed jobs no longer measure detached surfaces');
});


test('an unsent draft sends, then its exported version opens in the CMS without sending again', () => {
  const ui = setup();
  const action = ui.get('#editor-wordpress');
  assert.equal(action.textContent, 'Send to your CMS');
  assert.equal(action.disabled, false);
  action.dispatch('click');
  assert.deepEqual(ui.sentTargets, ['project']);
  assert.deepEqual(ui.opened, []);

  const signature = ui.editor.markSent();
  assert.equal(typeof signature, 'string');
  assert.equal(action.textContent, 'Open on your CMS');
  assert.equal(action.disabled, false);
  assert.equal(ui.editor.canSend(), false);
  action.dispatch('click');
  assert.deepEqual(ui.opened, [{ projectId: 'project', outputId: 'draft' }]);
  assert.equal(ui.sent, 1, 'opening an exported draft must not export it again');
});

test('editing an exported headline, subhead, or body restores Send until that version is exported', () => {
  for (const field of ['headline', 'subhead', 'body']) {
    const ui = setup();
    const action = ui.get('#editor-wordpress');
    ui.editor.markSent();
    if (field === 'body') ui.quill.changeText('Updated story body');
    else {
      const input = ui.get(field === 'headline' ? '#editor-title' : '#editor-share-text');
      input.value = field === 'headline' ? 'Updated headline' : 'Updated subhead';
      input.dispatch('input');
    }
    assert.equal(action.textContent, 'Send to your CMS', field);
    assert.equal(action.disabled, false, field);
    assert.equal(ui.editor.canSend(), true, field);
    action.dispatch('click');
    assert.deepEqual(ui.sentTargets, ['project'], field);
    assert.deepEqual(ui.opened, [], field);
    ui.editor.markSent();
    assert.equal(action.textContent, 'Open on your CMS', field);
    action.dispatch('click');
    assert.deepEqual(ui.opened, [{ projectId: 'project', outputId: 'draft' }], field);
  }
});

test('reopening a saved exported draft restores Open, and switching to an unsent draft resets the action', () => {
  const ui = setup();
  const signature = ui.editor.markSent();
  ui.editor.close();
  ui.editor.open({ ...ui.draft, cmsSentAt: 100, cmsSentContent: signature });
  const action = ui.get('#editor-wordpress');
  assert.equal(action.textContent, 'Open on your CMS');
  assert.equal(action.disabled, false);
  action.dispatch('click');
  assert.deepEqual(ui.opened, [{ projectId: 'project', outputId: 'draft' }]);

  ui.editor.open({ ...ui.draft, selectedOutputId: 'new-draft', title: 'Unsent draft' });
  assert.equal(action.textContent, 'Send to your CMS');
  assert.equal(action.disabled, false);
  action.dispatch('click');
  assert.equal(ui.sent, 1);
  assert.equal(ui.opened.length, 1, 'switching drafts cannot open the previously exported draft');
});

test('legacy sent drafts without a stored signature can open their CMS page', () => {
  const ui = setup();
  ui.editor.open({ ...ui.draft, cmsSentAt: 100 });
  const action = ui.get('#editor-wordpress');
  assert.equal(action.textContent, 'Open on your CMS');
  assert.equal(action.disabled, false);
  action.dispatch('click');
  assert.deepEqual(ui.opened, [{ projectId: 'project', outputId: 'draft' }]);
  assert.equal(ui.sent, 0);
});

test('revision and similarity loading disable opening an exported draft without changing its action label', () => {
  for (const busy of ['setRevisionBusy', 'setSimilarityBusy']) {
    const ui = setup();
    const action = ui.get('#editor-wordpress');
    ui.editor.markSent();
    ui.editor[busy](true);
    assert.equal(action.textContent, 'Open on your CMS', busy);
    assert.equal(action.disabled, true, busy);
    action.dispatch('click');
    assert.deepEqual(ui.opened, [], busy);
    assert.equal(ui.sent, 0, busy);
    ui.editor[busy](false);
    assert.equal(action.textContent, 'Open on your CMS', busy);
    assert.equal(action.disabled, false, busy);
    action.dispatch('click');
    assert.deepEqual(ui.opened, [{ projectId: 'project', outputId: 'draft' }], busy);
  }
});

test('a pending or empty draft cannot open a previously exported CMS page', () => {
  for (const override of [{ status: 'pending' }, { needsRegeneration: true }, { selectedOutputId: null }, { draftText: '' }]) {
    const ui = setup();
    ui.editor.open({ ...ui.draft, cmsSentAt: 100, ...override });
    const action = ui.get('#editor-wordpress');
    assert.equal(action.disabled, true);
    action.dispatch('click');
    assert.deepEqual(ui.opened, []);
    assert.equal(ui.sent, 0);
  }
});
