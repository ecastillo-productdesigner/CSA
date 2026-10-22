import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentCardActions, createContentCardEditing } from '../dist/content-card-editing.js';

class Element {
  constructor(tag = 'button') {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.rect = { left: 400, right: 444, top: 100, bottom: 144, width: 44, height: 44 };
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  emit(type, detail = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...detail };
    this.listeners.get(type)?.(event);
    return event;
  }
  click(target = this) { return this.emit('click', { target }); }
  matches(selector) {
    if (selector === '[data-delete-output]') return 'deleteOutput' in this.dataset;
    if (selector === '[data-edit-output]') return 'editOutput' in this.dataset;
    return selector.startsWith('.') && (this.className || '').split(' ').includes(selector.slice(1));
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() {
    return this.matches('.output-card-menu') ? { width: 160, height: 56 } : this.rect;
  }
  focus() { document.activeElement = this; }
}

function setup(t, initial = [{ id: 'pending', title: 'Pending', status: 'pending' }, { id: 'ready', title: 'Adapted', status: 'ready' }]) {
  const previous = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  const panel = new Element('section');
  const list = new Element('ul');
  const tab = new Element();
  const body = new Element('body');
  panel.append(list, tab);
  panel.querySelector = () => tab;
  const doc = new Element('document');
  doc.body = body;
  doc.documentElement = { clientWidth: 1024, clientHeight: 768 };
  doc.activeElement = null;
  doc.createElement = tag => new Element(tag);
  doc.querySelector = selector => ({ '.composer-outputs': panel, '#output-list': list }[selector]);
  globalThis.document = doc;
  globalThis.window = new Element('window');
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => ({ '--csa-foundation-space-12': '12px', '--csa-foundation-space-4': '4px' }[name]) });
  t.after(() => { Object.assign(globalThis, previous); });
  let project = { id: 'story', outputs: initial };
  const calls = [];
  let canDelete = true;
  let rerenderOnRefusal = false;
  const controller = createContentCardEditing({
    getProject: () => project,
    onDelete(id) {
      calls.push(id);
      if (!canDelete) {
        if (rerenderOnRefusal) show();
        return false;
      }
      project = { ...project, outputs: project.outputs.filter(output => output.id !== id) };
      show(project.outputs);
      return true;
    },
  });
  function show(outputs = project.outputs) {
    list.children.forEach(child => { child.parent = null; });
    list.children = [];
    for (const output of outputs) {
      const card = new Element('article');
      card.className = 'output-card';
      card.append(createContentCardActions(output, { disabled: Boolean(project.outputProcessing) }));
      list.append(card);
    }
    controller.render(project);
  }
  show();
  const menu = body.querySelector('.output-card-menu');
  return {
    panel, list, tab, body, doc, menu, controller, show, calls,
    remove: menu.children[0],
    edits: () => list.querySelectorAll('[data-edit-output]'),
    project: () => project,
    setProject(value) { project = value; show(); },
    rejectDeletion({ rerender = false } = {}) { canDelete = false; rerenderOnRefusal = rerender; },
  };
}

test('each pencil opens a single anchored body menu with Delete, without inline trash controls', t => {
  const ui = setup(t);
  assert.equal(ui.edits().length, 2);
  assert.equal(ui.list.querySelectorAll('[data-delete-output]').length, 0);
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.edits()[0].getAttribute('aria-label'), 'Edit content: Pending');
  assert.equal(ui.edits()[0].getAttribute('aria-haspopup'), 'menu');
  assert.equal(ui.edits()[0].getAttribute('aria-controls'), 'content-card-menu');
  assert.equal(ui.edits()[0].children[0].textContent, 'edit');
  ui.list.click(ui.edits()[0]);
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.edits()[0].getAttribute('aria-expanded'), 'true');
  assert.equal(ui.edits()[1].getAttribute('aria-expanded'), 'false');
  assert.equal(ui.remove.getAttribute('role'), 'menuitem');
  assert.equal(ui.remove.getAttribute('aria-label'), 'Delete content: Pending');
  assert.equal(ui.remove.children[0].textContent, 'delete');
  assert.equal(ui.remove.children[1].textContent, 'Delete');
  assert.equal(document.activeElement, ui.remove);
  assert.equal(ui.menu.style.left, '284px');
  assert.equal(ui.menu.style.top, '148px');
  ui.list.click(ui.edits()[1]);
  assert.equal(ui.body.querySelectorAll('.output-card-menu').length, 1);
  assert.equal(ui.edits()[0].getAttribute('aria-expanded'), 'false');
  assert.equal(ui.edits()[1].getAttribute('aria-expanded'), 'true');
  assert.equal(ui.remove.dataset.deleteOutput, 'ready');
  ui.list.click(ui.edits()[1]);
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.edits()[1]);
});

