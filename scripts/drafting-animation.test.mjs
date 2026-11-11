import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDraftingAnimation, createSourceAddingAnimation, createAudienceSuggestingAnimation, createRevisionAnimation } from '../dist/drafting-animation.js';

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
    this._textContent = '';
    this.textWrites = 0;
    this.isConnected = false;
    this.hasLayout = true;
    this.animations = [];
    const classes = new Set();
    this.classList = { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) };
  }
  get textContent() { return this._textContent; }
  set textContent(value) { this._textContent = value; this.textWrites += 1; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
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
      '--csa-component-drafting-processing-duration': '10000ms',
      '--csa-component-drafting-revision-duration': '10000ms',
      '--csa-component-drafting-audience-hold-duration': '2400ms',
      '--csa-component-drafting-audience-panel-scale': String(64 / 88),
      '--csa-component-drafting-audience-compact-scale': String(32 / 88),
      '--csa-component-drafting-audience-side-scale': '0.74',
      '--csa-component-drafting-audience-lift-scale': '0.83',
      '--csa-component-drafting-audience-settle-scale': '0.68',
      '--csa-component-drafting-audience-retire-offset': '0.15',
      '--csa-component-drafting-audience-settle-offset': '0.6',
      '--csa-foundation-motion-duration-800': '0.8s',
      '--csa-foundation-motion-easing-arrive': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      '--csa-foundation-space-2': '2px', '--csa-foundation-space-3': '3px',
      '--csa-foundation-space-4': '4px', '--csa-foundation-space-6': '6px',
      '--csa-foundation-space-12': '12px', '--csa-foundation-space-14': '14px',
      '--csa-foundation-space-1': '1px', '--csa-foundation-space-8': '8px',
      '--csa-foundation-space-25': '25px', '--csa-foundation-space-32': '32px',
      '--csa-foundation-space-13': '13px',
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
  const create = (options, factory = createDraftingAnimation) => {
    const controller = factory(options);
    const content = controller.element.dataset.variant === 'revision' ? controller.element.children[0] : controller.element;
    const stack = content.children[0];
    const message = content.children[1];
    const mount = () => { controller.element.isConnected = true; mutations[0]?.change(); intersections[0]?.visible(true); if (!observers) document.fire('visibilitychange'); };
    return { controller, root: controller.element, stack, message, papers: stack.children, mount };
  };
  return { create, document, window, motion, timers, tick, intersections, mutations };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const allAnimations = ui => ui.papers.flatMap(paper => paper.animations);

function assertActiveShimmer(ui, key) {
  assert.equal(ui.root.dataset.shimmerColor, key);
  const expected = ['neutral', 'source'].includes(key) ? undefined : `var(--csa-component-drafting-shimmer-${key})`;
  assert.equal(ui.root.style['--drafting-shimmer-color'], expected, 'only the active selected color is applied');
  assert.equal(ui.root.style['--drafting-shimmer-stops'], undefined, 'selected colors are not mixed into simultaneous stops');
}

function provideGeometry(env, ui) {
  Object.assign(env.document.documentElement, { clientWidth: 600, clientHeight: 600 });
  Object.assign(env.window, { innerWidth: 600, innerHeight: 600 });
  const bounds = { left: 20, top: 20, width: 300, height: 120 };
  ui.root.getBoundingClientRect = () => ({ ...bounds, x: bounds.left, y: bounds.top, right: bounds.left + bounds.width, bottom: bounds.top + bounds.height });
  return update => Object.assign(bounds, update);
}

test('the shared component has one decorative white sheet and one static drafting status label', t => {
  const env = setup(t);
  const ui = env.create();
  assert.equal(ui.root.className, 'drafting-animation');
  assert.equal(ui.root.dataset.compact, 'true');
  assert.equal(ui.root.dataset.phaseCount, '1');
  assert.equal(ui.root.dataset.shimmerColors, '');
  assertActiveShimmer(ui, 'neutral');
  assert.equal(ui.stack.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(ui.papers.map(paper => paper.dataset.depth), ['front']);
  assert.equal(ui.papers.every(paper => paper.children.length === 7), true);
  assert.deepEqual(ui.papers[0].children.map(line => line.style['--rule']), ['0', '1', '2', '3', '4', '5', '6']);
  assert.equal(ui.message.getAttribute('role'), 'status');
  assert.equal(ui.message.getAttribute('aria-live'), 'polite');
  assert.equal(ui.message.className, 'drafting-message');
  assert.equal(ui.message.textContent, 'Creating Draft');
  assert.equal(ui.message.textWrites, 1);
  assert.equal(env.timers.size, 0, 'a detached component must not start a loop');
  ui.controller.destroy();
});

test('draft shimmer includes exactly the selected categories in canonical order', t => {
  const env = setup(t);
  const combinations = [
    [['format'], ['format']],
    [['audience'], ['audience']],
    [['voice'], ['voice']],
    [['audience', 'format'], ['format', 'audience']],
    [['voice', 'format'], ['format', 'voice']],
    [['voice', 'audience'], ['audience', 'voice']],
    [['voice', 'format', 'audience'], ['format', 'audience', 'voice']],
    [['voice', 'format', 'invalid', 'voice', 'audience', 'format'], ['format', 'audience', 'voice']],
  ];
  for (const [selectionKeys, expected] of combinations) {
    const ui = env.create({ selectionKeys });
    assert.equal(ui.root.dataset.shimmerColors, expected.join(' '));
    assertActiveShimmer(ui, expected[0]);
    assert.equal(ui.root.children.length, 2, 'selected shimmer colors do not change the paper/message structure');
    ui.controller.destroy();
  }
  for (const selectionKeys of [[], ['invalid', null, undefined]]) {
    const ui = env.create({ selectionKeys });
    assert.equal(ui.root.dataset.shimmerColors, '');
    assertActiveShimmer(ui, 'neutral');
    ui.controller.destroy();
  }
});

test('draft shimmer colors cycle without moving the single paper and pause safely', t => {
  const env = setup(t, { observers: false });
  const sequences = [
    [[], ['neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral']],
    [['voice'], ['voice', 'voice', 'voice', 'voice', 'voice', 'voice']],
    [['voice', 'format'], ['format', 'voice', 'format', 'voice', 'format', 'voice']],
    [['voice', 'audience'], ['audience', 'voice', 'audience', 'voice', 'audience', 'voice']],
    [['voice', 'audience', 'format'], ['format', 'audience', 'voice', 'format', 'audience', 'voice']],
  ];
  for (const [selectionKeys, expected] of sequences) {
    const ui = env.create({ selectionKeys });
    const hold = 10000 / new Set(expected).size;
    ui.mount();
    assertActiveShimmer(ui, expected[0]);
    for (let step = 1; step < expected.length; step += 1) {
      env.tick(hold);
      assert.equal(ui.root.dataset.phaseIndex, '0');
      assert.equal(ui.papers.length, 1);
      assert.equal(allAnimations(ui).length, 0);
      assertActiveShimmer(ui, expected[step]);
    }
    env.document.hidden = true;
    env.document.fire('visibilitychange');
    env.tick(60000);
    assert.equal(ui.root.dataset.playing, 'false');
    assertActiveShimmer(ui, expected.at(-1));
    env.document.hidden = false;
    env.document.fire('visibilitychange');
    env.tick(hold);
    assert.equal(ui.root.dataset.phaseIndex, '0');
    assertActiveShimmer(ui, expected[0]);
    ui.controller.destroy();
  }
});

test('source adding keeps one page and a fixed message without scheduling handoffs', t => {
  const env = setup(t);
  const ui = env.create(undefined, createSourceAddingAnimation);
  assert.equal(ui.root.dataset.variant, 'source');
  assert.equal(ui.root.dataset.shimmerColors, 'source');
  assertActiveShimmer(ui, 'source');
  assert.equal(ui.root.dataset.compact, 'true');
  assert.equal(ui.root.dataset.phaseCount, '1');
  assert.equal(ui.papers.length, 1);
  assert.equal(ui.papers[0].dataset.depth, 'front');
  assert.equal(ui.papers[0].children.length, 7);
  assert.equal(ui.message.textContent, 'Adding Source');
  assert.equal(ui.message.getAttribute('role'), 'status');
  assert.equal(ui.message.getAttribute('aria-live'), 'polite');
  ui.mount();
  assert.equal(ui.root.dataset.playing, 'true', 'the CSS shimmer can play without a message timer');
  assert.equal(env.timers.size, 0);
  env.tick(60000);
  assert.equal(ui.message.textContent, 'Adding Source');
  assert.equal(ui.root.dataset.phaseIndex, '0');
  assert.equal(ui.message.textWrites, 1);
  assert.equal(ui.root.dataset.shimmerColors, 'source');
  assertActiveShimmer(ui, 'source');
  assert.equal(allAnimations(ui).length, 0, 'one page must not schedule a WAAPI paper handoff');
  assert.equal(env.timers.size, 0);

  env.motion.matches = true;
  env.motion.fire('change');
  assert.equal(ui.root.dataset.reducedMotion, 'true');
  assert.equal(ui.root.dataset.playing, 'false');
  env.motion.matches = false;
  env.motion.fire('change');
  assert.equal(ui.root.dataset.playing, 'true');
  assert.equal(env.timers.size, 0, 'resuming source shimmer must not introduce a message timer');
  ui.controller.destroy();
  assert.equal(env.timers.size, 0);
  assert.equal(env.document.listenerCount(), 0);
  assert.equal(env.window.listenerCount(), 0);
  assert.equal(env.motion.listenerCount(), 0);
  assert.equal(env.intersections[0].disconnected, true);
  assert.equal(env.mutations[0].disconnected, true);
});

test('each visual phase brings the back sheet forward without changing or animating the status text', async t => {
  const env = setup(t);
  const ui = env.create({ compact: false, variant: 'source', label: 'Adding Sources' });
  ui.mount();
  assert.equal(ui.root.dataset.compact, 'false');
  assert.equal(ui.root.dataset.playing, 'true');
  assert.equal(env.timers.size, 1);
  env.tick(4999);
  assert.equal(ui.message.textContent, 'Adding Sources');
  env.tick(1);
  assert.equal(ui.message.textContent, 'Adding Sources');
  assert.deepEqual(ui.papers.map(paper => paper.dataset.depth), ['front', 'back', 'middle']);
  assert.equal(ui.papers[0].classList.contains('is-drawing'), true);
  assert.equal(ui.papers[2].classList.contains('is-drawing'), false);
  const animations = allAnimations(ui);
  assert.equal(animations.length, 3);
  assert.equal(animations.every(animation => animation.timing.duration === 800), true, '0.8s CSS tokens must be converted to 800ms');
  assert.equal(animations.every(animation => !animation.frames.some(frame => 'opacity' in frame)), true);
  assert.equal(ui.message.animations.length, 0);
  assert.match(ui.papers[0].animations[0].frames[1].transform, /translate\(12px, -14px\) rotate\(9deg\) scale\(0.96\)/);
  assert.equal(env.timers.size, 0, 'the next visual hold starts after the sheet arrives');
  animations.forEach(animation => animation.finish());
  await flush();
  assert.equal(env.timers.size, 1);
  for (let next = 2; next <= 6; next += 1) {
    env.tick(5000);
    assert.equal(ui.message.textContent, 'Adding Sources');
    assert.equal(ui.message.textWrites, 1);
    allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
    await flush();
  }
  ui.controller.destroy();
});

test('a ten-second drafting job shows both category colors on one paper with a fixed label', t => {
  const tokens = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
  assert.deepEqual(tokens.component.drafting['processing-duration'].$value, { value: 10000, unit: 'ms' });
  const env = setup(t);
  const ui = env.create({ selectionKeys: ['voice', 'format'] });
  ui.mount();
  assert.equal(ui.root.dataset.shimmerColors, 'format voice');
  assertActiveShimmer(ui, 'format');
  env.tick(4999);
  assertActiveShimmer(ui, 'format');
  env.tick(1);
  assertActiveShimmer(ui, 'voice');
  assert.equal(ui.papers.length, 1);
  assert.equal(ui.root.dataset.phaseIndex, '0');
  assert.equal(allAnimations(ui).length, 0, 'category colors change without a paper handoff');
  env.tick(4999);
  assertActiveShimmer(ui, 'voice');
  assert.equal(ui.message.textContent, 'Creating Draft');
  assert.equal(ui.message.textWrites, 1, 'color steps must not reannounce identical status text');
  ui.controller.destroy();
  env.tick(100001);
  assert.equal(ui.root.dataset.phaseIndex, '0');
  assert.equal(env.timers.size, 0);
});

test('the reference repeats three visual phases while its status text is written only once', async t => {
  const env = setup(t);
  const ui = env.create({ label: 'Adding Sources' }, createSourceAddingAnimation);
  ui.mount();
  for (const expected of [1, 2, 0, 1]) {
    env.tick(5000);
    assert.equal(ui.root.dataset.phaseIndex, String(expected));
    assert.equal(ui.message.textContent, 'Adding Sources');
    assert.equal(ui.message.textWrites, 1);
    env.tick(800);
    allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
    await flush();
  }
  ui.controller.destroy();
});

test('browsers without animation APIs keep the same hold and handoff timing', t => {
  const env = setup(t, { observers: false });
  const ui = env.create({ label: 'Adding Sources' }, createSourceAddingAnimation);
  ui.papers.forEach(paper => { paper.animate = undefined; });
  ui.mount();
  env.tick(5000);
  assert.equal(ui.root.dataset.phaseIndex, '1');
  env.tick(5799);
  assert.equal(ui.root.dataset.phaseIndex, '1');
  env.tick(1);
  assert.equal(ui.root.dataset.phaseIndex, '2');
  env.tick(4200);
  assert.equal(ui.root.dataset.phaseIndex, '2');
  ui.controller.destroy();
});

test('offscreen or hidden animation cancels current motion and resumes without accumulating timers', async t => {
  const env = setup(t);
  const ui = env.create({ label: 'Adding Sources' }, createSourceAddingAnimation);
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
  assert.equal(ui.message.textContent, 'Adding Sources');
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

test('fresh geometry recovers missing or stale intersection delivery while preserving playback guards', t => {
  const env = setup(t);
  const ui = env.create();
  const move = provideGeometry(env, ui);
  ui.root.isConnected = true;
  env.mutations[0].change();
  assert.equal(ui.root.dataset.playing, 'true', 'a visible mounted card must not wait indefinitely for IntersectionObserver');
  assert.equal(env.timers.size, 1);
  env.intersections[0].visible(false);
  assert.equal(ui.root.dataset.playing, 'true', 'a stale negative observer entry cannot override current visible geometry');

  move({ top: 700 });
  env.document.fire('scroll');
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(env.timers.size, 0);
  env.intersections[0].visible(true);
  assert.equal(ui.root.dataset.playing, 'false', 'a stale positive observer entry cannot override an offscreen rectangle');
  move({ top: 40 });
  env.document.fire('scroll');
  assert.equal(ui.root.dataset.playing, 'true', 'scrolling into view resumes without a new observer entry');
  move({ left: 700 });
  env.window.fire('resize');
  assert.equal(ui.root.dataset.playing, 'false');
  move({ left: 20 });
  env.window.fire('resize');
  assert.equal(ui.root.dataset.playing, 'true', 'resizing into view resumes without a new observer entry');

  env.document.hidden = true;
  env.document.fire('visibilitychange');
  env.document.fire('scroll');
  env.window.fire('resize');
  assert.equal(ui.root.dataset.playing, 'false', 'visible geometry cannot restart a hidden document');
  env.document.hidden = false;
  env.document.fire('visibilitychange');
  assert.equal(ui.root.dataset.playing, 'true');
  env.motion.matches = true;
  env.motion.fire('change');
  env.document.fire('scroll');
  env.window.fire('resize');
  assert.equal(ui.root.dataset.playing, 'false', 'visible geometry cannot override reduced motion');
  assert.equal(env.timers.size, 0);
  env.motion.matches = false;
  env.motion.fire('change');
  assert.equal(ui.root.dataset.playing, 'true');

  ui.controller.destroy();
  env.document.fire('scroll');
  env.window.fire('resize');
  env.window.fire('pageshow');
  env.motion.fire('change');
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(env.timers.size, 0);
  assert.equal(env.document.listenerCount(), 0);
  assert.equal(env.window.listenerCount(), 0);
  assert.equal(env.motion.listenerCount(), 0);
  assert.equal(env.intersections[0].disconnected, true);
  assert.equal(env.mutations[0].disconnected, true);
});

test('fresh geometry respects scrollable and hidden ancestor clipping', t => {
  const env = setup(t);
  const ui = env.create();
  const move = provideGeometry(env, ui);
  const clip = new Element();
  Object.assign(clip, { clientLeft: 0, clientTop: 0, clientWidth: 300, clientHeight: 100 });
  clip.getBoundingClientRect = () => ({ left: 20, top: 20, right: 320, bottom: 120, width: 300, height: 100 });
  clip.parentElement = env.document.documentElement;
  ui.root.parentElement = clip;
  const overflow = { overflowX: 'hidden', overflowY: 'auto' };
  const previousStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = element => {
    const base = previousStyle(element);
    const style = { overflowX: 'visible', overflowY: 'visible', display: 'block', visibility: 'visible', ...(element === clip ? overflow : {}) };
    return { ...base, ...style, getPropertyValue(name) { return style[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? base.getPropertyValue(name); } };
  };
  move({ left: 40, top: 220, width: 200 });
  ui.root.isConnected = true;
  env.mutations[0].change();
  env.intersections[0].visible(true);
  assert.equal(ui.root.dataset.playing, 'false', 'a card below its scroll container is clipped even inside the page viewport');
  move({ top: 40 });
  env.document.fire('scroll', { target: clip });
  assert.equal(ui.root.dataset.playing, 'true');
  move({ left: 350 });
  env.document.fire('scroll', { target: clip });
  assert.equal(ui.root.dataset.playing, 'false', 'hidden horizontal overflow also clips playback');
  Object.assign(overflow, { overflowX: 'visible', overflowY: 'visible' });
  env.window.fire('resize');
  assert.equal(ui.root.dataset.playing, 'true', 'an ancestor with visible overflow does not clip the card');
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
  assert.equal(ui.message.textContent, 'Creating Draft');
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
  const ui = env.create({ label: 'Adding Sources' }, createSourceAddingAnimation);
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

test('browsers without animation or observer APIs still rotate papers while keeping the label static', t => {
  const env = setup(t, { observers: false });
  const ui = env.create({ label: 'Adding Sources' }, createSourceAddingAnimation);
  ui.papers.forEach(paper => { paper.animate = undefined; });
  ui.mount();
  env.tick(5000);
  assert.equal(ui.message.textContent, 'Adding Sources');
  assert.equal(env.timers.size, 1);
  ui.root.hasLayout = false;
  env.document.fire('visibilitychange');
  assert.equal(env.timers.size, 0);
  ui.controller.destroy();
});

test('revision progress uses one paper, neutral fallback and a fixed accessible status', t => {
  const env = setup(t);
  const ui = env.create(undefined, createRevisionAnimation);
  assert.equal(ui.root.dataset.variant, 'revision');
  assert.equal(ui.root.dataset.phaseCount, '1');
  assert.equal(ui.papers.length, 1);
  assert.equal(ui.papers[0].dataset.depth, 'front');
  assertActiveShimmer(ui, 'neutral');
  assert.equal(ui.message.textContent, 'Revising Draft');
  assert.equal(ui.message.getAttribute('role'), 'status');
  assert.equal(ui.message.getAttribute('aria-live'), 'polite');
  ui.mount();
  assert.equal(ui.root.dataset.playing, 'true');
  env.motion.matches = true;
  env.motion.fire('change');
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(ui.root.dataset.reducedMotion, 'true');
  assert.equal(env.timers.size, 0);
  assert.equal(ui.message.textContent, 'Revising Draft');
  ui.controller.destroy();
  assert.equal(env.document.listenerCount(), 0);
  assert.equal(env.window.listenerCount(), 0);
  assert.equal(env.motion.listenerCount(), 0);
});

test('new draft cards use Creating Draft with the same shared loading animation', t => {
  const env = setup(t);
  const ui = env.create({ selectionKeys: ['audience'], label: 'Creating Draft' }, createRevisionAnimation);
  assert.equal(ui.root.dataset.variant, 'revision', 'the existing overlay layout is retained');
  assert.equal(ui.papers.length, 1, 'Creating Draft cards use one paper in the existing overlay');
  assertActiveShimmer(ui, 'audience');
  assert.equal(ui.message.textContent, 'Creating Draft');
  assert.equal(ui.message.getAttribute('role'), 'status');
  ui.mount();
  env.motion.matches = true;
  env.motion.fire('change');
  assert.equal(ui.message.textContent, 'Creating Draft');
  ui.controller.destroy();
});

test('revision colors follow saved categories in canonical order, never the source-adding mint', t => {
  const env = setup(t);
  for (const [selectionKeys, expected] of [
    [['format'], ['format']], [['voice'], ['voice']],
    [['voice', 'audience'], ['audience', 'voice']],
    [['voice', 'format', 'audience', 'invalid'], ['format', 'audience', 'voice']],
  ]) {
    const ui = env.create({ selectionKeys }, createRevisionAnimation);
    assert.equal(ui.root.dataset.shimmerColors, expected.join(' '));
    assertActiveShimmer(ui, expected[0]);
    ui.controller.destroy();
  }
});

for (const [name, factory, options, durationToken, label] of [
  ['draft', createDraftingAnimation, {}, 'processing-duration', 'Creating Draft'],
  ['draft overlay', createRevisionAnimation, { label: 'Creating Draft' }, 'processing-duration', 'Creating Draft'],
  ['revision', createRevisionAnimation, {}, 'revision-duration', 'Revising Draft'],
]) {
  test(`three-category ${name} shows pink, lavender and peach on one paper within ten seconds`, t => {
    const tokens = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
    const duration = tokens.component.drafting[durationToken].$value.value;
    assert.equal(duration, 10000);
    const hold = duration / 3;
    const env = setup(t, { observers: false });
    const ui = env.create({ ...options, selectionKeys: ['voice', 'audience', 'format'] }, factory);
    ui.mount();
    assertActiveShimmer(ui, 'format');
    env.tick(hold);
    assertActiveShimmer(ui, 'audience');
    assert.equal(ui.papers.length, 1);
    assert.equal(allAnimations(ui).length, 0, 'single-draft statuses do not perform a paper handoff');
    env.tick(hold);
    assertActiveShimmer(ui, 'voice');
    assert.equal(ui.message.textContent, label);
    assert.equal(ui.message.textWrites, 1);
    ui.controller.destroy();
  });
}

test('revision indicator stays centered in the visible part of a long draft while its background covers the full area', t => {
  const env = setup(t);
  const ui = env.create({ selectionKeys: ['voice'] }, createRevisionAnimation);
  const move = provideGeometry(env, ui);
  move({ top: 100, height: 1200 });
  ui.mount();
  assert.equal(ui.root.style['--revision-indicator-y'], '250px');
  move({ top: -400 });
  env.document.fire('scroll');
  assert.equal(ui.root.style['--revision-indicator-y'], '700px');
  assert.equal(ui.root.getBoundingClientRect().height, 1200);
  ui.controller.destroy();
});


test('Adding Sources uses three papers with the shared handoff and green shimmer', async t => {
  const env = setup(t);
  const ui = env.create({ label: 'Adding Sources' }, createSourceAddingAnimation);
  assert.equal(ui.message.textContent, 'Adding Sources');
  assertActiveShimmer(ui, 'source');
  assert.equal(ui.root.dataset.phaseCount, '3');
  assert.deepEqual(ui.papers.map(paper => paper.dataset.depth), ['back', 'middle', 'front']);
  ui.mount();
  env.tick(5000);
  assert.equal(ui.root.dataset.phaseIndex, '1');
  assert.deepEqual(ui.papers.map(paper => paper.dataset.depth), ['front', 'back', 'middle']);
  assert.equal(allAnimations(ui).length, 3);
  allAnimations(ui).forEach(animation => animation.finish());
  await flush();
  assert.equal(ui.message.textWrites, 1, 'the status stays fixed while the papers swap');
  env.motion.matches = true;
  env.motion.fire('change');
  assert.equal(ui.root.dataset.playing, 'false');
  assert.equal(env.timers.size, 0);
  ui.controller.destroy();
});

test('overlapping source imports update paper count as the label changes', async t => {
  const env = setup(t);
  const ui = env.create(undefined, createSourceAddingAnimation);
  ui.mount();
  ui.controller.setLabel('Adding Sources');
  assert.equal(ui.stack.children.length, 3);
  assert.equal(ui.root.dataset.phaseCount, '3');
  env.tick(5000);
  const handoffs = ui.stack.children.flatMap(paper => paper.animations);
  assert.equal(handoffs.length, 3);
  ui.controller.setLabel('Adding Source');
  await flush();
  assert.equal(ui.stack.children.length, 1);
  assert.equal(ui.stack.children[0].dataset.depth, 'front');
  assert.equal(ui.root.dataset.phaseCount, '1');
  assert.equal(ui.root.dataset.phaseIndex, '0');
  assert.equal(ui.message.textContent, 'Adding Source');
  assert.ok(handoffs.every(animation => animation.cancelled));
  assert.equal(env.timers.size, 0, 'one source resumes without a paper handoff');
  ui.controller.destroy();
});

for (const compact of [false, true]) {
  test(`audience suggestions use compact green people animation with a fixed label (${compact ? 'trigger' : 'panel'})`, async t => {
    const tokens = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
    assert.deepEqual(tokens.component.drafting['audience-suggest-duration'].$value, { value: 10000, unit: 'ms' });
    assert.equal(tokens.component.drafting[compact ? 'audience-icon-compact-size' : 'audience-icon-size'].$value, compact ? '{foundation.space.32}' : '{foundation.space.64}');
    assert.equal(tokens.component.drafting[compact ? 'audience-compact-scale' : 'audience-panel-scale'].$value, (compact ? 32 : 64) / 88);
    const env = setup(t);
    const ui = env.create(compact ? { compact } : undefined, createAudienceSuggestingAnimation);
    assert.equal(ui.root.dataset.compact, 'true');
    assert.equal(ui.root.dataset.audienceCompact, String(compact));
    assert.equal(ui.root.dataset.audienceSuggesting, 'true');
    assert.equal(ui.root.dataset.variant, 'source');
    assert.equal(ui.stack.className, 'drafting-audience-people');
    assert.equal(ui.stack.getAttribute('aria-hidden'), 'true');
    assert.deepEqual(ui.papers.map(person => person.dataset.depth), ['back', 'middle', 'front']);
    assert.ok(ui.papers.every(person => person.className === 'drafting-audience-person'));
    assert.ok(ui.papers.every(person => person.children.length === 0), 'each complete silhouette is drawn by CSS rather than clipped glyph slices');
    assertActiveShimmer(ui, 'source');
    assert.equal(ui.message.textContent, 'Suggesting Audiences');
    assert.equal(ui.message.getAttribute('role'), 'status');
    assert.equal(ui.message.getAttribute('aria-live'), 'polite');
    ui.mount();
    assert.equal(ui.root.dataset.playing, 'true');
    env.tick(2399);
    assert.equal(ui.root.dataset.phaseIndex, '0');
    env.tick(1);
    assert.deepEqual(ui.papers.map(person => person.dataset.depth), ['front', 'back', 'middle']);
    assert.equal(allAnimations(ui).length, 3);
    assert.ok(allAnimations(ui).every(animation => animation.timing.duration === 800));
    const scale = (compact ? 32 : 64) / 88;
    assert.equal(ui.papers[0].animations[0].frames[1].transform, `translate(${-32 * scale}px, ${-13 * scale}px) rotate(-9deg) scale(0.83)`);
    assert.equal(ui.papers[0].animations[0].frames[1].zIndex, 1, 'the arriving person lifts behind the foreground silhouette');
    assert.equal(ui.papers[0].animations[0].frames[2].zIndex, 4, 'then moves in front before landing');
    assert.equal(ui.papers[1].animations[0].frames[2].transform, `translate(0px, ${-8 * scale}px) rotate(4deg) scale(0.68)`);
    env.tick(800);
    allAnimations(ui).forEach(animation => animation.finish());
    await flush();
    assert.equal(ui.message.textContent, 'Suggesting Audiences');
    assert.equal(ui.message.textWrites, 1);
    assert.equal(ui.root.dataset.phaseIndex, '1');
    assert.equal(env.timers.size, 1, 'the owner controls completion while visual handoffs continue');
    ui.root.hasLayout = false;
    env.document.fire('visibilitychange');
    assert.equal(ui.root.dataset.playing, 'false');
    assert.equal(env.timers.size, 0, 'hidden loading panels do not run visual timers');
    ui.root.hasLayout = true;
    env.document.fire('visibilitychange');
    assert.equal(ui.root.dataset.playing, 'true');
    env.motion.matches = true;
    env.motion.fire('change');
    assert.equal(ui.root.dataset.playing, 'false');
    assert.equal(ui.root.dataset.reducedMotion, 'true');
    assert.equal(env.timers.size, 0);
    assert.ok(allAnimations(ui).every(animation => animation.cancelled));
    assert.equal(ui.message.textContent, 'Suggesting Audiences');
    ui.controller.destroy();
    assert.equal(env.document.listenerCount(), 0);
    assert.equal(env.window.listenerCount(), 0);
    assert.equal(env.motion.listenerCount(), 0);
  });
}

for (const [name, factory, label] of [['draft', createDraftingAnimation, 'Creating Drafts'], ['draft overlay', createRevisionAnimation, 'Creating Drafts'], ['revision', createRevisionAnimation, 'Revising Drafts']]) {
  test(`plural ${name} has three papers and fits all category colors into ten seconds`, async t => {
    const env = setup(t);
    const ui = env.create({ label, selectionKeys: ['format', 'audience', 'voice'] }, factory);
    assert.equal(ui.papers.length, 3);
    assert.equal(ui.root.dataset.phaseCount, '3');
    assert.equal(ui.message.textContent, label);
    ui.mount();
    assertActiveShimmer(ui, 'format');
    env.tick(2800);
    assertActiveShimmer(ui, 'audience');
    assert.equal(ui.root.dataset.phaseIndex, '1');
    env.tick(800);
    allAnimations(ui).filter(animation => !animation.cancelled).forEach(animation => animation.finish());
    await flush();
    env.tick(2800);
    assertActiveShimmer(ui, 'voice');
    assert.equal(ui.root.dataset.phaseIndex, '2');
    assert.equal(ui.message.textWrites, 1);
    env.motion.matches = true;
    env.motion.fire('change');
    assert.equal(ui.root.dataset.playing, 'false');
    assert.equal(env.timers.size, 0);
    ui.controller.destroy();
  });
}

test('draft label changes synchronize paper count and cancel an in-flight plural handoff', async t => {
  const env = setup(t);
  const ui = env.create({ selectionKeys: ['format', 'audience', 'voice'] });
  ui.mount();
  ui.controller.setLabel('Creating Drafts');
  assert.equal(ui.stack.children.length, 3);
  env.tick(2800);
  const handoffs = ui.stack.children.flatMap(paper => paper.animations);
  assert.equal(handoffs.length, 3);
  ui.controller.setLabel('Creating Draft');
  await flush();
  assert.equal(ui.stack.children.length, 1);
  assert.equal(ui.root.dataset.phaseCount, '1');
  assert.equal(ui.message.textContent, 'Creating Draft');
  assert.ok(handoffs.every(animation => animation.cancelled));
  const currentColor = ui.root.dataset.shimmerColor;
  env.tick(10000 / 3);
  assert.notEqual(ui.root.dataset.shimmerColor, currentColor, 'one paper still cycles its category colors');
  assert.equal(ui.stack.children[0].animations.length, 0);
  ui.controller.destroy();
});

test('audience status follows the singular and plural illustration rule', async t => {
  const env = setup(t);
  const ui = env.create({ label: 'Suggesting Audience' }, createAudienceSuggestingAnimation);
  assert.equal(ui.papers.length, 1);
  assert.equal(ui.papers[0].className, 'drafting-audience-person');
  assert.equal(ui.message.textContent, 'Suggesting Audience');
  ui.mount();
  assert.equal(env.timers.size, 0);
  ui.controller.setLabel('Suggesting Audiences');
  assert.equal(ui.stack.children.length, 3);
  env.tick(2400);
  const handoffs = ui.stack.children.flatMap(person => person.animations);
  assert.equal(handoffs.length, 3);
  ui.controller.setLabel('Suggesting Audience');
  await flush();
  assert.equal(ui.stack.children.length, 1);
  assert.ok(handoffs.every(animation => animation.cancelled));
  assert.equal(env.timers.size, 0);
  ui.controller.destroy();
});
