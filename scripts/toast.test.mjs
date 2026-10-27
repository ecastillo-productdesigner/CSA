import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createToast } from '../dist/toast.js';

function setup(t) {
  const names = ['document', 'getComputedStyle', 'setTimeout', 'clearTimeout'];
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  const tokens = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8')).component.toast;
  const timers = new Map();
  const handlers = new Map();
  let now = 0;
  let id = 0;
  globalThis.document = { documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue(name) {
    const token = tokens[name.replace('--csa-component-toast-', '')];
    return token ? `${token.$value.value}${token.$value.unit}` : '';
  } });
  globalThis.setTimeout = (callback, delay) => { timers.set(++id, { callback, at: now + delay }); return id; };
  globalThis.clearTimeout = timer => timers.delete(timer);
  const root = { hidden: true };
  const message = { textContent: '' };
  const action = { hidden: true, addEventListener(name, callback) { handlers.set(name, callback); }, removeEventListener(name) { handlers.delete(name); } };
  const toast = createToast({ root, message, action });
  function tick(ms) {
    now += ms;
    for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.callback(); }
  }
  t.after(() => {
    toast.destroy();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  });
  return { root, message, action, toast, tick, timers, click: () => handlers.get('click')?.() };
}

test('message toasts use the shared five-second duration and remove a final period', t => {
  const ui = setup(t);
  ui.toast.show('  Source added.  ');
  assert.equal(ui.message.textContent, 'Source added');
  assert.equal(ui.root.hidden, false);
  assert.equal(ui.action.hidden, true);
  ui.tick(4999);
  assert.equal(ui.root.hidden, false);
  ui.tick(1);
  assert.equal(ui.root.hidden, true);
});

test('Undo stays available for ten seconds and is consumed before a callback shows another toast', t => {
  const ui = setup(t);
  let calls = 0;
  ui.toast.show('Draft deleted', () => { calls += 1; ui.toast.show('Draft restored'); });
  ui.tick(9999);
  assert.equal(ui.root.hidden, false);
  assert.equal(ui.action.hidden, false);
  ui.click();
  ui.click();
  assert.equal(calls, 1);
  assert.equal(ui.message.textContent, 'Draft restored');
  assert.equal(ui.root.hidden, false);
  assert.equal(ui.action.hidden, true);
  ui.tick(4999);
  assert.equal(ui.root.hidden, false);
  ui.tick(1);
  assert.equal(ui.root.hidden, true);
  ui.toast.show('Source deleted', () => calls++);
  ui.tick(10000);
  ui.click();
  assert.equal(calls, 1, 'an expired action cannot run');
});

test('replacing a toast cancels its previous deadline and Undo callback', t => {
  const ui = setup(t);
  let calls = 0;
  ui.toast.show('Source deleted', () => calls++);
  ui.tick(8000);
  ui.toast.show('Revision complete');
  assert.equal(ui.timers.size, 1);
  ui.click();
  assert.equal(calls, 0);
  ui.toast.show('Revision complete');
  ui.tick(4999);
  assert.equal(ui.root.hidden, false);
  ui.tick(1);
  assert.equal(ui.root.hidden, true);
});
