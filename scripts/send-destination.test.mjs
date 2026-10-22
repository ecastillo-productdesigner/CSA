import test from 'node:test';
import assert from 'node:assert/strict';
import { createSendDestinationDialog } from '../dist/send-destination.js';

class Control {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.isConnected = true;
    this.value = '';
    this.textContent = '';
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  closest() { return this.hiddenParent || null; }
  focus() { document.activeElement = this; }
  fire(type) {
    const event = { preventDefault() { this.defaultPrevented = true; } };
    this.lastEvent = event;
    return this.listeners.get(type)?.(event);
  }
}

function setup(t) {
  const previous = globalThis.document;
  const nodes = Object.fromEntries(['dialog', 'form', 'site', 'close', 'cancel', 'confirm', 'error'].map(name => [name, new Control()]));
  const main = new Control();
  const opener = new Control();
  globalThis.document = {
    activeElement: opener,
    querySelector: selector => selector === '#main' ? main : nodes[selector.replace('#send-destination-', '')],
  };
  t.after(() => { globalThis.document = previous; });
  nodes.site.value = 'csa-gate-test';
  nodes.dialog.open = false;
  nodes.dialog.showModal = () => { nodes.dialog.open = true; };
  nodes.dialog.close = () => { nodes.dialog.open = false; nodes.dialog.fire('close'); };
  let target = { projectId: 'project', outputId: 'output' };
  let send = () => true;
  const calls = [];
  const api = createSendDestinationDialog({
    getTarget: projectId => target?.projectId === projectId ? target : null,
    onSend(snapshot, destination) {
      calls.push({ target: structuredClone(snapshot), destination });
      return send(snapshot, destination);
    },
  });
  return {
    ...nodes, main, opener, api, calls,
    target: () => target,
    setTarget(value) { target = value; },
    setSend(callback) { send = callback; },
    submit: () => nodes.form.fire('submit'),
  };
}

test('opening, Cancel, X, Escape, and external native close never send or change the draft', async t => {
  const ui = setup(t);
  const before = structuredClone(ui.target());
  for (const action of [() => ui.cancel.fire('click'), () => ui.close.fire('click'), () => ui.dialog.fire('cancel'), () => ui.dialog.close()]) {
    ui.opener.focus();
    assert.equal(ui.api.open('project'), true);
    assert.equal(ui.dialog.open, true);
    assert.equal(document.activeElement, ui.site);
    assert.equal(ui.calls.length, 0);
    action();
    assert.equal(ui.dialog.open, false);
    assert.equal(document.activeElement, ui.opener);
    await ui.submit();
    assert.deepEqual(ui.calls, []);
    assert.deepEqual(ui.target(), before);
  }
});

test('an unsendable or different project cannot open a destination dialog', t => {
  const ui = setup(t);
  assert.equal(ui.api.open('other-project'), false);
  for (const target of [null, { projectId: 'project' }, { projectId: 'project', outputId: '' }]) {
    ui.setTarget(target);
    assert.equal(ui.api.open('project'), false);
    assert.equal(ui.dialog.open, false);
  }
  assert.deepEqual(ui.calls, []);
});

test('Send confirms the captured draft and selected demo destination, then restores enabled fallback focus', async t => {
  const ui = setup(t);
  ui.setSend(() => { ui.opener.disabled = true; return true; });
  ui.api.open('project');
  assert.deepEqual(ui.calls, []);
  await ui.submit();
  assert.deepEqual(ui.calls, [{ target: { projectId: 'project', outputId: 'output' }, destination: 'csa-gate-test' }]);
  assert.equal(ui.dialog.open, false);
  assert.equal(document.activeElement, ui.main);
  assert.equal(ui.confirm.disabled, true);
});

test('invalid destinations and stale, removed, or switched drafts are blocked before sending', async t => {
  const ui = setup(t);
  ui.api.open('project');
  ui.site.value = 'https://wordpress.example.invalid';
  ui.site.fire('change');
  assert.equal(ui.confirm.disabled, true);
  await ui.submit();
  assert.equal(ui.error.hidden, false);
  assert.match(ui.error.textContent, /Choose a destination/);
  ui.site.value = 'csa-gate-test';
  ui.site.fire('change');
  for (const target of [{ projectId: 'project', outputId: 'another-output' }, null, { projectId: 'other-project', outputId: 'output' }]) {
    ui.setTarget(target);
    await ui.submit();
    assert.equal(ui.dialog.open, true);
    assert.match(ui.error.textContent, /no longer ready/);
    assert.deepEqual(ui.calls, []);
  }
});

test('a pending Send cannot be duplicated or cancelled, and a false result retains the dialog for retry', async t => {
  const ui = setup(t);
  let finish;
  ui.setSend(() => new Promise(resolve => { finish = resolve; }));
  ui.api.open('project');
  const pending = ui.submit();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.dialog.dataset.busy, 'true');
  assert.equal(ui.form.getAttribute('aria-busy'), 'true');
  for (const control of [ui.site, ui.close, ui.cancel, ui.confirm]) assert.equal(control.disabled, true);
  await ui.submit();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.api.close(), false);
  ui.cancel.fire('click');
  ui.close.fire('click');
  ui.dialog.fire('cancel');
  assert.equal(ui.dialog.lastEvent.defaultPrevented, true);
  assert.equal(ui.dialog.open, true);
  finish(false);
  await pending;
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.error.hidden, false);
  assert.equal(ui.site.value, 'csa-gate-test');
  assert.equal(ui.dialog.dataset.busy, 'false');
  assert.equal(document.activeElement, ui.confirm);
  assert.equal(ui.confirm.disabled, false);
  ui.api.open('project');
  assert.equal(ui.error.hidden, false);
  ui.setSend(() => true);
  await ui.submit();
  assert.equal(ui.calls.length, 2);
  assert.equal(ui.dialog.open, false);
});

test('send exceptions stay visible without discarding the selected destination', async t => {
  const ui = setup(t);
  ui.setSend(() => { throw new Error('Unavailable'); });
  ui.api.open('project');
  await ui.submit();
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.error.hidden, false);
  assert.match(ui.error.textContent, /could not be sent/);
  assert.equal(ui.site.value, 'csa-gate-test');
  assert.equal(ui.confirm.disabled, false);
  ui.api.close();
  assert.equal(document.activeElement, ui.opener);
});

test('an old asynchronous completion cannot close a newly opened dialog', async t => {
  const ui = setup(t);
  let finish;
  ui.setSend(() => new Promise(resolve => { finish = resolve; }));
  ui.api.open('project');
  const pending = ui.submit();
  ui.dialog.close();
  ui.setTarget({ projectId: 'project', outputId: 'new-output' });
  assert.equal(ui.api.open('project'), true);
  finish(true);
  await pending;
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.confirm.disabled, false);
  ui.api.close();
});

test('closing returns focus to main when the original trigger was removed or hidden', t => {
  const ui = setup(t);
  ui.api.open('project');
  ui.opener.isConnected = false;
  ui.api.close();
  assert.equal(document.activeElement, ui.main);
  ui.opener.isConnected = true;
  ui.opener.focus();
  ui.api.open('project');
  ui.opener.hiddenParent = new Control();
  ui.api.close();
  assert.equal(document.activeElement, ui.main);
});
