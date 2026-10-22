import test from 'node:test';
import assert from 'node:assert/strict';
import { createSendDestinationDialog, sendDestinations, isSendDestination } from '../dist/send-destination.js';

class Control {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.scrollTop = 0;
    this.disabled = false;
    this.hidden = false;
    this.isConnected = true;
    this.value = '';
    this.textContent = '';
    this.rect = { left: 100, right: 500, top: 200, bottom: 272, width: 400, height: 72 };
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  closest() { return this.hiddenParent || null; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  querySelector(selector) {
    const name = selector.slice(1);
    for (const child of this.children) {
      if ((child.className || '').split(' ').includes(name)) return child;
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
  getBoundingClientRect() {
    const left = Number.parseFloat(this.style.left) || this.rect.left;
    const top = Number.parseFloat(this.style.top) || this.rect.top;
    const width = Number.parseFloat(this.style.width) || this.rect.width;
    const height = Math.min(Number.parseFloat(this.style.maxHeight) || this.rect.height, this.rect.height);
    return { left, right: left + width, top, bottom: top + height, width, height };
  }
  dispatchEvent(event) { return this.listeners.get(event.type)?.(event); }
  focus() { document.activeElement = this; }
  fire(type, detail = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...detail };
    this.lastEvent = event;
    return this.listeners.get(type)?.(event);
  }
}

function setup(t) {
  const previous = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  const nodes = Object.fromEntries(['dialog', 'form', 'site', 'trigger', 'name', 'url', 'admin', 'options', 'close', 'cancel', 'confirm', 'error'].map(name => [name, new Control()]));
  const main = new Control();
  const opener = new Control();
  const doc = new Control();
  doc.activeElement = opener;
  doc.documentElement = { clientWidth: 1024, clientHeight: 768 };
  doc.createElement = tag => new Control(tag);
  doc.querySelector = selector => selector === '#main' ? main : nodes[selector.replace('#send-destination-', '')];
  globalThis.document = doc;
  globalThis.window = new Control();
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => ({ '--csa-foundation-space-12': '12px', '--csa-foundation-space-8': '8px', '--csa-foundation-size-420': '420px' }[name]) });
  t.after(() => { Object.assign(globalThis, previous); });
  nodes.trigger.append(nodes.name, nodes.url, nodes.admin);
  nodes.dialog.append(nodes.trigger, nodes.options);
  nodes.options.hidden = true;
  nodes.options.rect = { left: 100, top: 280, width: 400, height: 380 };
  nodes.site.value = 'csa-gate-test';
  nodes.dialog.open = false;
  nodes.dialog.showModal = () => { nodes.dialog.open = true; };
  nodes.dialog.close = () => { nodes.dialog.open = false; nodes.dialog.fire('close'); };
  let target = { projectId: 'project', outputId: 'output' };
  let send = () => true;
  const calls = [];
  const sentCalls = [];
  const api = createSendDestinationDialog({
    getTarget: projectId => target?.projectId === projectId ? target : null,
    onSend(snapshot, destination) {
      calls.push({ target: structuredClone(snapshot), destination });
      return send(snapshot, destination);
    },
    onSent(snapshot, destination) {
      sentCalls.push({ target: structuredClone(snapshot), destination, dialogOpen: nodes.dialog.open, focused: document.activeElement });
    },
  });
  return {
    ...nodes, document: doc, main, opener, api, calls, sentCalls,
    option: id => nodes.options.children.find(button => button.dataset.sendDestination === id),
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
    assert.equal(document.activeElement, ui.trigger);
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
  for (const control of [ui.site, ui.trigger, ui.close, ui.cancel, ui.confirm, ...ui.options.children]) assert.equal(control.disabled, true);
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

test('the destination catalog contains the requested names, URLs and four noninteractive Admin View tags', t => {
  const ui = setup(t);
  assert.deepEqual(sendDestinations.map(({ id, name, url, adminView }) => [id, name, url, adminView]), [
    ['csa-gate-test', 'CSA gate test (not a real site)', 'https://csa-gate-test.invalid', false],
    ['us-weekly', 'Us Weekly WordPress', 'https://www.usmagazine.com', true],
    ['bargain-hunter', 'Bargain Hunter WordPress', 'https://www.bargainhunter.com', true],
    ['womans-world', "Woman's World", 'https://www.womansworld.com', true],
    ['soap-opera-digest', 'Soap Opera Digest', 'https://www.soapoperadigest.com', true],
  ]);
  assert.equal(ui.site.children.length, 5);
  assert.equal(ui.options.children.length, 5);
  for (const { id, adminView } of sendDestinations) {
    const row = ui.option(id);
    assert.equal(row.type, 'button');
    assert.equal(row.getAttribute('role'), 'option');
    const admin = row.querySelector('.send-destination-admin');
    assert.equal(admin.textContent, 'ADMIN VIEW');
    assert.equal(admin.hidden, !adminView);
    assert.equal(admin.tagName, 'span');
    assert.equal(admin.getAttribute('role'), undefined);
    assert.equal(admin.tabIndex, undefined);
    assert.equal(isSendDestination(id), true);
  }
  for (const invalid of ['', null, 'us-weekly.invalid', 'https://www.usmagazine.com', {}, 1]) assert.equal(isSendDestination(invalid), false);
});

test('every destination can be chosen, updates both trigger lines, and sends only its ID on confirmation', async t => {
  const ui = setup(t);
  for (const destination of sendDestinations) {
    ui.opener.focus();
    ui.api.open('project');
    ui.trigger.fire('click');
    assert.equal(ui.options.hidden, false);
    ui.option(destination.id).fire('click');
    assert.equal(ui.options.hidden, true);
    assert.equal(ui.dialog.open, true);
    assert.equal(ui.site.value, destination.id);
    assert.equal(ui.name.textContent, destination.name);
    assert.equal(ui.url.textContent, destination.url);
    assert.equal(ui.admin.hidden, !destination.adminView);
    assert.equal(document.activeElement, ui.trigger);
    for (const row of ui.options.children) {
      const selected = row.dataset.sendDestination === destination.id;
      assert.equal(row.getAttribute('aria-selected'), String(selected));
      assert.equal(row.querySelector('.send-destination-option-check').hidden, !selected);
    }
    await ui.submit();
    assert.equal(ui.dialog.open, false);
  }
  assert.deepEqual(ui.calls.map(call => call.destination), sendDestinations.map(destination => destination.id));
});

test('keyboard navigation chooses an option and Escape closes the list before closing the dialog', t => {
  const ui = setup(t);
  ui.api.open('project');
  ui.trigger.fire('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, ui.option('csa-gate-test'));
  ui.options.fire('keydown', { key: 'ArrowDown' });
  assert.equal(document.activeElement, ui.option('us-weekly'));
  ui.options.fire('keydown', { key: 'End' });
  assert.equal(document.activeElement, ui.option('soap-opera-digest'));
  ui.options.fire('keydown', { key: 'Home' });
  ui.options.fire('keydown', { key: 'ArrowUp' });
  assert.equal(document.activeElement, ui.option('soap-opera-digest'));
  ui.options.fire('keydown', { key: 'Enter' });
  assert.equal(ui.site.value, 'soap-opera-digest');
  assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.dialog.open, true);
  ui.trigger.fire('keydown', { key: 'Home' });
  assert.equal(document.activeElement, ui.option('csa-gate-test'));
  ui.options.fire('keydown', { key: ' ' });
  assert.equal(ui.site.value, 'csa-gate-test');
  assert.equal(ui.admin.hidden, true);
  ui.trigger.fire('keydown', { key: 'End' });
  ui.options.fire('keydown', { key: 'Escape' });
  assert.equal(ui.options.hidden, true);
  assert.equal(ui.dialog.open, true);
  assert.equal(document.activeElement, ui.trigger);
  ui.trigger.fire('click');
  ui.dialog.fire('cancel');
  assert.equal(ui.options.hidden, true);
  assert.equal(ui.dialog.open, true);
  ui.dialog.fire('cancel');
  assert.equal(ui.dialog.open, false);
  assert.deepEqual(ui.calls, []);
});

test('outside interaction, focus movement, Tab and outside scrolling dismiss only the picker', t => {
  const ui = setup(t);
  ui.api.open('project');
  for (const dismiss of [
    () => ui.document.fire('pointerdown', { target: ui.confirm }),
    () => ui.document.fire('focusin', { target: ui.cancel }),
    () => ui.options.fire('keydown', { key: 'Tab' }),
    () => ui.document.fire('scroll', { target: ui.dialog }),
  ]) {
    ui.trigger.fire('click');
    assert.equal(ui.options.hidden, false);
    ui.document.fire('pointerdown', { target: ui.option('us-weekly') });
    ui.document.fire('scroll', { target: ui.options });
    assert.equal(ui.options.hidden, false);
    dismiss();
    assert.equal(ui.options.hidden, true);
    assert.equal(ui.dialog.open, true);
    assert.equal(ui.site.value, 'csa-gate-test');
  }
  assert.deepEqual(ui.calls, []);
});

test('the picker stays inside the modal and clamps to a narrow viewport with scrolling or an upward flip', t => {
  const ui = setup(t);
  ui.document.documentElement.clientWidth = 320;
  ui.document.documentElement.clientHeight = 568;
  ui.trigger.rect = { left: 32, top: 240, width: 256, height: 72, right: 288, bottom: 312 };
  ui.api.open('project');
  ui.trigger.fire('click');
  assert.equal(ui.options.parent, ui.dialog);
  assert.equal(ui.options.style.width, '256px');
  assert.equal(ui.options.style.left, '32px');
  assert.equal(ui.options.style.top, '320px');
  assert.equal(ui.options.style.maxHeight, '236px');
  assert.equal(ui.options.children.length, 5);
  ui.trigger.rect = { left: 32, top: 420, width: 256, height: 72, right: 288, bottom: 492 };
  window.fire('resize');
  assert.equal(ui.options.style.top, '32px');
  assert.equal(ui.options.style.maxHeight, '400px');
  const bounds = ui.options.getBoundingClientRect();
  assert.ok(bounds.top >= 12 && bounds.bottom <= 556 && bounds.right <= 308);
});

test('busy confirmation closes the list and prevents changing the selected destination', async t => {
  const ui = setup(t);
  let finish;
  ui.setSend(() => new Promise(resolve => { finish = resolve; }));
  ui.api.open('project');
  ui.trigger.fire('click');
  ui.option('us-weekly').fire('click');
  ui.trigger.fire('click');
  const pending = ui.submit();
  assert.equal(ui.options.hidden, true);
  assert.equal(ui.trigger.disabled, true);
  ui.trigger.fire('click');
  ui.option('bargain-hunter').fire('click');
  ui.options.fire('keydown', { key: 'End' });
  assert.equal(ui.site.value, 'us-weekly');
  assert.equal(ui.options.hidden, true);
  assert.equal(ui.calls[0].destination, 'us-weekly');
  finish(true);
  await pending;
});


test('post-Send feedback hook runs once after the destination dialog closes and restores focus', async t => {
  const ui = setup(t);
  ui.api.open('project');
  ui.site.value = 'us-weekly';
  ui.site.fire('change');
  await ui.submit();
  assert.equal(ui.sentCalls.length, 1);
  assert.deepEqual(ui.sentCalls[0], { target: { projectId: 'project', outputId: 'output' }, destination: 'us-weekly', dialogOpen: false, focused: ui.opener });
  ui.api.open('project');
  ui.cancel.fire('click');
  assert.equal(ui.sentCalls.length, 1);
});

test('cancelled, failed and stale sends never open post-Send feedback', async t => {
  const ui = setup(t);
  ui.api.open('project');
  ui.cancel.fire('click');
  ui.api.open('project');
  ui.setSend(() => false);
  await ui.submit();
  assert.deepEqual(ui.sentCalls, []);
  ui.setSend(() => { throw new Error('Try again'); });
  await ui.submit();
  assert.deepEqual(ui.sentCalls, []);
  ui.setTarget(null);
  await ui.submit();
  assert.deepEqual(ui.sentCalls, []);
});
