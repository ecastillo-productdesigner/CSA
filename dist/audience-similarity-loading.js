import { tokenNumber } from './design-system/runtime.js?v=20261026-drafting-card-size';

// Both the compared-card list and the article editor use this DS loading surface.
export function createAudienceSimilarityLoadingSurface(doc, tagName = 'div') {
  const element = doc.createElement(tagName);
  element.className = 'audience-similarity-loading';
  const shimmer = doc.createElement('span');
  shimmer.className = 'audience-similarity-loading-shimmer';
  shimmer.setAttribute('aria-hidden', 'true');
  const label = doc.createElement('span');
  label.className = 'audience-similarity-loading-label';
  label.textContent = 'Calculating Similarities';
  label.setAttribute('role', 'status');
  label.setAttribute('aria-live', 'polite');
  element.append(shimmer, label);
  return element;
}

// One timed loading surface replaces the selected cards before comparison opens.
export function createAudienceSimilarityLoading({ list, button, status = null, onBusyChange = () => {} }) {
  const doc = list.ownerDocument || document;
  const view = doc.defaultView || globalThis;
  let active = null;
  let destroyed = false;

  function restore(job) {
    view.clearTimeout(job.timer);
    job.element.remove();
    for (const { element, hidden, inert } of job.children) {
      element.hidden = hidden;
      element.inert = inert;
    }
    button.replaceChildren(...job.buttonChildren);
    button.disabled = job.buttonDisabled;
    if (job.busy === null) list.removeAttribute('aria-busy');
    else list.setAttribute('aria-busy', job.busy);
    if (status) status.replaceChildren(...job.statusChildren);
    list.scrollTop = job.scrollTop;
    onBusyChange(false);
  }

  function cancel() {
    if (!active) return;
    const job = active;
    active = null;
    restore(job);
  }

  function start({ items, onComplete } = {}) {
    if (destroyed || active || !Array.isArray(items) || items.length < 2) return false;
    const children = [...list.children];
    if (new Set(items).size !== items.length || items.some(item => !children.includes(item))) return false;
    const duration = tokenNumber('component.audience-similarity.processing-duration', list);
    const style = view.getComputedStyle(list);
    const gap = Math.max(0, Number.parseFloat(style.rowGap) || 0);
    const heights = items.map(item => {
      const height = item.getBoundingClientRect().height;
      return Number.isFinite(height) && height > 0 ? height : tokenNumber('component.variant-card.min-height', list);
    });
    const height = heights.reduce((sum, value) => sum + value, 0) + gap * (items.length - 1);
    const element = createAudienceSimilarityLoadingSurface(doc, 'li');
    element.dataset.count = String(items.length);
    element.style.setProperty('--similarity-loading-height', `${height}px`);
    const job = {
      element,
      children: children.map(element => ({ element, hidden: element.hidden, inert: element.inert })),
      buttonChildren: [...button.childNodes],
      buttonDisabled: button.disabled,
      statusChildren: status ? [...status.childNodes] : [],
      busy: list.getAttribute('aria-busy'),
      scrollTop: list.scrollTop,
      timer: null,
    };
    active = job;
    for (const child of children) {
      if (items.includes(child)) child.hidden = true;
      child.inert = true;
    }
    list.insertBefore(element, children.find(child => items.includes(child)));
    list.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.textContent = 'Calculating Similarities';
    if (status) status.textContent = 'Calculating Similarities';
    onBusyChange(true);
    job.timer = view.setTimeout(() => {
      if (active !== job || destroyed) return;
      active = null;
      restore(job);
      onComplete?.();
    }, duration);
    return true;
  }

  view.addEventListener?.('pagehide', cancel);
  return {
    start,
    cancel,
    get isRunning() { return active !== null; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      view.removeEventListener?.('pagehide', cancel);
    },
  };
}
