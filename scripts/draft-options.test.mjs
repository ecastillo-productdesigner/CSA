import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOptions, populateDraftOptions, draftPreferenceValue, hasDraftSelection } from '../dist/draft-options.js';
import { createToolDropdowns } from '../dist/tool-dropdowns.js';
import { createToolFavorites } from '../dist/tool-favorites.js';

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
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(value => value !== child);
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
  get value() { return this._value ?? (this.tagName === 'select' ? this.children[0]?.value || '' : ''); }
  set value(value) { this._value = value; }
  get selectedIndex() { return this.options.findIndex(option => option.value === this.value); }
  get selected() { return this.tagName === 'option' && this.parentElement?.value === this.value; }
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

test('empty draft fields show their purpose while retaining the None Selected reset choice', t => {
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
    assert.equal(field.querySelector('.tool-dropdown-option').textContent, 'None Selected');
  }
  populateDraftOptions();
  controller.refresh();
  for (const { field, select } of entries) {
    assert.equal(select.value, '');
    assert.equal(field.querySelector('.tool-dropdown-trigger').children[0].textContent, field.dataset.label);
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
  }
});

test('favoriting Format or Audience keeps the current choice and popup open', t => {
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
    const savedTab = menu.querySelectorAll('.tool-favorites-tab').find(tab => tab.dataset.view === 'saved');
    assert.equal(savedTab.textContent, 'Favorites (0)');
    assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(menu.getAttribute('role'), 'dialog');
    assert.equal(menu.querySelector('.tool-dropdown-list').getAttribute('role'), 'group');
    assert.equal(rows[0].querySelector('.tool-option-favorite'), null);
    assert.equal(favorite.getAttribute('aria-pressed'), 'false');
    assert.equal(favorite.getAttribute('aria-label'), `Add ${select.options[2].textContent} to favorites`);
    assert.equal(menu.querySelector('.tool-saved-empty').textContent, `No favorite ${field.dataset.tool === 'format' ? 'formats' : 'audiences'} yet. Choose All, then use a heart to add a favorite.`);
    trigger.emit('click');
    favorite.focus();
    favorite.emit('click');
    assert.equal(favorite.getAttribute('aria-pressed'), 'true');
    assert.equal(savedTab.textContent, 'Favorites (1)');
    assert.equal(favorite.getAttribute('aria-label'), `Remove ${select.options[2].textContent} from favorites`);
    assert.equal(option.getAttribute('aria-pressed'), 'false');
    assert.equal(select.value, selected);
    assert.equal(changes, 0);
    assert.equal(menu.hidden, false);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, favorite);
    assert.deepEqual(ui.favoritesStore.values(field.dataset.tool), [select.options[2].value]);
  }
});

test('All and Favorites tabs count valid saved choices and preserve None Selected in the filtered view', t => {
  const ui = setup(t, { format: ['listicle', 'retired-format', 'listicle', ''], audience: ['general'] });
  const { field, select } = ui.field('Format', 'standard');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const toolbar = menu.querySelector('.tool-dropdown-toolbar');
  const tabs = menu.querySelectorAll('.tool-favorites-tab');
  const [allTab, savedTab] = tabs;
  const panel = menu.querySelector('.tool-favorites-panel');
  const rows = menu.querySelectorAll('.tool-dropdown-row');
  assert.equal(toolbar.getAttribute('role'), 'tablist');
  assert.deepEqual(tabs.map(tab => [tab.dataset.view, tab.textContent]), [['all', 'All'], ['saved', 'Favorites (1)']]);
  assert.deepEqual(tabs.map(tab => tab.id), [`${select.id}-all-tab`, `${select.id}-saved-tab`]);
  assert.ok(tabs.every(tab => tab.getAttribute('role') === 'tab' && tab.getAttribute('aria-controls') === panel.id));
  assert.deepEqual(tabs.map(tab => [tab.getAttribute('aria-selected'), tab.tabIndex]), [['true', 0], ['false', -1]]);
  assert.equal(panel.getAttribute('role'), 'tabpanel');
  assert.equal(panel.getAttribute('aria-labelledby'), allTab.id);
  assert.equal(panel.contains(menu.querySelector('.tool-dropdown-list')), true);
  assert.equal(panel.contains(menu.querySelector('.tool-saved-empty')), true);
  trigger.emit('click');
  savedTab.focus();
  toolbar.emit('click', { target: savedTab });
  assert.deepEqual(tabs.map(tab => [tab.getAttribute('aria-selected'), tab.tabIndex]), [['false', -1], ['true', 0]]);
  assert.equal(panel.getAttribute('aria-labelledby'), savedTab.id);
  assert.deepEqual(rows.map(row => row.hidden), [false, true, true, false, true]);
  assert.equal(menu.querySelector('.tool-saved-empty').hidden, true);
  assert.equal(select.value, 'standard');
  assert.equal(menu.hidden, false);
  assert.equal(document.activeElement, savedTab);
  allTab.focus();
  toolbar.emit('click', { target: allTab });
  assert.equal(allTab.getAttribute('aria-selected'), 'true');
  assert.equal(panel.getAttribute('aria-labelledby'), allTab.id);
  assert.ok(rows.every(row => !row.hidden));
  assert.equal(select.value, 'standard');
  assert.deepEqual(ui.favoritesStore.values('audience'), ['general']);
});

