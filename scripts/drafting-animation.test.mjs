import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDraftingAnimation, draftingMessages } from '../dist/drafting-animation.js';

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) { const handlers = this.listeners.get(name) || new Set(); handlers.add(callback); this.listeners.set(name, handlers); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  fire(name, detail = {}) { for (const callback of this.listeners.get(name) || []) callback({ type: name, ...detail }); }
  listenerCount() { return [...this.listeners.values()].reduce((total, set) => total + set.size, 0); }
}
class Element extends Events {
  constructor(tag = 'div') {
    super();
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.textContent = '';
    this.isConnected = false;
    this.hasLayout = true;
    this.animations = [];
    const classes = new Set();
    this.classList = { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) };
  }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  getClientRects() { return this.hasLayout ? [{}] : []; }
  animate(frames, timing) {
    let finish;
    let fail;
    const animation = {
      frames, timing, cancelled: false,
      finished: new Promise((resolve, reject) => { finish = resolve; fail = reject; }),
      finish() { finish(); },
      cancel() { this.cancelled = true; fail(new Error('Cancelled')); },
    };
    this.animations.push(animation);
    return animation;
  }
}

function setup(t, { reduced = false, observers = true } = {}) {
  const names = ['document', 'window', 'getComputedStyle', 'setTimeout', 'clearTimeout', 'IntersectionObserver', 'MutationObserver'];
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  const document = new Events();
  document.documentElement = new Element('html');
  document.createElement = tag => new Element(tag);
  document.hidden = false;
  const window = new Events();
  const motion = new Events();
  motion.matches = reduced;
  window.matchMedia = () => motion;
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const intersections = [];
  const mutations = [];
  Object.assign(globalThis, {
    document, window,
    getComputedStyle: () => ({ getPropertyValue: name => ({
      '--csa-component-drafting-paper-rotation-step': '3',
      '--csa-component-drafting-paper-scale-step': '0.04',
      '--csa-component-drafting-paper-lift-offset': '0.44',
      '--csa-component-drafting-paper-front-offset': '0.47',
      '--csa-component-drafting-message-hold-duration': '5000ms',
      '--csa-foundation-motion-duration-800': '0.8s',
      '--csa-foundation-motion-easing-arrive': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      '--csa-foundation-space-2': '2px', '--csa-foundation-space-3': '3px',
      '--csa-foundation-space-4': '4px', '--csa-foundation-space-6': '6px',
      '--csa-foundation-space-12': '12px', '--csa-foundation-space-14': '14px',
    }[name] || '') }),
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id),
    IntersectionObserver: observers ? class {
      constructor(callback) { this.callback = callback; this.disconnected = false; intersections.push(this); }
      observe(element) { this.element = element; }
      disconnect() { this.disconnected = true; }
      visible(value) { this.callback([{ target: this.element, isIntersecting: value }]); }
    } : undefined,
    MutationObserver: observers ? class {
      constructor(callback) { this.callback = callback; this.disconnected = false; mutations.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
      change() { this.callback(); }
    } : undefined,
  });
  t.after(() => { for (const name of names) { if (previous[name] === undefined) delete globalThis[name]; else globalThis[name] = previous[name]; } });
  function tick(milliseconds) {
    const until = now + milliseconds;
    let next;
    while ((next = [...timers.entries()].filter(([, task]) => task.at <= until).sort(([, first], [, second]) => first.at - second.at)[0])) {
      const [id, task] = next;
      now = task.at;
      timers.delete(id);
      task.callback();
    }
    now = until;
  }
  const create = options => {
    const controller = createDraftingAnimation(options);
    const stack = controller.element.children[0];
    const message = controller.element.children[1];
    const mount = () => { controller.element.isConnected = true; mutations[0]?.change(); intersections[0]?.visible(true); if (!observers) document.fire('visibilitychange'); };
    return { controller, root: controller.element, stack, message, papers: stack.children, mount };
  };
  return { create, document, window, motion, timers, tick, intersections, mutations };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const allAnimations = ui => ui.papers.flatMap(paper => paper.animations);

 test('the shared component has three decorative white-sheet layers, seven lines each and exact requested messages', t => {
  const env = setup(t);
  const ui = env.create();
  assert.equal(ui.root.className, 'drafting-animation');
  assert.equal(ui.root.dataset.compact, 'true');
  assert.equal(ui.root.dataset.messageCount, '3');
  assert.equal(ui.stack.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(ui.papers.map(paper => paper.dataset.depth), ['back', 'middle', 'front']);
  assert.equal(ui.papers.every(paper => paper.children.length === 7), true);
  assert.deepEqual(ui.papers[0].children.map(line => line.style['--rule']), ['0', '1', '2', '3', '4', '5', '6']);
  assert.equal(ui.message.getAttribute('role'), 'status');
  assert.equal(ui.message.getAttribute('aria-live'), 'polite');
  assert.equal(ui.message.textContent, draftingMessages[0]);
  assert.deepEqual(draftingMessages, [
    'Checking for AI patterns, ensuring variety and authentic voice',
    "Matching the publication's editorial voice and style",
    'Understanding reader interests, concerns, and language',
    'Preparing a polished draft for your editorial review and approval',
    'Identifying key facts, quotes, and narrative structure',
    'Every fact traced to your source material, every quote preserved in full',
  ]);
  assert.equal(env.timers.size, 0, 'a detached component must not start a loop');
  ui.controller.destroy();
});

test('each message change brings the back sheet to the front with token-driven motion and no text opacity animation', async t => {
  const env = setup(t);
  const ui = env.create({ compact: false, messageLimit: 6 });
  ui.mount();
  assert.equal(ui.root.dataset.compact, 'false');
  assert.equal(ui.root.dataset.playing, 'true');
  assert.equal(env.timers.size, 1);
  env.tick(4999);
  assert.equal(ui.message.textContent, draftingMessages[0]);
  env.tick(1);
  assert.equal(ui.message.textContent, draftingMessages[1]);
  assert.deepEqual(ui.papers.map(paper => paper.dataset.depth), ['front', 'back', 'middle']);
  assert.equal(ui.papers[0].classList.contains('is-drawing'), true);
  assert.equal(ui.papers[2].classList.contains('is-drawing'), false);
  const animations = allAnimations(ui);
  assert.equal(animations.length, 3);
  assert.equal(animations.every(animation => animation.timing.duration === 800), true, '0.8s CSS tokens must be converted to 800ms');
  assert.equal(animations.every(animation => !animation.frames.some(frame => 'opacity' in frame)), true);
  assert.equal(ui.message.animations.length, 0);
  assert.match(ui.papers[0].animations[0].frames[1].transform, /translate\(12px, -14px\) rotate\(9deg\) scale\(0.96\)/);
  assert.equal(env.timers.size, 0, 'the next message hold starts after the sheet arrives');
  animations.forEach(animation => animation.finish());
  await flush();
  assert.equal(env.timers.size, 1);
  for (let next = 2; next <= 6; next += 1) {
    env.tick(5000);
    assert.equal(ui.message.textContent, draftingMessages[next % draftingMessages.length]);
    allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
    await flush();
  }
  ui.controller.destroy();
});

test('a 15-second drafting job shows exactly the first three messages at 0, 5, and 10.8 seconds', async t => {
  const tokens = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
  assert.deepEqual(tokens.component.drafting['message-hold-duration'].$value, { value: 5000, unit: 'ms' });
  assert.deepEqual(tokens.component.drafting['processing-duration'].$value, { value: 15000, unit: 'ms' });
  const env = setup(t);
  const ui = env.create();
  ui.mount();
  const seen = [ui.message.textContent];
  env.tick(4999);
  assert.equal(ui.root.dataset.messageIndex, '0');
  env.tick(1);
  seen.push(ui.message.textContent);
  assert.equal(ui.root.dataset.messageIndex, '1');
  env.tick(800);
  allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
  await flush();
  env.tick(4999);
  assert.equal(ui.root.dataset.messageIndex, '1');
  env.tick(1);
  seen.push(ui.message.textContent);
  assert.equal(ui.root.dataset.messageIndex, '2');
  env.tick(800);
  allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
  await flush();
  env.tick(3400);
  assert.equal(ui.root.dataset.messageIndex, '2', 'the third message remains visible when the 15-second job finishes');
  assert.deepEqual(seen, draftingMessages.slice(0, 3));
  assert.equal(Math.min(...[...env.timers.values()].map(task => task.at)), 16600, 'no fourth transition can start before the app finishes');
  ui.controller.destroy();
  env.tick(100000);
  assert.equal(ui.root.dataset.messageIndex, '2');
  assert.equal(env.timers.size, 0);
});

test('the reference repeats the three-message sequence without advancing into the unused library messages', async t => {
  const env = setup(t);
  const ui = env.create();
  ui.mount();
  for (const expected of [1, 2, 0, 1]) {
    env.tick(5000);
    assert.equal(ui.root.dataset.messageIndex, String(expected));
    assert.equal(ui.message.textContent, draftingMessages[expected]);
    env.tick(800);
    allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
    await flush();
  }
  ui.controller.destroy();
});

test('browsers without animation APIs keep the same hold and handoff timing', t => {
  const env = setup(t, { observers: false });
  const ui = env.create();
  ui.papers.forEach(paper => { paper.animate = undefined; });
  ui.mount();
  env.tick(5000);
  assert.equal(ui.root.dataset.messageIndex, '1');
  env.tick(5799);
  assert.equal(ui.root.dataset.messageIndex, '1');
  env.tick(1);
  assert.equal(ui.root.dataset.messageIndex, '2');
  env.tick(4200);
  assert.equal(ui.root.dataset.messageIndex, '2');
  ui.controller.destroy();
});

test('offscreen or hidden animation cancels current motion and resumes without accumulating timers', async t => {
  const env = setup(t);
  const ui = env.create();
  ui.mount();
  env.tick(5000);
  assert.equal(allAnimations(ui).some(animation => !animation.cancelled), true);
  env.intersections[0].visible(false);
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(env.timers.size, 0);
  assert.equal(allAnimations(ui).every(animation => animation.cancelled), true);
  await flush();
  assert.equal(env.timers.size, 0);
  env.tick(100000);
  assert.equal(ui.message.textContent, draftingMessages[1]);
  env.intersections[0].visible(true);
  assert.equal(env.timers.size, 1);
  env.document.hidden = true;
  env.document.fire('visibilitychange');
  assert.equal(env.timers.size, 0);
  env.document.hidden = false;
  env.document.fire('visibilitychange');
  env.document.fire('visibilitychange');
  assert.equal(env.timers.size, 1);
  ui.controller.destroy();
});

test('reduced motion is static and changing the preference stops and restarts the loop safely', t => {
  const env = setup(t, { reduced: true });
  const ui = env.create();
  ui.mount();
  assert.equal(ui.root.dataset.reducedMotion, 'true');
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(env.timers.size, 0);
  env.tick(100000);
  assert.equal(ui.message.textContent, draftingMessages[0]);
  env.motion.matches = false;
  env.motion.fire('change');
  assert.equal(ui.root.dataset.reducedMotion, 'false');
  assert.equal(env.timers.size, 1);
  env.motion.matches = true;
  env.motion.fire('change');
  assert.equal(env.timers.size, 0);
  ui.controller.destroy();
});

test('removal and destroy clean up every timer, observer and listener, including in-flight motion', async t => {
  const env = setup(t);
  const ui = env.create();
  ui.mount();
  env.tick(5000);
  ui.root.isConnected = false;
  env.mutations[0].change();
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(env.timers.size, 0);
  assert.equal(allAnimations(ui).every(animation => animation.cancelled), true);
  assert.equal(env.intersections[0].disconnected, true);
  assert.equal(env.mutations[0].disconnected, true);
  assert.equal(env.document.listenerCount(), 0);
  assert.equal(env.window.listenerCount(), 0);
  assert.equal(env.motion.listenerCount(), 0);
  await flush();
  ui.controller.destroy();
  ui.mount();
  assert.equal(env.timers.size, 0, 'destroyed components cannot restart');
});

test('back-forward cache pauses the loop and resumes it on page restore', t => {
  const env = setup(t);
  const ui = env.create();
  ui.mount();
  env.window.fire('pagehide', { persisted: true });
  assert.equal(env.timers.size, 0);
  env.window.fire('pageshow');
  assert.equal(env.timers.size, 1);
  env.window.fire('pagehide', { persisted: false });
  assert.equal(env.timers.size, 0);
  assert.equal(env.window.listenerCount(), 0);
});

test('browsers without animation or observer APIs still rotate messages while visibly mounted', t => {
  const env = setup(t, { observers: false });
  const ui = env.create();
  ui.papers.forEach(paper => { paper.animate = undefined; });
  ui.mount();
  env.tick(5000);
  assert.equal(ui.message.textContent, draftingMessages[1]);
  assert.equal(env.timers.size, 1);
  ui.root.hasLayout = false;
  env.document.fire('visibilitychange');
  assert.equal(env.timers.size, 0);
  ui.controller.destroy();
});
