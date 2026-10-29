import test from 'node:test';
import assert from 'node:assert/strict';
import { createRailNavigation } from '../dist/navigation.js';

class Node {
  constructor() {
    this.hidden = true;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = new Map();
    this.isConnected = true;
    const classes = new Set();
    this.classList = {
      contains: name => classes.has(name),
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle(name, force = !classes.has(name)) { if (force) classes.add(name); else classes.delete(name); return force; },
    };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, callback) { this.listeners.set(name, [...(this.listeners.get(name) || []), callback]); }
  fire(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback({ preventDefault() {}, ...event }); }
  append(child) {
    if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
    this.children.push(child); child.parentElement = this;
  }
  before(child) {
    this.parentElement?.append(child);
  }
  after(child) { this.parentElement?.append(child); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) { return selector.split(',').some(part => this.classList.contains(part.trim().slice(1))); }
  querySelector() { return null; }
  focus() { this.ownerDocument.activeElement = this; }
}

function setup(t, { mobile = false, workspace = false } = {}) {
  const previous = Object.fromEntries(['document', 'window', 'MutationObserver', 'getComputedStyle'].map(key => [key, globalThis[key]]));
  t.after(() => Object.assign(globalThis, previous));
  const selectors = ['show-sources', 'editor-sources', 'show-new-variant', 'composer-tools', 'show-variants', 'composer-outputs', 'show-profile', 'profile-menu', 'navigation-drawer', 'toggle-navigation-drawer', 'new-project', 'home', 'new-project-tooltip', 'sources-tooltip', 'account-tooltip', 'workspace-app'];
  const nodes = Object.fromEntries(selectors.map(id => [`#${id}`, new Node()]));
  const doc = new Node();
  doc.body = new Node(); doc.documentElement = new Node();
  doc.defaultView = { matchMedia: () => ({ matches: true }) };
  doc.querySelector = selector => nodes[selector] || null;
  doc.querySelectorAll = () => [];
  doc.createComment = () => { const node = new Node(); node.ownerDocument = doc; return node; };
  doc.activeElement = null;
  for (const node of [doc, doc.body, doc.documentElement, ...Object.values(nodes)]) node.ownerDocument = doc;
  nodes['#workspace-app'].append(nodes['#navigation-drawer']);
  nodes['#navigation-drawer'].append(nodes['#editor-sources']);
  nodes['#navigation-drawer'].dataset.expanded = 'false';
  nodes['#home'].hidden = workspace;
  if (workspace) doc.body.classList.add('showing-composer');
  const media = new Node(); media.matches = mobile;
  const observers = [];
  Object.assign(globalThis, {
    document: doc,
    window: Object.assign(new Node(), { matchMedia: () => media }),
    getComputedStyle: () => ({ getPropertyValue: () => '640px' }),
    MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} },
  });
  let opened = 0;
  let closed = 0;
  const navigation = createRailNavigation({ onSourcesOpen() { opened++; }, onSourcesClose() { closed++; } });
  const deliverLayoutMutation = async () => { await Promise.resolve(); for (const callback of observers) callback(); };
  return { nodes, doc, media, navigation, deliverLayoutMutation, opened: () => opened, closed: () => closed };
}

for (const mobile of [false, true]) {
  test(`opening Sources with a new workspace survives its queued layout update on ${mobile ? 'mobile' : 'desktop'}`, async t => {
    const ui = setup(t, { mobile });
    ui.nodes['#home'].hidden = true;
    ui.doc.body.classList.add('showing-composer');
    ui.navigation.open('sources');
    assert.equal(ui.nodes['#show-sources'].getAttribute('aria-expanded'), 'true');
    assert.equal(ui.nodes['#editor-sources'].hidden, false, 'Sources opens immediately so loading is visible');
    await ui.deliverLayoutMutation();
    assert.equal(ui.nodes['#show-sources'].getAttribute('aria-expanded'), 'true', 'the deferred layout observer must not close the requested panel');
    assert.equal(ui.nodes['#editor-sources'].hidden, false);
    assert.equal(ui.nodes['#editor-sources'].inert, false);
    assert.equal(ui.opened(), 1);
    assert.equal(ui.nodes['#navigation-drawer'].dataset.expanded, String(!mobile));
    if (mobile) assert.equal(ui.nodes['#editor-sources'].parentElement, ui.nodes['#workspace-app']);
    ui.navigation.close('sources');
    await ui.deliverLayoutMutation();
    assert.equal(ui.nodes['#editor-sources'].hidden, true, 'explicit close still works');
  });
}

test('an actual responsive layout change closes the old panel and permits reopening in its new position', async t => {
  const ui = setup(t, { workspace: true });
  ui.navigation.open('sources');
  ui.media.matches = true;
  ui.media.fire('change');
  assert.equal(ui.nodes['#editor-sources'].hidden, true);
  assert.equal(ui.nodes['#show-sources'].getAttribute('aria-expanded'), 'false');
  ui.navigation.open('sources');
  await ui.deliverLayoutMutation();
  assert.equal(ui.nodes['#editor-sources'].hidden, false);
  assert.equal(ui.nodes['#editor-sources'].parentElement, ui.nodes['#workspace-app']);
});
