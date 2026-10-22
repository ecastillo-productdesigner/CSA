import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchExperience } from '../dist/search.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
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
  append(...children) {
    for (const child of children) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(entry => entry !== child);
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  dispatchEvent(event) { this.listeners.get(event.type)?.(event); return true; }
  emit(type, target = this) { this.listeners.get(type)?.({ target, preventDefault() {} }); }
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
  const previous = { document: globalThis.document, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const body = new Element('body');
  const nodes = new Map();
  const document = {
    activeElement: null,
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
  };
  globalThis.document = document;
  const timers = new Map();
  let now = 0;
  let sequence = 0;
  globalThis.setTimeout = (callback, delay) => {
    const id = ++sequence;
    timers.set(id, { callback, due: now + delay });
    return id;
  };
  globalThis.clearTimeout = id => timers.delete(id);
  t.after(() => { Object.assign(globalThis, previous); });
  const changes = [];
  const experience = createSearchExperience({
    onSearch() {}, onDirectionChange() {}, onDraft() {},
    onSelectionChange(projectId, selected, ready) { changes.push({ projectId, selected, ready }); },
  });
  const $ = selector => document.querySelector(selector);
  return {
    experience, changes, $, pending: () => timers.size,
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

test('fresh embedded links start the existing loader together and complete independently after three seconds', t => {
  const ui = setup(t);
  ui.experience.show(project([link('one'), link('two'), link('three')]), { embedded: true });
  assert.equal(ui.pending(), 3);
  for (const id of ['link-1', 'link-2', 'link-3']) {
    assert.equal(loading(ui.addition(id)), true);
    assert.match(ui.addition(id).textContent, /Adding to CSA/);
    assert.equal(ui.addition(id).getAttribute('aria-live'), 'polite');
    assert.equal(ui.addition(id).parentElement.querySelector('.result-add-button').getAttribute('aria-busy'), 'true');
  }
  ui.tick(2999);
  assert.equal(ui.changes.length, 0);
  ui.tick(1);
  assert.equal(ui.pending(), 0);
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
  ui.tick(1000);
  ui.select('link-2');
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
  ui.experience.hide();
  assert.equal(ui.pending(), 0);
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
