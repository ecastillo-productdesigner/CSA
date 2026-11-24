import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { projectOutputs, outputIsReady, outputIsSent, outputLoadingSelectionKeys } from './outputs.js?v=20261120-chip-tooltips';

import { tokenNumber } from './design-system/runtime.js?v=20261028-revision-dot';
import { createRevisionAnimation } from './drafting-animation.js?v=20261027-revision-tabs';

// Keep every displayed tab whole, reserving the overflow control only when needed.
export function editorTabLayout({ count, activeIndex = 0, width, tabWidth, moreWidth, gap }) {
  if (!count) return { visibleIndexes: [], hiddenIndexes: [], tabWidth: 0 };
  const available = Math.max(0, width);
  const overflow = count * tabWidth + (count - 1) * gap > available;
  const tabSpace = Math.max(0, available - (overflow ? moreWidth + gap : 0));
  const capacity = overflow ? Math.max(1, Math.min(count, Math.floor((tabSpace + gap) / (tabWidth + gap)))) : count;
  const visibleIndexes = Array.from({ length: capacity }, (_, index) => index);
  const active = Math.max(0, Math.min(count - 1, activeIndex));
  if (!visibleIndexes.includes(active)) visibleIndexes[capacity - 1] = active;
  const hiddenIndexes = Array.from({ length: count }, (_, index) => index).filter(index => !visibleIndexes.includes(index));
  return {
    visibleIndexes,
    hiddenIndexes,
    tabWidth: hiddenIndexes.length ? Math.max(0, (tabSpace - (capacity - 1) * gap) / capacity) : Math.min(tabWidth, available),
  };
}

