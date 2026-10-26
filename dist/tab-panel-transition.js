import { tokenValue } from './design-system/runtime.js?v=20261026-ds-consolidation';

function milliseconds(value) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0 || !/m?s$/.test(value)) throw new TypeError('A motion duration token is required');
  return value.endsWith('ms') ? amount : amount * 1000;
}

/** Replace a tab's content immediately, then fade in only the newly rendered panel. */
export function createTabPanelTransition(panel, { motionQuery, readToken = tokenValue } = {}) {
  if (!panel) throw new TypeError('A tab panel is required');
  const view = panel.ownerDocument?.defaultView || globalThis;
  const motion = motionQuery || view.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  let running = null;
  let revision = 0;
  let destroyed = false;

  function cancel() {
    revision++;
    const previous = running;
    running = null;
    previous?.cancel();
  }

  function run(render) {
    if (typeof render !== 'function') throw new TypeError('A render callback is required');
    cancel();
    const result = render();
    if (destroyed || motion.matches || !panel.isConnected || panel.hidden || typeof panel.animate !== 'function') return result;
    const sequence = revision;
    try {
      const animation = panel.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: milliseconds(readToken('foundation.motion.duration.200', panel)),
        easing: readToken('foundation.motion.easing.ease', panel),
        fill: 'none',
      });
      running = animation;
      const settle = () => {
        if (revision !== sequence || running !== animation) return;
        running = null;
        animation.cancel();
      };
      animation.finished.then(settle, settle);
    } catch {
      cancel();
    }
    return result;
  }

  function onMotionChange() { if (motion.matches) cancel(); }
  motion.addEventListener?.('change', onMotionChange);
  return {
    run,
    cancel,
    destroy() {
      cancel();
      destroyed = true;
      motion.removeEventListener?.('change', onMotionChange);
    },
  };
}
