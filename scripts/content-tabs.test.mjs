import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { bindTabSelection, syncSelection } from '../dist/selection-controls.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = app.indexOf('function selectOutputView(');
const end = app.indexOf('\nfunction renderProjectSources(', start);
assert.ok(start >= 0 && end > start, 'Content selection handler and binding exist in app.js');
const productionBinding = app.slice(start, end);

class Element {
  constructor({ id = '', className = '', value = '', dataset = {} } = {}) {
    Object.assign(this, { id, className, value, dataset, children: [], attributes: new Map(), listeners: new Map() });
  }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  contains(target) { return this === target || this.children.some(child => child.contains(target)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(type, callback) { this.listeners.set(type, [...this.listeners.get(type) || [], callback]); }
  removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) || []).filter(handler => handler !== callback)); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    return selector === '[data-output-view]' && Object.hasOwn(this.dataset, 'outputView');
  }
  querySelectorAll(selector) {
    const parts = selector.trim().split(/\s+/);
    const matches = node => {
      if (!node.matches(parts.at(-1))) return false;
      let ancestor = node.parentElement;
      for (let index = parts.length - 2; index >= 0; index--) {
        while (ancestor && !ancestor.matches(parts[index])) ancestor = ancestor.parentElement;
        if (!ancestor) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    };
    const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
    return descendants(this).filter(matches);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { this.root().activeElement = this; }
  root() { return this.parentElement ? this.parentElement.root() : this; }
  emit(type, details = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...details };
    for (let node = this; node; node = node.parentElement) {
      for (const callback of node.listeners.get(type) || []) callback(event);
    }
    return event;
  }
}

function setup() {
  const document = new Element();
  const audienceTabs = new Element({ className: 'output-status-tabs audience-suggestion-tabs' });
  const audienceItems = ['all', 'suggested'].map(value => new Element({ id: `audience-${value}`, value }));
  audienceTabs.append(...audienceItems);
  const audiencePanel = new Element({ id: 'audience-panel' });
  const content = new Element({ id: 'composer-outputs' });
  const contentTabs = new Element({ className: 'output-status-tabs' });
  const contentItems = ['pending', 'created'].map(value => new Element({ id: `output-${value}-tab`, dataset: { outputView: value } }));
  contentTabs.append(...contentItems);
  const contentPanel = new Element({ id: 'output-status-content' });
  const list = new Element({ id: 'output-list' });
  list.scrollTop = 120;
  contentPanel.append(list);
  content.append(contentTabs, contentPanel);
  // The Audience dropdown is created earlier in the DOM than Content.
  document.append(audienceTabs, audiencePanel, content);
  assert.equal(document.querySelector('.output-status-tabs'), audienceTabs);

  let audienceView = 'all';
  const audienceSelection = bindTabSelection({ root: audienceTabs, items: audienceItems, panel: audiencePanel, onSelect(value) {
    audienceView = value;
    audienceSelection.sync(value);
  } });
  audienceSelection.sync(audienceView);
  const project = { id: 'project' };
  const outputViews = new Map([[project.id, 'created']]);
  const renderedViews = [];
  const renderOutputs = current => {
    assert.equal(current, project);
    const view = outputViews.get(current.id);
    renderedViews.push(view);
    syncSelection(contentItems, view, { getValue: tab => tab.dataset.outputView });
    contentPanel.setAttribute('aria-labelledby', `output-${view}-tab`);
  };
  renderOutputs(project);
  renderedViews.length = 0;
  const context = createContext({
    document, bindTabSelection,
    $: selector => document.querySelector(selector),
    projects: [project], activeProjectId: project.id, outputViews,
    outputTabTransition: { run: render => render() }, renderOutputs,
  });
  runInContext(productionBinding, context);
  return { document, audienceItems, audiencePanel, contentItems, contentPanel, list, renderedViews, outputViews, audienceView: () => audienceView };
}

test('Content clicks switch To Draft and Drafted when Audience tabs precede Content', () => {
  const ui = setup();
  const [pending, created] = ui.contentItems;
  pending.focus();
  pending.emit('click');
  assert.equal(ui.outputViews.get('project'), 'pending');
  assert.equal(pending.getAttribute('aria-selected'), 'true');
  assert.equal(created.getAttribute('aria-selected'), 'false');
  assert.equal(ui.contentPanel.getAttribute('aria-labelledby'), 'output-pending-tab');
  assert.equal(ui.list.scrollTop, 0);
  created.emit('click');
  assert.deepEqual(ui.renderedViews, ['pending', 'created']);
  assert.equal(ui.audienceView(), 'all');
  assert.equal(ui.audienceItems[0].getAttribute('aria-selected'), 'true');
  assert.equal(ui.audiencePanel.getAttribute('aria-labelledby'), 'audience-all');
});

test('Content keyboard activation stays scoped to Content and updates the selected panel', () => {
  const ui = setup();
  const [pending, created] = ui.contentItems;
  created.focus();
  const left = created.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(left.defaultPrevented, true);
  assert.equal(ui.outputViews.get('project'), 'pending');
  assert.equal(ui.document.activeElement, pending);
  pending.emit('keydown', { key: 'End' });
  assert.equal(ui.outputViews.get('project'), 'created');
  assert.equal(ui.document.activeElement, created);
  created.emit('keydown', { key: 'Home' });
  assert.equal(ui.outputViews.get('project'), 'pending');
  assert.equal(ui.contentPanel.getAttribute('aria-labelledby'), pending.id);
  assert.equal(ui.audienceView(), 'all');
  assert.equal(ui.audienceItems[0].getAttribute('aria-selected'), 'true');
});

test('Audience tab interactions do not change Content selection', () => {
  const ui = setup();
  ui.audienceItems[1].emit('click');
  assert.equal(ui.audienceView(), 'suggested');
  ui.audienceItems[1].emit('keydown', { key: 'Home' });
  assert.equal(ui.audienceView(), 'all');
  assert.equal(ui.outputViews.get('project'), 'created');
  assert.equal(ui.contentItems[1].getAttribute('aria-selected'), 'true');
  assert.deepEqual(ui.renderedViews, []);
});
