import test from 'node:test';
import assert from 'node:assert/strict';
import { getDraftOptions, populateDraftOptions } from '../dist/draft-options.js';
import { createToolDropdowns } from '../dist/tool-dropdowns.js';
import { createToolFavorites } from '../dist/tool-favorites.js';
import { createAudienceSuggestionLibrary } from '../dist/audience-suggestions.js?v=20261119-trend-hunter';
import { createProjectAudienceSuggestions } from '../dist/project-audience-suggestions.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this._value = undefined;
    this.classList = {
      add: name => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), name])].join(' '); },
      remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
    };
  }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) {
        child.parentElement.children = child.parentElement.children.filter(value => value !== child);
        // Moving an ancestor with append can blur a focused descendant in browsers.
        if (child.contains(globalThis.document?.activeElement)) globalThis.document.activeElement = null;
      }
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this._value = undefined; this.append(...children); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'style') this.style = {}; }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (part.startsWith('.')) return this.className.split(' ').includes(part.slice(1));
      if (part.startsWith('#')) return this.id === part.slice(1);
      return this.tagName === part;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(element) { return this === element || this.children.some(child => child.contains(element)); }
  addEventListener(type, callback) { const list = this.listeners.get(type) || []; list.push(callback); this.listeners.set(type, list); }
  removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) || []).filter(listener => listener !== callback)); }
  emit(type, detail = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...detail };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }
  dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event); return true; }
  focus() { document.activeElement = this; }
  getBoundingClientRect() {
    return this.className.split(' ').includes('tool-dropdown-menu')
      ? { top: 144, bottom: 444, left: 100, width: 360, height: 300 }
      : { top: 100, bottom: 136, left: 100, width: 360, height: 36 };
  }
  get options() { return this.tagName === 'select' ? this.children : undefined; }
  get value() { return this.tagName === 'select' && this.multiple ? this.children.find(option => option.selected)?.value || '' : this._value ?? (this.tagName === 'select' ? this.children[0]?.value || '' : ''); }
  set value(value) {
    this._value = value;
    if (this.tagName === 'select') for (const option of this.children) option._selected = option.value === value;
  }
  get selectedIndex() { return this.options.findIndex(option => option.value === this.value); }
  get selected() { return this.tagName === 'option' && (this.parentElement?.multiple ? Boolean(this._selected) : this.parentElement?.value === this.value); }
  set selected(value) { this._selected = Boolean(value); }
}

function setup(t, savedFavorites = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  const doc = new Element('document');
  doc.body = new Element('body');
  doc.documentElement = { clientWidth: 1000, clientHeight: 800 };
  doc.createElement = tag => new Element(tag);
  doc.createTextNode = text => Object.assign(new Element('#text'), { textContent: text });
  doc.activeElement = null;
  doc.append(doc.body);
  globalThis.document = doc;
  globalThis.window = new Element('window');
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => name === '--csa-component-drafting-audience-suggest-duration' ? '10000ms' : name.match(/-(\d+)$/)?.[1] || '0' });
  window.matchMedia = () => ({ matches: false });
  const records = new Map([['csa.tool-favorites.v1', JSON.stringify(savedFavorites)]]);
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const favoritesStore = createToolFavorites({ storage: () => storage });
  const controllers = [];
  const animations = [];
  const notices = [];
  function createSuggestionAnimation({ compact = false } = {}) {
    const element = new Element();
    element.className = 'drafting-animation';
    element.textContent = 'Suggesting Audiences';
    element.dataset.compact = String(compact);
    const animation = { element, destroyed: false, destroy() { this.destroyed = true; } };
    animations.push(animation);
    return animation;
  }
  function dropdowns(options = {}) {
    const controller = createToolDropdowns({ favoritesStore, createSuggestionAnimation, notify: message => notices.push(message), ...options });
    controllers.push(controller);
    return controller;
  }
  t.after(() => {
    for (const controller of controllers) controller.destroy();
    Object.assign(globalThis, previous);
  });
  function field(label, value = '', parent = doc.body, prefix = 'composer-') {
    const field = new Element();
    field.className = 'composer-field';
    field.dataset.label = label;
    field.dataset.fixedValue = value || 'old-fixed-value';
    const select = new Element('select');
    select.id = `${prefix}${label.toLowerCase()}`;
    const option = new Element('option');
    option.value = value;
    option.textContent = 'Old option';
    select.append(option);
    select.value = value;
    const fieldLabel = new Element('label');
    fieldLabel.className = 'composer-field-label';
    fieldLabel.textContent = label;
    fieldLabel.setAttribute('for', `${select.id}-trigger`);
    field.append(fieldLabel, select);
    parent.append(field);
    return { field, select };
  }
  return { doc, field, dropdowns, favoritesStore, storage, animations, notices, async advance(milliseconds = 10000) { t.mock.timers.tick(milliseconds); await flush(); } };
}


const choices = [
  { value: 'suggested-local-explorers', label: 'Local Explorers' },
  { value: 'suggested-culture-followers', label: 'Culture Followers' },
  { value: 'suggested-community-readers', label: 'Community Readers' },
];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };

function suggestionFixture(t, { available = true, withProvider = true } = {}) {
  const ui = setup(t);
  const audience = ui.field('Audience');
  audience.field.dataset.placeholder = 'None Selected';
  const format = ui.field('Format');
  populateDraftOptions();
  let context = { key: 'project-a:sources-a', available, suggestions: [] };
  let remembered = [];
  const requests = [];
  const provider = {
    getContext: () => context,
    getOptions: () => remembered,
    generate() {
      const request = deferred();
      const sourceKey = context.key;
      requests.push(request);
      return request.promise.then(result => {
        if (context.key === sourceKey) {
          context = { ...context, suggestions: result };
          remembered = [...new Map([...remembered, ...result].map(choice => [choice.value, choice])).values()];
        }
        return result;
      });
    },
  };
  const controller = ui.dropdowns(withProvider ? { audienceSuggestions: provider } : {});
  const trigger = audience.field.querySelector('.tool-dropdown-trigger');
  const menu = audience.field.querySelector('.tool-dropdown-menu');
  const tabs = () => menu.querySelector('.output-status-tabs');
  const tab = name => tabs().querySelectorAll('button').find(button => button.getAttribute('aria-label') === name);
  const show = name => tabs().emit('click', { target: tab(name) });
  const view = () => menu.querySelector('.audience-suggestion-view');
  const suggestedRows = () => view().querySelectorAll('.tool-dropdown-row');
  const generatedRows = () => suggestedRows().filter(row => row.querySelector('.tool-dropdown-option').textContent !== 'None Selected');
  const action = () => view().querySelector('.audience-suggestion-action');
  const allList = () => menu.querySelector('.tool-dropdown-list');
  return {
    ...ui, audience, format, controller, trigger, menu, tabs, tab, show, view,
    suggestedRows, generatedRows, action, allList, requests,
    setContext(next) { context = { ...context, ...next }; },
  };
}

