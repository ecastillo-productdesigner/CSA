import test from 'node:test';
import assert from 'node:assert/strict';
import { createRailPanelTransition } from '../dist/navigation.js';

class MotionQuery extends EventTarget {
  matches = false;
  set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')); }
}

function fixture({ hidden = true, reduced = false, duration = '0.2s', animate = true } = {}) {
  const motion = new MotionQuery();
  motion.matches = reduced;
  const document = { activeElement: null, defaultView: { getComputedStyle: () => ({ transform: current?.visualTransform || 'none' }) } };
  const child = {};
  const attributes = new Map();
  const triggerAttributes = new Map();
  const animations = [];
  let current = null;
  let hiddenCalls = 0;
  const trigger = {
    setAttribute: (name, value) => triggerAttributes.set(name, value),
    focus() { document.activeElement = trigger; },
  };
  const panel = {
    ownerDocument: document, hidden, isConnected: true, inert: false,
    setAttribute: (name, value) => attributes.set(name, value),
    contains: node => node === child,
    animate: animate ? (frames, options) => {
      let resolve;
      let reject;
      const animation = {
        frames, options, visualTransform: frames[0].transform, cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish: () => resolve(), fail: () => reject(new Error('Interrupted')),
        cancel() { this.cancelled = true; if (current === this) current = null; },
      };
      current = animation;
      animations.push(animation);
      return animation;
    } : undefined,
  };
  const transition = createRailPanelTransition(panel, {
    trigger, motionQuery: motion,
    readToken: path => path.endsWith('duration.200') ? duration : path.endsWith('space.5') ? '5px' : 'ease',
    onHidden: () => hiddenCalls++,
  });
  return { panel, trigger, child, document, motion, attributes, triggerAttributes, animations, transition, hiddenCalls: () => hiddenCalls };
}

const flush = () => Promise.resolve();

test('opening Sources uses the shared 200 ms ease motion without fading text', async () => {
  const state = fixture();
  assert.equal(state.animations.length, 0);
  state.transition.setVisible(true);
  assert.equal(state.panel.hidden, false);
  assert.equal(state.panel.inert, false);
  assert.equal(state.triggerAttributes.get('aria-expanded'), 'true');
  assert.equal(state.attributes.get('aria-hidden'), 'false');
  assert.deepEqual(state.animations[0].frames, [
    { transform: 'translateX(calc(-1 * 5px))' }, { transform: 'translateX(0)' },
  ]);
  assert.equal(state.animations[0].options.duration, 200);
  assert.equal(state.animations[0].options.easing, 'ease');
  state.animations[0].finish();
  await flush();
  assert.equal(state.panel.hidden, false);
  assert.equal(state.animations[0].cancelled, true);
});

test('closing returns focus immediately, disables interaction and reparents only after the slide completes', async () => {
  const state = fixture({ hidden: false, duration: '200ms' });
  state.document.activeElement = state.child;
  state.transition.setVisible(false);
  assert.equal(state.document.activeElement, state.trigger);
  assert.equal(state.panel.hidden, false);
  assert.equal(state.panel.inert, true);
  assert.equal(state.attributes.get('aria-hidden'), 'true');
  assert.equal(state.triggerAttributes.get('aria-expanded'), 'false');
  assert.equal(state.hiddenCalls(), 0);
  assert.equal(state.animations[0].options.duration, 200);
  state.animations[0].finish();
  await flush();
  assert.equal(state.panel.hidden, true);
  assert.equal(state.hiddenCalls(), 1);
});

test('rapid close/open reversal starts at the visible transform and ignores the outdated close completion', async () => {
  const state = fixture({ hidden: false });
  state.transition.setVisible(false);
  const closing = state.animations[0];
  closing.visualTransform = 'matrix(1, 0, 0, 1, -2, 0)';
  state.transition.setVisible(true);
  const opening = state.animations[1];
  assert.equal(closing.cancelled, true);
  assert.equal(opening.frames[0].transform, closing.visualTransform);
  closing.finish();
  await flush();
  assert.equal(state.panel.hidden, false);
  assert.equal(state.panel.inert, false);
  assert.equal(state.hiddenCalls(), 0);
  opening.finish();
  await flush();
  assert.equal(state.transition.visible, true);
  assert.equal(state.panel.hidden, false);
});

test('reduced motion and layout reset settle immediately without a pending close race', async () => {
  const reduced = fixture({ reduced: true });
  reduced.transition.setVisible(true);
  reduced.transition.setVisible(false);
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.panel.hidden, true);
  const state = fixture({ hidden: false });
  state.transition.setVisible(false);
  const closing = state.animations[0];
  state.motion.set(true);
  assert.equal(closing.cancelled, true);
  assert.equal(state.panel.hidden, true);
  state.transition.setVisible(true);
  assert.equal(state.panel.hidden, false);
  closing.finish();
  await flush();
  assert.equal(state.panel.hidden, false);
  state.motion.set(false);
  state.transition.setVisible(false, { animate: false });
  assert.equal(state.panel.hidden, true);
  assert.equal(state.animations.length, 1);
});

test('interrupted animation, missing animation API and destruction preserve the requested final state', async () => {
  const plain = fixture({ animate: false });
  plain.transition.setVisible(true);
  assert.equal(plain.panel.hidden, false);
  plain.transition.setVisible(false);
  assert.equal(plain.panel.hidden, true);
  const state = fixture({ hidden: false });
  state.transition.setVisible(false);
  state.animations[0].fail();
  await flush();
  assert.equal(state.panel.hidden, true);
  state.transition.setVisible(true);
  const opening = state.animations[1];
  state.transition.destroy();
  state.transition.setVisible(false);
  opening.finish();
  await flush();
  assert.equal(opening.cancelled, true);
  assert.equal(state.panel.hidden, false);
  assert.equal(state.panel.inert, false);
});
