export function createRailNavigation({ onRecentsOpen, onSourcesOpen, onOpen }) {
  const panels = {
    history: { trigger: document.querySelector('#show-history'), panel: document.querySelector('#recent-projects') },
    sources: { trigger: document.querySelector('#show-sources'), panel: document.querySelector('#editor-sources') },
    profile: { trigger: document.querySelector('#show-profile'), panel: document.querySelector('#profile-menu') },
  };
  const sidebar = document.querySelector('#navigation-drawer');
  const drawerToggle = document.querySelector('#toggle-navigation-drawer');
  let drawerOpen = false;
  let active = null;
  let activation = '';
  let closeTimer;
  let restoringFocus = false;

  function clearCloseTimer() { clearTimeout(closeTimer); }

  function setDrawer(open, restoreFocus = false) {
    if (open === drawerOpen) return;
    close();
    if (open) onOpen?.();
    drawerOpen = open;
    sidebar.dataset.expanded = String(open);
    document.body.classList.toggle('navigation-drawer-open', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    drawerToggle.setAttribute('aria-label', `${open ? 'Close' : 'Open'} navigation drawer`);
    drawerToggle.querySelector('.material-symbols-outlined').textContent = open ? 'right_panel_open' : 'right_panel_close';
    if (restoreFocus) drawerToggle.focus({ preventScroll: true });
  }
  drawerToggle.addEventListener('click', () => setDrawer(!drawerOpen));

  function close(name = active, restoreFocus = false) {
    if (!name || !panels[name]) return;
    clearCloseTimer();
    const { trigger, panel } = panels[name];
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (active === name) { active = null; activation = ''; }
    if (restoreFocus) {
      restoringFocus = true;
      trigger.focus({ preventScroll: true });
      restoringFocus = false;
    }
  }

  function open(name, source) {
    if (document.querySelector('dialog[open]')) return;
    clearCloseTimer();
    if (active === name) { if (source === 'click') activation = source; return; }
    if (active) close(active);
    onOpen?.();
    if (name === 'history') onRecentsOpen();
    if (name === 'sources') onSourcesOpen();
    const { trigger, panel } = panels[name];
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    active = name;
    activation = source;
  }

  function scheduleClose(name) {
    clearCloseTimer();
    if (active !== name || activation !== 'hover') return;
    closeTimer = setTimeout(() => {
      const { trigger, panel } = panels[name];
      if (trigger.matches(':hover') || panel.matches(':hover') || panel.contains(document.activeElement)) return;
      close(name);
    }, 220);
  }

  for (const [name, { trigger, panel }] of Object.entries(panels)) {
    for (const target of [trigger, panel]) {
      target.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        clearCloseTimer();
        if (target === trigger) open(name, 'hover');
      });
      target.addEventListener('pointerleave', () => scheduleClose(name));
      target.addEventListener('focusin', () => {
        clearCloseTimer();
        if (target === trigger && !restoringFocus && trigger.matches(':focus-visible')) open(name, 'focus');
      });
      target.addEventListener('focusout', event => {
        if (trigger.contains(event.relatedTarget) || panel.contains(event.relatedTarget)) return;
        if (!trigger.matches(':hover') && !panel.matches(':hover')) close(name);
      });
    }
    trigger.addEventListener('click', () => {
      setDrawer(true);
      if (active === name && activation === 'click') close(name); else open(name, 'click');
    });
    trigger.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      open(name, 'focus');
      (panel.querySelector(name === 'history' ? '.history-item' : name === 'sources' ? '#editor-add-source-button:not(:disabled), .editor-source-checkbox' : '.profile-navigation') || panel.querySelector('[data-close-navigation]'))?.focus();
    });
  }

  document.querySelector('#new-project').addEventListener('click', () => setDrawer(true));

  for (const button of document.querySelectorAll('[data-close-navigation]')) button.addEventListener('click', () => close(button.dataset.closeNavigation, true));
  document.addEventListener('pointerdown', event => {
    if (drawerOpen && !sidebar.contains(event.target) && !Object.values(panels).some(({ panel }) => !panel.hidden && panel.contains(event.target))) setDrawer(false);
    if (!active) return;
    const { trigger, panel } = panels[active];
    if (!trigger.contains(event.target) && !panel.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (active) { event.preventDefault(); close(active, true); }
    else if (drawerOpen) { event.preventDefault(); setDrawer(false, true); }
  });
  return { close, open: name => open(name, 'click') };
}
