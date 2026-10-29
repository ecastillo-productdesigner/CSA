import { tokenNumber } from './design-system/runtime.js?v=20261026-drafting-card-size';

export function createEditorPopover({ container, trigger, popover, dismiss, onOpen = () => {}, resetScroll = false }) {
  function close(restoreFocus = false) {
    const wasOpen = !popover.hidden;
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (wasOpen && restoreFocus && !trigger.hidden && trigger.isConnected !== false) trigger.focus({ preventScroll: true });
  }

  function position() {
    if (popover.hidden) return;
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const anchor = trigger.getBoundingClientRect();
    const width = Math.max(0, Math.min(tokenNumber('foundation.size.620'), container.getBoundingClientRect().width, viewportWidth - inset * 2));
    popover.style.width = `${width}px`;
    const above = Math.max(0, anchor.top - inset - gap);
    const below = Math.max(0, viewportHeight - anchor.bottom - inset - gap);
    const desired = Math.min(popover.scrollHeight || tokenNumber('foundation.size.420'), tokenNumber('foundation.size.420'));
    const opensAbove = above >= desired || above > below;
    popover.style.maxHeight = `${Math.min(tokenNumber('foundation.size.420'), opensAbove ? above : below)}px`;
    const height = popover.getBoundingClientRect().height;
    const top = opensAbove ? anchor.top - height - gap : anchor.bottom + gap;
    popover.style.left = `${Math.max(inset, Math.min(anchor.left, viewportWidth - width - inset))}px`;
    popover.style.top = `${Math.max(inset, Math.min(top, viewportHeight - height - inset))}px`;
  }

  trigger.addEventListener('click', () => {
    if (trigger.hidden || trigger.disabled) return;
    if (!popover.hidden) { close(true); return; }
    onOpen();
    popover.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    position();
    if (resetScroll) popover.scrollTop = 0;
    popover.focus({ preventScroll: true });
  });
  dismiss.addEventListener('click', () => close(true));
  document.addEventListener('pointerdown', event => {
    if (!popover.hidden && !popover.contains(event.target) && !trigger.contains(event.target)) close();
  });
  popover.addEventListener('focusout', event => {
    if (event.relatedTarget && !popover.contains(event.relatedTarget) && !trigger.contains(event.relatedTarget)) close();
  });
  document.addEventListener('focusin', event => {
    if (!popover.hidden && !popover.contains(event.target) && !trigger.contains(event.target)) close();
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
  return { close, refresh() { if (!popover.hidden) { onOpen(); position(); } } };
}
