import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOptions, getDraftOptions, setDraftOptionsContext, populateDraftOptions, draftPreferenceValue, hasDraftSelection } from '../dist/draft-options.js';
import { createToolDropdowns } from '../dist/tool-dropdowns.js';
import { createToolFavorites } from '../dist/tool-favorites.js';
import { createAudienceSuggestionLibrary, demoAudienceSuggestions } from '../dist/audience-suggestions.js';

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
  const previous = { document: globalThis.document, window: globalThis.window };
  const doc = new Element('document');
  doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  doc.createTextNode = text => Object.assign(new Element('#text'), { textContent: text });
  doc.activeElement = null;
  doc.append(doc.body);
  globalThis.document = doc;
  globalThis.window = new Element('window');
  window.matchMedia = () => ({ matches: false });
  const records = new Map([['csa.tool-favorites.v1', JSON.stringify(savedFavorites)]]);
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const favoritesStore = createToolFavorites({ storage: () => storage });
  const controllers = [];
  function dropdowns(options = {}) {
    const controller = createToolDropdowns({ favoritesStore, ...options });
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
    field.append(select);
    parent.append(field);
    return { field, select };
  }
  return { doc, field, dropdowns, favoritesStore };
}

test('draft option labels and values match the requested Format, Audience, and Voice choices', () => {
  assert.deepEqual(draftOptions.map(({ label, key, options }) => [label, key, options.map(({ value, label }) => [value, label])]), [
    ['Format', 'format', [['', 'None Selected'], ['standard', 'Standard Format'], ['celebrity-relationship-timeline', 'Celebrity Relationship Timeline'], ['listicle', 'Listicle'], ['whos-returning-to-show', 'Who’s Returning to the Show?']]],
    ['Audience', 'audience', [['', 'None Selected'], ['general', 'General Audience'], ['millennial-pop-culture', 'Millennial Pop-Culture Fan'], ['wellness-enthusiast', 'Wellness Enthusiast'], ['trend-chasing-fashion-shopper', 'Trend-Chasing Fashion Shopper']]],
    ['Voice', 'voice', [['', 'None Selected'], ['us-weekly', 'Us Weekly'], ['womans-world', "Woman's World"]]],
  ]);
});

test('populating replaces fixed fields with options, retains valid selections, and defaults unsupported values', t => {
  const ui = setup(t);
  const format = ui.field('Format', 'listicle');
  const audience = ui.field('Audience', 'legacy-audience');
  const voice = ui.field('Voice', 'womans-world');
  populateDraftOptions();
  assert.equal(format.select.value, 'listicle');
  assert.equal(audience.select.value, '');
  assert.equal(voice.select.value, 'womans-world');
  assert.deepEqual([format.select.options.length, audience.select.options.length, voice.select.options.length], [5, 5, 3]);
  for (const entry of [format, audience, voice]) assert.equal('fixedValue' in entry.field.dataset, false);
  populateDraftOptions();
  assert.equal(format.select.value, 'listicle');
  assert.equal(format.select.options.length, 5);
});

test('draft fields without an explicit placeholder show their purpose and retain the None Selected reset choice', t => {
  const ui = setup(t);
  const entries = draftOptions.map(({ label }) => ui.field(label));
  populateDraftOptions();
  const controller = ui.dropdowns();
  for (const { field, select } of entries) {
    assert.equal(select.value, '');
    assert.equal(select.selectedIndex, 0);
    assert.equal(select.options[0].textContent, 'None Selected');
    assert.equal(select.options[0].selected, true);
    assert.equal('fixedValue' in field.dataset, false);
    assert.equal(field.dataset.hasValue, 'false');
    const trigger = field.querySelector('.tool-dropdown-trigger');
    assert.equal(trigger.children[0].textContent, field.dataset.label);
    assert.equal(trigger.getAttribute('aria-label'), field.dataset.label);
    assert.equal(trigger.querySelector('.tool-dropdown-chevron').textContent, 'keyboard_arrow_down');
    assert.equal(field.querySelector('.tool-dropdown-option').textContent, 'None Selected');
  }
  populateDraftOptions();
  controller.refresh();
  for (const { field, select } of entries) {
    assert.equal(select.value, '');
    assert.equal(field.querySelector('.tool-dropdown-trigger').children[0].textContent, field.dataset.label);
  }
});

