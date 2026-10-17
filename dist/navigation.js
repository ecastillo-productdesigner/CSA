export function createRailNavigation({ onSourcesOpen, onOpen }) {
  const panels = {
    sources: { trigger: document.querySelector('#show-sources'), panel: document.querySelector('#editor-sources') },
    profile: { trigger: document.querySelector('#show-profile'), panel: document.querySelector('#profile-menu') },
  };
  const sidebar = document.querySelector('#navigation-drawer');
  const drawerToggle = document.querySelector('#toggle-navigation-drawer');
  let drawerOpen = false;
  let active = null;

  function close(name = active, restoreFocus = false) {
    if (!name || !panels[name]) return;
    const { trigger, panel } = panels[name];
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (active === name) active = null;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function setDrawer(open, restoreFocus = false) {
    if (open === drawerOpen) return;
    close();
    if (open) onOpen?.();
    drawerOpen = open;
    sidebar.dataset.expanded = String(open);
    document.body.classList.toggle('navigation-drawer-open', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    drawerToggle.setAttribute('aria-label', `${open ? 'Close' : 'Open'} navigation drawer`);
    sidebar.setAttribute('aria-label', open ? 'Main navigation' : 'Main navigation. Press Enter to open drawer.');
    if (restoreFocus) (open ? drawerToggle : sidebar).focus({ preventScroll: true });
  }

  function open(name) {
    if (document.querySelector('dialog[open]') || !panels[name]) return;
    setDrawer(true);
    if (active === name) return;
    close();
    onOpen?.();
    if (name === 'sources') onSourcesOpen();
    panels[name].panel.hidden = false;
    panels[name].trigger.setAttribute('aria-expanded', 'true');
    active = name;
  }

  drawerToggle.addEventListener('click', () => setDrawer(false, true));
  sidebar.addEventListener('click', event => {
    if (!drawerOpen && !event.target.closest('button, a, input, textarea, select')) setDrawer(true);
  });
  sidebar.addEventListener('keydown', event => {
    if (event.target !== sidebar || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setDrawer(!drawerOpen, true);
  });
  for (const [name, { trigger, panel }] of Object.entries(panels)) {
    trigger.addEventListener('click', () => {
      if (name === 'profile' && !drawerOpen) { setDrawer(true); return; }
      if (active === name) close(name); else open(name);
    });
    trigger.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      open(name);
      (panel.querySelector(name === 'sources' ? '#editor-add-source-button:not(:disabled), .editor-source-checkbox' : '.profile-navigation') || panel.querySelector('[data-close-navigation]'))?.focus();
    });
  }
  document.querySelector('#new-project').addEventListener('click', () => setDrawer(true));
  for (const button of document.querySelectorAll('[data-close-navigation]')) button.addEventListener('click', () => close(button.dataset.closeNavigation, true));
  document.addEventListener('pointerdown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (drawerOpen && !sidebar.contains(event.target)) setDrawer(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (active) { event.preventDefault(); close(active, true); }
    else if (drawerOpen) { event.preventDefault(); setDrawer(false, true); }
  });
  return { close, open };
}