test('removing the last favorite shows Favorites (0), the empty state, and the focused reset choice', t => {
  const ui = setup(t, { format: ['listicle'] });
  const { field, select } = ui.field('Format', 'listicle');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const toolbar = menu.querySelector('.tool-dropdown-toolbar');
  const [allTab, savedTab] = menu.querySelectorAll('.tool-favorites-tab');
  const rows = menu.querySelectorAll('.tool-dropdown-row');
  const reset = rows[0].querySelector('.tool-dropdown-option');
  const favorite = rows[3].querySelector('.tool-option-favorite');
  trigger.emit('click');
  toolbar.emit('click', { target: savedTab });
  favorite.focus();
  favorite.emit('click');
  assert.deepEqual(rows.map(row => row.hidden), [false, true, true, true, true]);
  assert.equal(savedTab.textContent, 'Favorites (0)');
  assert.equal(savedTab.getAttribute('aria-selected'), 'true');
  assert.equal(menu.querySelector('.tool-saved-empty').hidden, false);
  assert.equal(menu.querySelector('.tool-saved-empty').getAttribute('role'), 'status');
  assert.equal(document.activeElement, reset);
  assert.equal(favorite.getAttribute('aria-pressed'), 'false');
  assert.equal(select.value, 'listicle');
  assert.equal(menu.hidden, false);
  menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, reset);
  reset.emit('click');
  assert.equal(select.value, '');
  assert.equal(field.dataset.hasValue, 'false');
  assert.equal(trigger.getAttribute('aria-label'), 'Format');
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  assert.equal(savedTab.getAttribute('aria-selected'), 'true');
  assert.equal(rows[0].hidden, false);
  assert.equal(document.activeElement, reset);
  toolbar.emit('click', { target: allTab });
  assert.equal(menu.querySelector('.tool-saved-empty').hidden, true);
  assert.ok(rows.every(row => !row.hidden));
});

test('None Selected resets the current choice while other saved choices remain available', t => {
  const ui = setup(t, { audience: ['general'] });
  const { field, select } = ui.field('Audience', 'wellness-enthusiast');
  populateDraftOptions();
  ui.dropdowns();
  let changes = 0;
  select.addEventListener('change', () => { changes++; });
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const toolbar = menu.querySelector('.tool-dropdown-toolbar');
  const savedTab = menu.querySelectorAll('.tool-favorites-tab').find(tab => tab.dataset.view === 'saved');
  const rows = menu.querySelectorAll('.tool-dropdown-row');
  trigger.emit('click');
  toolbar.emit('click', { target: savedTab });
  assert.deepEqual(rows.map(row => row.hidden), [false, false, true, true, true]);
  rows[0].querySelector('.tool-dropdown-option').emit('click');
  assert.equal(select.value, '');
  assert.equal(changes, 1);
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  assert.deepEqual(ui.favoritesStore.values('audience'), ['general']);
  assert.equal(savedTab.textContent, 'Favorites (1)');
});

