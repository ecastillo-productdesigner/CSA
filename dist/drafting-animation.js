import { tokenNumber, tokenValue } from './design-system/runtime.js?v=20261026-drafting-card-size';

function durationMilliseconds(path) {
  const value = tokenValue(path);
  const duration = Number.parseFloat(value);
  if (!Number.isFinite(duration) || duration <= 0 || !/m?s$/.test(value)) throw new Error(`Invalid motion duration: ${path}`);
  return duration * (value.endsWith('ms') ? 1 : 1000);
}

export function createDraftingAnimation({ compact = true, selectionKeys = [], variant = 'drafting' } = {}) {
  const addingSource = variant === 'source';
  const revising = variant === 'revision';
  const mintShimmer = addingSource || revising;
  const depths = addingSource ? ['front'] : ['back', 'middle', 'front'];
  const element = document.createElement('div');
  element.className = 'drafting-animation';
  element.dataset.compact = String(compact);
  element.dataset.variant = addingSource ? 'source' : revising ? 'revision' : 'drafting';
  element.dataset.playing = 'false';
  element.dataset.phaseIndex = '0';
  element.dataset.phaseCount = String(depths.length);
  const selectedKeys = Array.isArray(selectionKeys) ? selectionKeys : [];
  const shimmerColors = ['format', 'audience', 'voice'].filter(key => selectedKeys.includes(key));
  element.dataset.shimmerColors = mintShimmer ? 'source' : shimmerColors.join(' ');
  let shimmerIndex = 0;
  function updateShimmerColor() {
    const color = mintShimmer ? 'source' : shimmerColors[shimmerIndex];
    element.dataset.shimmerColor = color || 'neutral';
    if (!mintShimmer && color) {
      element.style.setProperty('--drafting-shimmer-color', `var(--csa-component-drafting-shimmer-${color})`);
    }
  }
  updateShimmerColor();
  const stack = document.createElement('div');
  stack.className = 'drafting-paper-stack';
  stack.setAttribute('aria-hidden', 'true');
  const papers = depths.map(depth => {
    const paper = document.createElement('div');
    paper.className = 'drafting-paper';
    paper.dataset.depth = depth;
    for (let index = 0; index < 7; index += 1) {
      const line = document.createElement('span');
      line.className = 'drafting-paper-line';
      line.style.setProperty('--rule', String(index));
      paper.append(line);
    }
    stack.append(paper);
    return paper;
  });
  const message = document.createElement('p');
  message.className = 'drafting-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  message.setAttribute('aria-atomic', 'true');
  message.textContent = addingSource ? 'Adding your Source' : revising ? 'Revising Draft' : 'Drafting Content';
  element.append(stack, message);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rotationStep = tokenNumber('component.drafting.paper-rotation-step');
  const scaleStep = tokenNumber('component.drafting.paper-scale-step');
  const liftOffset = tokenNumber('component.drafting.paper-lift-offset');
  const frontOffset = tokenNumber('component.drafting.paper-front-offset');
  const holdDuration = durationMilliseconds('component.drafting.message-hold-duration');
  const timing = {
    duration: durationMilliseconds('foundation.motion.duration.800'),
    easing: tokenValue('foundation.motion.easing.arrive'),
    fill: 'both',
  };
  const pose = (x, y, rotation, scale) => `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
  const poses = {
    front: pose(0, 0, 0, 1),
    middle: pose(tokenNumber('foundation.space.3'), -tokenNumber('foundation.space.2'), rotationStep, 1 - scaleStep),
    back: pose(tokenNumber('foundation.space.6'), -tokenNumber('foundation.space.4'), rotationStep * 2, 1 - scaleStep * 2),
    lift: pose(tokenNumber('foundation.space.12'), -tokenNumber('foundation.space.14'), rotationStep * 3, 1 - scaleStep),
  };
  let phaseIndex = 0;
  let timer = null;
  let moving = false;
  let playing = false;
  let destroyed = false;
  let connectedOnce = false;
  let inViewport = typeof IntersectionObserver === 'undefined';
  let pageActive = true;
  let animations = [];
  let generation = 0;

  function setDepth(paper, depth) {
    paper.dataset.depth = depth;
    paper.style.transform = poses[depth];
    paper.style.zIndex = String({ front: 3, middle: 2, back: 1 }[depth]);
    paper.classList.toggle('is-drawing', depth === 'front');
  }
  for (const paper of papers) setDepth(paper, paper.dataset.depth);

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function cancelAnimations() {
    generation += 1;
    for (const animation of animations) animation.cancel();
    animations = [];
    moving = false;
  }

  function schedule() {
    if (addingSource || destroyed || !playing || moving || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      updateVisibility();
      if (playing) { clearTimer(); advance(); }
    }, holdDuration);
  }

  function advance() {
    if (addingSource || destroyed || moving || !playing) return;
    const front = papers.find(paper => paper.dataset.depth === 'front');
    const middle = papers.find(paper => paper.dataset.depth === 'middle');
    const incoming = papers.find(paper => paper.dataset.depth === 'back');
    setDepth(incoming, 'front');
    setDepth(front, 'middle');
    setDepth(middle, 'back');
    phaseIndex = (phaseIndex + 1) % papers.length;
    if (shimmerColors.length > 1) shimmerIndex = (shimmerIndex + 1) % shimmerColors.length;
    updateShimmerColor();
    element.dataset.phaseIndex = String(phaseIndex);
    if (typeof incoming.animate !== 'function') {
      moving = true;
      timer = setTimeout(() => { timer = null; moving = false; schedule(); }, timing.duration);
      return;
    }
    moving = true;
    const stamp = generation;
    animations = [
      incoming.animate([
        { offset: 0, transform: poses.back, zIndex: 1 },
        { offset: liftOffset, transform: poses.lift, zIndex: 1 },
        { offset: frontOffset, transform: poses.lift, zIndex: 4 },
        { offset: 1, transform: poses.front, zIndex: 4 },
      ], timing),
      front.animate([
        { offset: 0, transform: poses.front, zIndex: 3 },
        { offset: liftOffset, transform: poses.front, zIndex: 3 },
        { offset: 1, transform: poses.middle, zIndex: 2 },
      ], timing),
      middle.animate([
        { transform: poses.middle, zIndex: 2 },
        { transform: poses.back, zIndex: 1 },
      ], timing),
    ];
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (destroyed || stamp !== generation) return;
      for (const animation of animations) animation.cancel();
      animations = [];
      moving = false;
      schedule();
    }).catch(() => {
      if (destroyed || stamp !== generation) return;
      cancelAnimations();
      schedule();
    });
  }

  function isInViewport() {
    if (typeof element.getBoundingClientRect !== 'function') return inViewport;
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    if (!(width > 0 && height > 0)) return inViewport;
    const rect = element.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    let left = 0;
    let top = 0;
    let right = width;
    let bottom = height;
    for (let parent = element.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
      const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
      if (!clipsX && !clipsY) continue;
      const bounds = parent.getBoundingClientRect();
      if (clipsX) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (clipsY) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    return right > left && bottom > top && rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom;
  }

  function updateVisibility() {
    if (destroyed) return;
    const connected = element.isConnected;
    if (connected) connectedOnce = true;
    else if (connectedOnce) { destroy(); return; }
    const hasLayout = connected && element.getClientRects().length > 0;
    const visible = hasLayout && isInViewport();
    const next = Boolean(connected && visible && pageActive && !document.hidden && !reducedMotion.matches);
    element.dataset.playbackState = !connected ? 'detached' : !hasLayout ? 'hidden-layout' : !visible ? 'offscreen' : !pageActive ? 'inactive-page' : document.hidden ? 'hidden-document' : reducedMotion.matches ? 'reduced-motion' : 'playing';
    element.dataset.reducedMotion = String(reducedMotion.matches);
    if (next === playing) { if (next) schedule(); return; }
    playing = next;
    element.dataset.playing = String(playing);
    if (playing) schedule();
    else { clearTimer(); cancelAnimations(); }
  }

  const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    const entry = entries.find(item => item.target === element);
    if (!entry) return;
    inViewport = entry.isIntersecting;
    updateVisibility();
  });
  intersection?.observe(element);
  const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(updateVisibility);
  mutations?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  document.addEventListener('visibilitychange', updateVisibility);
  document.addEventListener('scroll', updateVisibility, { capture: true, passive: true });
  window.addEventListener('resize', updateVisibility);
  reducedMotion.addEventListener('change', updateVisibility);
  function onPageHide(event) {
    if (!event.persisted) { destroy(); return; }
    pageActive = false;
    updateVisibility();
  }
  function onPageShow() { pageActive = true; updateVisibility(); }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    element.dataset.playbackState = 'destroyed';
    playing = false;
    element.dataset.playing = 'false';
    clearTimer();
    cancelAnimations();
    intersection?.disconnect();
    mutations?.disconnect();
    document.removeEventListener('visibilitychange', updateVisibility);
    document.removeEventListener('scroll', updateVisibility, true);
    window.removeEventListener('resize', updateVisibility);
    reducedMotion.removeEventListener('change', updateVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  }

  updateVisibility();
  return { element, destroy };
}

export function createSourceAddingAnimation() {
  return createDraftingAnimation({ compact: true, variant: 'source' });
}

export function createRevisionAnimation() {
  return createDraftingAnimation({ compact: true, variant: 'revision' });
}
