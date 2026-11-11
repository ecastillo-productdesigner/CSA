import { tokenNumber } from './design-system/runtime.js?v=20261026-drafting-card-size';

export function createEditorPopover({ container, trigger, popover, dismiss, onOpen = () => {}, resetScroll = false, compact = false }) {
  let activeTrigger = trigger;
  const usableTrigger = anchor => anchor && anchor.isConnected !== false && !anchor.hidden && !anchor.disabled
    && !anchor.closest?.('[hidden], [inert]') && (!anchor.getClientRects || anchor.getClientRects().length > 0);
  const anchorObserver = typeof MutationObserver === 'function' ? new MutationObserver(() => {
    if (!popover.hidden && !usableTrigger(activeTrigger)) close();
  }) : null;

  function close(restoreFocus = false) {
    const wasOpen = !popover.hidden;
    const previousTrigger = activeTrigger;
    popover.hidden = true;
    previousTrigger.setAttribute('aria-expanded', 'false');
    anchorObserver?.disconnect();
    activeTrigger = trigger;
    if (wasOpen && restoreFocus && usableTrigger(previousTrigger)) previousTrigger.focus({ preventScroll: true });
  }

  function position() {
    if (popover.hidden) return;
    if (!usableTrigger(activeTrigger)) { close(); return; }
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    let anchor = activeTrigger.getBoundingClientRect();
    if (compact) {
      const chipHeight = Math.min(anchor.height, tokenNumber('component.chip.height'));
      const chipTop = anchor.top + (anchor.height - chipHeight) / 2;
      anchor = { left: anchor.left, top: chipTop, bottom: chipTop + chipHeight };
    }
    const width = Math.max(0, Math.min(
      tokenNumber(compact ? 'foundation.size.360' : 'foundation.size.620'),
      compact ? viewportWidth : container.getBoundingClientRect().width,
      viewportWidth - inset * 2,
    ));
    const maxHeight = tokenNumber('foundation.size.420');
    popover.style.width = `${width}px`;
    if (compact) popover.style.maxHeight = `${maxHeight}px`;
    const above = Math.max(0, anchor.top - inset - gap);
    const below = Math.max(0, viewportHeight - anchor.bottom - inset - gap);
    const desired = Math.min(popover.scrollHeight || maxHeight, maxHeight);
    const opensAbove = compact ? below < desired && above > below : above >= desired || above > below;
    popover.style.maxHeight = `${Math.min(maxHeight, opensAbove ? above : below)}px`;
    const height = popover.getBoundingClientRect().height;
    const top = opensAbove ? anchor.top - height - gap : anchor.bottom + gap;
    popover.style.left = `${Math.max(inset, Math.min(anchor.left, viewportWidth - width - inset))}px`;
    popover.style.top = `${Math.max(inset, Math.min(top, viewportHeight - height - inset))}px`;
  }

  function toggleFor(nextTrigger = trigger) {
    if (!usableTrigger(nextTrigger)) return;
    if (!popover.hidden && activeTrigger === nextTrigger) { close(true); return; }
    close();
    activeTrigger = nextTrigger;
    onOpen(activeTrigger);
    popover.hidden = false;
    activeTrigger.setAttribute('aria-expanded', 'true');
    position();
    if (popover.hidden) return;
    anchorObserver?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'disabled', 'class', 'style'] });
    if (resetScroll) popover.scrollTop = 0;
    popover.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', () => toggleFor(trigger));
  dismiss.addEventListener('click', () => close(true));
  document.addEventListener('pointerdown', event => {
    if (!popover.hidden && !popover.contains(event.target) && !activeTrigger.contains(event.target)) close();
  });
  popover.addEventListener('focusout', event => {
    if (event.relatedTarget && !popover.contains(event.relatedTarget) && !activeTrigger.contains(event.relatedTarget)) close();
  });
  document.addEventListener('focusin', event => {
    if (!popover.hidden && !popover.contains(event.target) && !activeTrigger.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || popover.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  });
  document.addEventListener('scroll', event => {
    if (!popover.hidden && !popover.contains(event.target)) close();
  }, true);
  window.addEventListener('resize', position);
  return { close, toggleFor, refresh() { if (!popover.hidden) { onOpen(activeTrigger); position(); } } };
}
