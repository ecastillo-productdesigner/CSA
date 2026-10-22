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
    this.hidden = false;
    this.disabled = false;
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  click(target = this) { this.listeners.get('click')?.({ target, preventDefault() {}, stopPropagation() {} }); }
  matches(selector) {
    if (selector === '[data-delete-output]') return 'deleteOutput' in this.dataset;
    if (selector === '[data-edit-output]') return 'editOutput' in this.dataset;
    return selector.startsWith('.') && (this.className || '').split(' ').includes(selector.slice(1));
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
}

function setup(t, initial = [{ id: 'pending', title: 'Pending', status: 'pending' }, { id: 'ready', title: 'Adapted', status: 'ready' }]) {
  const previous = globalThis.document;
  const panel = new Element('section');
  const list = new Element('ul');
  const tab = new Element();
  panel.append(list, tab);
  panel.querySelector = () => tab;
  globalThis.document = {
    activeElement: null,
    createElement: tag => new Element(tag),
    querySelector: selector => ({ '.composer-outputs': panel, '#output-list': list }[selector]),
  };
  t.after(() => { globalThis.document = previous; });
  let project = { id: 'story', outputs: initial };
  let calls = [];
  let canDelete = true;
  const controller = createContentCardEditing({
    getProject: () => project,
    onDelete(id) {
      calls.push(id);
      if (!canDelete) return false;
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
  return {
    panel, list, tab, controller, show, calls,
    edits: () => list.querySelectorAll('[data-edit-output]'),
    buttons: () => list.querySelectorAll('[data-delete-output]'),
    project: () => project,
    setProject(value) { project = value; show(); },
    rejectDeletion() { canDelete = false; },
  };
}

test('each card has a pencil that reveals only its own delete control and toggles off safely', t => {
  const ui = setup(t);
  assert.equal(ui.edits().length, 2);
  assert.ok(ui.buttons().every(button => button.hidden));
  assert.equal(ui.edits()[0].getAttribute('aria-label'), 'Edit content: Pending');
  assert.equal(ui.edits()[0].children[0].textContent, 'edit');
  ui.list.click(ui.edits()[0]);
  assert.equal(ui.edits()[0].getAttribute('aria-pressed'), 'true');
  assert.equal(ui.edits()[1].getAttribute('aria-pressed'), 'false');
  assert.equal(ui.buttons()[0].hidden, false);
  assert.equal(ui.buttons()[1].hidden, true);
  assert.equal(ui.list.children[0].dataset.editing, 'true');
  assert.equal(ui.buttons()[0].getAttribute('aria-label'), 'Delete content: Pending');
  assert.equal(ui.buttons()[0].children[0].textContent, 'delete');
  ui.buttons()[0].focus();
  ui.list.click(ui.edits()[0]);
  assert.ok(ui.buttons().every(button => button.hidden));
  assert.equal(ui.edits()[0].getAttribute('aria-pressed'), 'false');
  assert.equal(document.activeElement, ui.edits()[0]);
  ui.list.click(ui.edits()[1]);
  assert.equal(ui.buttons()[1].hidden, false);
  assert.equal(ui.buttons()[0].hidden, true);
});

test('editing survives segment changes and an empty segment, then resets for another project', t => {
  const ui = setup(t);
  ui.list.click(ui.edits()[0]);
  ui.show([ui.project().outputs[1]]);
  assert.equal(ui.edits()[0].getAttribute('aria-pressed'), 'false');
  assert.equal(ui.buttons()[0].hidden, true);
  ui.show([]);
  ui.show([ui.project().outputs[0]]);
  assert.equal(ui.buttons()[0].hidden, false);
  ui.setProject({ id: 'another', outputs: [{ id: 'pending', title: 'Other' }] });
  assert.equal(ui.buttons()[0].hidden, true);
  ui.setProject({ id: 'empty', outputs: [] });
  assert.equal(ui.edits().length, 0);
});

test('adapting disables editing and deletion, including synthetic stale clicks', t => {
  const ui = setup(t);
  ui.list.click(ui.edits()[0]);
  ui.setProject({ ...ui.project(), outputProcessing: { ids: ['pending'] } });
  assert.ok(ui.edits().every(button => button.disabled));
  assert.ok(ui.buttons().every(button => button.disabled));
  ui.list.click(ui.edits()[0]);
  ui.list.click(ui.buttons()[0]);
  assert.equal(ui.edits()[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(ui.calls, []);
  ui.setProject({ ...ui.project(), outputProcessing: null });
  assert.ok(ui.edits().every(button => !button.disabled));
  assert.ok(ui.buttons().every(button => !button.disabled));
});

test('deletion focuses the neighboring pencil, then the segment after the last card', t => {
  const ui = setup(t);
  ui.list.click(ui.buttons()[0]);
  assert.deepEqual(ui.calls, []);
  ui.list.click(ui.edits()[0]);
  ui.list.click(ui.buttons()[0]);
  assert.deepEqual(ui.calls, ['pending']);
  assert.equal(document.activeElement, ui.edits()[0]);
  assert.equal(ui.edits()[0].dataset.editOutput, 'ready');
  assert.equal(ui.buttons()[0].hidden, true);
  ui.list.click(ui.edits()[0]);
  ui.list.click(ui.buttons()[0]);
  assert.deepEqual(ui.calls, ['pending', 'ready']);
  assert.equal(ui.edits().length, 0);
  assert.equal(document.activeElement, ui.tab);
});

test('a refused deletion preserves the card and does not move focus', t => {
  const ui = setup(t);
  ui.list.click(ui.edits()[0]);
  ui.rejectDeletion();
  const button = ui.buttons()[0];
  button.focus();
  ui.list.click(button);
  assert.equal(ui.buttons().length, 2);
  assert.equal(document.activeElement, button);
});