test('Escape, Tab, outside click, focus leaving and outside scroll dismiss the menu', t => {
  const ui = setup(t);
  ui.list.click(ui.edits()[0]);
  ui.menu.emit('keydown', { key: 'Escape' });
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.edits()[0]);
  ui.list.click(ui.edits()[0]);
  ui.menu.emit('keydown', { key: 'Tab' });
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.edits()[0]);
  ui.list.click(ui.edits()[0]);
  const outside = new Element();
  outside.focus();
  ui.doc.emit('pointerdown', { target: outside });
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, outside);
  ui.list.click(ui.edits()[0]);
  ui.menu.emit('focusout', { relatedTarget: outside });
  assert.equal(ui.menu.hidden, true);
  ui.list.click(ui.edits()[0]);
  ui.doc.emit('scroll', { target: ui.list });
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.edits()[0]);
});

test('arrow keys open the menu and navigate its only item; viewport edges flip and clamp it', t => {
  const ui = setup(t);
  ui.edits()[0].rect = { left: 16, right: 60, top: 700, bottom: 744, width: 44, height: 44 };
  assert.equal(ui.list.emit('keydown', { target: ui.edits()[0], key: 'ArrowDown' }).defaultPrevented, true);
  assert.equal(ui.menu.hidden, false);
  assert.equal(ui.menu.style.left, '12px');
  assert.equal(ui.menu.style.top, '640px');
  ui.edits()[0].focus();
  ui.list.emit('keydown', { target: ui.edits()[0], key: 'ArrowUp' });
  assert.equal(ui.menu.hidden, false);
  assert.equal(document.activeElement, ui.remove);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.equal(ui.menu.emit('keydown', { key }).defaultPrevented, true);
    assert.equal(document.activeElement, ui.remove);
  }
});

test('rerender reconnects the active trigger; segment and project changes close the menu', t => {
  const ui = setup(t);
  const oldTrigger = ui.edits()[0];
  ui.list.click(oldTrigger);
  ui.show();
  assert.notEqual(ui.edits()[0], oldTrigger);
  assert.equal(ui.edits()[0].getAttribute('aria-expanded'), 'true');
  assert.equal(oldTrigger.getAttribute('aria-expanded'), 'false');
  ui.menu.emit('keydown', { key: 'Escape' });
  assert.equal(document.activeElement, ui.edits()[0]);
  ui.list.click(ui.edits()[0]);
  ui.show([ui.project().outputs[1]]);
  assert.equal(ui.menu.hidden, true);
  ui.show();
  ui.list.click(ui.edits()[0]);
  ui.setProject({ id: 'another', outputs: [{ id: 'pending', title: 'Other' }] });
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.edits()[0].getAttribute('aria-expanded'), 'false');
});

test('adapting closes the menu and blocks disabled or stale activation', t => {
  const ui = setup(t);
  ui.list.click(ui.edits()[0]);
  ui.setProject({ ...ui.project(), outputProcessing: { ids: ['pending'] } });
  assert.equal(ui.menu.hidden, true);
  assert.ok(ui.edits().every(button => button.disabled));
  ui.list.click(ui.edits()[0]);
  ui.remove.click();
  assert.equal(ui.menu.hidden, true);
  assert.deepEqual(ui.calls, []);
  assert.equal(document.activeElement, ui.tab);
  ui.setProject({ ...ui.project(), outputProcessing: null });
  assert.ok(ui.edits().every(button => !button.disabled));
  ui.list.click(ui.edits()[0]);
  ui.project().outputProcessing = { ids: ['pending'] };
  ui.remove.click();
  assert.equal(ui.menu.hidden, true);
  assert.deepEqual(ui.calls, []);
});

test('Delete uses the selected output and focuses the neighboring pencil, then the segment after the last card', t => {
  const ui = setup(t);
  ui.list.click(ui.edits()[0]);
  ui.remove.click();
  assert.deepEqual(ui.calls, ['pending']);
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.edits()[0]);
  assert.equal(ui.edits()[0].dataset.editOutput, 'ready');
  ui.list.click(ui.edits()[0]);
  ui.remove.click();
  assert.deepEqual(ui.calls, ['pending', 'ready']);
  assert.equal(ui.edits().length, 0);
  assert.equal(document.activeElement, ui.tab);
});

test('a refused deletion keeps the card and returns focus to its pencil', t => {
  const ui = setup(t);
  const oldTrigger = ui.edits()[0];
  ui.list.click(ui.edits()[0]);
  ui.rejectDeletion({ rerender: true });
  ui.remove.click();
  assert.equal(ui.edits().length, 2);
  assert.notEqual(ui.edits()[0], oldTrigger);
  assert.equal(ui.menu.hidden, true);
  assert.equal(document.activeElement, ui.edits()[0]);
});