test('explicit draft placeholders preserve field context while selecting and clearing choices', t => {
  const ui = setup(t);
  const entries = draftOptions.map(({ label }) => {
    const entry = ui.field(label);
    entry.field.dataset.placeholder = 'None Selected';
    return entry;
  });
  populateDraftOptions();
  const controller = ui.dropdowns();
  for (const { field, select } of entries) {
    const label = field.dataset.label;
    const trigger = field.querySelector('.tool-dropdown-trigger');
    const menu = field.querySelector('.tool-dropdown-menu');
    const options = menu.querySelectorAll('.tool-dropdown-option');
    let changes = 0;
    select.addEventListener('change', () => { changes++; });
    assert.equal(select.value, '');
    assert.equal(trigger.children[0].textContent, 'None Selected');
    assert.equal(trigger.getAttribute('aria-label'), `${label}: None Selected`);
    assert.equal(field.dataset.hasValue, 'false');

    trigger.emit('click');
    options[1].emit('click');
    assert.equal(select.value, select.options[1].value);
    assert.equal(trigger.children[0].textContent, select.options[1].textContent);
    assert.equal(trigger.getAttribute('aria-label'), `${label}: ${select.options[1].textContent}`);
    assert.equal(field.dataset.hasValue, 'true');
    assert.equal(menu.hidden, true);

    trigger.emit('click');
    options[0].emit('click');
    assert.equal(select.value, '');
    assert.equal(trigger.children[0].textContent, 'None Selected');
    assert.equal(trigger.getAttribute('aria-label'), `${label}: None Selected`);
    assert.equal(field.dataset.hasValue, 'false');
    assert.equal(menu.hidden, true);
    assert.equal(document.activeElement, trigger);
    assert.equal(changes, 2);
  }
  populateDraftOptions();
  controller.refresh();
  for (const { field } of entries) {
    const trigger = field.querySelector('.tool-dropdown-trigger');
    assert.equal(trigger.children[0].textContent, 'None Selected');
    assert.equal(trigger.getAttribute('aria-label'), `${field.dataset.label}: None Selected`);
  }
});

test('populating a scope leaves other composer fields and unrelated selects unchanged', t => {
  const ui = setup(t);
  const panel = new Element('section');
  ui.doc.body.append(panel);
  const inside = ui.field('Audience', 'wellness-enthusiast', panel, 'ds-new-draft-');
  const outside = ui.field('Voice', 'legacy-outside');
  const unrelated = ui.field('Sort', 'newest', panel);
  populateDraftOptions(panel);
  assert.equal(inside.select.options.length, 5);
  assert.equal(inside.select.value, 'wellness-enthusiast');
  assert.equal(outside.select.options.length, 1);
  assert.equal(outside.select.value, 'legacy-outside');
  assert.equal(outside.field.dataset.fixedValue, 'legacy-outside');
  assert.equal(unrelated.select.options.length, 1);
  assert.equal(unrelated.select.value, 'newest');
});

test('scoped dropdowns create only their panel controls and selecting a choice updates the native saved value', t => {
  const ui = setup(t);
  const panel = new Element('section');
  ui.doc.body.append(panel);
  const inside = ui.field('Format', 'standard', panel, 'ds-new-draft-');
  const outside = ui.field('Audience', 'general');
  populateDraftOptions();
  let changes = 0;
  inside.select.addEventListener('change', () => { changes++; });
  const controller = ui.dropdowns({ root: panel });
  assert.equal(inside.field.dataset.tool, 'format');
  assert.equal(panel.querySelectorAll('.tool-dropdown-trigger').length, 1);
  assert.equal(outside.field.querySelectorAll('.tool-dropdown-trigger').length, 0);
  assert.equal(inside.field.querySelectorAll('.tool-fixed-value').length, 0);
  const trigger = inside.field.querySelector('.tool-dropdown-trigger');
  const menu = inside.field.querySelector('.tool-dropdown-menu');
  trigger.emit('click');
  assert.equal(menu.hidden, false);
  const options = menu.querySelectorAll('.tool-dropdown-option');
  options[3].emit('click');
  assert.equal(inside.select.value, 'listicle');
  assert.equal(changes, 1);
  assert.equal(trigger.getAttribute('aria-label'), 'Format: Listicle');
  assert.equal(options[3].getAttribute('aria-pressed'), 'true');
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  assert.equal(options[0].textContent, 'None Selected');
  options[0].emit('click');
  assert.equal(inside.select.value, '');
  assert.equal(changes, 2);
  assert.equal(inside.field.dataset.hasValue, 'false');
  assert.equal(trigger.children[0].textContent, 'Format');
  assert.equal(trigger.getAttribute('aria-label'), 'Format');
  assert.equal(options[0].getAttribute('aria-pressed'), 'true');
  assert.equal(options[3].getAttribute('aria-pressed'), 'false');
  assert.equal(menu.hidden, true);
  inside.select.disabled = true;
  controller.refresh();
  trigger.emit('click');
  assert.equal(menu.hidden, true);
  assert.equal(trigger.disabled, true);
});


