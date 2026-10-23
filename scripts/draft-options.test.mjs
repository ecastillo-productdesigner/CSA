import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOptions, populateDraftOptions, draftPreferenceValue, hasDraftSelection } from '../dist/draft-options.js';
import { createToolDropdowns } from '../dist/tool-dropdowns.js';

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

function setup(t) {
  const previous = { document: globalThis.document, window: globalThis.window };
  const doc = new Element('document');
  doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  doc.activeElement = null;
  doc.append(doc.body);
  globalThis.document = doc;
  globalThis.window = new Element('window');
  window.matchMedia = () => ({ matches: false });
  t.after(() => Object.assign(globalThis, previous));
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
  return { doc, field };
}

test('draft option labels and values match the requested Format, Audience, and Voice choices', () => {
  assert.deepEqual(draftOptions.map(({ label, key, options }) => [label, key, options.map(({ value, label }) => [value, label])]), [
    ['Format', 'format', [['', 'None Selected'], ['standard', 'Standard Format'], ['celebrity-relationship-timeline', 'Celebrity Relationship Timeline'], ['listicle', 'Listicle'], ['whos-returning-to-show', 'Who’s Returning to the Show?']]],
    ['Audience', 'audience', [['', 'None Selected'], ['general', 'General Audience'], ['millennial-pop-culture', 'Millennial Pop-Culture Fan'], ['wellness-enthusiast', 'Wellness Enthusiast'], ['trend-chasing-fashion-shopper', 'Trend-Chasing Fashion Shopper']]],
    ['Voice', 'voice', [['', 'None Selected'], ['us-weekly', 'US Weekly'], ['womans-world', "Woman's World"]]],
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

test('all three new draft fields start with None Selected and retain their empty selection on refresh', t => {
  const ui = setup(t);
  const entries = draftOptions.map(({ label }) => ui.field(label));
  populateDraftOptions();
  const controller = createToolDropdowns();
  for (const { field, select } of entries) {
    assert.equal(select.value, '');
    assert.equal(select.selectedIndex, 0);
    assert.equal(select.options[0].textContent, 'None Selected');
    assert.equal(select.options[0].selected, true);
    assert.equal('fixedValue' in field.dataset, false);
    assert.equal(field.dataset.hasValue, 'false');
    const trigger = field.querySelector('.tool-dropdown-trigger');
    assert.equal(trigger.children[0].textContent, 'None Selected');
    assert.equal(trigger.getAttribute('aria-label'), `${field.dataset.label}: None Selected`);
  }
  populateDraftOptions();
  controller.refresh();
  for (const { select } of entries) assert.equal(select.value, '');
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
  const controller = createToolDropdowns({ root: panel });
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
  assert.equal(options[3].getAttribute('aria-selected'), 'true');
  assert.equal(menu.hidden, true);
  assert.equal(document.activeElement, trigger);
  trigger.emit('click');
  options[0].emit('click');
  assert.equal(inside.select.value, '');
  assert.equal(changes, 2);
  assert.equal(inside.field.dataset.hasValue, 'false');
  assert.equal(trigger.children[0].textContent, 'None Selected');
  assert.equal(trigger.getAttribute('aria-label'), 'Format: None Selected');
  assert.equal(options[0].getAttribute('aria-selected'), 'true');
  assert.equal(options[3].getAttribute('aria-selected'), 'false');
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
  createToolDropdowns();
  for (const { field, placeholder } of entries) {
    const trigger = field.querySelector('.tool-dropdown-trigger');
    assert.equal(trigger.children[0].textContent, placeholder);
    assert.equal(trigger.getAttribute('aria-label'), placeholder);
  }
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
