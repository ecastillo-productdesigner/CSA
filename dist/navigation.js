import { tokenValue, tokenNumber, breakpointQuery } from './design-system/runtime.js?v=20261026-drafting-card-size';

function milliseconds(value) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0 || !/m?s$/.test(value)) throw new TypeError('A motion duration token is required');
  return value.endsWith('ms') ? amount : amount * 1000;
}

/** Slide a rail panel without leaving closing controls in the focus order. */
export function createRailPanelTransition(panel, { trigger, motionQuery, readToken = tokenValue, onHidden = () => {} } = {}) {
  if (!panel) throw new TypeError('A rail panel is required');
  const view = panel.ownerDocument?.defaultView || globalThis;
  const motion = motionQuery || view.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
  let visible = !panel.hidden;
  let running = null;
  let revision = 0;
  let destroyed = false;

  function settle(sequence) {
    if (sequence !== revision || destroyed) return;
    const completed = running;
    running = null;
    panel.hidden = !visible;
    completed?.cancel();
    if (!visible) onHidden();
  }

  function setVisible(next, { animate = true } = {}) {
    if (destroyed) return visible;
    next = Boolean(next);
    if (next === visible && animate) return visible;
    const wasHidden = panel.hidden;
    const previousTransform = !wasHidden && running ? view.getComputedStyle?.(panel).transform : null;
    const sequence = ++revision;
    running?.cancel();
    running = null;
    visible = next;
    if (!next && panel.contains(panel.ownerDocument?.activeElement)) trigger?.focus({ preventScroll: true });
    panel.inert = !next;
    panel.setAttribute('aria-hidden', String(!next));
    trigger?.setAttribute('aria-expanded', String(next));
    panel.hidden = false;
    if (!animate || motion.matches || !panel.isConnected || typeof panel.animate !== 'function' || (wasHidden && !next)) {
      settle(sequence);
      return visible;
    }
    try {
      const shifted = `translateX(calc(-1 * ${readToken('foundation.space.5', panel)}))`;
      const start = previousTransform || (wasHidden ? shifted : 'translateX(0)');
      running = panel.animate([{ transform: start }, { transform: next ? 'translateX(0)' : shifted }], {
        duration: milliseconds(readToken('foundation.motion.duration.200', panel)),
        easing: readToken('foundation.motion.easing.ease', panel),
        fill: 'both',
      });
      running.finished.then(() => settle(sequence), () => settle(sequence));
    } catch {
      settle(sequence);
    }
    return visible;
  }

  function onMotionChange() { if (motion.matches) setVisible(visible, { animate: false }); }
  motion.addEventListener?.('change', onMotionChange);
  setVisible(visible, { animate: false });
  return {
    setVisible,
    get visible() { return visible; },
    destroy() {
      if (destroyed) return;
      setVisible(visible, { animate: false });
      destroyed = true;
      revision++;
      motion.removeEventListener?.('change', onMotionChange);
    },
  };
}