test('unselected feedback, editor style, and sort dropdowns keep their existing placeholders', t => {
  const ui = setup(t);
  const examples = [
    ['Category', 'feedback-select-field', 'Select a category'],
    ['Paragraph style', 'editor-style-field', 'Paragraph style'],
    ['Sort', 'results-sort-field', 'Sort'],
  ];
  const entries = examples.map(([label, className, placeholder]) => {
    const entry = ui.field(label);
    entry.field.className = className;
    delete entry.field.dataset.fixedValue;
    if (className === 'feedback-select-field') entry.field.dataset.placeholder = placeholder;
    return { ...entry, placeholder };
  });
  ui.dropdowns();
  for (const { field, placeholder } of entries) {
    const trigger = field.querySelector('.tool-dropdown-trigger');
    assert.equal(trigger.children[0].textContent, placeholder);
    assert.equal(trigger.getAttribute('aria-label'), placeholder);
    assert.equal(trigger.querySelector('.tool-dropdown-chevron').textContent, field.matches('.results-sort-field') ? 'keyboard_arrow_down' : 'unfold_less');
  }
});

test('favoriting Format or Audience pins that choice without changing selection or closing the popup', t => {
  const ui = setup(t);
  const entries = [ui.field('Format', 'standard'), ui.field('Audience', 'general')];
  populateDraftOptions();
  ui.dropdowns();
  for (const { field, select } of entries) {
    const selected = select.value;
    let changes = 0;
    select.addEventListener('change', () => { changes++; });
    const trigger = field.querySelector('.tool-dropdown-trigger');
    const menu = field.querySelector('.tool-dropdown-menu');
    const rows = menu.querySelectorAll('.tool-dropdown-row');
    const option = rows[2].querySelector('.tool-dropdown-option');
    const favorite = rows[2].querySelector('.tool-option-favorite');
    assert.equal(menu.querySelector('.tool-dropdown-toolbar'), null);
    assert.equal(menu.querySelector('.tool-favorites-tab'), null);
    assert.equal(menu.querySelector('.tool-saved-empty'), null);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(menu.getAttribute('role'), 'dialog');
    assert.equal(menu.querySelector('.tool-dropdown-list').getAttribute('role'), 'group');
    assert.equal(rows[0].querySelector('.tool-option-favorite'), null);
    assert.equal(favorite.getAttribute('aria-pressed'), 'false');
    trigger.emit('click');
    favorite.focus();
    favorite.emit('click');
    assert.equal(favorite.getAttribute('aria-pressed'), 'true');
    assert.equal(favorite.getAttribute('aria-label'), `Remove ${select.options[2].textContent} from favorites`);
    assert.deepEqual(menu.querySelectorAll('.tool-dropdown-row'), [rows[0], rows[2], rows[1], rows[3], rows[4]]);
    assert.equal(option.getAttribute('aria-pressed'), 'false');
    assert.equal(select.value, selected);
    assert.equal(changes, 0);
    assert.equal(menu.hidden, false);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, favorite);
    assert.deepEqual(ui.favoritesStore.values(field.dataset.tool), [select.options[2].value]);
    favorite.emit('click');
    assert.deepEqual(menu.querySelectorAll('.tool-dropdown-row'), rows);
    assert.equal(document.activeElement, favorite);
    assert.equal(select.value, selected);
  }
});

test('favorites keep catalog order below None Selected and ignore retired favorites', t => {
  const ui = setup(t, { format: ['listicle', 'retired-format', 'standard', 'listicle', ''], audience: ['general'] });
  const { field, select } = ui.field('Format', 'listicle');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const options = menu.querySelectorAll('.tool-dropdown-option');
  assert.deepEqual(options.map(option => option.textContent), [
    'None Selected', 'Standard Format', 'Listicle', 'Celebrity Relationship Timeline', 'Who’s Returning to the Show?',
  ]);
  assert.ok(menu.querySelectorAll('.tool-dropdown-row').every(row => !row.hidden));
  assert.equal(options[2].getAttribute('aria-pressed'), 'true');
  trigger.emit('click');
  assert.equal(document.activeElement, options[2]);
  options[0].emit('click');
  assert.equal(select.value, '');
  assert.equal(trigger.getAttribute('aria-label'), 'Format');
  assert.equal(menu.hidden, true);
  assert.deepEqual(ui.favoritesStore.values('audience'), ['general']);
  assert.deepEqual(ui.favoritesStore.values('format'), ['listicle', 'retired-format', 'standard']);
});

