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
    this.animations = [];
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
  insertSibling(child, offset) {
    const parent = this.parentElement;
    if (!parent) return;
    if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
    parent.children.splice(parent.children.indexOf(this) + offset, 0, child);
    child.parentElement = parent;
  }
  before(child) { this.insertSibling(child, 0); }
  after(child) { this.insertSibling(child, 1); }
  animate(frames, options) {
    let finish;
    const animation = {
      frames, options, cancelled: false,
      finished: new Promise(resolve => { finish = resolve; }),
      finish() { finish(); },
      cancel() { this.cancelled = true; },
    };
    this.animations.push(animation);
    return animation;
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) { return selector.split(',').some(part => this.classList.contains(part.trim().slice(1))); }
  querySelector() { return null; }
  focus() { this.ownerDocument.activeElement = this; }
}

function setup(t, { mobile = false, workspace = false, reducedMotion = true } = {}) {
  const previous = Object.fromEntries(['document', 'window', 'MutationObserver', 'getComputedStyle'].map(key => [key, globalThis[key]]));
  t.after(() => Object.assign(globalThis, previous));
  const selectors = ['show-sources', 'editor-sources', 'show-new-variant', 'composer-tools', 'show-variants', 'composer-outputs', 'show-profile', 'profile-menu', 'navigation-drawer', 'toggle-navigation-drawer', 'new-project', 'home', 'new-project-tooltip', 'sources-tooltip', 'account-tooltip', 'workspace-app', 'mobile-workspace-utilities', 'sidebar-header', 'workspace-navigation'];
  const nodes = Object.fromEntries(selectors.map(id => [`#${id}`, new Node()]));
  const doc = new Node();
  doc.body = new Node(); doc.documentElement = new Node();
  doc.defaultView = { matchMedia: () => ({ matches: reducedMotion }) };
  doc.querySelector = selector => nodes[selector] || null;
  doc.querySelectorAll = () => [];
  doc.createComment = () => { const node = new Node(); node.ownerDocument = doc; return node; };
  doc.activeElement = null;
  for (const node of [doc, doc.body, doc.documentElement, ...Object.values(nodes)]) node.ownerDocument = doc;
  nodes['#workspace-app'].append(nodes['#navigation-drawer']);
  nodes['#navigation-drawer'].append(nodes['#sidebar-header']);
  nodes['#sidebar-header'].append(nodes['#mobile-workspace-utilities']);
  nodes['#navigation-drawer'].append(nodes['#workspace-navigation']);
  nodes['#workspace-navigation'].append(nodes['#new-project']);
  nodes['#workspace-navigation'].append(nodes['#editor-sources']);
  nodes['#navigation-drawer'].append(nodes['#show-profile']);
  nodes['#navigation-drawer'].dataset.expanded = 'false';
  nodes['#home'].hidden = workspace;
  if (workspace) doc.body.classList.add('showing-composer');
  const media = new Node(); media.matches = mobile;
  const observers = [];
  Object.assign(globalThis, {
    document: doc,
    window: Object.assign(new Node(), { matchMedia: () => media }),
    getComputedStyle: () => ({ getPropertyValue: name => ({
      '--csa-foundation-breakpoint-mobile': '768px',
      '--csa-foundation-space-5': '5px',
      '--csa-foundation-motion-duration-200': '200ms',
      '--csa-foundation-motion-easing-ease': 'ease',
    })[name] || '' }),
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

test('mobile workspace utilities follow visual focus order and return to the desktop rail', t => {
  const ui = setup(t, { mobile: true, workspace: true });
  const { nodes } = ui;
  const utilities = nodes['#mobile-workspace-utilities'];
  assert.deepEqual(utilities.children, [nodes['#new-project'], nodes['#show-profile']]);
  ui.navigation.open('profile');
  assert.equal(nodes['#show-profile'].getAttribute('aria-expanded'), 'true');
  assert.equal(nodes['#profile-menu'].hidden, false);
  ui.media.matches = false;
  ui.media.fire('change');
  assert.equal(nodes['#new-project'].parentElement, nodes['#workspace-navigation']);
  assert.equal(nodes['#show-profile'].parentElement, nodes['#navigation-drawer']);
  assert.equal(utilities.children.length, 0);
  assert.equal(nodes['#profile-menu'].hidden, true);
});

test('home and workspace transitions relocate utilities even when both use a mobile top bar', async t => {
  const ui = setup(t, { mobile: true });
  const { nodes } = ui;
  assert.equal(nodes['#mobile-workspace-utilities'].children.length, 0);
  nodes['#home'].hidden = true;
  ui.doc.body.classList.add('showing-composer');
  await ui.deliverLayoutMutation();
  assert.deepEqual(nodes['#mobile-workspace-utilities'].children, [nodes['#new-project'], nodes['#show-profile']]);
  nodes['#home'].hidden = false;
  ui.doc.body.classList.remove('showing-composer');
  await ui.deliverLayoutMutation();
  assert.equal(nodes['#new-project'].parentElement, nodes['#workspace-navigation']);
  assert.equal(nodes['#show-profile'].parentElement, nodes['#navigation-drawer']);
});

for (const mobile of [true, false]) {
  test(`Sources ${mobile ? 'matches immediate mobile panels' : 'retains desktop slide motion'} with reduced motion off`, async t => {
    const ui = setup(t, { mobile, workspace: true, reducedMotion: false });
    const panel = ui.nodes['#editor-sources'];
    const trigger = ui.nodes['#show-sources'];
    const home = ui.nodes['#workspace-navigation'];
    const originalOrder = [...home.children];
    ui.navigation.open('sources');
    assert.equal(panel.hidden, false);
    assert.equal(panel.inert, false);
    assert.equal(panel.getAttribute('aria-hidden'), 'false');
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(panel.parentElement, mobile ? ui.nodes['#workspace-app'] : home);
    assert.equal(panel.animations.length, mobile ? 0 : 1);
    if (!mobile) {
      assert.deepEqual(panel.animations[0].frames, [{ transform: 'translateX(calc(-1 * 5px))' }, { transform: 'translateX(0)' }]);
      assert.equal(panel.animations[0].options.duration, 200);
      panel.animations[0].finish();
      await Promise.resolve();
    }
    panel.focus();
    ui.navigation.close('sources');
    assert.equal(ui.doc.activeElement, trigger, 'closing returns focus before the panel becomes unavailable');
    assert.equal(panel.inert, true);
    assert.equal(panel.getAttribute('aria-hidden'), 'true');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(panel.animations.length, mobile ? 0 : 2);
    if (!mobile) {
      assert.equal(panel.hidden, false, 'desktop remains rendered during its exit slide');
      assert.deepEqual(panel.animations[1].frames, [{ transform: 'translateX(0)' }, { transform: 'translateX(calc(-1 * 5px))' }]);
      panel.animations[1].finish();
      await Promise.resolve();
    }
    assert.equal(panel.hidden, true, 'mobile closes immediately; desktop closes when its animation finishes');
    assert.equal(panel.parentElement, home);
    assert.deepEqual(home.children, originalOrder, 'Sources returns to its original navigation position');
    if (mobile) {
      ui.navigation.open('sources');
      ui.navigation.open('newVariant');
      assert.equal(panel.hidden, true, 'direct switching closes Sources immediately');
      assert.equal(panel.parentElement, home);
      assert.equal(panel.animations.length, 0);
      assert.equal(ui.nodes['#composer-tools'].dataset.mobileOpen, 'true');
    }
  });
}
