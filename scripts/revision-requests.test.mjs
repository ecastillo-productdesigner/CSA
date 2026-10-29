import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevisionButton, updateRevisionButton, createRevisionRequests } from '../dist/revision-requests.js';

class Control {
  children = [];
  listeners = new Map();
  attributes = new Map();
  dataset = {};
  value = '';
  textContent = '';
  disabled = false;
  hidden = false;
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) { return this.children.find(child => selector.startsWith('.') && child.className?.split(' ').includes(selector.slice(1))) || null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  focus() { document.activeElement = this; }
  fire(name) { this.listeners.get(name)?.({ preventDefault() {} }); }
}

function setup(t) {
  const previous = globalThis.document;
  const nodes = Object.fromEntries(['dialog', 'form', 'instructions', 'submit', 'error', 'history-toggle', 'history-panel', 'history-list', 'history-label'].map(name => [name, new Control()]));
  const fallback = new Control();
  const buttons = [];
  globalThis.document = {
    activeElement: null,
    createElement: () => new Control(),
    createTextNode: textContent => Object.assign(new Control(), { textContent }),
    querySelector: selector => selector.startsWith('#revision-request-') ? nodes[selector.slice('#revision-request-'.length)] : fallback,
    querySelectorAll: () => buttons,
  };
  t.after(() => { globalThis.document = previous; });
  nodes.instructions.maxLength = 8000;
  nodes.form.reset = () => { nodes.instructions.value = ''; };
  nodes.dialog.showModal = () => { nodes.dialog.open = true; };
  nodes.dialog.close = () => { nodes.dialog.open = false; nodes.dialog.fire('close'); };
  const project = { id: 'project-a' };
  const output = { id: 'draft-a', title: 'The draft being revised' };
  const trigger = createRevisionButton(output);
  buttons.push(trigger);
  const calls = [];
  let result = true;
  let closes = 0;
  const reads = [];
  const api = createRevisionRequests({
    closePanels() { closes++; },
    onRevisionRead(project, output) { reads.push([project.id, output.id]); },
    onSubmit(request) { calls.push(request); return result; },
  });
  return { ...nodes, api, project, output, trigger, fallback, calls, reads, closes: () => closes, setResult(value) { result = value; } };
}

test('revision trigger uses the requested edit_document glyph and native dialog button semantics', t => {
  const ui = setup(t);
  assert.equal(ui.trigger.type, 'button');
  assert.equal(ui.trigger.dataset.requestRevision, 'draft-a');
  assert.equal(ui.trigger.children[0].textContent, 'edit_document');
  assert.equal(ui.trigger.children[1].textContent, 'Request Revision');
  assert.equal(ui.trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(ui.trigger.getAttribute('aria-controls'), 'revision-request-dialog');
  assert.equal(createRevisionButton(ui.output, true).disabled, true);
});

test('opening focuses instructions and rejects blank or over-limit input before submitting', t => {
  const ui = setup(t);
  ui.api.open(ui.project, ui.output);
  assert.equal(ui.closes(), 1);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui['history-toggle'].hidden, true);
  assert.equal(document.activeElement, ui.instructions);
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
  for (const text of ['', '   ', 'x'.repeat(8001)]) {
    ui.instructions.value = text;
    ui.instructions.fire('input');
    assert.equal(ui.submit.disabled, true);
    ui.form.fire('submit');
  }
  assert.deepEqual(ui.calls, []);
  ui.instructions.value = 'x'.repeat(8000);
  ui.instructions.fire('input');
  assert.equal(ui.submit.disabled, false);
});

test('submission captures trimmed instructions for the chosen draft and closes only once', t => {
  const ui = setup(t);
  ui.api.open(ui.project, ui.output);
  ui.instructions.value = '  Shorten the intro  ';
  ui.form.fire('submit');
  assert.deepEqual(ui.calls, [{ projectId: 'project-a', outputId: 'draft-a', instructions: 'Shorten the intro' }]);
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.instructions.value, '');
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, ui.trigger);
  ui.form.fire('submit');
  assert.equal(ui.calls.length, 1);
});

test('a refused revision preserves instructions for retry and cancellation restores available focus', t => {
  const ui = setup(t);
  ui.setResult(false);
  ui.api.open(ui.project, ui.output);
  ui.instructions.value = 'Keep the sources and revise the opening';
  ui.form.fire('submit');
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.error.hidden, false);
  assert.equal(ui.instructions.value, 'Keep the sources and revise the opening');
  ui.trigger.disabled = true;
  ui.dialog.close();
  assert.equal(document.activeElement, ui.fallback);
  ui.form.fire('submit');
  assert.equal(ui.calls.length, 1);
});