function assertSuggestionReady(ui, ready) {
  assert.equal(ui.trigger.dataset.suggestionsReady, String(ready));
  const fieldLabel = ui.audience.field.querySelector('.composer-field-label');
  const dot = fieldLabel.querySelector('.audience-ready-dot');
  assert.ok(dot, 'Audience label has a ready notification dot');
  assert.equal(dot.parentElement, fieldLabel);
  assert.equal(fieldLabel.textContent, 'Audience');
  assert.equal(fieldLabel.getAttribute('for'), ui.trigger.id);
  assert.equal(ui.trigger.querySelector('.audience-ready-dot'), null, 'The field border has no dot');
  assert.equal(dot.tagName, 'span');
  assert.equal(dot.hidden, !ready);
  if (ready) {
    assert.equal(ui.trigger.children[0].textContent, 'Audience Generation Ready to Review');
    assert.equal(ui.trigger.getAttribute('aria-label'), 'Audience: Audience Generation Ready to Review');
  }
}

test('Audience without a suggestions provider retains its existing dropdown', t => {
  const ui = suggestionFixture(t, { withProvider: false });
  assert.equal(ui.menu.querySelector('.output-status-tabs'), null);
  assert.equal(ui.audience.field.querySelector('.audience-ready-dot'), null);
  ui.trigger.emit('click');
  assert.equal(ui.menu.querySelectorAll('.tool-dropdown-option').length, 5);
});

test('suggestions stay scoped to Audience and require sources', async t => {
  const ui = suggestionFixture(t, { available: false });
  assert.deepEqual(ui.tabs().querySelectorAll('button').map(button => button.getAttribute('aria-label')), ['Audiences', 'Suggested']);
  assert.equal(ui.format.field.querySelector('.output-status-tabs'), null);
  const suggestedTab = ui.tab('Suggested');
  const icon = suggestedTab.querySelector('.material-symbols-outlined');
  assert.equal(suggestedTab.children[0], icon);
  assert.equal(icon.textContent, 'wand_stars');
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.equal(suggestedTab.getAttribute('aria-selected'), 'false');
  ui.trigger.emit('click');
  ui.show('Suggested');
  assert.equal(ui.generatedRows().length, 0);
  assert.equal(ui.action().textContent, 'Suggest Audiences');
  assert.equal(ui.action().disabled, true);
  assert.match(ui.view().querySelector('.saved-drafts-empty').textContent, /source/i);
  ui.action().emit('click');
  await ui.advance();
  assert.equal(ui.requests.length, 0);
  ui.setContext({ key: 'project-a:sources-b', available: true });
  ui.controller.refresh();
  assert.equal(ui.action().disabled, false);
});

test('explicit generation yields three selectable audiences and retains the native change and reset paths', async t => {
  const ui = suggestionFixture(t);
  let changes = 0;
  ui.audience.select.addEventListener('change', () => { changes++; });
  ui.trigger.emit('click');
  ui.show('Suggested');
  assert.equal(ui.tab('Suggested').getAttribute('aria-selected'), 'true');
  assert.equal(ui.view().querySelector('.saved-drafts-empty').textContent, 'Suggest audiences based on your project sources.');
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.generatedRows().length, 0);
  ui.action().focus();
  ui.action().emit('click');
  await ui.advance();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.action().disabled, true);
  ui.action().emit('click');
  await ui.advance();
  assert.equal(ui.requests.length, 1);
  ui.requests[0].resolve(choices);
  await flush();
  assert.deepEqual(ui.generatedRows().map(row => row.querySelector('.tool-dropdown-option').textContent), choices.map(choice => choice.label));
  assert.equal(ui.view().querySelector('.saved-drafts-empty').hidden, true);
  assert.equal(ui.view().querySelector('.saved-drafts-empty').textContent, '');
  assert.equal(ui.action().parentElement.hidden, true);
  assert.equal(ui.action().disabled, true);
  assert.equal(document.activeElement, ui.generatedRows()[0].querySelector('.tool-dropdown-option'));
  ui.action().emit('click');
  await ui.advance();
  assert.equal(ui.requests.length, 1);
  for (const choice of choices) assert.ok([...ui.audience.select.options].some(option => option.value === choice.value));
  ui.generatedRows()[1].querySelector('.tool-dropdown-option').emit('click');
  assert.equal(ui.audience.select.value, choices[1].value);
  assert.equal(changes, 1);
  assert.equal(ui.trigger.getAttribute('aria-label'), 'Audience: Culture Followers');
  assert.equal(ui.menu.hidden, true);
  ui.trigger.emit('click');
  assert.equal(ui.tab('Suggested').getAttribute('aria-selected'), 'true');
  ui.suggestedRows().find(row => row.querySelector('.tool-dropdown-option').textContent === 'None Selected').querySelector('.tool-dropdown-option').emit('click');
  assert.equal(ui.audience.select.value, '');
  assert.equal(changes, 2);
  assert.equal(ui.trigger.getAttribute('aria-label'), 'Audience: None Selected');
});

test('generated audience favorites appear in both tabs and remain on reopening', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance();
  ui.requests[0].resolve(choices);
  await flush();
  const favorite = ui.generatedRows()[2].querySelector('.tool-option-favorite');
  favorite.emit('click');
  assert.equal(ui.generatedRows()[0].querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.generatedRows()[0].querySelector('.tool-dropdown-option').textContent, choices[2].label);
  assert.deepEqual(ui.favoritesStore.values('audience'), [choices[2].value]);
  const pinned = ui.view().querySelectorAll('.audience-suggestion-group')[0];
  assert.equal(pinned.getAttribute('aria-label'), 'Favorite audiences');
  assert.equal(pinned.querySelector('.audience-generation-header'), null);
  assert.equal(pinned.querySelector('.audience-generation-source-link'), null);
  ui.show('Audiences');
  const labels = ui.allList().querySelectorAll('.tool-dropdown-option').map(button => button.textContent);
  assert.equal(labels.length, 6);
  assert.equal(labels[0], 'None Selected');
  assert.equal(labels[1], choices[2].label);
  for (const choice of choices.slice(0, 2)) assert.ok(!labels.includes(choice.label));
  ui.show('Suggested');
  ui.menu.emit('keydown', { key: 'Escape' });
  ui.trigger.emit('click');
  assert.equal(ui.tab('Suggested').getAttribute('aria-selected'), 'true');
  assert.equal(ui.generatedRows().length, 3);
  assert.equal(ui.generatedRows()[0].querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.requests.length, 1);
});

test('a completed request never reopens a dismissed menu or steals focus', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance();
  const outside = new Element('button');
  ui.doc.body.append(outside);
  ui.doc.emit('pointerdown', { target: outside });
  outside.focus();
  assert.equal(ui.menu.hidden, true);
  ui.requests[0].resolve(choices);
  await flush();
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, outside);
  assertSuggestionReady(ui, true);
  ui.trigger.emit('click');
  assertSuggestionReady(ui, false);
  assert.equal(ui.generatedRows().length, 3);
  assert.equal(ui.requests.length, 1);
});

