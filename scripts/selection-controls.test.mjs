import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTabSelection, bindRovingSelection } from '../dist/selection-controls.js';

class Control {
  constructor(value) { this.value = value; this.id = `tab-${value}`; this.attributes = new Map(); this.tabIndex = 0; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  contains(target) { return target?.parent === this; }
  focus(options) { this.focused = options; }
}
function fixture(values = ['pending', 'created']) {
  const root = new Control('root');
  const listeners = new Map();
  root.addEventListener = (type, listener) => listeners.set(type, listener);
  root.removeEventListener = (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); };
  root.emit = (type, target, properties = {}) => {
    const event = { target, preventDefault() { this.defaultPrevented = true; }, ...properties };
    listeners.get(type)?.(event);
    return event;
  };
  return { root, panel: new Control('panel'), items: values.map(value => new Control(value)), listeners };
}

test('tabs share selected state, panel labeling, and wrapping arrow/Home/End activation', () => {
  const state = fixture();
  const changes = [];
  const selection = bindTabSelection({ ...state, onSelect(value, item) { changes.push([value, item]); selection.sync(value); } });
  selection.sync('pending');
  assert.equal(state.root.getAttribute('role'), 'tablist');
  assert.equal(state.panel.getAttribute('role'), 'tabpanel');
  assert.ok(state.items.every(item => item.getAttribute('aria-controls') === state.panel.id));
  assert.deepEqual(state.items.map(item => [item.getAttribute('role'), item.getAttribute('aria-selected'), item.tabIndex]), [['tab', 'true', 0], ['tab', 'false', -1]]);
  assert.equal(state.panel.getAttribute('aria-labelledby'), 'tab-pending');

  for (const [key, start, next] of [['ArrowLeft', 0, 1], ['ArrowRight', 1, 0], ['End', 0, 1], ['Home', 1, 0]]) {
    const event = state.root.emit('keydown', state.items[start], { key });
    assert.equal(event.defaultPrevented, true);
    assert.equal(changes.at(-1)[0], state.items[next].value);
    assert.equal(changes.at(-1)[1], state.items[next]);
    assert.deepEqual(state.items[next].focused, { preventScroll: true });
    assert.equal(state.panel.getAttribute('aria-labelledby'), state.items[next].id);
    assert.deepEqual(state.items.map(item => item.tabIndex), next ? [-1, 0] : [0, -1]);
  }
  assert.equal(changes.length, 4);
  state.root.emit('click', { parent: state.items[1] });
  assert.equal(changes.length, 5, 'a nested icon click activates its button once');
  assert.equal(state.panel.getAttribute('aria-labelledby'), 'tab-created');
});

test('keyboard navigation skips disabled and hidden choices without intercepting native button keys or browser shortcuts', () => {
  const state = fixture(['first', 'disabled', 'hidden', 'last']);
  state.items[1].disabled = true;
  state.items[2].hidden = true;
  const changes = [];
  const selection = bindTabSelection({ ...state, onSelect(value) { changes.push(value); selection.sync(value); } });
  selection.sync('first');
  state.root.emit('keydown', state.items[0], { key: 'ArrowRight' });
  assert.deepEqual(changes, ['last']);
  for (const properties of [{ key: 'ArrowDown' }, { key: 'Enter' }, { key: ' ' }, { key: 'Tab' }, { key: 'ArrowLeft', altKey: true }]) {
    assert.equal(state.root.emit('keydown', state.items[3], properties).defaultPrevented, undefined);
  }
  state.root.emit('click', state.items[1]);
  state.root.emit('click', state.items[2]);
  state.root.emit('keydown', new Control('foreign'), { key: 'Home' });
  assert.deepEqual(changes, ['last']);
  selection.destroy();
  state.root.emit('click', state.items[0]);
  assert.equal(state.listeners.size, 0);
  assert.deepEqual(changes, ['last']);
});

test('vertical tabs use Up/Down navigation and keep horizontal arrows available to their surrounding UI', () => {
  const state = fixture();
  const changes = [];
  const selection = bindTabSelection({ ...state, orientation: 'vertical', onSelect(value) { changes.push(value); selection.sync(value); } });
  selection.sync('pending');
  assert.equal(state.root.getAttribute('aria-orientation'), 'vertical');
  state.root.emit('keydown', state.items[0], { key: 'ArrowUp' });
  state.root.emit('keydown', state.items[1], { key: 'ArrowDown' });
  assert.deepEqual(changes, ['created', 'pending']);
  assert.equal(state.root.emit('keydown', state.items[0], { key: 'ArrowRight' }).defaultPrevented, undefined);
});

test('layout switches retain pressed button semantics and separate Tab stops while sharing arrow navigation', () => {
  const state = fixture(['grid', 'list']);
  state.root.setAttribute('role', 'group');
  const changes = [];
  const selection = bindRovingSelection({ ...state, onSelect(value) { changes.push(value); selection.sync(value); } });
  selection.sync('grid');
  assert.equal(state.root.getAttribute('role'), 'group');
  assert.deepEqual(state.items.map(item => [item.getAttribute('aria-pressed'), item.tabIndex]), [['true', 0], ['false', 0]]);
  state.root.emit('keydown', state.items[0], { key: 'End' });
  assert.deepEqual(changes, ['list']);
  assert.deepEqual(state.items.map(item => [item.getAttribute('aria-pressed'), item.tabIndex]), [['false', 0], ['true', 0]]);
  assert.equal(state.items[1].getAttribute('role'), undefined);
});