export function createEditorTabs({ onSelect, onRevisionRead = () => {}, createAnimation = createRevisionAnimation,
  root = document.querySelector('#editor-variant-tabs'), panel = document.querySelector('#editor-canvas-content') }) {
  const prefix = root.id && root.id !== 'editor-variant-tabs' ? `${root.id}-tab` : 'editor-tab';
  const list = document.createElement('div');
  list.className = 'editor-variant-tab-list';
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', 'Drafts');
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'editor-tabs-more';
  more.hidden = true;
  more.setAttribute('aria-haspopup', 'menu');
  more.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div');
  menu.id = `${root.id || 'editor-variant-tabs'}-more-menu`;
  menu.className = 'editor-tabs-more-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'More Drafts');
  menu.hidden = true;
  more.setAttribute('aria-controls', menu.id);
  root.removeAttribute('role');
  root.removeAttribute('aria-label');
  root.replaceChildren(list, more, menu);
  let entries = [];
  let tabs = [];
  let hiddenIndexes = [];
  let layoutSignature = '';
  let destroyed = false;
  let signature = '';
  let currentProject = null;
  let currentActiveId = null;
  let readTimer = null;
  let readKey = '';
  function clearReadTimer() {
    clearTimeout(readTimer);
    readTimer = null;
    readKey = '';
  }
  function syncReadTimer(project, activeId, outputs, revisingIds) {
    currentProject = project;
    currentActiveId = activeId;
    const output = outputs.find(output => output.id === activeId);
    const history = Array.isArray(output?.revisionRequests) ? output.revisionRequests : [];
    const key = output?.revisionUnread && !revisingIds.includes(activeId)
      ? JSON.stringify([project.id, activeId, history.length, history.at(-1)?.completedAt]) : '';
    if (key === readKey) return;
    clearReadTimer();
    if (!key) return;
    readKey = key;
    readTimer = setTimeout(() => {
      clearReadTimer();
      const output = projectOutputs(currentProject).find(output => output.id === currentActiveId);
      if (!output?.revisionUnread) return;
      const focused = document.activeElement && root.querySelector('[aria-selected="true"]') === document.activeElement;
      output.revisionRequestUnread ??= output.revisionUnread;
      output.revisionUnread = false;
      onRevisionRead(currentProject, output);
      controller.render(currentProject);
      if (focused) root.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
    }, tokenNumber('component.editor-tab.revision-dot-active-duration'));
  }
  const animations = new Set();
  function clearAnimations() {
    for (const animation of animations) animation.destroy();
    animations.clear();
  }

  function closeMenu(restoreFocus = false) {
    const wasOpen = !menu.hidden;
    menu.hidden = true;
    more.setAttribute('aria-expanded', 'false');
    if (wasOpen && restoreFocus && !more.hidden) more.focus({ preventScroll: true });
  }
  function menuItems() { return [...menu.querySelectorAll('[role="menuitem"]')]; }
  function openMenu(last = false) {
    if (more.hidden || !hiddenIndexes.length) return;
    menu.hidden = false;
    more.setAttribute('aria-expanded', 'true');
    const items = menuItems();
    (last ? items.at(-1) : items[0])?.focus();
  }
  function layout() {
    if (destroyed || root.hidden || !tabs.length) return;
    const width = root.getBoundingClientRect().width;
    if (!width) return; // Hidden DS specimens are laid out when they become visible.
    const arrangement = editorTabLayout({ count: tabs.length, activeIndex: entries.findIndex(entry => entry.id === currentActiveId), width,
      tabWidth: tokenNumber('component.editor-tab.preferred-width'), moreWidth: tokenNumber('component.editor-tab.more-width'), gap: tokenNumber('foundation.space.4') });
    root.style.setProperty('--editor-tab-visible-width', `${arrangement.tabWidth}px`);
    const nextLayout = JSON.stringify(arrangement.hiddenIndexes);
    if (layoutSignature === nextLayout) return;
    const focusInMenu = menu.contains(document.activeElement);
    const focusOnMore = document.activeElement === more;
    closeMenu();
    layoutSignature = nextLayout;
    hiddenIndexes = arrangement.hiddenIndexes;
    tabs.forEach((tab, index) => { tab.hidden = hiddenIndexes.includes(index); });
    more.hidden = hiddenIndexes.length === 0;
    more.replaceChildren(document.createTextNode(`+${hiddenIndexes.length}`), createIcon('keyboard_arrow_down'));
    more.setAttribute('aria-label', `${hiddenIndexes.length} more ${hiddenIndexes.length === 1 ? 'draft' : 'drafts'}`);
    menu.replaceChildren(...hiddenIndexes.map(index => {
      const entry = entries[index];
      const tab = tabs[index];
      const revising = tab.dataset.revising === 'true';
      const status = revising ? 'Revising Draft' : outputIsSent(entry) ? 'Sent' : 'Draft';
      const unread = entry.revisionUnread && !revising;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'project-card-menu-item editor-tabs-more-option';
      item.dataset.editorOutput = entry.id || '';
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.setAttribute('aria-label', entry.preview ? entry.title : `${entry.title} · ${status}${unread ? ' · Revision complete, unread' : ''}`);
      const badge = document.createElement('span');
      badge.className = 'editor-tab-draft';
      badge.dataset.sent = String(status === 'Sent');
      badge.append(createIcon(status === 'Sent' ? 'send' : 'draw'), document.createTextNode(status));
      const label = document.createElement('span');
      label.className = 'editor-tabs-more-title';
      label.textContent = entry.title;
      if (!entry.preview) item.append(badge);
      item.append(label);
      if (unread) {
        const dot = document.createElement('span');
        dot.className = 'editor-tab-revision-dot';
        dot.setAttribute('aria-hidden', 'true');
        item.append(dot);
      }
      return item;
    }));
    if (focusInMenu || (focusOnMore && more.hidden)) {
      (more.hidden ? tabs.find(tab => tab.getAttribute('aria-selected') === 'true') : more)?.focus({ preventScroll: true });
    }
  }
  const resizeObserver = new ResizeObserver(layout);
  resizeObserver.observe(root);

  function select(tab) {
    closeMenu();
    onSelect(tab.dataset.editorOutput || null);
    layout();
    const current = root.querySelector('[aria-selected="true"]');
    current?.focus({ preventScroll: true });
  }

  function onClick(event) {
    if (more.contains(event.target)) { if (menu.hidden) openMenu(); else closeMenu(true); return; }
    const tab = event.target.closest('[role="tab"]') || event.target.closest('[role="menuitem"]');
    if (tab && root.contains(tab)) select(tab);
  }
  function onKeyDown(event) {
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }
    if (event.target === more && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(event.key === 'ArrowUp'); return; }
    if (menu.contains(event.target)) {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = menuItems();
      const index = items.indexOf(event.target.closest('[role="menuitem"]'));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const index = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[next]);
  }
  function onOutside(event) { if (!menu.hidden && !root.contains(event.target)) closeMenu(); }
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('focusin', onOutside);

  const controller = {
    render(project) {
      const allOutputs = projectOutputs(project);
      const outputs = allOutputs.filter(output => outputIsReady(output) || output.needsRegeneration);
      const sourceSearchOpen = Boolean(project?.sourceSearchOpen && project?.searchQuery);
      const showCreateTab = sourceSearchOpen || !outputs.length && Boolean(project?.searchQuery || project?.linkCards || project?.viewOriginalDraft || project?.awaitingOutput || allOutputs.some(output => output.id === project?.lastPendingOutputId && !outputIsReady(output)));
      const activeId = showCreateTab && project?.viewOriginalDraft ? null : outputs.some(output => output.id === project?.selectedOutputId) ? project.selectedOutputId : outputs[0]?.id ?? null;
      const revisingIds = project?.outputProcessing?.kind === 'revision' ? project.outputProcessing.ids || [] : [];
      syncReadTimer(project, activeId, outputs, revisingIds);
      const nextSignature = JSON.stringify([project?.id, activeId, showCreateTab, Boolean(project?.searchQuery), revisingIds, outputs.map(output => [output.id, output.title, output.cmsSentAt, output.revisionUnread, revisingIds.includes(output.id) ? outputLoadingSelectionKeys(output) : null])]);
      if (signature === nextSignature) { layout(); return; }
      signature = nextSignature;
      const menuHadFocus = !menu.hidden && menu.contains(document.activeElement);
      closeMenu();
      clearAnimations();
      const hasTabs = showCreateTab || Boolean(outputs.length);
      root.hidden = !hasTabs;
      panel.classList.toggle('has-variant-tabs', hasTabs);
      if (!hasTabs) {
        list.replaceChildren();
        menu.replaceChildren();
        more.hidden = true;
        entries = [];
        tabs = [];
        hiddenIndexes = [];
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        return;
      }
      entries = [...(showCreateTab ? [{ id: null, title: project?.searchQuery ? 'Searching Topic' : 'Project workspace', preview: true }] : []), ...outputs];
      tabs = entries.map(output => {
        const { id, cmsSentAt, preview } = output;
        const title = output.title;
        const sent = outputIsSent({ cmsSentAt });
        const status = preview ? 'To Draft' : sent ? 'Sent' : 'Draft';
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `${prefix}-${id || 'original'}`;
        tab.dataset.editorOutput = id || '';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', String(id === activeId));
        tab.tabIndex = id === activeId ? 0 : -1;
        tab.setAttribute('aria-label', preview && project?.searchQuery ? 'Searching Topic' : title);
        const badge = document.createElement('span');
        badge.className = 'editor-tab-draft';
        badge.setAttribute('aria-hidden', 'true');
        badge.append(createIcon(preview ? 'article' : sent ? 'send' : 'draw'));
        badge.append(document.createTextNode(status));
        badge.dataset.sent = String(sent);
        if (preview) badge.dataset.pending = 'true';
        if (!preview) tab.append(badge);
        else if (project?.searchQuery) {
          tab.dataset.searchResults = 'true';
          tab.append(document.createTextNode('Searching Topic'));
        }
        tab.setAttribute('aria-description', preview ? 'New draft workspace' : status);
        if (!preview) {
          const label = document.createElement('span');
          label.className = 'editor-tab-title';
          const titleText = document.createElement('span');
          titleText.className = 'editor-tab-title-text';
          titleText.textContent = title;
          if (output.revisionUnread && id !== activeId && !revisingIds.includes(id)) {
            const dot = document.createElement('span');
            dot.className = 'editor-tab-revision-dot';
            dot.setAttribute('aria-hidden', 'true');
            label.append(dot);
            tab.setAttribute('aria-description', `${status} · Revision complete, unread`);
          }
          label.append(titleText);
          tab.append(label);
        }
        tab.title = preview ? title : `${title} · ${status}${output.revisionUnread ? " · Revision complete" : ""}`;
        if (!preview && id !== activeId && revisingIds.includes(id)) {
          tab.dataset.revising = 'true';
          tab.setAttribute('aria-description', 'Revising Draft');
          tab.title = `${title} · Revising Draft`;
          const animation = createAnimation({ selectionKeys: outputLoadingSelectionKeys(output) });
          animation.element.setAttribute('aria-hidden', 'true');
          animations.add(animation);
          tab.append(animation.element);
        }
        return tab;
      });
      list.replaceChildren(...tabs);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `${prefix}-${activeId || 'original'}`);
      layoutSignature = '';
      layout();
      if (menuHadFocus) (more.hidden ? tabs.find(tab => tab.getAttribute('aria-selected') === 'true') : more)?.focus({ preventScroll: true });
      requestAnimationFrame(layout);
    },
    suspend() { clearReadTimer(); closeMenu(); currentProject = null; currentActiveId = null; },
    destroy() {
      destroyed = true;
      controller.suspend(); clearAnimations(); resizeObserver.disconnect();
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
    },
  };
  return controller;
}
