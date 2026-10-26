import { tokenValue, tokenNumber } from './design-system/runtime.js?v=20261026-us-weekly-case';

function milliseconds(value) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0 || !/m?s$/.test(value)) throw new TypeError('A motion duration token is required');
  return value.endsWith('ms') ? amount : amount * 1000;
}

/** Keep a closing menu visible only for motion; it leaves interaction immediately. */
export function createDropdownTransition(menu, { onClosed = () => {}, motionQuery, readToken = tokenValue, readNumber = tokenNumber, readStyle } = {}) {
  const view = menu.ownerDocument?.defaultView || globalThis;
  const motion = motionQuery || view.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  const computed = readStyle || (element => view.getComputedStyle(element));
  let expanded = false;
  let running = null;
  let revision = 0;
  let upward = false;
  let destroyed = false;
  menu.hidden = true;
  menu.inert = true;
  menu.setAttribute('aria-hidden', 'true');

  function finish(sequence) {
    if (sequence !== revision || destroyed) return;
    const completed = running;
    running = null;
    menu.hidden = !expanded;
    menu.inert = !expanded;
    menu.setAttribute('aria-hidden', String(!expanded));
    delete menu.dataset.dropdownMoving;
    menu.dataset.dropdownState = expanded ? 'open' : 'closed';
    completed?.cancel();
    if (!expanded) onClosed();
  }

  function setExpanded(next, { animate = true, opensUp = upward } = {}) {
    if (destroyed) return;
    next = Boolean(next);
    if (next === expanded && animate) return;
    let current = null;
    if (running && !menu.hidden) {
      const style = computed(menu);
      current = { opacity: style.opacity, transform: style.transform };
    }
    const sequence = ++revision;
    running?.cancel();
    running = null;
    const wasExpanded = expanded;
    expanded = next;
    upward = opensUp;
    menu.inert = !next;
    menu.setAttribute('aria-hidden', String(!next));
    menu.hidden = false;
    menu.dataset.dropdownState = next ? 'opening' : 'closing';
    const shouldAnimate = animate && !motion.matches && menu.isConnected && typeof menu.animate === 'function';
    if (!shouldAnimate) {
      finish(sequence);
      return;
    }
    try {
      const offset = readNumber('foundation.space.4', menu) * (upward ? 1 : -1);
      const closed = { opacity: 0, transform: `translateY(${offset}px)` };
      const opened = { opacity: 1, transform: 'none' };
      const start = current || (wasExpanded ? opened : closed);
      const end = next ? opened : closed;
      menu.dataset.dropdownMoving = 'true';
      running = menu.animate([start, end], {
        duration: milliseconds(readToken('foundation.motion.duration.200', menu)),
        easing: readToken('foundation.motion.easing.ease', menu),
        fill: 'both',
      });
      running.finished.then(() => finish(sequence), () => finish(sequence));
    } catch {
      finish(sequence);
    }
  }

  function onMotionChange() { if (motion.matches) setExpanded(expanded, { animate: false }); }
  motion.addEventListener?.('change', onMotionChange);
  return {
    get expanded() { return expanded; },
    open: options => setExpanded(true, options),
    close: options => setExpanded(false, options),
    settle() { setExpanded(expanded, { animate: false }); },
    destroy() {
      if (destroyed) return;
      setExpanded(false, { animate: false });
      destroyed = true;
      revision++;
      motion.removeEventListener?.('change', onMotionChange);
    },
  };
}
