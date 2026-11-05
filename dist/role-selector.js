import { createDropdownTransition } from './dropdown-transition.js?v=20261026-drafting-card-size';
import { tokenNumber, breakpointQuery } from './design-system/runtime.js?v=20261029-revision-indicator-location';

const storageKey = 'csa.role.v1';
const roles = new Set(['Trend Hunter', 'Lifestyle & Entertainment', 'Journalist', 'eCommerce']);
const validRole = value => roles.has(value) ? value : '';

export function createRoleSelector({ onOpen = () => {}, notify = () => {} } = {}) {
  const trigger = document.querySelector('#show-role');
  const menu = document.querySelector('#role-menu');
  const label = trigger.querySelector('.role-label');
  const doc = trigger.ownerDocument;
  const view = doc.defaultView;
  const items = [...menu.querySelectorAll('.role-option')];
  const mobile = view.matchMedia(breakpointQuery());
  const portal = doc.querySelector('#workspace-app') || doc.body;
  let selected = '';
  let destroyed = false;
  try { selected = validRole(view.localStorage.getItem(storageKey)); } catch { /* Selection still works for this session. */ }
  menu.dataset.workspaceDropdown = 'true';
  const transition = createDropdownTransition(menu, { onClosed() { menu.removeAttribute('style'); } });

  function render() {
    label.textContent = selected || 'Role';
    const description = selected ? `Role: ${selected}` : 'Select role';
    trigger.setAttribute('aria-label', description);
    trigger.title = description;
    for (const item of items) {
      const checked = item.dataset.role === selected;
      item.setAttribute('aria-checked', String(checked));
      item.tabIndex = -1;
      const check = item.querySelector('.role-check');
      if (check) check.hidden = !checked;
    }
  }

  function position() {
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const width = doc.documentElement.clientWidth;
    const height = doc.documentElement.clientHeight;
    const anchor = trigger.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.maxWidth = `${Math.max(0, width - inset * 2)}px`;
    menu.style.maxHeight = `${Math.max(0, height - inset * 2)}px`;
    const bounds = menu.getBoundingClientRect();
    const clamp = (value, size, available) => Math.max(inset, Math.min(value, available - size - inset));
    const beside = !mobile.matches && anchor.right + gap + bounds.width <= width - inset;
    const below = anchor.bottom + gap;
    const opensUp = !beside && below + bounds.height > height - inset;
    const left = beside ? anchor.right + gap : anchor.right - bounds.width;
    const top = beside ? anchor.top : opensUp ? anchor.top - gap - bounds.height : below;
    menu.style.left = `${clamp(left, bounds.width, width)}px`;
    menu.style.top = `${clamp(top, bounds.height, height)}px`;
    return opensUp;
  }

  function close(restoreFocus = false) {
    trigger.setAttribute('aria-expanded', 'false');
    transition.close();
    if (restoreFocus && trigger.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
  }

  function open(preferLast = false) {
    if (destroyed || trigger.disabled) return;
    if (transition.expanded) return;
    onOpen();
    doc.dispatchEvent(new view.CustomEvent('csa:dropdown-open', { detail: { trigger } }));
    portal.append(menu);
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const opensUp = position();
    transition.open({ opensUp });
    const available = items.filter(item => !item.disabled);
    const active = available.find(item => item.dataset.role === selected);
    (active || (preferLast ? available.at(-1) : available[0]))?.focus({ preventScroll: true });
  }

  function choose(event) {
    if (!transition.expanded || destroyed) return;
    const item = event.target.closest('.role-option');
    if (!items.includes(item) || item.disabled) return;
    const role = validRole(item.dataset.role);
    if (!role) return;
    selected = role;
    render();
    try { view.localStorage.setItem(storageKey, selected); }
    catch { notify('Role saved for this session only. Browser storage is unavailable'); }
    close(true);
  }
  function toggle() { if (transition.expanded) close(true); else open(); }
  function onTriggerKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowUp');
    } else if (event.key === 'Escape' && transition.expanded) {
      event.preventDefault(); event.stopPropagation(); close(true);
    }
  }
  function onMenuKey(event) {
    if (!transition.expanded) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const available = items.filter(item => !item.disabled);
    const index = available.indexOf(doc.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % available.length : (index < 0 ? available.length - 1 : (index - 1 + available.length) % available.length);
    available[next]?.focus({ preventScroll: true });
  }
  function outside(event) {
    if (transition.expanded && !trigger.contains(event.target) && !menu.contains(event.target)) close();
  }
  function onLayoutChange() { if (transition.expanded) close(menu.contains(doc.activeElement)); }
  function onScroll(event) { if (!menu.contains(event.target)) onLayoutChange(); }
  function onOtherDropdown(event) { if (event.detail?.trigger !== trigger) close(); }
  function onStorage(event) {
    if (event.key !== storageKey && event.key !== null) return;
    selected = validRole(event.newValue);
    render();
  }

  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', toggle);
  trigger.addEventListener('keydown', onTriggerKey);
  menu.addEventListener('click', choose);
  menu.addEventListener('keydown', onMenuKey);
  doc.addEventListener('pointerdown', outside);
  doc.addEventListener('focusin', outside);
  doc.addEventListener('scroll', onScroll, true);
  doc.addEventListener('csa:dropdown-open', onOtherDropdown);
  view.addEventListener('resize', onLayoutChange);
  view.addEventListener('storage', onStorage);
  mobile.addEventListener('change', onLayoutChange);
  render();
  return {
    close,
    get isOpen() { return transition.expanded; },
    get value() { return selected; },
    destroy() {
      destroyed = true;
      trigger.setAttribute('aria-expanded', 'false');
      transition.destroy();
      trigger.removeEventListener('click', toggle);
      trigger.removeEventListener('keydown', onTriggerKey);
      menu.removeEventListener('click', choose);
      menu.removeEventListener('keydown', onMenuKey);
      doc.removeEventListener('pointerdown', outside);
      doc.removeEventListener('focusin', outside);
      doc.removeEventListener('scroll', onScroll, true);
      doc.removeEventListener('csa:dropdown-open', onOtherDropdown);
      view.removeEventListener('resize', onLayoutChange);
      view.removeEventListener('storage', onStorage);
      mobile.removeEventListener('change', onLayoutChange);
    },
  };
}