test('keyboard navigation follows pinned display order, preserves heart focus, and supports Escape and Tab', t => {
  const ui = setup(t, { format: ['listicle'] });
  const { field, select } = ui.field('Format', 'standard');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const rows = menu.querySelectorAll('.tool-dropdown-row');
  const options = rows.map(row => row.querySelector('.tool-dropdown-option'));
  const hearts = rows.map(row => row.querySelector('.tool-option-favorite'));
  assert.equal(options[1].textContent, 'Listicle');
  assert.equal(trigger.emit('keydown', { key: 'ArrowDown' }).defaultPrevented, true);
  assert.equal(document.activeElement, options[2]);
  menu.emit('keydown', { key: 'ArrowUp' });
  assert.equal(document.activeElement, options[1]);
  menu.emit('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, hearts[1]);
  hearts[1].emit('click');
  assert.equal(document.activeElement, hearts[1]);
  menu.emit('keydown', { key: 'ArrowUp' });
  assert.equal(document.activeElement, hearts[3]);
  menu.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, options[3]);
  menu.emit('keydown', { key: 'Home' });
  assert.equal(document.activeElement, options[0]);
  menu.emit('keydown', { key: 'End' });
  assert.equal(document.activeElement, options.at(-1));
  assert.notEqual(menu.emit('keydown', { key: 'Tab' }).defaultPrevented, true);
  assert.equal(menu.hidden, false);
  hearts.at(-1).focus();
  menu.emit('keydown', { key: 'Tab' });
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  options[0].focus();
  menu.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(menu.hidden, true);
  trigger.emit('click');
  menu.emit('keydown', { key: 'Escape' });
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  assert.equal(select.value, 'standard');
});