test('changing source context while open discards stale completion and permits a new request', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance();
  ui.setContext({ key: 'project-b:sources-new', suggestions: [] });
  ui.controller.refresh();
  assert.equal(ui.action().disabled, false);
  ui.action().emit('click');
  await ui.advance();
  assert.equal(ui.requests.length, 2);
  ui.requests[0].resolve(choices);
  await flush();
  assert.equal(ui.generatedRows().length, 0);
  assert.equal(ui.action().disabled, true);
  const replacement = choices.map(choice => ({ value: `${choice.value}-new`, label: `New ${choice.label}` }));
  ui.requests[1].resolve(replacement);
  await flush();
  assert.deepEqual(ui.generatedRows().map(row => row.querySelector('.tool-dropdown-option').textContent), replacement.map(choice => choice.label));
  assert.equal(ui.action().disabled, true);
  ui.generatedRows()[0].querySelector('.tool-dropdown-option').focus();
  ui.setContext({ key: 'project-c:other-sources', suggestions: [] });
  ui.controller.refresh();
  assert.equal(ui.generatedRows().length, 0);
  assert.equal(document.activeElement, ui.tab('Suggested'));
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.view().querySelector('.saved-drafts-empty').hidden, false);
  assert.equal(ui.action().parentElement.hidden, false);
  assert.equal(ui.action().disabled, false);
});

test('failed generation presents an alert and can be retried without changing the selected audience', async t => {
  const ui = suggestionFixture(t);
  ui.audience.select.value = 'general';
  ui.audience.select.dispatchEvent(new Event('change'));
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance();
  ui.requests[0].reject(new Error('Offline'));
  await flush();
  const error = ui.view().querySelector('.form-error');
  assert.equal(error.hidden, false);
  assert.equal(error.getAttribute('role'), 'alert');
  assert.ok(error.textContent.length > 0);
  assert.equal(ui.action().textContent, 'Try Again');
  assert.equal(ui.action().parentElement.hidden, false);
  assert.equal(ui.action().disabled, false);
  assert.equal(ui.audience.select.value, 'general');
  ui.action().emit('click');
  await ui.advance();
  ui.requests[1].resolve(choices);
  await flush();
  assert.equal(error.hidden, true);
  assert.equal(ui.action().parentElement.hidden, true);
  assert.equal(ui.generatedRows().length, 3);
  assert.equal(ui.audience.select.value, 'general');
});

test('tab, row, heart, and action keyboard navigation stays within the active pane until dismissal', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  const all = ui.tab('Audiences');
  const suggested = ui.tab('Suggested');
  all.focus();
  ui.tabs().emit('keydown', { target: all, key: 'End' });
  assert.equal(document.activeElement, suggested);
  assert.equal(suggested.getAttribute('aria-selected'), 'true');
  ui.menu.emit('keydown', { target: suggested, key: 'Tab' });
  assert.equal(ui.menu.hidden, false);
  ui.action().emit('click');
  await ui.advance();
  ui.requests[0].resolve(choices);
  await flush();
  const first = ui.suggestedRows()[0].querySelector('.tool-dropdown-option');
  suggested.focus();
  ui.menu.emit('keydown', { target: suggested, key: 'ArrowDown' });
  assert.equal(document.activeElement, first);
  ui.menu.emit('keydown', { key: 'End' });
  const last = ui.generatedRows().at(-1);
  assert.equal(document.activeElement, last.querySelector('.tool-dropdown-option'));
  ui.menu.emit('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, last.querySelector('.tool-option-favorite'));
  ui.menu.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, last.querySelector('.tool-dropdown-option'));
  ui.menu.emit('keydown', { key: 'Home' });
  assert.equal(document.activeElement, first);
  ui.menu.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(ui.menu.hidden, false);
  last.querySelector('.tool-option-favorite').focus();
  ui.menu.emit('keydown', { key: 'Tab' });
  assert.equal(ui.menu.hidden, true);
  ui.trigger.emit('click');
  ui.tab('Suggested').focus();
  ui.menu.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(ui.menu.hidden, true);
  ui.trigger.emit('click');
  ui.menu.emit('keydown', { key: 'Escape' });
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.trigger);
});


test('ten-second animation continues in the closed trigger and completes with one toast', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().focus();
  ui.action().emit('click');
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.view().getAttribute('aria-busy'), 'true');
  assert.equal(ui.view().querySelector('.audience-suggestion-loading').hidden, false);
  assert.equal(ui.action().parentElement.hidden, true);
  assert.equal(ui.trigger.dataset.suggesting, 'false');
  assert.equal(document.activeElement, ui.tab('Suggested'));
  assert.equal(ui.animations.length, 2);
  await ui.advance(2000);
  ui.menu.emit('keydown', { key: 'Escape' });
  assert.equal(ui.trigger.dataset.suggesting, 'true');
  assert.equal(ui.trigger.getAttribute('aria-label'), 'Audience: Suggesting Audiences');
  assert.equal(ui.animations[1].element.hidden, false);
  await ui.advance(2000);
  ui.trigger.emit('click');
  assert.equal(ui.animations.length, 2, 'reopening keeps the same animation instances');
  assert.equal(ui.trigger.dataset.suggesting, 'false');
  ui.menu.emit('keydown', { key: 'Escape' });
  await ui.advance(5999);
  assert.equal(ui.requests.length, 0);
  assert.deepEqual(ui.notices, []);
  await ui.advance(1);
  assert.equal(ui.requests.length, 1, 'generation starts at the original ten-second deadline');
  ui.requests[0].resolve(choices);
  await flush();
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.trigger.dataset.suggesting, 'false');
  assert.equal(ui.trigger.getAttribute('aria-busy'), 'false');
  assertSuggestionReady(ui, true);
  assert.ok(ui.animations.every(animation => animation.destroyed));
  assert.deepEqual(ui.notices, ['Suggested audiences are ready']);
  ui.trigger.emit('click');
  assertSuggestionReady(ui, false);
  assert.equal(ui.trigger.getAttribute('aria-label'), 'Audience: None Selected');
  assert.equal(ui.generatedRows().length, 3);
  assert.deepEqual(ui.notices, ['Suggested audiences are ready']);
});

test('ready audiences preserve the selected value until keyboard opening acknowledges the Suggested tab', async t => {
  const ui = suggestionFixture(t);
  ui.audience.select.value = 'general';
  ui.audience.select.dispatchEvent(new Event('change'));
  const selectedLabel = [...ui.audience.select.options].find(option => option.value === 'general').textContent;
  let changes = 0;
  ui.audience.select.addEventListener('change', () => { changes++; });
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  ui.show('Audiences');
  ui.menu.emit('keydown', { key: 'Escape' });
  await ui.advance();
  ui.requests[0].resolve(choices);
  await flush();
  assertSuggestionReady(ui, true);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.audience.select.value, 'general');
  assert.equal(changes, 0);
  assert.deepEqual(ui.notices, ['Suggested audiences are ready']);

  ui.controller.refresh();
  ui.favoritesStore.toggle('audience', 'general');
  assertSuggestionReady(ui, true);
  const event = ui.trigger.emit('keydown', { key: 'ArrowDown' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.tab('Suggested').getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, ui.tab('Suggested'));
  assert.equal(ui.generatedRows().length, 3);
  assertSuggestionReady(ui, false);
  assert.equal(ui.trigger.children[0].textContent, selectedLabel);
  assert.equal(ui.trigger.getAttribute('aria-label'), `Audience: ${selectedLabel}`);
  assert.equal(ui.audience.select.value, 'general');
  assert.equal(changes, 0);

  ui.menu.emit('keydown', { key: 'Escape' });
  ui.controller.refresh();
  assertSuggestionReady(ui, false);
  assert.equal(ui.trigger.children[0].textContent, selectedLabel);
  assert.deepEqual(ui.notices, ['Suggested audiences are ready']);
});

