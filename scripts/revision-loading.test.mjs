import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevisionLoading } from '../dist/revision-loading.js';

function fixture() {
  const host = { hidden: true, children: [], replaceChildren(...children) { this.children = children; } };
  const content = [{ hidden: false, inert: false }, { hidden: true, inert: true }];
  const animations = [];
  const controller = createRevisionLoading({ host, content, createAnimation() {
    const animation = { element: {}, destroyed: false, destroy() { this.destroyed = true; } };
    animations.push(animation);
    return animation;
  } });
  return { host, content, animations, controller };
}

test('revision loading blocks document controls, reuses one animation and restores previous visibility', () => {
  const { host, content, animations, controller } = fixture();
  controller.setBusy(true);
  assert.equal(host.hidden, false);
  assert.deepEqual(host.children, [animations[0].element]);
  assert.equal(content.every(element => element.hidden && element.inert), true);
  controller.setBusy(true);
  assert.equal(animations.length, 1, 'rerendering the same job must not leak observers or duplicate status messages');
  controller.setBusy(false);
  assert.equal(animations[0].destroyed, true);
  assert.equal(host.hidden, true);
  assert.deepEqual(host.children, []);
  assert.deepEqual(content, [{ hidden: false, inert: false }, { hidden: true, inert: true }]);
  controller.setBusy(false);
  assert.equal(animations.length, 1);
});

test('closing or changing a draft removes the old animation and the next job mounts a fresh one', () => {
  const { host, content, animations, controller } = fixture();
  controller.setBusy(true);
  controller.destroy();
  assert.equal(animations[0].destroyed, true);
  assert.equal(host.hidden, true);
  assert.equal(content[0].inert, false);
  controller.setBusy(true);
  assert.equal(animations.length, 2);
  assert.notEqual(host.children[0], animations[0].element);
  controller.destroy();
  controller.destroy();
  assert.equal(animations[1].destroyed, true);
  assert.equal(host.hidden, true);
});
