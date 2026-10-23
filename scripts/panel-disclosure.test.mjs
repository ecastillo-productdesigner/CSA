import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanelDisclosure } from '../dist/panel-disclosure.js';

class MotionQuery extends EventTarget {
  matches = false;
  set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')); }
}

function fixture({ expanded = true, reduced = false } = {}) {
  const document = { activeElement: null, defaultView: {} };
  const child = {};
  const classes = new Set();
  const attributes = new Map();
  const animations = [];
  let activeAnimation = null;
  const body = {
    ownerDocument: document, hidden: false, inert: false, isConnected: true,
    dataset: {}, style: { height: '', overflow: 'auto' },
    classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
    setAttribute: (name, value) => attributes.set(name, value),
    contains: node => node === child,
    getBoundingClientRect() {
      return { height: this.hidden ? 0 : activeAnimation?.visualHeight ?? (this.style.height ? Number.parseFloat(this.style.height) : 240) };
    },
    animate(frames, options) {
      let finish;
      let reject;
      const animation = {
        frames, options, visualHeight: Number.parseFloat(frames[0].height), cancelled: false,
        finished: new Promise((resolve, fail) => { finish = resolve; reject = fail; }),
        finish() { finish(); },
        fail() { reject(new Error('Animation interrupted')); },
        cancel() { this.cancelled = true; if (activeAnimation === this) activeAnimation = null; },
      };
      activeAnimation = animation;
      animations.push(animation);
      return animation;
    },
  };
  const triggerAttributes = new Map();
  const chevron = { textContent: '' };
  const trigger = {
    setAttribute: (name, value) => triggerAttributes.set(name, value),
    querySelector: () => chevron,
    focus: () => { document.activeElement = trigger; },
  };
  const panel = { dataset: {} };
  const motion = new MotionQuery();
  motion.matches = reduced;
  const disclosure = createPanelDisclosure({
    body, trigger, panel, expanded, motionQuery: motion,
    readToken: path => path.endsWith('duration.200') ? '200ms' : 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  });
  return { body, trigger, panel, child, document, attributes, triggerAttributes, chevron, animations, motion, disclosure };
}

const flush = () => Promise.resolve();

test('restored disclosure state is immediate and keeps collapsed controls out of focus', () => {
  const state = fixture({ expanded: false });
  assert.equal(state.animations.length, 0);
  assert.equal(state.body.hidden, true);
  assert.equal(state.body.inert, true);
  assert.equal(state.attributes.get('aria-hidden'), 'true');
  assert.equal(state.triggerAttributes.get('aria-expanded'), 'false');
  assert.equal(state.chevron.textContent, 'keyboard_arrow_down');
  state.disclosure.setExpanded(true, { animate: false });
  assert.equal(state.animations.length, 0);
  assert.equal(state.body.hidden, false);
  assert.equal(state.body.inert, false);
  assert.equal(state.panel.dataset.collapsed, 'false');
});

test('collapse moves focus to its trigger and hides the body after the measured animation', async () => {
  const state = fixture();
  state.document.activeElement = state.child;
  state.disclosure.setExpanded(false);
  assert.equal(state.document.activeElement, state.trigger);
  assert.equal(state.body.hidden, false);
  assert.equal(state.body.inert, true);
  assert.equal(state.attributes.get('aria-hidden'), 'true');
  assert.deepEqual(state.animations[0].frames, [{ height: '240px' }, { height: '0px' }]);
  assert.equal(state.animations[0].options.duration, 200);
  assert.equal(state.body.style.overflow, 'hidden');
  state.animations[0].finish();
  await flush();
  assert.equal(state.body.hidden, true);
  assert.equal(state.body.style.height, '');
  assert.equal(state.body.style.overflow, 'auto');
  assert.equal(state.body.dataset.disclosureAnimating, undefined);
});

test('rapid reversal starts at the visible height and ignores an outdated completion', async () => {
  const state = fixture();
  state.disclosure.setExpanded(false);
  const closing = state.animations[0];
  closing.visualHeight = 90;
  state.disclosure.setExpanded(true);
  const opening = state.animations[1];
  assert.equal(closing.cancelled, true);
  assert.deepEqual(opening.frames, [{ height: '90px' }, { height: '240px' }]);
  assert.equal(state.disclosure.expanded, true);
  assert.equal(state.body.inert, false);
  closing.finish();
  await flush();
  assert.equal(state.body.hidden, false);
  assert.equal(state.body.dataset.disclosureAnimating, 'true');
  opening.finish();
  await flush();
  assert.equal(state.body.hidden, false);
  assert.equal(state.body.getBoundingClientRect().height, 240);
});

test('reduced motion is immediate and changing the preference settles in-flight motion', async () => {
  const reduced = fixture({ reduced: true });
  reduced.disclosure.setExpanded(false);
  reduced.disclosure.setExpanded(true);
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.body.hidden, false);
  const state = fixture();
  state.disclosure.setExpanded(false);
  state.motion.set(true);
  assert.equal(state.animations[0].cancelled, true);
  assert.equal(state.body.hidden, true);
  state.animations[0].finish();
  await flush();
  assert.equal(state.body.hidden, true);
});

test('interrupted animations settle safely and destroyed disclosures ignore later requests', async () => {
  const state = fixture();
  state.disclosure.setExpanded(false);
  state.animations[0].fail();
  await flush();
  assert.equal(state.body.hidden, true);
  state.disclosure.setExpanded(true);
  state.disclosure.destroy();
  assert.equal(state.body.hidden, false);
  assert.equal(state.body.style.height, '');
  state.disclosure.setExpanded(false);
  assert.equal(state.body.hidden, false);
  state.animations[1].finish();
  await flush();
  assert.equal(state.body.hidden, false);
});