export function createRailNavigation({ onSourcesOpen, onSourcesClose, onNewVariantOpen, onVariantsOpen, onOpen }) {
  const panels = {
    sources: { trigger: document.querySelector('#show-sources'), panel: document.querySelector('#editor-sources') },
    newVariant: { trigger: document.querySelector('#show-new-variant'), panel: document.querySelector('#composer-tools'), mobileOnly: true },
    variants: { trigger: document.querySelector('#show-variants'), panel: document.querySelector('#composer-outputs'), mobileOnly: true },
    profile: { trigger: document.querySelector('#show-profile'), panel: document.querySelector('#profile-menu') },
  };
  const sidebar = document.querySelector('#navigation-drawer');
  const drawerToggle = document.querySelector('#toggle-navigation-drawer');
  const newProject = document.querySelector('#new-project');
  const home = document.querySelector('#home');
  const mobile = window.matchMedia(breakpointQuery());
  const mobileTopBar = () => mobile.matches && (!home.hidden || document.body.matches('.showing-results, .showing-composer'));
  const drawerAvailable = () => !mobileTopBar() && document.body.classList.contains('showing-composer');
  const floatingProfile = () => !drawerAvailable();
  const tooltips = [
    { trigger: newProject, tooltip: document.querySelector('#new-project-tooltip') },
    { trigger: panels.sources.trigger, tooltip: document.querySelector('#sources-tooltip') },
    { trigger: panels.profile.trigger, tooltip: document.querySelector('#account-tooltip') },
  ];
  let drawerOpen = false;
  let active = null;
  const sourcesHome = document.createComment('Sources panel home');
  panels.sources.panel.before(sourcesHome);
  const sourcesTransition = createRailPanelTransition(panels.sources.panel, {
    trigger: panels.sources.trigger,
    onHidden: () => sourcesHome.after(panels.sources.panel),
  });

  function hideTooltips() { for (const { tooltip } of tooltips) tooltip.hidden = true; }
  function showTooltip(trigger, tooltip) {
    hideTooltips();
    if (drawerOpen || active === 'profile' || mobileTopBar() || document.querySelector('dialog[open]')) return;
    const bounds = trigger.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    tooltip.style.left = `${bounds.right + tokenNumber('foundation.space.12')}px`;
    tooltip.style.top = `${bounds.top + bounds.height / 2}px`;
    tooltip.hidden = false;
  }
  for (const { trigger, tooltip } of tooltips) {
    for (const eventName of ['mouseenter', 'focus']) trigger.addEventListener(eventName, () => showTooltip(trigger, tooltip));
    for (const eventName of ['mouseleave', 'blur', 'click']) trigger.addEventListener(eventName, hideTooltips);
  }
  window.addEventListener('resize', hideTooltips);

  function close(name = active, restoreFocus = false, { animate = true } = {}) {
    if (!name || !panels[name]) return;
    const { trigger, panel, mobileOnly } = panels[name];
    if (mobileOnly) delete panel.dataset.mobileOpen;
    else if (name === 'sources') sourcesTransition.setVisible(false, { animate });
    else panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (name === 'sources') onSourcesClose?.();
    if (active === name) active = null;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function setDrawer(open, restoreFocus = false) {
    open = Boolean(open && drawerAvailable());
    hideTooltips();
    if (open === drawerOpen) return;
    close();
    if (open) onOpen?.();
    drawerOpen = open;
    sidebar.dataset.expanded = String(open);
    document.body.classList.toggle('navigation-drawer-open', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    drawerToggle.setAttribute('aria-label', `${open ? 'Close' : 'Open'} navigation drawer`);
    sidebar.setAttribute('aria-label', open || !drawerAvailable() ? 'Main navigation' : 'Main navigation. Press Enter to open drawer.');
    if (restoreFocus) (open ? drawerToggle : sidebar).focus({ preventScroll: true });
  }

  function open(name) {
    if (document.querySelector('dialog[open]') || !panels[name] || (panels[name].mobileOnly && (!mobile.matches || !document.body.classList.contains('showing-composer')))) return;
    setDrawer(drawerAvailable());
    if (active === name) return;
    close();
    onOpen?.();
    if (name === 'sources') onSourcesOpen();
    if (name === 'newVariant') onNewVariantOpen?.();
    if (name === 'variants') onVariantsOpen?.();
    // Keep the mobile Sources panel above the backdrop without lifting its navigation bar.
    if (name === 'sources' && mobileTopBar()) document.querySelector('#workspace-app').append(panels.sources.panel);
    if (panels[name].mobileOnly) panels[name].panel.dataset.mobileOpen = 'true';
    else if (name === 'sources') sourcesTransition.setVisible(true);
    else panels[name].panel.hidden = false;
    panels[name].trigger.setAttribute('aria-expanded', 'true');
    active = name;
  }

  drawerToggle.addEventListener('click', () => setDrawer(false, true));
  sidebar.addEventListener('click', event => {
    if (drawerAvailable() && !drawerOpen && !event.target.closest('button, a, input, textarea, select')) setDrawer(true);
  });
  sidebar.addEventListener('keydown', event => {
    if (!drawerAvailable() || event.target !== sidebar || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setDrawer(!drawerOpen, true);
  });
  for (const [name, { trigger, panel }] of Object.entries(panels)) {
    trigger.addEventListener('click', () => {
      if (name === 'profile' && !drawerOpen && drawerAvailable()) { setDrawer(true); return; }
      if (active === name) close(name);
      else {
        open(name);
        if (name === 'profile' && floatingProfile()) panel.querySelector('.profile-navigation')?.focus({ preventScroll: true });
        else if (panels[name].mobileOnly) panel.querySelector('h2')?.focus({ preventScroll: true });
      }
    });
    trigger.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      open(name);
      const focusSelector = name === 'sources' ? '.editor-source-open' : name === 'newVariant' ? '.tool-dropdown-trigger' : name === 'variants' ? '.output-open:not(:disabled)' : '.profile-navigation';
      (panel.querySelector(focusSelector) || panel.querySelector('[data-close-navigation]'))?.focus();
    });
  }
  panels.profile.panel.addEventListener('keydown', event => {
    if (event.key === 'Tab' && floatingProfile()) close('profile', true);
  });
  for (const button of document.querySelectorAll('[data-close-navigation]')) button.addEventListener('click', () => close(button.dataset.closeNavigation, true));
  document.addEventListener('pointerdown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (active === 'profile' && floatingProfile() && !panels.profile.panel.contains(event.target) && !panels.profile.trigger.contains(event.target)) { close(); return; }
    if (active !== 'sources' && mobileTopBar() && !sidebar.contains(event.target) && !panels[active]?.panel.contains(event.target) && !event.target.closest('.output-card-menu, .editor-flyover, .draft-sources-popover, [data-variant-sources], [data-workspace-dropdown]')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (document.querySelector('.output-card-menu:not([hidden])')) return;
    if (tooltips.some(({ tooltip }) => !tooltip.hidden)) { event.preventDefault(); hideTooltips(); return; }
    if (active) { event.preventDefault(); close(active, true); }
    else if (drawerOpen) { event.preventDefault(); setDrawer(false, true); }
  });
  let layoutMode;
  function syncLayout() {
    const available = drawerAvailable();
    const next = `${mobileTopBar()}:${available}`;
    if (next !== layoutMode) { hideTooltips(); close(active, false, { animate: false }); setDrawer(false); layoutMode = next; }
    sidebar.dataset.expandable = String(available);
    sidebar.tabIndex = available ? 0 : -1;
    sidebar.setAttribute('aria-label', !available || drawerOpen ? 'Main navigation' : 'Main navigation. Press Enter to open drawer.');
  }
  mobile.addEventListener('change', syncLayout);
  const layoutObserver = new MutationObserver(syncLayout);
  layoutObserver.observe(home, { attributes: true, attributeFilter: ['hidden'] });
  layoutObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncLayout();
  return { close, open, closeTransient() { if (active !== 'sources') close(); }, closeDrawer: () => setDrawer(false) };
}