for (const tab of ['Suggested', 'Audiences']) {
  test(`completion while ${tab} is open never creates a ready notification`, async t => {
    const ui = suggestionFixture(t);
    ui.trigger.emit('click');
    ui.show('Suggested');
    ui.action().emit('click');
    ui.show(tab);
    await ui.advance();
    ui.requests[0].resolve(choices);
    await flush();
    assertSuggestionReady(ui, false);
    assert.equal(ui.tab(tab).getAttribute('aria-selected'), 'true');
    assert.equal(ui.trigger.children[0].textContent, 'None Selected');
    assert.deepEqual(ui.notices, ['Suggested audiences are ready']);
    ui.menu.emit('keydown', { key: 'Escape' });
    assertSuggestionReady(ui, false);
  });
}

for (const reason of ['context changes', 'sources become unavailable', 'controller is destroyed']) {
  test(`pending audience notification clears when ${reason}`, async t => {
    const ui = suggestionFixture(t);
    ui.trigger.emit('click');
    ui.show('Suggested');
    ui.action().emit('click');
    ui.menu.emit('keydown', { key: 'Escape' });
    await ui.advance();
    ui.requests[0].resolve(choices);
    await flush();
    assertSuggestionReady(ui, true);
    if (reason === 'controller is destroyed') ui.controller.destroy();
    else {
      ui.setContext(reason === 'context changes'
        ? { key: 'project-b:other-sources', suggestions: [] }
        : { available: false });
      ui.controller.refresh();
    }
    assertSuggestionReady(ui, false);
    assert.equal(ui.trigger.children[0].textContent, 'None Selected');
    assert.equal(ui.trigger.getAttribute('aria-label'), 'Audience: None Selected');
    assert.equal(ui.audience.select.value, '');
    assert.deepEqual(ui.notices, ['Suggested audiences are ready']);
  });
}

test('a stale closed completion cannot mark a different source context ready', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance();
  ui.menu.emit('keydown', { key: 'Escape' });
  ui.setContext({ key: 'project-b:other-sources', suggestions: [] });
  ui.requests[0].resolve(choices);
  await flush();
  assertSuggestionReady(ui, false);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.trigger.children[0].textContent, 'None Selected');
  assert.equal(ui.audience.select.value, '');
  assert.equal(ui.generatedRows().length, 0);
  assert.deepEqual(ui.notices, []);
});

for (const failure of ['rejected request', 'incomplete results']) {
  test(`closed audience generation with ${failure} never marks results ready`, async t => {
    const ui = suggestionFixture(t);
    ui.audience.select.value = 'general';
    ui.audience.select.dispatchEvent(new Event('change'));
    const selectedLabel = ui.trigger.children[0].textContent;
    ui.trigger.emit('click');
    ui.show('Suggested');
    ui.action().emit('click');
    ui.menu.emit('keydown', { key: 'Escape' });
    await ui.advance();
    if (failure === 'rejected request') ui.requests[0].reject(new Error('Offline'));
    else ui.requests[0].resolve(choices.slice(0, 2));
    await flush();
    assertSuggestionReady(ui, false);
    assert.equal(ui.trigger.getAttribute('aria-busy'), 'false');
    assert.equal(ui.trigger.children[0].textContent, selectedLabel);
    assert.equal(ui.menu.hidden, true);
    assert.equal(ui.audience.select.value, 'general');
    assert.deepEqual(ui.notices, []);
  });
}

test('context changes and destruction cancel loading without a stale toast or generation', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance(1000);
  ui.setContext({ key: 'other-project' });
  ui.controller.refresh();
  await ui.advance(9000);
  assert.equal(ui.requests.length, 0);
  assert.deepEqual(ui.notices, []);
  assert.equal(ui.view().getAttribute('aria-busy'), 'false');
  assert.ok(ui.animations.every(animation => animation.destroyed));
  ui.action().emit('click');
  ui.controller.destroy();
  await ui.advance();
  assert.equal(ui.requests.length, 0);
  assert.deepEqual(ui.notices, []);
});

test('a context that becomes unavailable during loading cannot generate or toast', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  ui.setContext({ available: false });
  await ui.advance();
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.view().getAttribute('aria-busy'), 'false');
  assert.deepEqual(ui.notices, []);
});


test('a request rejected after the project becomes unavailable cancels without an error or toast', async t => {
  const ui = suggestionFixture(t);
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.action().emit('click');
  await ui.advance();
  ui.setContext({ available: false });
  ui.requests[0].reject(new Error('The project sources changed'));
  await flush();
  assert.equal(ui.view().getAttribute('aria-busy'), 'false');
  assert.equal(ui.view().querySelector('.form-error').hidden, true);
  assert.deepEqual(ui.notices, []);
});


function generation(id, key, titles, suggestions = choices) {
  return { id, key, sources: titles.map(title => ({ title })), suggestions };
}

