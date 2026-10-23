import test from 'node:test';
import assert from 'node:assert/strict';
import { createTabPanelTransition } from '../dist/tab-panel-transition.js';

class MotionQuery extends EventTarget {
  matches = false;
  set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')); }
}

function fixture({ reduced = false, connected = true } = {}) {
  const animations = [];
  const motion = new MotionQuery();
  motion.matches = reduced;
  const panel = {
    ownerDocument: { defaultView: {} }, isConnected: connected, hidden: false,
    children: ['old card'], selected: 'pending',
    animate(frames, options) {
      let finish;
      let fail;
      const animation = {
        frames, options, selectedWhenStarted: this.selected, cancelled: false,
        finished: new Promise((resolve, reject) => { finish = resolve; fail = reject; }),
        finish() { finish(); },
        fail() { fail(new Error('Animation interrupted')); },
        cancel() { this.cancelled = true; },
      };
      animations.push(animation);
      return animation;
    },
  };
  const transition = createTabPanelTransition(panel, {
    motionQuery: motion,
    readToken: path => path.endsWith('duration.200') ? '200ms' : 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  });
  return { panel, animations, motion, transition };
}

const flush = () => Promise.resolve();

test('new content and selected state replace the old cards before the fade starts', async () => {
  const state = fixture();
  const result = state.transition.run(() => {
    state.panel.children = ['new drafted card'];
    state.panel.selected = 'drafted';
    return 'rendered';
  });
  assert.equal(result, 'rendered');
  assert.deepEqual(state.panel.children, ['new drafted card']);
  assert.equal(state.animations[0].selectedWhenStarted, 'drafted');
  assert.deepEqual(state.animations[0].frames, [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(state.animations[0].options.duration, 200);
  assert.equal(state.animations[0].options.easing, 'cubic-bezier(0.25, 0.1, 0.25, 1)');
  state.animations[0].finish();
  await flush();
  assert.equal(state.animations[0].cancelled, true);
  assert.deepEqual(state.panel.children, ['new drafted card']);
});

test('rapid switches cancel the previous fade and ignore its later completion', async () => {
  const state = fixture();
  state.transition.run(() => { state.panel.selected = 'drafted'; });
  const first = state.animations[0];
  state.transition.run(() => { state.panel.selected = 'pending'; });
  const second = state.animations[1];
  assert.equal(first.cancelled, true);
  first.finish();
  await flush();
  assert.equal(second.cancelled, false);
  assert.equal(state.panel.selected, 'pending');
  second.finish();
  await flush();
  assert.equal(second.cancelled, true);
});

test('reduced-motion and disconnected panels still render immediately without fading', () => {
  for (const options of [{ reduced: true }, { connected: false }]) {
    const state = fixture(options);
    let renders = 0;
    state.transition.run(() => { renders++; state.panel.selected = 'drafted'; });
    assert.equal(renders, 1);
    assert.equal(state.panel.selected, 'drafted');
    assert.equal(state.animations.length, 0);
  }
});

test('cancelling or enabling reduced motion leaves the current content intact', () => {
  const state = fixture();
  state.transition.run(() => { state.panel.children = ['current card']; });
  state.motion.set(true);
  assert.equal(state.animations[0].cancelled, true);
  assert.deepEqual(state.panel.children, ['current card']);
  state.transition.run(() => { state.panel.children = ['latest card']; });
  assert.equal(state.animations.length, 1);
  assert.deepEqual(state.panel.children, ['latest card']);
});

test('render failures and interrupted animations do not leave stale animation effects', async () => {
  const state = fixture();
  state.transition.run(() => {});
  assert.throws(() => state.transition.run(() => { throw new Error('Render failed'); }), /Render failed/);
  assert.equal(state.animations[0].cancelled, true);
  assert.equal(state.animations.length, 1);
  state.transition.run(() => { state.panel.selected = 'drafted'; });
  state.animations[1].fail();
  await flush();
  assert.equal(state.animations[1].cancelled, true);
  assert.equal(state.panel.selected, 'drafted');
  state.transition.destroy();
  state.transition.run(() => { state.panel.selected = 'pending'; });
  assert.equal(state.panel.selected, 'pending');
  assert.equal(state.animations.length, 2);
});
