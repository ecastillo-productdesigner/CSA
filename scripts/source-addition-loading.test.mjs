import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceAdditionLoading } from '../dist/source-addition-loading.js';

class Element {
  constructor() { this.className = ''; this.attributes = new Map(); this.classList = { toggle: (name, enabled) => { this.className = enabled ? name : ''; } }; this.children = []; this.scrollHeight = 400; this.scrollTop = 0; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(child) { return this === child || this.children.some(element => element.contains(child)); }
  focus() { document.activeElement = this; }
  querySelector() { return null; }
  get lastElementChild() { return this.children.at(-1); }
  append(child) { child.remove(); this.children.push(child); child.parentElement = this; }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
}

function setup(t) {
  const globals = ['document', 'getComputedStyle', 'setTimeout', 'clearTimeout'];
  const previous = Object.fromEntries(globals.map(name => [name, globalThis[name]]));
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  Object.assign(globalThis, {
    document: { createElement: () => new Element(), documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: name => name === '--csa-component-drafting-source-add-duration' ? '5000ms' : '' }),
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  t.after(() => Object.assign(globalThis, previous));
  const list = new Element();
  const existing = new Element(); list.append(existing);
  const animations = [];
  const controller = createSourceAdditionLoading({ list, createAnimation(options) {
    const animation = { element: new Element(), options, destroyed: false, destroy() { this.destroyed = true; } };
    animations.push(animation);
    return animation;
  } });
  t.after(() => controller.destroy());
  function tick(ms) {
    const until = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].callback();
    }
    now = until;
  }
  controller.render('one');
  return { list, existing, controller, animations, timers, tick };
}

test('source-list shimmer sits below existing sources for exactly five seconds', async t => {
  const ui = setup(t);
  let completed = false;
  const pending = ui.controller.wait('one').then(result => { completed = result; });
  assert.equal(ui.list.children[0], ui.existing);
  assert.equal(ui.list.children.length, 2);
  assert.equal(ui.list.lastElementChild.className, 'editor-source-addition');
  assert.equal(ui.animations[0].options.label, 'Adding sources');
  assert.equal(ui.list.scrollTop, ui.list.scrollHeight, 'only the source list scrolls to reveal loading');
  ui.tick(4999);
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(ui.controller.isPending('one'), true);
  assert.equal(ui.animations[0].destroyed, false);
  ui.tick(1);
  await pending;
  assert.equal(completed, true);
  assert.equal(ui.controller.isPending('one'), false);
  assert.deepEqual(ui.list.children, [ui.existing]);
  assert.equal(ui.animations[0].destroyed, true);
});

test('switching projects hides the unrelated shimmer and returning restores the remaining wait', async t => {
  const ui = setup(t);
  const pending = ui.controller.wait('one');
  ui.tick(2000);
  ui.controller.render('two');
  assert.equal(ui.list.children.length, 1);
  assert.equal(ui.animations[0].destroyed, true);
  assert.equal(ui.controller.isPending('one'), true);
  ui.controller.render('one');
  assert.equal(ui.list.children.length, 2);
  assert.equal(ui.animations.length, 2);
  const row = ui.list.lastElementChild;
  row.remove(); // A normal source render rebuilds the list.
  ui.controller.render('one');
  assert.equal(ui.list.lastElementChild, row, 'the pending row survives list rerenders without another animation');
  assert.equal(ui.animations.length, 2);
  ui.tick(3000);
  assert.equal(await pending, true);
  assert.equal(ui.list.children.length, 1);
  assert.equal(ui.animations[1].destroyed, true);
});

test('overlapping batches retain loading until every batch finishes, and destroy cancels pending work', async t => {
  const ui = setup(t);
  const first = ui.controller.wait('one');
  ui.tick(1000);
  const second = ui.controller.wait('one');
  ui.tick(4000);
  assert.equal(await first, true);
  assert.equal(ui.controller.isPending('one'), true);
  assert.equal(ui.animations[0].destroyed, false);
  ui.tick(1000);
  assert.equal(await second, true);
  assert.equal(ui.list.children.length, 1);
  const canceled = ui.controller.wait('one');
  ui.controller.destroy();
  assert.equal(await canceled, false);
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.list.children.length, 1);
});


test('a source row shimmers in place for five seconds and returns after rerendering without moving its neighbors', async t => {
  const ui = setup(t);
  const source = { title: 'Selected source' };
  const following = new Element();
  ui.list.append(following);
  ui.controller.render('one', [{ source, row: ui.existing }]);
  const pending = ui.controller.wait('one', source);
  assert.deepEqual(ui.list.children, [ui.existing, following]);
  assert.equal(ui.existing.className, 'is-adding-source');
  assert.equal(ui.animations.at(-1).options.label, 'Adding Source');
  ui.tick(2000);
  const replacement = new Element();
  ui.existing.remove();
  following.remove();
  ui.list.append(replacement); ui.list.append(following);
  ui.controller.render('one', [{ source, row: replacement }]);
  assert.equal(ui.existing.className, '');
  assert.equal(replacement.className, 'is-adding-source');
  assert.equal(ui.animations[0].destroyed, true);
  ui.tick(2999);
  assert.equal(replacement.className, 'is-adding-source');
  ui.tick(1);
  assert.equal(await pending, true);
  assert.equal(replacement.className, '');
  assert.deepEqual(ui.list.children, [replacement, following]);
  assert.equal(replacement.children.length, 0);
  assert.equal(ui.animations.at(-1).destroyed, true);
});