test('suggested audiences retain source groups, one reset row, and duplicate audience identities', t => {
  const ui = suggestionFixture(t);
  const older = generation('old', 'project-a:first-source', ['First source']);
  const current = generation('current', 'project-a:sources-a', ['Second source', 'Third source']);
  ui.setContext({ groups: [older, current], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  const groups = ui.view().querySelectorAll('.audience-suggestion-group');
  assert.deepEqual(groups.map(group => group.dataset.generation), ['current', 'old']);
  for (const group of groups) {
    assert.equal(group.getAttribute('role'), 'group');
    assert.equal(group.getAttribute('aria-label'), 'Suggested audiences');
    assert.equal(group.getAttribute('aria-labelledby'), undefined);
    assert.equal(group.querySelector('.audience-generation-header'), null);
    assert.equal(group.querySelector('.audience-generation-current'), null);
    assert.equal(group.querySelector('.audience-generation-source-link'), null);
  }
  assert.equal(ui.suggestedRows().length, 7, 'one reset plus two groups of three choices');
  assert.equal(new Set([...ui.audience.select.options].map(option => option.value)).size, ui.audience.select.options.length);
  assert.equal(ui.action().parentElement.hidden, true);
  const row = groups[1].querySelector('.tool-dropdown-row');
  assert.equal(row.querySelector('.tool-dropdown-option').getAttribute('aria-describedby'), undefined);
  assert.equal(row.querySelector('.tool-option-favorite').getAttribute('aria-describedby'), undefined);
  row.querySelector('.tool-dropdown-option').emit('click');
  assert.equal(ui.audience.select.value, choices[0].value);
});

test('new source selections retain historical choices while offering a new generation', t => {
  const ui = suggestionFixture(t);
  ui.setContext({ groups: [generation('old', 'project-a:old-sources', ['Original source'])] });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  assert.equal(ui.generatedRows().length, 3);
  assert.equal(ui.action().disabled, false);
  assert.equal(ui.action().parentElement.hidden, false);
  assert.equal(ui.view().querySelector('.saved-drafts-empty').textContent, 'Suggest audiences for your current source selection.');
});

test('Audiences includes favorited persisted suggestions and excludes other history without losing the selected value', t => {
  const ui = suggestionFixture(t);
  const persisted = document.createElement('option');
  persisted.value = 'suggested-audience:previous%20project';
  persisted.textContent = 'Previous Project';
  ui.audience.select.append(persisted);
  ui.audience.select.value = persisted.value;
  ui.favoritesStore.toggle('audience', persisted.value);
  ui.setContext({ groups: [generation('first', 'project-a:first', ['First source'])] });
  ui.controller.refresh();
  const originalOptions = ui.audience.select.options.length;
  ui.setContext({ groups: [generation('second', 'project-a:second', ['Second source', 'Third source'])] });
  ui.controller.refresh();
  assert.equal(ui.audience.select.options.length, originalOptions);
  assert.equal(ui.audience.select.value, persisted.value);
  ui.trigger.emit('click');
  const labels = ui.allList().querySelectorAll('.tool-dropdown-option').map(button => button.textContent);
  assert.equal(labels.length, 6);
  assert.equal(labels[1], persisted.textContent);
  for (const choice of choices) assert.ok(!labels.includes(choice.label));
  const general = ui.allList().querySelectorAll('.tool-dropdown-row')[2];
  general.querySelector('.tool-option-favorite').emit('click');
  assert.equal(ui.allList().querySelectorAll('.tool-dropdown-row')[1], general);
});

test('hearting a suggested audience adds one favorite to Audiences and unhearting preserves the selected value', t => {
  const ui = suggestionFixture(t);
  ui.setContext({ groups: [generation('current', 'project-a:sources-a', ['Current source']),
    generation('older', 'project-a:older-sources', ['Earlier source'])], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  let changes = 0;
  ui.audience.select.addEventListener('change', () => { changes++; });
  const suggested = ui.generatedRows().find(row => row.querySelector('.tool-dropdown-option').textContent === choices[1].label);
  suggested.querySelector('.tool-option-favorite').emit('click');
  assert.equal(ui.audience.select.value, '', 'hearting does not select the audience');
  assert.equal(changes, 0);
  ui.show('Audiences');
  const rows = () => ui.allList().querySelectorAll('.tool-dropdown-row');
  assert.equal(rows().length, 6, 'duplicate generation identities produce one catalog choice');
  const saved = rows()[1];
  assert.equal(saved.querySelector('.tool-dropdown-option').textContent, choices[1].label);
  assert.equal(saved.querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  assert.equal(rows()[0].querySelector('.tool-dropdown-option').textContent, 'None Selected');
  saved.querySelector('.tool-dropdown-option').emit('click');
  assert.equal(ui.audience.select.value, choices[1].value);
  assert.equal(changes, 1);
  ui.trigger.emit('click');
  const heart = rows()[1].querySelector('.tool-option-favorite');
  heart.focus();
  heart.emit('click');
  assert.equal(rows().length, 5);
  assert.ok(!rows().some(row => row.querySelector('.tool-dropdown-option').textContent === choices[1].label));
  assert.equal(ui.audience.select.value, choices[1].value);
  assert.equal(ui.trigger.children[0].textContent, choices[1].label);
  assert.ok([...ui.audience.select.options].some(option => option.value === choices[1].value));
  assert.equal(changes, 1, 'removing a heart preserves the draft audience');
  assert.equal(document.activeElement, ui.tab('Audiences'), 'focus stays in the menu after the row disappears');
  ui.show('Suggested');
  const restored = ui.generatedRows().filter(row => row.querySelector('.tool-dropdown-option').textContent === choices[1].label);
  assert.equal(restored.length, 2, 'unhearting keeps the source history');
  assert.ok(restored.every(row => row.querySelector('.tool-option-favorite').getAttribute('aria-pressed') === 'false'));
});

test('hearted suggested audiences restore in Audiences on a new visit and project without source history', async t => {
  const ui = setup(t);
  const library = createAudienceSuggestionLibrary({ storage: () => ui.storage });
  const originalProject = { id: 'original-project', sources: [{ title: 'Local community garden plans' }] };
  const provider = createProjectAudienceSuggestions({ getProject: () => originalProject, library });
  const generated = await provider.generate();
  const original = ui.field('Audience');
  populateDraftOptions(original.field, { library });
  const controller = ui.dropdowns({ audienceSuggestions: provider });
  const originalMenu = original.field.querySelector('.tool-dropdown-menu');
  original.field.querySelector('.tool-dropdown-trigger').emit('click');
  const tabs = originalMenu.querySelector('.output-status-tabs');
  tabs.emit('click', { target: tabs.querySelectorAll('button').find(button => button.getAttribute('aria-label') === 'Suggested') });
  const favorite = originalMenu.querySelector('.audience-suggestion-view').querySelectorAll('.tool-dropdown-row')
    .find(row => row.querySelector('.tool-dropdown-option').textContent === generated[0].label);
  favorite.querySelector('.tool-option-favorite').emit('click');
  controller.destroy();
  original.field.remove();

  const restoredLibrary = createAudienceSuggestionLibrary({ storage: () => ui.storage });
  const restoredFavorites = createToolFavorites({ storage: () => ui.storage });
  const newProject = { id: 'new-project', sources: [] };
  const restoredProvider = createProjectAudienceSuggestions({ getProject: () => newProject, library: restoredLibrary });
  const restored = ui.field('Audience');
  populateDraftOptions(restored.field, { library: restoredLibrary });
  ui.dropdowns({ audienceSuggestions: restoredProvider, favoritesStore: restoredFavorites });
  const restoredMenu = restored.field.querySelector('.tool-dropdown-menu');
  restored.field.querySelector('.tool-dropdown-trigger').emit('click');
  const allRows = restoredMenu.querySelector('.tool-dropdown-list').querySelectorAll('.tool-dropdown-row');
  assert.equal(restoredProvider.getContext().available, false);
  assert.deepEqual(restoredProvider.getContext().groups, []);
  assert.deepEqual(restoredFavorites.values('audience'), [generated[0].value]);
  assert.equal(allRows.length, 6);
  assert.equal(allRows[1].querySelector('.tool-dropdown-option').textContent, generated[0].label);
  assert.equal(allRows[1].querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  for (const choice of generated.slice(1)) {
    assert.ok(!allRows.some(row => row.querySelector('.tool-dropdown-option').textContent === choice.label));
  }
  allRows[1].querySelector('.tool-dropdown-option').emit('click');
  assert.equal(restored.select.value, generated[0].value);
  assert.equal(restored.field.querySelector('.tool-dropdown-trigger').children[0].textContent, generated[0].label);
});


test('focus stays within the same generation when repeated audience rows are rebuilt', t => {
  const ui = suggestionFixture(t);
  const old = generation('old', 'old-key', ['Original source']);
  const recent = generation('recent', 'recent-key', ['Recent source']);
  ui.setContext({ key: 'recent-key', groups: [recent, old], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  const oldSection = ui.view().querySelectorAll('.audience-suggestion-group').find(group => group.dataset.generation === 'old');
  oldSection.querySelector('.tool-option-favorite').focus();
  ui.setContext({ key: 'old-key' });
  ui.controller.refresh();
  const updatedOld = ui.view().querySelectorAll('.audience-suggestion-group').find(group => group.dataset.generation === 'old');
  assert.equal(document.activeElement, updatedOld.querySelector('.tool-option-favorite'));
});


test('the new-generation action precedes retained groups in visual and keyboard order', t => {
  const ui = suggestionFixture(t);
  ui.setContext({ groups: [generation('old', 'old-key', ['Original source'])] });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  const children = ui.view().children;
  assert.ok(children.indexOf(ui.action().parentElement) < children.indexOf(ui.view().querySelector('.tool-dropdown-list')));
  const tab = ui.tab('Suggested');
  tab.focus();
  ui.menu.emit('keydown', { target: tab, key: 'ArrowDown' });
  assert.equal(document.activeElement, ui.action());
  ui.menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, ui.suggestedRows()[0].querySelector('.tool-dropdown-option'));
  ui.menu.emit('keydown', { key: 'ArrowUp' });
  assert.equal(document.activeElement, ui.action());
  ui.menu.emit('keydown', { key: 'End' });
  assert.equal(document.activeElement, ui.generatedRows().at(-1).querySelector('.tool-dropdown-option'));
  ui.generatedRows().at(-1).querySelector('.tool-option-favorite').focus();
  ui.menu.emit('keydown', { key: 'Tab' });
  assert.equal(ui.menu.hidden, true);
});


test('favorites rise above source groups without headings and retain ordering and focus', t => {
  const ui = suggestionFixture(t);
  const olderChoices = choices.map(choice => ({ value: `old-${choice.value}`, label: `Old ${choice.label}` }));
  ui.setContext({ groups: [generation('current', 'project-a:sources-a', ['Current source']), generation('older', 'older-key', ['Earlier source', 'Another source'], olderChoices)], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  const labels = () => ui.generatedRows().map(row => row.querySelector('.tool-dropdown-option').textContent);
  const heart = label => ui.generatedRows().find(row => row.querySelector('.tool-dropdown-option').textContent === label).querySelector('.tool-option-favorite');
  heart(olderChoices[2].label).focus();
  heart(olderChoices[2].label).emit('click');
  assert.equal(labels()[0], olderChoices[2].label, 'an older favorite precedes the current group');
  assert.equal(document.activeElement, heart(olderChoices[2].label));
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.audience.select.value, '', 'favoriting does not select an audience');
  heart(choices[1].label).focus();
  heart(choices[1].label).emit('click');
  assert.deepEqual(labels(), [choices[1].label, olderChoices[2].label, choices[0].label, choices[2].label, olderChoices[0].label, olderChoices[1].label]);
  assert.equal(ui.suggestedRows()[0].querySelector('.tool-dropdown-option').textContent, 'None Selected');
  assert.equal(document.activeElement, heart(choices[1].label));
  ui.menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, heart(olderChoices[2].label), 'arrow navigation follows the pinned order');
  const sections = ui.view().querySelectorAll('.audience-suggestion-group');
  assert.equal(sections.length, 3, 'one favorite section followed by two source groups');
  assert.equal(sections[0].getAttribute('aria-label'), 'Favorite audiences');
  assert.equal(sections[0].querySelector('.audience-generation-header'), null);
  assert.equal(sections[0].querySelector('.audience-generation-current'), null);
  assert.equal(sections[0].querySelector('.audience-generation-source-link'), null);
  assert.equal(ui.generatedRows()[1].querySelector('.tool-dropdown-option').title, 'Earlier source + Another source');
  assert.equal(ui.generatedRows()[1].querySelector('.tool-dropdown-option').getAttribute('aria-describedby'), undefined);
  assert.deepEqual(sections.slice(1).map(group => group.dataset.generation), ['current', 'older']);
  for (const group of sections.slice(1)) {
    assert.equal(group.getAttribute('aria-label'), 'Suggested audiences');
    assert.equal(group.querySelector('.audience-generation-header'), null);
    assert.equal(group.querySelector('.audience-generation-current'), null);
    assert.equal(group.querySelector('.audience-generation-source-link'), null);
  }
  assert.equal(labels()[0], choices[1].label);
  heart(choices[1].label).focus();
  heart(choices[1].label).emit('click');
  assert.deepEqual(labels(), [olderChoices[2].label, ...choices.map(choice => choice.label), olderChoices[0].label, olderChoices[1].label]);
  assert.equal(document.activeElement, heart(choices[1].label));
  heart(olderChoices[2].label).emit('click');
  assert.deepEqual(labels(), [...choices, ...olderChoices].map(choice => choice.label), 'removing hearts restores the source groups');
  assert.equal(ui.view().querySelectorAll('.audience-suggestion-group').length, 2);
});

test('persisted favorites shared across generations keep each source context and the focused occurrence', t => {
  const ui = suggestionFixture(t);
  ui.favoritesStore.toggle('audience', choices[2].value);
  ui.setContext({ groups: [generation('current', 'project-a:sources-a', ['Current source']), generation('older', 'older-key', ['Earlier source'])], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  assert.deepEqual(ui.generatedRows().slice(0, 2).map(row => row.querySelector('.tool-dropdown-option').textContent), [choices[2].label, choices[2].label]);
  const oldFavorite = ui.generatedRows()[1].querySelector('.tool-option-favorite');
  oldFavorite.focus();
  oldFavorite.emit('click');
  const oldSection = ui.view().querySelectorAll('.audience-suggestion-group').find(section => section.dataset.generation === 'older');
  assert.equal(document.activeElement, oldSection.querySelectorAll('.tool-option-favorite')[2]);
  assert.ok(ui.generatedRows().every(row => row.querySelector('.tool-option-favorite').getAttribute('aria-pressed') === 'false'));
});


test('an entirely hearted generation shows only favorite rows until a heart is removed', t => {
  const ui = suggestionFixture(t);
  for (const choice of choices) ui.favoritesStore.toggle('audience', choice.value);
  ui.setContext({ groups: [generation('current', 'project-a:sources-a', ['Current source'])], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  assert.equal(ui.generatedRows().length, 3);
  assert.equal(ui.view().querySelector('.audience-generation-header'), null);
  assert.equal(ui.view().querySelector('.audience-generation-source-link'), null);
  ui.generatedRows()[1].querySelector('.tool-option-favorite').emit('click');
  const sections = ui.view().querySelectorAll('.audience-suggestion-group');
  assert.equal(sections[0].querySelectorAll('.tool-dropdown-row').length, 2);
  assert.equal(sections[1].getAttribute('aria-label'), 'Suggested audiences');
  assert.equal(sections[1].querySelector('.audience-generation-header'), null);
  assert.equal(sections[1].querySelector('.audience-generation-current'), null);
  assert.equal(sections[1].querySelector('.audience-generation-source-link'), null);
  assert.equal(sections[1].querySelector('.tool-dropdown-option').textContent, choices[1].label);
});


test('only the clicked occurrence is checked when an audience appears in several generations', t => {
  const ui = suggestionFixture(t);
  const current = generation('current', 'project-a:sources-a', ['Current source']);
  const older = generation('older', 'older-key', ['Earlier source']);
  ui.setContext({ groups: [current, older], suggestions: choices });
  ui.controller.refresh();
  ui.trigger.emit('click');
  ui.show('Suggested');
  const section = id => ui.view().querySelectorAll('.audience-suggestion-group').find(group => group.dataset.generation === id);
  const checked = () => ui.generatedRows().filter(row => row.dataset.selected === 'true');
  const selectedIn = id => section(id).querySelectorAll('.tool-dropdown-row').filter(row => row.dataset.selected === 'true');
  section('older').querySelector('.tool-dropdown-option').emit('click');
  assert.equal(ui.audience.select.value, choices[0].value);
  assert.equal(checked().length, 1);
  assert.equal(selectedIn('older').length, 1);
  assert.equal(section('current').querySelector('.tool-dropdown-option').getAttribute('aria-pressed'), 'false');
  ui.trigger.emit('click');
  assert.equal(selectedIn('older').length, 1, 'reopening retains the clicked generation');
  section('current').querySelector('.tool-dropdown-option').emit('click');
  assert.equal(checked().length, 1);
  assert.equal(selectedIn('current').length, 1, 'clicking the identical value in another generation moves the check');
  assert.equal(selectedIn('older').length, 0);
  ui.setContext({ key: 'older-key' });
  ui.controller.refresh();
  assert.equal(selectedIn('current').length, 1, 'changing source selection does not move the audience check');
  ui.trigger.emit('click');
  section('current').querySelector('.tool-option-favorite').emit('click');
  assert.equal(checked().length, 1);
  assert.equal(checked()[0].querySelector('.tool-dropdown-option').title, 'Current source', 'the clicked occurrence stays checked when pinned');
  assert.equal(ui.generatedRows().filter(row => row.querySelector('.tool-dropdown-option').getAttribute('aria-pressed') === 'true').length, 1);
  checked()[0].querySelector('.tool-option-favorite').emit('click');
  assert.equal(selectedIn('current').length, 1, 'removing the heart restores the checked row to its group');
});

test('restored audience values check at most one occurrence and resets clear generated checks', t => {
  const ui = suggestionFixture(t);
  const current = generation('current', 'project-a:sources-a', ['Current source']);
  const older = generation('older', 'older-key', ['Earlier source']);
  ui.setContext({ groups: [current, older], suggestions: choices });
  ui.controller.refresh();
  ui.audience.select.value = choices[1].value;
  ui.audience.select.dispatchEvent(new Event('change'));
  const checked = () => ui.generatedRows().filter(row => row.dataset.selected === 'true');
  assert.equal(checked().length, 1, 'programmatic restoration chooses one matching row');
  assert.equal(checked()[0].parentElement.dataset.generation, 'current');
  ui.setContext({ groups: [older] });
  ui.controller.refresh();
  assert.equal(checked().length, 1, 'a removed group falls back to one remaining occurrence');
  assert.equal(checked()[0].parentElement.dataset.generation, 'older');
  ui.trigger.emit('click');
  ui.show('Suggested');
  ui.suggestedRows()[0].querySelector('.tool-dropdown-option').emit('click');
  assert.equal(ui.audience.select.value, '');
  assert.equal(checked().length, 0);
  assert.equal(ui.suggestedRows()[0].dataset.selected, 'true');
  ui.audience.select.value = choices[2].value;
  ui.controller.refresh();
  assert.equal(checked().length, 1);
  assert.equal(checked()[0].querySelector('.tool-dropdown-option').textContent, choices[2].label);
});


test('voice hearts pin favorites without selecting, closing, or losing keyboard focus', t => {
  const ui = setup(t);
  const voice = ui.field('Voice', 'us-weekly');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = voice.field.querySelector('.tool-dropdown-trigger');
  const menu = voice.field.querySelector('.tool-dropdown-menu');
  const rows = () => menu.querySelectorAll('.tool-dropdown-row');
  const row = label => rows().find(item => item.querySelector('.tool-dropdown-option').textContent === label);
  const choice = label => row(label).querySelector('.tool-dropdown-option');
  const heart = label => row(label).querySelector('.tool-option-favorite');
  const labels = () => rows().map(item => item.querySelector('.tool-dropdown-option').textContent);
  let changes = 0;
  voice.select.addEventListener('change', () => { changes++; });
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(menu.getAttribute('aria-label'), 'Voice options');
  assert.equal(heart('None Selected'), null);
  trigger.emit('click');
  assert.equal(choice('Us Weekly').getAttribute('aria-pressed'), 'true');
  heart("Woman's World").focus();
  heart("Woman's World").emit('click');
  assert.deepEqual(labels(), ['None Selected', "Woman's World", 'Us Weekly']);
  assert.deepEqual(ui.favoritesStore.values('voice'), ['womans-world']);
  assert.equal(heart("Woman's World").getAttribute('aria-pressed'), 'true');
  assert.equal(heart("Woman's World").getAttribute('aria-label'), "Remove Woman's World from favorites");
  assert.equal(document.activeElement, heart("Woman's World"));
  assert.equal(voice.select.value, 'us-weekly');
  assert.equal(choice('Us Weekly').getAttribute('aria-pressed'), 'true');
  assert.equal(choice("Woman's World").getAttribute('aria-pressed'), 'false');
  assert.equal(changes, 0);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, heart('Us Weekly'), 'keyboard follows the visible favorite-first order');
  menu.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, choice('Us Weekly'));
  menu.emit('keydown', { key: 'Home' });
  assert.equal(document.activeElement, choice('None Selected'));
  menu.emit('keydown', { key: 'Escape' });
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  assert.deepEqual(labels(), ['None Selected', "Woman's World", 'Us Weekly']);
  heart("Woman's World").focus();
  heart("Woman's World").emit('click');
  assert.deepEqual(labels(), ['None Selected', 'Us Weekly', "Woman's World"]);
  assert.equal(heart("Woman's World").getAttribute('aria-pressed'), 'false');
  assert.equal(document.activeElement, heart("Woman's World"));
  assert.equal(voice.select.value, 'us-weekly');
  assert.equal(changes, 0);
});

test('persisted voice favorites initialize consistently in new-draft and edit-card dropdowns', t => {
  const ui = setup(t, { voice: ['womans-world'], format: ['standard'], audience: ['general'] });
  const composer = ui.field('Voice');
  const editor = ui.field('Voice', '', document.body, 'output-edit-');
  populateDraftOptions();
  ui.dropdowns();
  for (const { field } of [composer, editor]) {
    const rows = field.querySelectorAll('.tool-dropdown-row');
    assert.deepEqual(rows.map(row => row.querySelector('.tool-dropdown-option').textContent), ['None Selected', "Woman's World", 'Us Weekly']);
    assert.equal(rows[1].querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  }
  assert.deepEqual(ui.favoritesStore.values('format'), ['standard']);
  assert.deepEqual(ui.favoritesStore.values('audience'), ['general']);
});


function contextualAudienceFixture(t) {
  const ui = setup(t);
  const library = createAudienceSuggestionLibrary({ storage: () => ui.storage });
  const project = { id: 'trend-project', sources: [
    { id: 'sports', title: 'Panthers stadium and football season news', selected: true },
    { id: 'health', title: 'Health research and everyday exercise habits', selected: false },
  ] };
  let role = 'Trend Hunter';
  const context = () => ({ role, sources: project.sources, library });
  const provider = createProjectAudienceSuggestions({ getProject: () => project, library });
  const format = ui.field('Format');
  const audience = ui.field('Audience');
  const voice = ui.field('Voice');
  populateDraftOptions(ui.doc, context());
  const controller = ui.dropdowns({ audienceSuggestions: provider,
    draftOptionsProvider: key => getDraftOptions(key, context()) });
  const trigger = audience.field.querySelector('.tool-dropdown-trigger');
  const menu = audience.field.querySelector('.tool-dropdown-menu');
  const rows = () => menu.querySelector('.tool-dropdown-list').querySelectorAll('.tool-dropdown-row');
  const labels = () => rows().map(row => row.querySelector('.tool-dropdown-option').textContent);
  const row = label => rows().find(row => row.querySelector('.tool-dropdown-option').textContent === label);
  return { ...ui, library, project, provider, format, audience, voice, controller, trigger, menu, rows, labels, row, context,
    setRole(next) { role = next; } };
}

test('live draft catalogs refresh contextual audiences with checked sources and isolate role-specific formats and voices', t => {
  const ui = contextualAudienceFixture(t);
  const initial = getDraftOptions('audience', ui.context()).filter(choice => choice.contextual);
  assert.equal(initial.length, 3);
  assert.deepEqual(ui.labels(), ['None Selected', 'General Audience', ...initial.map(choice => choice.label)]);
  assert.deepEqual(ui.favoritesStore.values('audience'), []);
  assert.deepEqual(ui.library.options(), [], 'displaying contextual audiences does not save them');
  assert.equal(ui.format.select.options[1].value, 'what-to-know');
  assert.equal(ui.voice.select.options.length, 13);
  ui.format.select.value = 'video-script';
  ui.voice.select.value = 'house-standard';
  ui.trigger.emit('click');
  ui.project.sources[0].selected = false;
  ui.project.sources[1].selected = true;
  ui.controller.refresh();
  const updated = getDraftOptions('audience', ui.context()).filter(choice => choice.contextual);
  assert.equal(updated.length, 3);
  assert.notDeepEqual(updated, initial);
  assert.deepEqual(ui.labels(), ['None Selected', 'General Audience', ...updated.map(choice => choice.label)]);
  assert.ok(initial.every(choice => !ui.audience.select.options.some(option => option.value === choice.value)));
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.format.select.value, 'video-script');
  assert.equal(ui.voice.select.value, 'house-standard');
  ui.setRole('Journalist');
  ui.controller.close();
  ui.controller.refresh();
  assert.equal(ui.format.select.value, '');
  assert.equal(ui.voice.select.value, '');
  assert.deepEqual(ui.format.select.options.map(option => option.value), ['', 'standard', 'celebrity-relationship-timeline', 'listicle', 'whos-returning-to-show']);
  assert.deepEqual(ui.voice.select.options.map(option => option.value), ['', 'us-weekly', 'womans-world']);
  assert.deepEqual(ui.labels(), ['None Selected', 'General Audience', 'Millennial Pop-Culture Fan', 'Wellness Enthusiast', 'Trend-Chasing Fashion Shopper']);
  ui.setRole('Trend Hunter');
  ui.controller.refresh();
  assert.deepEqual(ui.labels(), ['None Selected', 'General Audience', ...updated.map(choice => choice.label)]);
  ui.project.sources[1].selected = false;
  ui.controller.refresh();
  assert.deepEqual(ui.labels(), ['None Selected', 'General Audience']);
});

test('selecting a contextual audience remembers it before change handlers refresh the source catalog', t => {
  const ui = contextualAudienceFixture(t);
  const choice = getDraftOptions('audience', ui.context()).find(choice => choice.contextual);
  let changes = 0;
  ui.audience.select.addEventListener('change', () => {
    changes++;
    assert.ok(ui.library.options().some(saved => saved.value === choice.value), 'persistence precedes the native change event');
    ui.project.sources[0].selected = false;
    ui.project.sources[1].selected = true;
    ui.controller.refresh();
  });
  ui.trigger.emit('click');
  ui.row(choice.label).querySelector('.tool-dropdown-option').emit('click');
  assert.equal(changes, 1);
  assert.equal(ui.audience.select.value, choice.value);
  assert.equal(ui.trigger.children[0].textContent, choice.label);
  assert.equal(ui.menu.hidden, true);
  assert.deepEqual(ui.favoritesStore.values('audience'), []);
  assert.deepEqual(ui.provider.getContext().groups, [], 'selection does not fabricate a generated source group');
  const restoredLibrary = createAudienceSuggestionLibrary({ storage: () => ui.storage });
  assert.deepEqual(restoredLibrary.options(), [{ value: choice.value, label: choice.label }]);
  assert.equal(ui.audience.select.options.filter(option => option.value === choice.value).length, 1);
});

test('hearting a contextual audience saves its label before favorite subscribers and restores it in another project', t => {
  const ui = contextualAudienceFixture(t);
  const choice = getDraftOptions('audience', ui.context()).find(choice => choice.contextual);
  ui.trigger.emit('click');
  let notifications = 0;
  const unsubscribe = ui.favoritesStore.subscribe(() => {
    notifications++;
    assert.ok(ui.library.options().some(saved => saved.value === choice.value), 'audience library is ready before favorite subscribers run');
  });
  t.after(unsubscribe);
  let changes = 0;
  ui.audience.select.addEventListener('change', () => { changes++; });
  const favorite = ui.row(choice.label).querySelector('.tool-option-favorite');
  favorite.focus();
  favorite.emit('click');
  assert.equal(notifications, 1);
  assert.equal(changes, 0);
  assert.equal(ui.audience.select.value, '');
  assert.equal(ui.menu.hidden, false);
  assert.equal(document.activeElement, ui.row(choice.label).querySelector('.tool-option-favorite'));
  assert.equal(ui.row(choice.label).querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(ui.labels(), ['None Selected', choice.label, 'General Audience',
    ...getDraftOptions('audience', ui.context()).filter(option => option.contextual && option.value !== choice.value).map(option => option.label)]);
  ui.controller.destroy();
  for (const entry of [ui.format, ui.audience, ui.voice]) entry.field.remove();

  const library = createAudienceSuggestionLibrary({ storage: () => ui.storage });
  const favorites = createToolFavorites({ storage: () => ui.storage });
  const project = { id: 'other-project', sources: [] };
  const provider = createProjectAudienceSuggestions({ getProject: () => project, library });
  const restored = ui.field('Audience');
  const context = { role: 'Trend Hunter', sources: [], library };
  populateDraftOptions(restored.field, context);
  ui.dropdowns({ audienceSuggestions: provider, favoritesStore: favorites,
    draftOptionsProvider: key => getDraftOptions(key, context) });
  const trigger = restored.field.querySelector('.tool-dropdown-trigger');
  const menu = restored.field.querySelector('.tool-dropdown-menu');
  const rows = menu.querySelector('.tool-dropdown-list').querySelectorAll('.tool-dropdown-row');
  assert.deepEqual(rows.map(row => row.querySelector('.tool-dropdown-option').textContent), ['None Selected', choice.label, 'General Audience']);
  assert.equal(rows[1].querySelector('.tool-option-favorite').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(favorites.values('audience'), [choice.value]);
  assert.deepEqual(provider.getContext().groups, []);
  trigger.emit('click');
  rows[1].querySelector('.tool-dropdown-option').emit('click');
  assert.equal(restored.select.value, choice.value);
  assert.equal(trigger.children[0].textContent, choice.label);
});