test('an unread revision uses a small decorative dot beside Request Revision without changing its label', t => {
  const ui = setup(t);
  ui.output.revisionUnread = true;
  updateRevisionButton(ui.trigger, ui.output);
  const dot = ui.trigger.querySelector('.revision-request-dot');
  assert.equal(dot.hidden, false);
  assert.equal(dot.getAttribute('aria-hidden'), 'true');
  assert.equal(ui.trigger.children[1].textContent, 'Request Revision');
  assert.equal(ui.trigger.getAttribute('aria-description'), 'Revision complete, unread');
  updateRevisionButton(ui.trigger, ui.output, true);
  assert.equal(dot.hidden, true, 'processing does not show a completion dot');
  assert.equal(ui.output.revisionUnread, true, 'hiding a disabled action does not acknowledge it');
  updateRevisionButton(ui.trigger, ui.output, false);
  assert.equal(dot.hidden, false);
  ui.output.revisionRequestUnread = true;
  ui.output.revisionUnread = false;
  updateRevisionButton(ui.trigger, ui.output);
  assert.equal(dot.hidden, false, 'acknowledging only the tab keeps the action dot');
  ui.output.revisionRequestUnread = false;
  updateRevisionButton(ui.trigger, ui.output);
  assert.equal(dot.hidden, true);
  assert.equal(ui.trigger.getAttribute('aria-description'), undefined);
});

test('opening Request Revision acknowledges its dot while preserving the captured revision history', t => {
  const ui = setup(t);
  ui.output.revisionUnread = false;
  ui.output.revisionRequestUnread = true;
  ui.output.revisionRequests = [{ instructions: 'Keep this request', completedAt: 1 }];
  const before = structuredClone(ui.output.revisionRequests);
  updateRevisionButton(ui.trigger, ui.output);
  ui.api.open(ui.project, ui.output);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.output.revisionUnread, false);
  assert.equal(ui.output.revisionRequestUnread, false);
  assert.equal(ui.trigger.querySelector('.revision-request-dot').hidden, true);
  assert.deepEqual(ui.output.revisionRequests, before);
  assert.deepEqual(ui.reads, [['project-a', 'draft-a']]);
  assert.equal(document.activeElement, ui.instructions);
  ui.dialog.close();
  ui.api.open(ui.project, ui.output);
  assert.equal(ui.reads.length, 1, 'a viewed revision is not acknowledged twice');
});


const contents = element => element.textContent + element.children.map(contents).join('');

test('Revision History expands saved requests chronologically without submitting or losing typed instructions', t => {
  const ui = setup(t);
  ui.output.revisionRequests = [
    { instructions: 'Second request', completedAt: 2000 },
    { instructions: 'First request\nKeep the quote', completedAt: 1000 },
  ];
  const saved = structuredClone(ui.output.revisionRequests);
  ui.api.open(ui.project, ui.output);
  assert.equal(ui['history-panel'].hidden, true);
  assert.equal(ui['history-toggle'].getAttribute('aria-expanded'), 'false');
  ui.instructions.value = 'An unsent request';
  ui.instructions.fire('input');
  ui['history-toggle'].fire('click');
  assert.equal(ui['history-panel'].hidden, false);
  assert.equal(ui['history-toggle'].getAttribute('aria-expanded'), 'true');
  assert.equal(ui['history-toggle'].hidden, false);
  assert.equal(ui['history-label'].textContent, 'Revision History (2)');
  const entries = ui['history-list'].children.map(contents);
  assert.match(entries[0], /Revision 1.*Requested Change: First request\nKeep the quote/s);
  assert.match(entries[1], /Revision 2.*Requested Change: Second request/s);
  ui['history-toggle'].fire('click');
  assert.equal(ui['history-panel'].hidden, true);
  assert.equal(ui.instructions.value, 'An unsent request');
  assert.equal(ui.submit.disabled, false);
  assert.deepEqual(ui.calls, []);
  assert.deepEqual(ui.output.revisionRequests, saved);
});

test('closing history and changing drafts resets the disclosure without leaking earlier requests', t => {
  const ui = setup(t);
  ui.output.revisionRequests = [{ instructions: 'Only for draft A', completedAt: 1000 }];
  ui.api.open(ui.project, ui.output);
  ui['history-toggle'].fire('click');
  ui.dialog.close();
  assert.equal(ui['history-panel'].hidden, true);
  assert.equal(ui['history-toggle'].getAttribute('aria-expanded'), 'false');
  assert.equal(ui['history-list'].children.length, 0);
  ui.api.open(ui.project, { id: 'draft-b', revisionRequests: [{ instructions: ' ' }] });
  ui['history-toggle'].fire('click');
  assert.equal(ui['history-toggle'].hidden, true);
  assert.equal(ui['history-list'].children.length, 0);
  assert.equal(ui['history-panel'].hidden, true);
  ui.dialog.close();
  ui.api.open(ui.project, ui.output);
  assert.equal(ui['history-panel'].hidden, true);
  assert.match(contents(ui['history-list']), /Only for draft A/);
  assert.equal(ui['history-toggle'].hidden, false);
});


test('Revision History count includes only saved requests with actual instructions', t => {
  const ui = setup(t);
  ui.output.revisionRequests = [
    { instructions: 'First' }, { instructions: '' }, null,
    { instructions: 'Second' }, { instructions: 'Third' },
  ];
  ui.api.open(ui.project, ui.output);
  assert.equal(ui['history-label'].textContent, 'Revision History (3)');
  assert.equal(ui['history-list'].children.length, 3);
});
