import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchExperience } from '../dist/search.js';

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) {
    const handlers = this.listeners.get(name) || new Set();
    handlers.add(callback);
    this.listeners.set(name, handlers);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event); return true; }
  emit(type, target = this) { return this.dispatchEvent({ type, target, preventDefault() {} }); }
  listenerCount() { return [...this.listeners.values()].reduce((count, handlers) => count + handlers.size, 0); }
}

class Element extends Events {
  constructor(tag = 'div') {
    super();
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this._text = '';
    this.classList = {
      toggle: (name, force) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        const enabled = force ?? !names.has(name);
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
      contains: name => this.className.split(' ').includes(name),
    };
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.replaceChildren(); }
  get options() { return this.children; }
  get isConnected() { return Boolean(this.connectedRoot || this.parentElement?.isConnected); }
  getBoundingClientRect() { return { left: 0, top: 0, right: 360, bottom: 160, width: 360, height: 160 }; }
  getClientRects() {
    for (let element = this; element; element = element.parentElement) if (element.hidden) return [];
    return this.isConnected ? [this.getBoundingClientRect()] : [];
  }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(entry => entry !== child);
      child.parentElement = this;
      this.children.push(child);
    }
    Element.notifyMutation?.();
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    const match = selector.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);
    const key = match?.[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return Boolean(match && this.dataset[key] === match[2]);
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) {
    const parts = selector.split(' ');
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return descendants;
    return descendants.filter(child => child.matches(parts.at(-1)) && (parts.length === 1 || child.parentElement?.closest(parts[0])));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
}

function setup(t) {
  const globalNames = ['document', 'window', 'getComputedStyle', 'setTimeout', 'clearTimeout', 'IntersectionObserver', 'MutationObserver'];
  const previous = Object.fromEntries(globalNames.map(name => [name, globalThis[name]]));
  const previousMutationHook = Element.notifyMutation;
  const mutations = new Set();
  Element.notifyMutation = () => { for (const observer of mutations) if (observer.observing) observer.callback(); };
  const html = new Element('html');
  html.connectedRoot = true;
  html.clientWidth = 1280;
  html.clientHeight = 850;
  const body = new Element('body');
  html.append(body);
  const nodes = new Map();
  const document = Object.assign(new Events(), {
    activeElement: null,
    documentElement: html,
    hidden: false,
    createElement: tag => new Element(tag),
    createTextNode: text => Object.assign(new Element('#text'), { textContent: text }),
    querySelector(selector) {
      if (!nodes.has(selector)) {
        const node = new Element();
        if (selector.startsWith('#')) node.id = selector.slice(1);
        else node.className = selector.slice(1);
        nodes.set(selector, node);
        body.append(node);
      }
      return nodes.get(selector);
    },
  });
  const motion = Object.assign(new Events(), { matches: false });
  const window = Object.assign(new Events(), { innerWidth: 1280, innerHeight: 850, matchMedia: () => motion });
  const tokenValues = {
    '--csa-component-drafting-paper-rotation-step': '3',
    '--csa-component-drafting-paper-scale-step': '0.04',
    '--csa-component-drafting-paper-lift-offset': '0.44',
    '--csa-component-drafting-paper-front-offset': '0.47',
    '--csa-component-drafting-message-hold-duration': '5000ms',
    '--csa-foundation-motion-duration-800': '0.8s',
    '--csa-foundation-motion-easing-arrive': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    '--csa-foundation-space-2': '2px', '--csa-foundation-space-3': '3px',
    '--csa-foundation-space-4': '4px', '--csa-foundation-space-6': '6px',
    '--csa-foundation-space-12': '12px', '--csa-foundation-space-14': '14px',
  };
  Object.assign(globalThis, {
    document, window,
    getComputedStyle: () => ({ overflowX: 'visible', overflowY: 'visible', getPropertyValue: name => tokenValues[name] || '' }),
    IntersectionObserver: undefined,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.observing = false; mutations.add(this); }
      observe() { this.observing = true; }
      disconnect() { this.observing = false; mutations.delete(this); }
    },
  });
  const timers = new Map();
  let now = 0;
  let sequence = 0;
  globalThis.setTimeout = (callback, delay) => {
    const id = ++sequence;
    timers.set(id, { callback, due: now + delay });
    return id;
  };
  globalThis.clearTimeout = id => timers.delete(id);
  t.after(() => {
    experience.hide();
    Element.notifyMutation = previousMutationHook;
    for (const name of globalNames) {
      if (previous[name] === undefined) delete globalThis[name];
      else globalThis[name] = previous[name];
    }
  });
  const changes = [];
  const experience = createSearchExperience({
    onSearch() {}, onDirectionChange() {}, onDraft() {},
    onSelectionChange(projectId, selected, ready) { changes.push({ projectId, selected, ready }); },
  });
  const $ = selector => document.querySelector(selector);
  return {
    experience, changes, $, pending: () => timers.size,
    animationListeners: () => document.listenerCount() + window.listenerCount() + motion.listenerCount(),
    animationObservers: () => mutations.size,
    addition: id => $('#result-list').querySelector('[data-addition-article-id="' + id + '"]'),
    select(id) {
      const card = $('#result-list').querySelector('[data-article-id="' + id + '"]');
      $('#result-list').emit('click', card.querySelector('.result-select-button'));
    },
    tick(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        now = next[1].due;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
  };
}