test('Source uses the shared favorites menu and refreshes when search replaces its publication options', t => {
  const ui = setup(t, { source: ['Miami Herald', 'Bellingham Herald'], format: ['listicle'] });
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => name.match(/-(\d+)$/)?.[1] || '0' });
  t.after(() => { globalThis.getComputedStyle = previousStyle; });
  ui.doc.documentElement = { clientHeight: 900, clientWidth: 1200 };
  const { field, select } = ui.field('Source', 'all', ui.doc.body, 'results-');
  field.className = 'results-source-field';
  delete field.dataset.fixedValue;
  function populate() {
    select.replaceChildren(...[
      ['all', 'All sources'], ['Bargain Hunter', 'Bargain Hunter'],
      ['Bellingham Herald', 'Bellingham Herald'], ['Miami Herald', 'Miami Herald'],
    ].map(([value, label]) => {
      const option = new Element('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    select.value = 'all';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  ui.dropdowns();
  populate();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  trigger.getBoundingClientRect = () => ({ left: 20, top: 100, bottom: 136, width: 300 });
  const menu = field.querySelector('.tool-dropdown-menu');
  const labels = () => menu.querySelectorAll('.tool-dropdown-option').map(option => option.textContent);
  assert.equal(trigger.querySelector('.tool-dropdown-chevron').textContent, 'keyboard_arrow_down');
  assert.deepEqual(labels(), ['All sources', 'Bellingham Herald', 'Miami Herald', 'Bargain Hunter']);
  assert.equal(menu.querySelector('.tool-dropdown-row').querySelector('.tool-option-favorite'), null);
  trigger.emit('click');
  assert.equal(menu.parentElement, ui.doc.body);
  assert.equal(menu.style.position, 'fixed');
  const favorite = menu.querySelectorAll('.tool-dropdown-row').at(-1).querySelector('.tool-option-favorite');
  favorite.focus();
  favorite.emit('click');
  assert.deepEqual(labels(), ['All sources', 'Bargain Hunter', 'Bellingham Herald', 'Miami Herald']);
  assert.equal(document.activeElement, favorite);
  assert.deepEqual(ui.favoritesStore.values('source'), ['Miami Herald', 'Bellingham Herald', 'Bargain Hunter']);
  menu.querySelectorAll('.tool-dropdown-option')[2].emit('click');
  assert.equal(select.value, 'Bellingham Herald');
  assert.equal(trigger.getAttribute('aria-label'), 'Source: Bellingham Herald');
  assert.equal(menu.parentElement, ui.doc.body);
  assert.equal(menu.hidden, false);
  populate();
  assert.deepEqual(labels(), ['All sources', 'Bargain Hunter', 'Bellingham Herald', 'Miami Herald']);
  assert.equal(menu.querySelector('.tool-dropdown-option').getAttribute('aria-checked'), 'true');
  assert.equal(trigger.getAttribute('aria-label'), 'Source: All sources');
  const freshOptions = menu.querySelectorAll('.tool-dropdown-option');
  freshOptions[3].emit('click');
  assert.equal(select.value, 'Miami Herald');
  assert.equal(menu.hidden, false);
  freshOptions[0].emit('click');
  assert.equal(select.value, 'all');
  assert.deepEqual(ui.favoritesStore.values('format'), ['listicle']);
});

test('Voice selection and keyboard behavior use the shared favorite-enabled dialog', t => {
  const ui = setup(t);
  const { field, select } = ui.field('Voice', 'us-weekly');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const options = menu.querySelectorAll('.tool-dropdown-option');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(menu.getAttribute('role'), 'dialog');
  assert.equal(menu.querySelector('.tool-dropdown-list').getAttribute('role'), 'group');
  assert.equal(menu.querySelector('.tool-dropdown-toolbar'), null);
  assert.equal(menu.querySelector('.tool-favorites-tab'), null);
  assert.equal(menu.querySelector('.tool-favorites-panel'), null);
  assert.equal(menu.querySelectorAll('.tool-option-favorite').length, 2);
  assert.ok(options.every(option => option.getAttribute('role') !== 'option'));
  assert.equal(options[1].getAttribute('aria-pressed'), 'true');
  trigger.emit('click');
  assert.equal(document.activeElement, options[1]);
  menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, options[2]);
  options[2].emit('click');
  assert.equal(select.value, 'womans-world');
  assert.equal(options[2].getAttribute('aria-pressed'), 'true');
  assert.equal(options[1].getAttribute('aria-pressed'), 'false');
  assert.equal(menu.hidden, true);
  trigger.emit('click');
  menu.emit('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, menu.querySelectorAll('.tool-option-favorite').at(-1));
  menu.emit('keydown', { key: 'Tab' });
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
});

test('draft preferences restore valid saved values and leave absent or unsupported historical settings unselected', () => {
  for (const { key, options } of draftOptions) {
    for (const value of [undefined, null, '', 'retired-historical-value', 42]) {
      assert.equal(draftPreferenceValue(key, value), '');
    }
    for (const { value } of options) assert.equal(draftPreferenceValue(key, value), value);
  }
  assert.equal(draftPreferenceValue('unknown', 'standard'), '');
  assert.equal(draftPreferenceValue(undefined, 'general'), '');
});


test('Add to List stays disabled when every draft preference is unselected', () => {
  assert.equal(hasDraftSelection(), false);
  assert.equal(hasDraftSelection({}), false);
  assert.equal(hasDraftSelection({ format: '', audience: '', voice: '' }), false);
  assert.equal(hasDraftSelection(null), false);
});

test('any single configured Format, Audience, or Voice enables Add to List', () => {
  const preferences = { format: '', audience: '', voice: '' };
  assert.equal(hasDraftSelection({ ...preferences, format: 'listicle' }), true);
  assert.equal(hasDraftSelection({ ...preferences, audience: 'wellness-enthusiast' }), true);
  assert.equal(hasDraftSelection({ ...preferences, voice: 'womans-world' }), true);
});

test('multiple selections enable Add to List and clearing every choice disables it again', () => {
  const preferences = { format: 'standard', audience: 'general', voice: 'us-weekly' };
  assert.equal(hasDraftSelection(preferences), true);
  preferences.format = '';
  assert.equal(hasDraftSelection(preferences), true);
  preferences.audience = '';
  assert.equal(hasDraftSelection(preferences), true);
  preferences.voice = '';
  assert.equal(hasDraftSelection(preferences), false);
});

test('unknown settings and unsupported saved values do not count as draft selections', () => {
  assert.equal(hasDraftSelection({ unknown: 'standard' }), false);
  assert.equal(hasDraftSelection({ format: 'retired-format', audience: 'retired-audience', voice: 'retired-voice' }), false);
  assert.equal(hasDraftSelection({ format: 'general', audience: 'us-weekly', voice: 'standard' }), false);
  assert.equal(hasDraftSelection({ format: null, audience: undefined, voice: 42 }), false);
  assert.equal(hasDraftSelection({ format: 'retired-format', audience: 'general', voice: '' }), true);
});


test('publication choices toggle independently, keep the menu open, and use All sources when the last choice is cleared', t => {
  const ui = setup(t, { source: ['The Sacramento Bee'] });
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => name.match(/-(\d+)$/)?.[1] || '0' });
  t.after(() => { globalThis.getComputedStyle = previousStyle; });
  ui.doc.documentElement = { clientHeight: 900, clientWidth: 1200 };
  const { field, select } = ui.field('Source', 'The State', ui.doc.body, 'results-');
  field.className = 'results-source-field';
  delete field.dataset.fixedValue;
  select.replaceChildren(...['all', 'The Fresno Bee', 'The Sacramento Bee', 'The State'].map(value => {
    const option = new Element('option');
    option.value = value;
    option.textContent = value === 'all' ? 'All sources' : value;
    return option;
  }));
  select.value = 'The State';
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  trigger.getBoundingClientRect = () => ({ left: 20, top: 100, bottom: 136, width: 500 });
  const menu = field.querySelector('.tool-dropdown-menu');
  const choices = () => menu.querySelectorAll('.tool-dropdown-option');
  const choice = label => choices().find(button => button.textContent === label);
  const selected = () => select.options.filter(option => option.selected).map(option => option.value);
  assert.equal(select.multiple, true);
  assert.deepEqual(selected(), ['The State']);
  assert.equal(choice('The State').getAttribute('role'), 'checkbox');
  trigger.emit('click');
  choice('The State').emit('click');
  assert.deepEqual(selected(), ['all']);
  assert.equal(choice('All sources').getAttribute('aria-checked'), 'true');
  ui.doc.emit('scroll', { target: ui.doc.body });
  assert.equal(menu.hidden, false, 'a results reflow scroll keeps the multi-select open');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  choice('The Sacramento Bee').emit('click');
  choice('The Fresno Bee').emit('click');
  assert.deepEqual(selected(), ['The Fresno Bee', 'The Sacramento Bee']);
  assert.equal(choice('All sources').getAttribute('aria-checked'), 'false');
  assert.equal(choice('The Fresno Bee').getAttribute('aria-checked'), 'true');
  assert.equal(choice('The Sacramento Bee').getAttribute('aria-checked'), 'true');
  assert.equal(trigger.children[0].textContent, 'The Fresno Bee + The Sacramento Bee');
  assert.equal(trigger.getAttribute('aria-label'), 'Source: The Fresno Bee, The Sacramento Bee');
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  const heart = choice('The Fresno Bee').parentElement.querySelector('.tool-option-favorite');
  heart.emit('click');
  assert.deepEqual(selected(), ['The Fresno Bee', 'The Sacramento Bee']);
  assert.deepEqual(ui.favoritesStore.values('source'), ['The Sacramento Bee', 'The Fresno Bee']);
  assert.deepEqual(choices().map(button => button.textContent), ['All sources', 'The Fresno Bee', 'The Sacramento Bee', 'The State']);
  choice('The State').emit('click');
  assert.equal(trigger.children[0].textContent, '3 publications');
  assert.equal(trigger.title, 'The Fresno Bee, The Sacramento Bee, The State');
  choice('All sources').emit('click');
  assert.deepEqual(selected(), ['all']);
  assert.equal(trigger.children[0].textContent, 'All sources');
  assert.equal(menu.hidden, false);
  menu.emit('keydown', { key: 'Escape' });
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  trigger.getBoundingClientRect = () => ({ left: 20, top: -100, bottom: -64, width: 500 });
  ui.doc.emit('scroll', { target: ui.doc.body });
  assert.equal(menu.hidden, true, 'scrolling the filter trigger off screen closes its popup');
});


const emptyAudienceLibrary = { options: () => [] };
const trendHunterSources = [
  { id: 'stadium', title: 'Charlotte council discusses Panthers stadium investment', selected: true },
  { id: 'ignored', title: 'Fashion shoppers compare seasonal dresses', selected: false },
];

test('Trend Hunter has its own formats while other roles keep the legacy catalog', () => {
  const context = { role: 'Trend Hunter', library: emptyAudienceLibrary };
  assert.deepEqual(getDraftOptions('format', context), [
    { value: '', label: 'None Selected' },
    { value: 'what-to-know', label: 'What to Know' },
    { value: 'video-script', label: 'Video Script' },
    { value: 'listicle', label: 'Listicle' },
  ]);
  for (const role of ['', 'Journalist', 'Lifestyle & Entertainment', 'eCommerce']) {
    for (const { key, options } of draftOptions) {
      assert.deepEqual(getDraftOptions(key, { role, library: emptyAudienceLibrary }), options);
    }
  }
  assert.deepEqual(getDraftOptions('unknown', context), []);
  assert.equal(draftPreferenceValue('format', 'standard', context), '');
  assert.equal(draftPreferenceValue('format', 'what-to-know', context), 'what-to-know');
  assert.equal(draftPreferenceValue('format', 'video-script', context), 'video-script');
  assert.equal(draftPreferenceValue('format', 'video-script', { role: 'Journalist' }), '');
});

test('Trend Hunter audiences include General Audience and three contextual source-related choices', () => {
  const context = { role: 'Trend Hunter', sources: trendHunterSources, library: emptyAudienceLibrary };
  const choices = getDraftOptions('audience', context);
  assert.deepEqual(choices.slice(0, 2), [
    { value: '', label: 'None Selected' },
    { value: 'general', label: 'General Audience' },
  ]);
  assert.deepEqual(choices.slice(2), demoAudienceSuggestions(trendHunterSources)
    .map(option => ({ ...option, contextual: true })));
  assert.equal(choices.filter(option => option.contextual).length, 3);
  assert.equal(new Set(choices.map(option => option.value)).size, choices.length);
  assert.ok(choices.some(option => /Panthers|Stadium/.test(option.label)));
  assert.ok(choices.some(option => /Charlotte/.test(option.label)));
  for (const { value } of choices) assert.equal(draftPreferenceValue('audience', value, context), value);
  assert.equal(getDraftOptions('audience', { ...context, sources: [] }).length, 2);
});

test('Trend Hunter voices use the approved labels and descriptions with existing favorite IDs', () => {
  const context = { role: 'Trend Hunter' };
  const choices = getDraftOptions('voice', context);
  assert.deepEqual(choices.map(({ value, label }) => [value, label]), [
    ['', 'None Selected'],
    ['house-standard', 'House Standard'],
    ['apple-news', 'Apple News'],
    ['centre-daily-times', 'Centre Daily Times'],
    ['idaho-statesman', 'Idaho Statesman Voice Guide'],
    ['msn-syndication', 'MSN Syndication'],
    ['national-team', 'National Team Voice Guide'],
    ['kansas-city-star', 'The Kansas City Star Voice Guide'],
    ['news-observer', 'The News & Observer Voice Guide'],
    ['trend-hunter-b2c', 'Trend Hunter B2C'],
    ['us-weekly', 'Us Weekly Voice Guide'],
    ['womans-world', "Woman's World"],
    ['yahoo-news', 'Yahoo News'],
  ]);
  assert.equal(choices.find(option => option.value === 'house-standard').description,
    'McClatchy brand voice, tone, and style preferences');
  assert.equal(choices.find(option => option.value === 'centre-daily-times').description,
    'Emphasize local perspectives and community relevance');
  for (const { value } of choices) assert.equal(draftPreferenceValue('voice', value, context), value);
  const favorites = createToolFavorites({ storage: () => ({ getItem: () => JSON.stringify({ voice: ['us-weekly', 'womans-world'] }) }) });
  assert.deepEqual(choices.filter(option => favorites.values('voice').includes(option.value)).map(option => option.value), ['us-weekly', 'womans-world']);
});

test('live context updates roles and sources while explicit overrides keep specimens independent', t => {
  let context = { role: 'Trend Hunter', sources: trendHunterSources };
  setDraftOptionsContext(() => context);
  t.after(() => setDraftOptionsContext());
  assert.equal(getDraftOptions('format')[1].value, 'what-to-know');
  assert.equal(draftPreferenceValue('voice', 'house-standard'), 'house-standard');
  assert.equal(hasDraftSelection({ format: 'video-script' }), true);
  assert.equal(getDraftOptions('format', { role: '' })[1].value, 'standard');
  assert.equal(draftPreferenceValue('format', 'standard', { role: 'Journalist' }), 'standard');
  assert.equal(hasDraftSelection({ format: 'video-script' }, { role: 'Journalist' }), false);
  const originalAudiences = getDraftOptions('audience').filter(option => option.contextual);
  context = { ...context, sources: [{ title: 'Technology and software reshape digital tools' }] };
  const changedAudiences = getDraftOptions('audience').filter(option => option.contextual);
  assert.equal(changedAudiences.length, 3);
  assert.notDeepEqual(changedAudiences, originalAudiences);
  assert.deepEqual(getDraftOptions('audience', { sources: trendHunterSources }).filter(option => option.contextual), originalAudiences);
  context = { ...context, role: 'Journalist' };
  assert.equal(getDraftOptions('format')[1].value, 'standard');
  assert.equal(draftPreferenceValue('voice', 'house-standard'), '');
  assert.equal(hasDraftSelection({ format: 'video-script', voice: 'house-standard' }), false);
  setDraftOptionsContext();
  assert.equal(getDraftOptions('voice').length, 3);
});

test('populating role options preserves identical native options and resets unsupported selections', t => {
  const ui = setup(t);
  const context = { role: 'Trend Hunter', sources: trendHunterSources, library: emptyAudienceLibrary };
  const format = ui.field('Format', 'what-to-know');
  const audienceValue = demoAudienceSuggestions(trendHunterSources)[0].value;
  const audience = ui.field('Audience', audienceValue);
  const voice = ui.field('Voice', 'house-standard');
  populateDraftOptions(ui.doc, context);
  assert.deepEqual([format.select.options.length, audience.select.options.length, voice.select.options.length], [4, 5, 13]);
  assert.deepEqual([format.select.value, audience.select.value, voice.select.value], ['what-to-know', audienceValue, 'house-standard']);
  assert.equal(audience.select.options[2].dataset.contextual, 'true');
  assert.equal(audience.select.options[1].dataset.contextual, 'false');
  assert.equal(voice.select.options[1].title, 'McClatchy brand voice, tone, and style preferences');
  const originalOptions = [format, audience, voice].map(({ select }) => [...select.options]);
  populateDraftOptions(ui.doc, context);
  [format, audience, voice].forEach(({ select }, index) => {
    assert.ok(select.options.every((option, optionIndex) => option === originalOptions[index][optionIndex]));
  });
  populateDraftOptions(ui.doc, { role: 'Journalist', library: emptyAudienceLibrary });
  assert.deepEqual([format.select.value, audience.select.value, voice.select.value], ['', '', '']);
  assert.deepEqual([format.select.options.length, audience.select.options.length, voice.select.options.length], [5, 5, 3]);
  format.select.value = 'listicle';
  audience.select.value = 'general';
  voice.select.value = 'us-weekly';
  populateDraftOptions(ui.doc, context);
  assert.deepEqual([format.select.value, audience.select.value, voice.select.value], ['listicle', 'general', 'us-weekly']);
  const preferences = { format: 'video-script', audience: audienceValue, voice: 'house-standard' };
  assert.equal(hasDraftSelection(preferences, context), true);
  for (const key of ['format', 'audience', 'voice']) preferences[key] = '';
  assert.equal(hasDraftSelection(preferences, context), false);
});

test('saved contextual audiences remain available after source changes without duplicate options or mutation', () => {
  const records = new Map();
  const library = createAudienceSuggestionLibrary({ storage: () => ({
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }) });
  const context = { role: 'Trend Hunter', sources: trendHunterSources, library };
  const original = getDraftOptions('audience', context).filter(option => option.contextual);
  library.remember(original);
  const withSaved = getDraftOptions('audience', context);
  assert.equal(withSaved.length, 5);
  assert.deepEqual(withSaved.filter(option => option.contextual), original);
  withSaved[2].label = 'Changed returned option';
  assert.deepEqual(getDraftOptions('audience', context).filter(option => option.contextual), original);
  assert.equal(library.options()[0].label, original[0].label);
  const nextContext = { ...context, sources: [{ title: 'Everyday health and exercise habits' }] };
  assert.equal(getDraftOptions('audience', nextContext).filter(option => option.contextual).length, 3);
  assert.equal(draftPreferenceValue('audience', original[0].value, nextContext), original[0].value);
  assert.equal(hasDraftSelection({ audience: original[0].value }, nextContext), true);
  const duplicatedLibrary = { options: () => [
    { value: '', label: 'Duplicate None' },
    { value: 'general', label: 'Duplicate General' },
    ...original, ...original,
  ] };
  const deduplicated = getDraftOptions('audience', { ...context, library: duplicatedLibrary });
  assert.equal(deduplicated.length, 5);
  assert.equal(deduplicated[0].label, 'None Selected');
  assert.equal(deduplicated[1].label, 'General Audience');
  assert.ok(deduplicated.slice(2).every(option => option.contextual));
  const formats = getDraftOptions('format', context);
  formats[1].label = 'Changed format';
  assert.equal(getDraftOptions('format', context)[1].label, 'What to Know');
});
