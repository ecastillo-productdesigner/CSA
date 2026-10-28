import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceAlreadyAddedDialog } from '../dist/source-already-added.js';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.isConnected = true; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  addEventListener(key, callback) { this.listeners.set(key, callback); }
  fire(key, values = {}) { this.listeners.get(key)?.({ target: this, ...values }); }
  focus() { document.activeElement = this; }
  closest() { return null; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire('close'); }
  remove() { this.isConnected = false; }
  getBoundingClientRect() { return { left: 10, top: 10, right: 500, bottom: 200 }; }
}

function setup(t) {
  const previous = globalThis.document;
  const body = new Element('body');
  globalThis.document = { body, createElement: tag => new Element(tag), activeElement: null };
  t.after(() => { globalThis.document = previous; });
  const controller = createSourceAlreadyAddedDialog();
  const dialog = body.children[0];
  const [heading, footer] = dialog.children;
  return { controller, dialog, title: heading.children[0], dismiss: heading.children[1], button: footer.children[0] };
}

test('duplicate-source popup contains only Source Already Added, the close icon, and Close with accessible focus', t => {
  const ui = setup(t);
  const trigger = new Element('button');
  ui.controller.open({ trigger });
  assert.equal(ui.title.textContent, 'Source Already Added');
  assert.equal(ui.dialog.children.length, 2, 'no subheading or description is rendered');
  assert.equal(ui.dialog.getAttribute('aria-describedby'), undefined);
  assert.equal(ui.dialog.getAttribute('role'), 'alertdialog');
  assert.equal(ui.dialog.getAttribute('aria-labelledby'), ui.title.id);
  assert.equal(ui.button.textContent, 'Close');
  assert.equal(document.activeElement, ui.button);
  ui.button.fire('click');
  assert.equal(ui.dialog.open, false);
  assert.equal(document.activeElement, trigger);
});

test('close icon, native Escape close event, and outside clicks dismiss without returning focus to a hidden trigger', t => {
  const ui = setup(t);
  const trigger = new Element('button');
  ui.controller.open({ trigger });
  ui.dismiss.fire('click');
  assert.equal(ui.dialog.open, false);
  ui.controller.open({ trigger });
  trigger.closest = () => trigger;
  ui.dialog.close();
  assert.equal(document.activeElement, ui.button);
  ui.controller.open();
  ui.dialog.fire('click', { clientX: 0, clientY: 0 });
  assert.equal(ui.dialog.open, false);
  ui.controller.destroy();
  assert.equal(ui.dialog.isConnected, false);
});