const link = (name, overrides = {}) => ({ type: 'link', url: 'https://example.com/' + name, selected: true, addedToCsa: false, ...overrides });
const project = (sources, id = 'links') => ({ id, kind: 'draft', sources });
const loading = addition => addition.classList.contains('is-loading');

test('fresh embedded links use the one-page source animation and complete independently after three seconds', t => {
  const ui = setup(t);
  ui.experience.show(project([link('one'), link('two'), link('three')]), { embedded: true });
  assert.equal(ui.pending(), 3);
  for (const id of ['link-1', 'link-2', 'link-3']) {
    assert.equal(loading(ui.addition(id)), true);
    const animation = ui.addition(id).querySelector('.drafting-animation');
    assert.equal(animation.dataset.variant, 'source');
    assert.equal(animation.dataset.compact, 'true');
    assert.equal(animation.dataset.shimmerColors, 'source');
    assert.equal(animation.dataset.playing, 'true');
    const papers = animation.querySelectorAll('.drafting-paper');
    assert.equal(papers.length, 1);
    assert.equal(papers[0].dataset.depth, 'front');
    assert.equal(papers[0].children.length, 7);
    assert.equal(animation.querySelector('.drafting-message').textContent, 'Adding Source');
    assert.equal(ui.addition(id).getAttribute('aria-live'), 'polite');
    assert.equal(ui.addition(id).parentElement.querySelector('.result-add-button').getAttribute('aria-busy'), 'true');
  }
  ui.tick(2999);
  assert.equal(ui.changes.length, 0);
  ui.tick(1);
  assert.equal(ui.pending(), 0);
  assert.equal(ui.animationListeners(), 0);
  assert.equal(ui.animationObservers(), 0);
  assert.equal(ui.changes.length, 3);
  assert.deepEqual(ui.changes.at(-1), { projectId: 'links', selected: ['link-1', 'link-2', 'link-3'], ready: ['link-1', 'link-2', 'link-3'] });
  for (const id of ['link-1', 'link-2', 'link-3']) {
    assert.equal(loading(ui.addition(id)), false);
    assert.equal(ui.addition(id).parentElement.querySelector('.result-add-button').getAttribute('aria-busy'), 'false');
  }
});

test('completed and legacy unmarked link sources do not replay their loader', t => {
  const ui = setup(t);
  const legacy = link('legacy');
  delete legacy.addedToCsa;
  ui.experience.show(project([link('completed', { addedToCsa: true }), legacy]), { embedded: true });
  assert.equal(ui.pending(), 0);
  assert.equal(loading(ui.addition('link-1')), false);
  assert.equal(loading(ui.addition('link-2')), false);
  ui.tick(3000);
  assert.deepEqual(ui.changes, []);
});

test('unselected new links wait for selection and duplicate URLs keep independent addition IDs', t => {
  const ui = setup(t);
  ui.experience.show(project([link('same'), link('same', { selected: false })]), { embedded: true });
  assert.equal(ui.pending(), 1);
  assert.equal(ui.addition('link-2').hidden, true);
  const firstAnimation = ui.addition('link-1').querySelector('.drafting-animation');
  ui.tick(1000);
  ui.select('link-2');
  assert.equal(firstAnimation.dataset.playbackState, 'destroyed', 'rerendered cards release their old animation controllers');
  assert.equal(ui.animationObservers(), 2, 'only the two mounted loading cards retain observers');
  assert.equal(ui.pending(), 2);
  assert.equal(loading(ui.addition('link-2')), true);
  ui.tick(2000);
  assert.equal(loading(ui.addition('link-1')), false);
  assert.equal(loading(ui.addition('link-2')), true);
  assert.deepEqual(ui.changes.at(-1).ready, ['link-1']);
  ui.tick(1000);
  assert.deepEqual(ui.changes.at(-1).ready, ['link-1', 'link-2']);
});