test('All and Favorites support tab arrows, Home, End, native Tab, and Escape', t => {
  const ui = setup(t, { format: ['listicle'] });
  const { field, select } = ui.field('Format', 'standard');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const toolbar = menu.querySelector('.tool-dropdown-toolbar');
  const [allTab, savedTab] = menu.querySelectorAll('.tool-favorites-tab');
  const panel = menu.querySelector('.tool-favorites-panel');
  function keydown(key, target) {
    target.focus();
    const event = toolbar.emit('keydown', { key, target });
    // The mock does not bubble; pass the handled event on to the popup listener.
    menu.emit('keydown', event);
    assert.equal(event.defaultPrevented, true);
  }
  trigger.emit('click');
  keydown('ArrowRight', allTab);
  assert.equal(document.activeElement, savedTab);
  assert.equal(savedTab.getAttribute('aria-selected'), 'true');
  assert.equal(panel.getAttribute('aria-labelledby'), savedTab.id);
  keydown('ArrowRight', savedTab);
  assert.equal(document.activeElement, allTab);
  assert.equal(allTab.getAttribute('aria-selected'), 'true');
  keydown('ArrowLeft', allTab);
  assert.equal(document.activeElement, savedTab);
  keydown('Home', savedTab);
  assert.equal(document.activeElement, allTab);
  keydown('End', allTab);
  assert.equal(document.activeElement, savedTab);
  assert.deepEqual([allTab.tabIndex, savedTab.tabIndex], [-1, 0]);
  assert.notEqual(menu.emit('keydown', { key: 'Tab', target: savedTab }).defaultPrevented, true);
  assert.equal(menu.hidden, false);
  assert.equal(select.value, 'standard');
  assert.equal(menu.emit('keydown', { key: 'Escape', target: savedTab }).defaultPrevented, true);
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
});

test('favorite popups support row and heart arrows and leave interior Tab to the browser', t => {
  const ui = setup(t);
  const { field } = ui.field('Format', 'standard');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const allTab = menu.querySelectorAll('.tool-favorites-tab').find(tab => tab.dataset.view === 'all');
  const rows = menu.querySelectorAll('.tool-dropdown-row');
  const options = rows.map(row => row.querySelector('.tool-dropdown-option'));
  const hearts = rows.map(row => row.querySelector('.tool-option-favorite'));
  assert.equal(trigger.emit('keydown', { key: 'ArrowDown' }).defaultPrevented, true);
  assert.equal(document.activeElement, options[1]);
  menu.emit('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, hearts[1]);
  menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, hearts[2]);
  menu.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, options[2]);
  menu.emit('keydown', { key: 'End' });
  assert.equal(document.activeElement, options.at(-1));
  menu.emit('keydown', { key: 'Home' });
  assert.equal(document.activeElement, options[0]);
  menu.emit('keydown', { key: 'ArrowUp' });
  assert.equal(document.activeElement, options.at(-1));
  assert.notEqual(menu.emit('keydown', { key: 'Tab' }).defaultPrevented, true);
  assert.equal(menu.hidden, false);
  hearts.at(-1).focus();
  assert.notEqual(menu.emit('keydown', { key: 'Tab' }).defaultPrevented, true);
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  allTab.focus();
  menu.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
});

test('Voice retains listbox selection and keyboard behavior without favorite controls', t => {
  const ui = setup(t);
  const { field, select } = ui.field('Voice', 'us-weekly');
  populateDraftOptions();
  ui.dropdowns();
  const trigger = field.querySelector('.tool-dropdown-trigger');
  const menu = field.querySelector('.tool-dropdown-menu');
  const options = menu.querySelectorAll('.tool-dropdown-option');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
  assert.equal(menu.querySelector('.tool-dropdown-list').getAttribute('role'), 'listbox');
  assert.equal(menu.querySelector('.tool-dropdown-toolbar'), null);
  assert.equal(menu.querySelector('.tool-favorites-tab'), null);
  assert.equal(menu.querySelector('.tool-favorites-panel'), null);
  assert.equal(menu.querySelectorAll('.tool-option-favorite').length, 0);
  assert.ok(options.every(option => option.getAttribute('role') === 'option'));
  assert.equal(options[1].getAttribute('aria-selected'), 'true');
  trigger.emit('click');
  assert.equal(document.activeElement, options[1]);
  menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, options[2]);
  options[2].emit('click');
  assert.equal(select.value, 'womans-world');
  assert.equal(options[2].getAttribute('aria-selected'), 'true');
  assert.equal(options[1].getAttribute('aria-selected'), 'false');
  assert.equal(menu.hidden, true);
  trigger.emit('click');
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
