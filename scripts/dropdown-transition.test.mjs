import test from 'node:test';
import assert from 'node:assert/strict';
import { createDropdownTransition } from '../dist/dropdown-transition.js';

class MotionQuery extends EventTarget {
  matches = false;
  set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')); }
}

function fixture({ reduced = false } = {}) {
  const animations = [];
  const attributes = new Map();
  const motion = new MotionQuery();
  motion.matches = reduced;
  let closed = 0;
  const menu = {
    ownerDocument: { defaultView: {} }, hidden: true, inert: false, isConnected: true, dataset: {},
    visibleFrame: { opacity: 1, transform: 'none' },
    setAttribute: (name, value) => attributes.set(name, value),
    animate(frames, options) {
      let finish;
      let fail;
      const animation = {
        frames, options, cancelled: false,
        finished: new Promise((resolve, reject) => { finish = resolve; fail = reject; }),
        finish() { finish(); },
        fail() { fail(new Error('Animation interrupted')); },
        cancel() { this.cancelled = true; },
      };
      this.visibleFrame = frames[0];
      animations.push(animation);
      return animation;
    },
  };
  const transition = createDropdownTransition(menu, {
    onClosed: () => closed++, motionQuery: motion,
    readStyle: element => element.visibleFrame,
    readNumber: () => 4,
    readToken: path => path.endsWith('duration.200') ? '200ms' : 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  });
  return { menu, attributes, animations, motion, transition, closed: () => closed };
}

const flush = () => Promise.resolve();

test('closing immediately excludes the menu from focus and accessibility before its visual fade ends', async () => {
  const state = fixture();
  state.transition.open();
  assert.equal(state.menu.hidden, false);
  assert.equal(state.menu.inert, false);
  assert.equal(state.attributes.get('aria-hidden'), 'false');
  state.menu.visibleFrame = { opacity: 0.6, transform: 'translateY(-2px)' };
  state.transition.close();
  assert.equal(state.transition.expanded, false);
  assert.equal(state.menu.hidden, false);
  assert.equal(state.menu.inert, true);
  assert.equal(state.attributes.get('aria-hidden'), 'true');
  assert.equal(state.menu.dataset.dropdownState, 'closing');
  state.animations[1].finish();
  await flush();
  assert.equal(state.menu.hidden, true);
  assert.equal(state.closed(), 1);
  assert.equal(state.menu.dataset.dropdownMoving, undefined);
});

test('both opening and closing use the same token timing and slide toward the trigger', async () => {
  const state = fixture();
  state.transition.open({ opensUp: true });
  assert.deepEqual(state.animations[0].frames, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }]);
  state.animations[0].finish();
  await flush();
  assert.equal(state.menu.dataset.dropdownState, 'open');
  state.transition.close();
  assert.deepEqual(state.animations[1].frames[1], { opacity: 0, transform: 'translateY(4px)' });
  for (const animation of state.animations) {
    assert.equal(animation.options.duration, 200);
    assert.equal(animation.options.easing, 'cubic-bezier(0.25, 0.1, 0.25, 1)');
  }
});

test('rapid reopen reverses the visible frame and cannot be hidden by an old closing completion', async () => {
  const state = fixture();
  state.transition.open();
  state.transition.settle();
  state.transition.close();
  const closing = state.animations[1];
  state.menu.visibleFrame = { opacity: 0.5, transform: 'translateY(-2px)' };
  state.transition.open();
  const reopening = state.animations[2];
  assert.equal(closing.cancelled, true);
  assert.deepEqual(reopening.frames[0], { opacity: 0.5, transform: 'translateY(-2px)' });
  closing.finish();
  await flush();
  assert.equal(state.closed(), 0);
  assert.equal(state.menu.hidden, false);
  assert.equal(state.menu.inert, false);
  reopening.finish();
  await flush();
  assert.equal(state.menu.dataset.dropdownState, 'open');
});

test('refresh settles the current intent without changing an open menu or leaving a closing portal', async () => {
  const state = fixture();
  state.transition.open();
  state.transition.settle();
  assert.equal(state.menu.hidden, false);
  assert.equal(state.transition.expanded, true);
  assert.equal(state.animations[0].cancelled, true);
  state.transition.close();
  state.transition.settle();
  assert.equal(state.menu.hidden, true);
  assert.equal(state.closed(), 1);
  state.animations[1].finish();
  await flush();
  assert.equal(state.closed(), 1);
});

test('reduced motion and preference changes settle immediately', () => {
  const reduced = fixture({ reduced: true });
  reduced.transition.open();
  reduced.transition.close();
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.menu.hidden, true);
  const state = fixture();
  state.transition.open();
  state.motion.set(true);
  assert.equal(state.animations[0].cancelled, true);
  assert.equal(state.menu.hidden, false);
  state.transition.close();
  assert.equal(state.menu.hidden, true);
  assert.equal(state.animations.length, 1);
});

test('removal or interrupted animation cleans up without a stale visible menu', async () => {
  const state = fixture();
  state.transition.open();
  state.transition.close();
  state.animations[1].fail();
  await flush();
  assert.equal(state.menu.hidden, true);
  assert.equal(state.closed(), 1);
  state.transition.open();
  state.transition.destroy();
  assert.equal(state.menu.hidden, true);
  assert.equal(state.menu.inert, true);
  assert.equal(state.closed(), 2);
  state.animations[2].finish();
  await flush();
  assert.equal(state.closed(), 2);
  state.transition.open();
  assert.equal(state.menu.hidden, true);
});
