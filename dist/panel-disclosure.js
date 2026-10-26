import { tokenValue } from './design-system/runtime.js?v=20261026-drafting-card-size';

function milliseconds(value) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0 || !/m?s$/.test(value)) throw new TypeError('A motion duration token is required');
  return value.endsWith('ms') ? amount : amount * 1000;
}

/** Animate a disclosure's measured height while keeping its hidden state accessible. */
export function createPanelDisclosure({ body, trigger, panel, label = 'New Draft', expanded = !body?.hidden, motionQuery, readToken = tokenValue }) {
  if (!body || !trigger || !panel) throw new TypeError('Disclosure body, trigger, and panel are required');
  const view = body.ownerDocument?.defaultView || globalThis;
  const motion = motionQuery || view.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  const initialHeight = body.style.height;
  const initialOverflow = body.style.overflow;
  const hadBodyClass = body.classList.contains('panel-disclosure-body');
  let targetExpanded = Boolean(expanded);
  let initialized = false;
  let running = null;
  let revision = 0;
  let destroyed = false;
  body.classList.add('panel-disclosure-body');

  function semantics(next) {
    if (!next && body.contains(body.ownerDocument?.activeElement)) trigger.focus({ preventScroll: true });
    body.inert = !next;
    body.setAttribute('aria-hidden', String(!next));
    trigger.setAttribute('aria-expanded', String(next));
    const action = `${next ? 'Collapse' : 'Expand'} ${label}`;
    trigger.setAttribute('aria-label', action);
    trigger.title = action;
    panel.dataset.collapsed = String(!next);
    const chevron = trigger.querySelector('[data-collapse-chevron]');
    if (chevron) chevron.textContent = next ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  function settle(sequence) {
    if (sequence !== revision || destroyed) return;
    const completed = running;
    running = null;
    body.hidden = !targetExpanded;
    body.style.height = initialHeight;
    body.style.overflow = initialOverflow;
    delete body.dataset.disclosureAnimating;
    completed?.cancel();
  }

  function setExpanded(next, { animate = true } = {}) {
    if (destroyed) return targetExpanded;
    next = Boolean(next);
    if (initialized && next === targetExpanded && animate) return targetExpanded;
    const startHeight = body.hidden ? 0 : body.getBoundingClientRect().height;
    const sequence = ++revision;
    running?.cancel();
    running = null;
    targetExpanded = next;
    semantics(next);
    body.hidden = false;
    body.style.height = initialHeight;
    body.style.overflow = initialOverflow;
    delete body.dataset.disclosureAnimating;
    const endHeight = next ? body.getBoundingClientRect().height : 0;
    const shouldAnimate = initialized && animate && !motion.matches && body.isConnected
      && typeof body.animate === 'function' && startHeight !== endHeight && (startHeight > 0 || endHeight > 0);
    initialized = true;
    if (!shouldAnimate) {
      settle(sequence);
      return targetExpanded;
    }
    body.style.height = `${startHeight}px`;
    body.style.overflow = 'hidden';
    body.dataset.disclosureAnimating = 'true';
    try {
      running = body.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
        duration: milliseconds(readToken('foundation.motion.duration.200', body)),
        easing: readToken('foundation.motion.easing.ease', body),
        fill: 'both',
      });
      running.finished.then(() => settle(sequence), () => settle(sequence));
    } catch {
      settle(sequence);
    }
    return targetExpanded;
  }

  function onMotionChange() {
    if (motion.matches) setExpanded(targetExpanded, { animate: false });
  }
  motion.addEventListener?.('change', onMotionChange);
  setExpanded(targetExpanded, { animate: false });
  return {
    setExpanded,
    get expanded() { return targetExpanded; },
    destroy() {
      if (destroyed) return;
      setExpanded(targetExpanded, { animate: false });
      destroyed = true;
      revision++;
      motion.removeEventListener?.('change', onMotionChange);
      if (!hadBodyClass) body.classList.remove('panel-disclosure-body');
    },
  };
}