test('unselecting cancels only that source timer; hiding cancels every remaining addition', t => {
  const ui = setup(t);
  ui.experience.show(project([link('one'), link('two')]), { embedded: true });
  ui.tick(1000);
  ui.select('link-1');
  assert.equal(ui.pending(), 1);
  assert.deepEqual(ui.changes.at(-1).selected, ['link-2']);
  ui.tick(2000);
  assert.deepEqual(ui.changes.at(-1).ready, ['link-2']);
  assert.equal(ui.addition('link-1').hidden, true);
  ui.experience.show(project([link('unfinished')]), { embedded: true });
  assert.equal(ui.pending(), 1);
  const unfinishedAnimation = ui.addition('link-1').querySelector('.drafting-animation');
  ui.experience.hide();
  assert.equal(ui.pending(), 0);
  assert.equal(unfinishedAnimation.dataset.playbackState, 'destroyed');
  assert.equal(ui.animationListeners(), 0);
  assert.equal(ui.animationObservers(), 0);
  const count = ui.changes.length;
  ui.tick(3000);
  assert.equal(ui.changes.length, count);
  assert.equal(ui.$('#search-results').hidden, true);
});

test('switching projects prevents old addition callbacks from completing in the next project', t => {
  const ui = setup(t);
  ui.experience.show(project([link('old')], 'old-project'), { embedded: true });
  ui.tick(1000);
  ui.experience.show(project([link('new')], 'new-project'), { embedded: true });
  assert.equal(ui.pending(), 1);
  ui.tick(2000);
  assert.deepEqual(ui.changes, []);
  ui.tick(1000);
  assert.deepEqual(ui.changes, [{ projectId: 'new-project', selected: ['link-1'], ready: ['link-1'] }]);
});

test('reordering and removing links follows each source marker rather than old numeric article IDs', t => {
  const ui = setup(t);
  const first = link('completed-first', { addedToCsa: true });
  const pending = link('pending');
  const removed = link('removed', { addedToCsa: true });
  const record = { ...project([first, pending, removed]), addedArticleIds: ['link-1', 'link-3'] };
  ui.experience.show(record, { embedded: true });
  assert.equal(ui.pending(), 1);
  ui.tick(1000);
  record.sources = [pending, first];
  ui.experience.show(record, { embedded: true });
  assert.equal(ui.pending(), 1);
  assert.equal(loading(ui.addition('link-1')), true);
  assert.equal(loading(ui.addition('link-2')), false);
  ui.tick(2999);
  assert.deepEqual(ui.changes, []);
  ui.tick(1);
  assert.deepEqual(ui.changes.at(-1), { projectId: 'links', selected: ['link-1', 'link-2'], ready: ['link-2', 'link-1'] });
});

test('search stories still begin adding only after selection', t => {
  const ui = setup(t);
  ui.experience.show({ id: 'search', kind: 'search', sources: [{ type: 'search', title: 'Kelly Clarkson' }], selectedArticleIds: [], addedArticleIds: [] });
  assert.equal(ui.pending(), 0);
  assert.equal(ui.addition('article-1').hidden, true);
  ui.select('article-1');
  assert.equal(ui.pending(), 1);
  assert.equal(loading(ui.addition('article-1')), true);
  ui.tick(2999);
  assert.deepEqual(ui.changes.at(-1).ready, []);
  ui.tick(1);
  assert.deepEqual(ui.changes.at(-1), { projectId: 'search', selected: ['article-1'], ready: ['article-1'] });
  ui.experience.show({ id: 'search', kind: 'search', sources: [{ type: 'search', title: 'Kelly Clarkson' }], selectedArticleIds: ['article-1'], addedArticleIds: ['article-1'] });
  assert.equal(ui.pending(), 0);
  assert.equal(loading(ui.addition('article-1')), false);
});
