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
  get value() { return this.id === 'results-source' ? this.children.find(option => option.selected)?.value || '' : this._value || ''; }
  set value(value) {
    this._value = value;
    if (this.id === 'results-source') for (const option of this.children) option.selected = option.value === value;
  }
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
  setCustomValidity(value) { this.validityMessage = value; }
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
  const duplicates = [];
  const searches = [];
  const drafts = [];
  const backs = [];
  const selectionContexts = [];
  const workspaceSearches = [];
  const directions = [];
  let changeDates;
  const experience = createSearchExperience({
    createDateFilter({ onChange }) {
      const sync = ({ after, before }) => {
        document.querySelector('#results-after').value = after;
        document.querySelector('#results-before').value = before;
      };
      changeDates = (after, before = '') => { sync({ after, before }); onChange({ after, before }); };
      return { sync, close() {}, destroy() {} };
    },
    onSearch(query, sourceProjectId, workspaceProjectId) { searches.push({ query, sourceProjectId }); workspaceSearches.push(workspaceProjectId); },
    onDirectionChange(projectId, value) { directions.push({ projectId, value }); },
    onDraft(payload) { drafts.push(payload); },
    onBack(sourceProjectId) { backs.push(sourceProjectId); },
    onDuplicateSource: trigger => duplicates.push(trigger),
    onSelectionChange(projectId, selected, ready, context) { changes.push({ projectId, selected, ready }); selectionContexts.push(context); },
  });
  const $ = selector => document.querySelector(selector);
  return {
    experience, changeDates, changes, duplicates, searches, workspaceSearches, drafts, backs, selectionContexts, directions, $, pending: () => timers.size,
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
  assert.equal(ui.$('#results-source').value, 'all', 'link imports remain unfiltered');
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


test('adding an already-ready link opens the duplicate popup without replaying its shimmer or changing selection', t => {
  const ui = setup(t);
  ui.experience.show(project([link('ready', { addedToCsa: true })]), { embedded: true });
  const add = ui.$('#result-list').querySelector('[data-add-article-id="link-1"]');
  const before = ui.changes.length;
  ui.$('#result-list').emit('click', add);
  assert.deepEqual(ui.duplicates, [add]);
  assert.equal(ui.changes.length, before);
  assert.equal(ui.pending(), 0);
  assert.equal(loading(ui.addition('link-1')), false);
});


const topicProject = (overrides = {}) => ({ id: 'topic-search', kind: 'search', sources: [{ type: 'search', title: 'Local school openings' }], ...overrides });

test('Add Source search carries the original project through search, draft, and return callbacks', t => {
  const ui = setup(t);
  ui.experience.show(topicProject({ sourceProjectId: 'original-project' }), { addingSources: true });
  assert.equal(ui.$('#results-back').hidden, false);
  assert.equal(ui.$('#results-back').textContent, 'Back to Project');
  assert.equal(ui.$('#create-draft').textContent, 'Add Sources');
  ui.$('#results-query').value = 'School board decisions';
  ui.$('#results-query').emit('input');
  ui.$('#results-search-form').emit('submit');
  assert.deepEqual(ui.searches, [{ query: 'School board decisions', sourceProjectId: 'original-project' }]);
  ui.select('article-2');
  ui.$('#create-draft').emit('click');
  assert.equal(ui.drafts.length, 1);
  assert.equal(ui.drafts[0].sourceProjectId, 'original-project');
  assert.equal(ui.drafts[0].query, 'Local school openings');
  assert.deepEqual(ui.drafts[0].articles.map(article => article.id), ['article-2']);
  ui.$('#results-back').emit('click');
  assert.deepEqual(ui.backs, ['original-project']);
});

test('leaving Add Source results clears their target and embedded links hide search-only actions', t => {
  const ui = setup(t);
  ui.experience.show(topicProject({ sourceProjectId: 'original-project' }), { addingSources: true });
  ui.experience.show(topicProject({ sourceProjectId: 'irrelevant-target' }));
  assert.equal(ui.$('#results-back').textContent, 'Back to Projects');
  ui.$('#results-search-form').emit('submit');
  assert.equal(ui.searches.at(-1).sourceProjectId, null);
  ui.select('article-1');
  ui.$('#create-draft').emit('click');
  assert.equal(ui.drafts.at(-1).sourceProjectId, null);
  ui.$('#results-back').emit('click');
  assert.equal(ui.backs.at(-1), null);
  ui.experience.show(project([link('source')]), { embedded: true });
  assert.equal(ui.$('#results-back').hidden, true);
  assert.equal(ui.$('.results-search-form').hidden, true);
});

test('results search rejects mixed topics and links without losing the current selections', t => {
  const ui = setup(t);
  ui.experience.show(topicProject());
  ui.select('article-1');
  for (const value of ['School openings https://example.com/news', 'https://']) {
    ui.$('#results-query').value = value;
    ui.$('#results-query').emit('input');
    assert.equal(ui.$('#results-search-button').disabled, true);
    assert.equal(ui.$('#results-query').getAttribute('aria-invalid'), 'true');
    assert.match(ui.$('#results-query').validityMessage, /Keep topics and links separate/);
    ui.$('#results-search-form').emit('submit');
  }
  assert.deepEqual(ui.searches, []);
  assert.equal(ui.$('#create-draft').disabled, false);
  assert.deepEqual(ui.changes.at(-1).selected, ['article-1']);
  ui.$('#results-query').value = 'City schools';
  ui.$('#results-query').emit('input');
  assert.equal(ui.$('#results-search-button').disabled, false);
  assert.equal(ui.$('#results-query').getAttribute('aria-invalid'), 'false');
  assert.equal(ui.$('#results-query').validityMessage, '');
  ui.$('#results-search-form').emit('submit');
  assert.deepEqual(ui.searches, [{ query: 'City schools', sourceProjectId: null }]);
});

test('results search accepts pasted URLs and keeps empty input disabled without reporting an error', t => {
  const ui = setup(t);
  ui.experience.show(topicProject());
  ui.$('#results-query').value = 'https://example.com/news';
  ui.$('#results-query').emit('input');
  assert.equal(ui.$('#results-search-button').disabled, false);
  ui.$('#results-search-form').emit('submit');
  assert.deepEqual(ui.searches, [{ query: 'https://example.com/news', sourceProjectId: null }]);
  ui.$('#results-query').value = '  ';
  ui.$('#results-query').emit('input');
  assert.equal(ui.$('#results-search-button').disabled, true);
  assert.equal(ui.$('#results-query').getAttribute('aria-invalid'), 'false');
  assert.equal(ui.$('#results-query').validityMessage, '');
  ui.$('#results-search-form').emit('submit');
  assert.equal(ui.searches.length, 1);
});


const workspaceProject = (overrides = {}) => ({
  id: 'workspace-project', kind: 'draft', searchQuery: 'Local school openings',
  sources: Array.from({ length: 8 }, (_, index) => ({
    type: 'text', title: `Story ${index + 1}`, searchQuery: 'Local school openings',
    searchArticleId: `article-${index + 1}`, selected: false, addedToCsa: false,
  })),
  ...overrides,
});

test('workspace search preserves search, filters, and Load More while keeping direction in New Draft', t => {
  const ui = setup(t);
  ui.experience.show(workspaceProject(), { workspace: true });
  assert.equal(ui.$('#search-results').parentElement, ui.$('#editor-canvas-content'));
  assert.equal(ui.$('#search-results').classList.contains('workspace-search-panel'), true);
  assert.equal(ui.$('#search-results').classList.contains('link-cards-panel'), false);
  for (const selector of ['.results-search-form', '.results-toolbar', '.results-sort', '#results-toggle-filters', '#load-more']) {
    assert.equal(ui.$(selector).hidden, false, selector);
  }
  assert.equal(ui.$('#results-back').hidden, true);
  assert.equal(ui.$('.results-actions').hidden, true);
  assert.equal(ui.$('.results-direction').hidden, true);
  assert.equal(ui.$('#results-query').value, 'Local school openings');
  assert.equal(ui.$('#results-source').value, 'The State');
  assert.equal(ui.$('#results-count').textContent, '5 stories found');
  assert.equal(ui.$('#result-list').children.length, 4);
  assert.match(ui.$('#result-list').textContent, /Local school openings/);
  assert.equal(ui.pending(), 0);
  assert.equal(ui.addition('article-1').hidden, true);
  ui.$('#load-more').emit('click');
  assert.equal(ui.$('#result-list').children.length, 5);
  ui.experience.hide();
  assert.equal(ui.$('#search-results').classList.contains('workspace-search-panel'), false);
  ui.experience.show(topicProject());
  assert.notEqual(ui.$('#search-results').parentElement, ui.$('#editor-canvas-content'));
  assert.equal(ui.$('.results-actions').hidden, false);
  assert.equal(ui.$('#results-back').hidden, false);
});

test('workspace selection follows matching source article IDs rather than source order or previous topic selections', t => {
  const ui = setup(t);
  const record = workspaceProject();
  record.sources[0].selected = true;
  record.sources[0].addedToCsa = true;
  record.sources[2].selected = true;
  record.sources.reverse();
  record.sources.push({ searchQuery: 'Different topic', searchArticleId: 'article-2', selected: true, addedToCsa: true });
  record.selectedArticleIds = ['article-4'];
  record.addedArticleIds = ['article-4'];
  ui.experience.show(record, { workspace: true });
  const selected = id => ui.$('#result-list').querySelector(`[data-article-id="${id}"] .result-select-button`).getAttribute('aria-checked');
  assert.equal(selected('article-1'), 'true');
  assert.equal(selected('article-2'), 'false');
  assert.equal(selected('article-3'), 'true');
  assert.equal(selected('article-4'), 'false');
  assert.equal(loading(ui.addition('article-1')), false);
  assert.equal(loading(ui.addition('article-3')), true);
  assert.equal(ui.pending(), 1);
  ui.tick(3000);
  assert.deepEqual(ui.changes.at(-1), { projectId: record.id, selected: ['article-3', 'article-1'], ready: ['article-1', 'article-3'] });
  assert.deepEqual(ui.selectionContexts.at(-1), { query: record.searchQuery, workspace: true });
  ui.select('article-2');
  assert.deepEqual(ui.selectionContexts.at(-1), { query: record.searchQuery, workspace: true });
});

test('workspace searches carry the current project ID and direction can sync without triggering an input loop', t => {
  const ui = setup(t);
  ui.experience.show(workspaceProject({ editorialDirection: 'Focus on students' }), { workspace: true });
  assert.equal(ui.$('#results-editorial-direction').value, 'Focus on students');
  ui.$('#results-query').value = 'School board decisions';
  ui.$('#results-search-form').emit('submit');
  assert.deepEqual(ui.searches, [{ query: 'School board decisions', sourceProjectId: null }]);
  assert.deepEqual(ui.workspaceSearches, ['workspace-project']);
  ui.experience.syncDirection('Include the opening date');
  assert.equal(ui.$('#results-editorial-direction').value, 'Include the opening date');
  assert.deepEqual(ui.directions, []);
  ui.$('#results-editorial-direction').value = 'Keep the local angle';
  ui.$('#results-editorial-direction').emit('input');
  assert.deepEqual(ui.directions, [{ projectId: 'workspace-project', value: 'Keep the local angle' }]);
  ui.experience.hide();
  ui.experience.syncDirection('Ignored after leaving');
  assert.equal(ui.$('#results-editorial-direction').value, 'Keep the local angle');
  ui.experience.show(topicProject());
  ui.$('#results-search-form').emit('submit');
  assert.equal(ui.workspaceSearches.at(-1), null);
});

test('refreshing sidebar selections preserves workspace filters and direction while reconciling addition timers', t => {
  const ui = setup(t);
  const record = workspaceProject({ editorialDirection: 'Local impact' });
  record.sources[5].selected = true;
  ui.experience.show(record, { workspace: true });
  assert.equal(ui.$('#results-filter-panel').hidden, false);
  ui.$('#results-sort').value = 'oldest';
  ui.$('#results-sort').emit('change');
  ui.$('#results-source').value = 'Culture Weekly';
  ui.$('#results-source').emit('change');
  ui.changeDates('2026-10-08');
  ui.$('#load-more').emit('click');
  ui.$('#results-query').value = 'An unfinished replacement query';
  ui.tick(1000);
  record.sources[5].selected = false;
  record.sources[7].selected = true;
  record.sources.reverse();
  assert.equal(ui.experience.refreshSources(record), true);
  assert.equal(ui.pending(), 1, 'cancel deselected article and start newly selected article');
  assert.equal(ui.$('#results-filter-panel').hidden, false);
  assert.equal(ui.$('#results-sort').value, 'oldest');
  assert.equal(ui.$('#results-source').value, 'Culture Weekly');
  assert.equal(ui.$('#results-after').value, '2026-10-08');
  assert.equal(ui.$('#results-query').value, 'An unfinished replacement query');
  assert.equal(ui.$('#results-editorial-direction').value, 'Local impact');
  assert.equal(ui.$('#results-count').textContent, '2 stories found');
  assert.equal(ui.$('#result-list').children[0].querySelector('.result-card').dataset.articleId, 'article-8');
  assert.equal(ui.addition('article-6').hidden, true);
  assert.equal(loading(ui.addition('article-8')), true);
  const beforeRefresh = ui.$('#result-list').children[0];
  assert.equal(ui.experience.refreshSources({ ...record, id: 'another-project' }), false);
  assert.equal(ui.experience.refreshSources({ ...record, searchQuery: 'Another topic' }), false);
  assert.equal(ui.$('#result-list').children[0], beforeRefresh, 'stale updates leave current cards untouched');
  ui.tick(2000);
  assert.deepEqual(ui.changes, []);
  ui.tick(1000);
  assert.deepEqual(ui.changes.at(-1), { projectId: record.id, selected: ['article-8'], ready: ['article-8'] });
});

test('refreshing workspace source readiness completes the visible loader without notifying selection or resetting loaded results', t => {
  const ui = setup(t);
  const record = workspaceProject();
  record.sources[0].selected = true;
  ui.experience.show(record, { workspace: true });
  ui.$('#results-reset-filters').emit('click');
  ui.$('#load-more').emit('click');
  record.sources[0].addedToCsa = true;
  assert.equal(ui.experience.refreshSources(record), true);
  assert.equal(ui.$('#result-list').children.length, 8);
  assert.equal(loading(ui.addition('article-1')), false);
  assert.equal(ui.pending(), 0);
  ui.tick(3000);
  assert.deepEqual(ui.changes, []);
  ui.experience.hide();
  assert.equal(ui.experience.refreshSources(record), false);
  ui.experience.show(project([link('source')]), { embedded: true });
  assert.equal(ui.experience.refreshSources(record), false);
});


test('source catalog displays full publication names, defaults to The State, and resets to all sources', t => {
  const ui = setup(t);
  ui.experience.show(topicProject());
  const options = ui.$('#results-source').options;
  assert.equal(options.length, 39);
  assert.equal(options[0].value, 'all');
  assert.equal(options.filter(option => option.value === 'The State').length, 1);
  for (const option of options.slice(1)) assert.equal(option.textContent, option.value, 'publication labels omit appended codes');
  for (const name of ['Bargain Hunter', 'Bellingham Herald', 'The News & Observer', "Woman's World", 'Culture Weekly', 'Spotlight']) {
    assert.equal(options.find(option => option.value === name)?.textContent, name);
  }
  assert.equal(ui.$('#results-source').value, 'The State');
  assert.equal(ui.$('#results-count').textContent, '5 stories found');
  assert.equal(ui.$('#results-toggle-filters').dataset.active, 'true');
  ui.$('#results-source').value = 'Bargain Hunter';
  ui.$('#results-source').emit('change');
  assert.equal(ui.$('#results-count').textContent, '0 stories found');
  assert.equal(ui.$('#results-empty').hidden, false);
  ui.$('#results-reset-filters').emit('click');
  assert.equal(ui.$('#results-count').textContent, '8 stories found');
  assert.equal(ui.$('#results-source').value, 'all');
  assert.equal(ui.$('#results-toggle-filters').dataset.active, 'false');
});

test('publication date ranges include both endpoints and combine with source filters', t => {
  const ui = setup(t);
  ui.experience.show(topicProject());
  ui.$('#results-reset-filters').emit('click');
  ui.changeDates('2026-10-08', '2026-10-10');
  assert.equal(ui.$('#results-count').textContent, '3 stories found');
  assert.equal(ui.$('#results-toggle-filters').dataset.active, 'true');
  ui.changeDates('2026-10-12', '2026-10-12');
  assert.equal(ui.$('#results-count').textContent, '4 stories found');
  ui.changeDates('2026-10-12');
  assert.equal(ui.$('#results-count').textContent, '4 stories found');
  ui.$('#results-source').value = 'Culture Weekly';
  ui.$('#results-source').emit('change');
  ui.changeDates('2026-10-08', '2026-10-09');
  assert.equal(ui.$('#results-count').textContent, '1 story found');
  assert.equal(ui.$('#result-list').children[0].querySelector('.result-card').dataset.articleId, 'article-8');
  ui.$('#results-reset-filters').emit('click');
  assert.equal(ui.$('#results-count').textContent, '8 stories found');
  assert.equal(ui.$('#results-after').value, '');
  assert.equal(ui.$('#results-before').value, '');
  assert.equal(ui.$('#results-toggle-filters').dataset.active, 'false');
});


test('topic filters start open, can close and reopen, and open again for a new query while link results keep them hidden', t => {
  const ui = setup(t);
  for (const [record, options] of [
    [topicProject(), {}],
    [topicProject({ sourceProjectId: 'original-project' }), { addingSources: true }],
    [workspaceProject(), { workspace: true }],
  ]) {
    ui.experience.show(record, options);
    assert.equal(ui.$('#results-filter-panel').hidden, false);
    assert.equal(ui.$('#results-toggle-filters').getAttribute('aria-expanded'), 'true');
    ui.$('#results-toggle-filters').emit('click');
    assert.equal(ui.$('#results-filter-panel').hidden, true);
    assert.equal(ui.$('#results-toggle-filters').getAttribute('aria-expanded'), 'false');
    ui.$('#results-toggle-filters').emit('click');
    assert.equal(ui.$('#results-filter-panel').hidden, false);
    assert.equal(ui.$('#results-toggle-filters').getAttribute('aria-expanded'), 'true');
    ui.$('#results-toggle-filters').emit('click');
    const next = options.workspace
      ? { ...record, searchQuery: 'Community gardens' }
      : { ...record, sources: [{ type: 'search', title: 'Community gardens' }] };
    ui.experience.show(next, options);
    assert.equal(ui.$('#results-filter-panel').hidden, false);
    assert.equal(ui.$('#results-toggle-filters').getAttribute('aria-expanded'), 'true');
  }
  for (const options of [{}, { embedded: true }]) {
    ui.experience.show({ ...project([link('source')]), kind: 'links' }, options);
    assert.equal(ui.$('#results-filter-panel').hidden, true);
    assert.equal(ui.$('#results-toggle-filters').hidden, true);
    assert.equal(ui.$('#results-toggle-filters').getAttribute('aria-expanded'), 'false');
    assert.equal(ui.$('#results-source').value, 'all');
  }
});


test('multiple publication filters include any selected publication and combine with date, sort, and existing story selections', t => {
  const ui = setup(t);
  const record = workspaceProject();
  ui.experience.show(record, { workspace: true });
  ui.select('article-1');
  ui.tick(3000);
  const source = ui.$('#results-source');
  for (const option of source.options) option.selected = ['Culture Weekly', 'Spotlight'].includes(option.value);
  source.emit('change');
  assert.equal(ui.$('#results-count').textContent, '3 stories found');
  assert.equal(ui.$('#results-toggle-filters').dataset.active, 'true');
  assert.equal(ui.$('#results-selection').textContent, '1 story selected', 'filter changes do not discard chosen stories');
  assert.deepEqual(ui.$('#result-list').children.map(item => item.querySelector('.result-card').dataset.articleId), ['article-6', 'article-7', 'article-8']);
  ui.changeDates('2026-10-08', '2026-10-09');
  ui.$('#results-sort').value = 'oldest';
  ui.$('#results-sort').emit('change');
  assert.deepEqual(ui.$('#result-list').children.map(item => item.querySelector('.result-card').dataset.articleId), ['article-8', 'article-7']);
  record.sources[0].selected = true;
  record.sources[0].addedToCsa = true;
  ui.experience.refreshSources(record);
  assert.deepEqual(source.options.filter(option => option.selected).map(option => option.value), ['Culture Weekly', 'Spotlight']);
  assert.equal(ui.$('#results-count').textContent, '2 stories found');
  ui.$('#results-reset-filters').emit('click');
  assert.deepEqual(source.options.filter(option => option.selected).map(option => option.value), ['all']);
  assert.equal(ui.$('#results-count').textContent, '8 stories found');
  assert.equal(ui.$('#results-toggle-filters').dataset.active, 'false');
  assert.equal(ui.$('#results-selection').textContent, '1 story selected');
});
