import { tokenNumber, tokenValue, breakpointQuery } from './design-system/runtime.js?v=20261020-ds-centralized';
import { createIcon } from './icons.js?v=20261020-ds-centralized';
import { bindTapActivation } from './tap-activation.js?v=20261020-ds-centralized';

const favoritesStorageKey = 'csa.tool-favorites.v1';

function toolIcon(name) { return createIcon(name === 'heart' ? 'favorite' : 'filter_list'); }

export function createToolDropdowns({ notify = () => {} } = {}) {
  let savedFavorites = {};
  try {
    const stored = JSON.parse(localStorage.getItem(favoritesStorageKey));
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) savedFavorites = stored;
  } catch { /* Start with no saved choices when storage is unavailable. */ }

  const controls = [...document.querySelectorAll('.composer-field, .results-sort-field, .feedback-select-field, .editor-style-field')].map(field => {
    const select = field.querySelector('select');
    const label = field.dataset.label;
    const key = select.id.replace(/^(composer-|output-edit-)/, '');
    field.dataset.tool = key;
    const editorStyle = field.matches('.editor-style-field');
    const floating = select.id === 'output-edit-voice' || field.matches('.feedback-select-field') || editorStyle;
    const inWorkspacePanel = Boolean(field.closest('#composer-tools'));
    const mobileWorkspacePanel = () => inWorkspacePanel && window.matchMedia(breakpointQuery()).matches;
    const placeholder = field.dataset.placeholder || (['format', 'audience', 'voice'].includes(key) ? `Select ${label}` : label);
    const supportsFavorites = ['format', 'audience'].includes(key);
    const plural = key === 'format' ? 'formats' : 'audiences';
    const allowed = new Set([...select.options].map(option => option.value).filter(Boolean));
    const favorites = new Set((Array.isArray(savedFavorites[key]) ? savedFavorites[key] : []).filter(value => allowed.has(value)));
    let savedOnly = false;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'tool-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', supportsFavorites ? 'dialog' : 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${select.id}-options`);
    const text = document.createElement('span');
    const chevron = createIcon('keyboard_arrow_down', 'tool-dropdown-chevron');
    trigger.append(text, chevron);

    const menu = document.createElement('div');
    menu.id = `${select.id}-options`;
    menu.className = 'tool-dropdown-menu';
    if (supportsFavorites) {
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', `${label} options`);
    }
    menu.hidden = true;
    const list = document.createElement('div');
    list.id = `${select.id}-choices`;
    list.className = 'tool-dropdown-list';
    list.setAttribute('role', supportsFavorites ? 'group' : 'listbox');
    list.setAttribute('aria-label', label);
    let savedToggle;
    let savedLabel;
    if (supportsFavorites) {
      const toolbar = document.createElement('div');
      toolbar.className = 'tool-dropdown-toolbar';
      savedToggle = document.createElement('button');
      savedToggle.type = 'button';
      savedToggle.className = 'tool-saved-toggle';
      savedToggle.setAttribute('aria-controls', list.id);
      savedToggle.append(toolIcon('heart'));
      bindTapActivation(savedToggle, () => { savedOnly = !savedOnly; refreshFavorites(); });
      const filter = document.createElement('button');
      filter.type = 'button';
      filter.className = 'tool-filter-placeholder';
      filter.disabled = true;
      filter.setAttribute('aria-label', `Filter ${plural} (coming soon)`);
      filter.title = 'Filters are coming soon';
      filter.append(toolIcon('filter'));
      savedLabel = document.createElement('span');
      savedLabel.className = 'tool-saved-label';
      savedLabel.textContent = 'Saved';
      toolbar.append(savedToggle, filter, savedLabel);
      menu.append(toolbar);
    }

    const rows = [...select.options].map(option => {
      const row = document.createElement('div');
      row.className = 'tool-dropdown-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-dropdown-option';
      if (!supportsFavorites) { button.setAttribute('role', 'option'); button.tabIndex = -1; }
      button.textContent = option.textContent;
      button.append(createIcon('check', 'tool-dropdown-check'));
      bindTapActivation(button, () => {
        if (menu.hidden || select.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      });
      row.append(button);
      let favorite;
      if (supportsFavorites && option.value) {
        favorite = document.createElement('button');
        favorite.type = 'button';
        favorite.className = 'tool-option-favorite';
        favorite.append(toolIcon('heart'));
        bindTapActivation(favorite, () => {
          if (favorites.has(option.value)) favorites.delete(option.value); else favorites.add(option.value);
          savedFavorites[key] = [...favorites];
          try { localStorage.setItem(favoritesStorageKey, JSON.stringify(savedFavorites)); }
          catch { notify('Saved for this session. Browser storage is unavailable.'); }
          refreshFavorites();
          if (row.hidden) (rows.find(choice => !choice.row.hidden)?.button || savedToggle).focus();
        });
        row.append(favorite);
      }
      list.append(row);
      return { row, button, favorite, option };
    });
    const empty = document.createElement('p');
    empty.className = 'tool-saved-empty';
    empty.setAttribute('role', 'status');
    empty.textContent = `No saved ${plural} yet. Use the heart beside an option to save it.`;
    empty.hidden = true;
    menu.append(list, empty);
    field.append(trigger, menu);

    function refreshFavorites() {
      if (!supportsFavorites) return;
      savedToggle.setAttribute('aria-pressed', String(savedOnly));
      savedToggle.setAttribute('aria-label', `Show ${savedOnly ? 'all' : 'saved'} ${plural}`);
      savedToggle.title = `Show ${savedOnly ? 'all' : 'saved'} ${plural}`;
      savedLabel.hidden = !savedOnly;
      for (const { row, favorite, option } of rows) {
        const saved = favorites.has(option.value);
        row.hidden = savedOnly && !saved;
        if (!favorite) continue;
        favorite.setAttribute('aria-pressed', String(saved));
        favorite.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${option.textContent}`);
        favorite.title = `${saved ? 'Unsave' : 'Save'} ${option.textContent}`;
      }
      empty.hidden = !savedOnly || rows.some(choice => !choice.row.hidden);
    }
    function refresh() {
      trigger.disabled = select.disabled;
      field.dataset.hasValue = String(Boolean(select.value));
      trigger.title = select.title;
      if (select.disabled) close();
      const selected = select.options[select.selectedIndex];
      text.textContent = select.value ? selected.textContent : placeholder;
      trigger.setAttribute('aria-label', select.value ? `${label}: ${selected.textContent}` : placeholder);
      rows.forEach(({ row, button }, index) => {
        row.dataset.selected = String(index === select.selectedIndex);
        button.setAttribute(supportsFavorites ? 'aria-pressed' : 'aria-selected', String(index === select.selectedIndex));
      });
      refreshFavorites();
    }
    function close(restoreFocus = false) {
      menu.hidden = true;
      if (menu.parentElement !== field) field.append(menu);
      delete menu.dataset.workspaceDropdown;
      menu.removeAttribute('style');
      field.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
    function open() {
      if (select.disabled) return;
      closeAll();
      refresh();
      if (mobileWorkspacePanel() || editorStyle) {
        document.body.append(menu);
        menu.dataset.workspaceDropdown = 'true';
        menu.style.zIndex = tokenValue('foundation.layer.30');
      }
      menu.hidden = false;
      field.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      if (floating || mobileWorkspacePanel()) {
        const bounds = trigger.getBoundingClientRect();
        const below = document.documentElement.clientHeight - bounds.bottom - tokenNumber('foundation.space.12');
        const topLimit = mobileWorkspacePanel() ? tokenNumber('foundation.size.90') : tokenNumber('foundation.space.12');
        const above = bounds.top - topLimit;
        const opensUp = below < tokenNumber('foundation.size.160') && above > below;
        const menuWidth = editorStyle ? Math.min(tokenNumber('foundation.size.220'), document.documentElement.clientWidth - tokenNumber('foundation.space.24')) : bounds.width;
        menu.style.position = 'fixed';
        menu.style.left = `${editorStyle ? Math.max(tokenNumber('foundation.space.12'), Math.min(bounds.left, document.documentElement.clientWidth - menuWidth - tokenNumber('foundation.space.12'))) : bounds.left}px`;
        menu.style.right = 'auto';
        menu.style.width = `${menuWidth}px`;
        menu.style.maxHeight = `${Math.max(tokenNumber('foundation.size.80'), Math.min(tokenNumber('foundation.size.360'), opensUp ? above : below))}px`;
        menu.style.top = `${opensUp ? Math.max(topLimit, bounds.top - menu.getBoundingClientRect().height - tokenNumber('foundation.space.8')) : bounds.bottom + tokenNumber('foundation.space.8')}px`;
      }
      const selected = rows[select.selectedIndex];
      (selected && !selected.row.hidden ? selected.button : rows.find(choice => !choice.row.hidden)?.button || savedToggle).focus({ preventScroll: true });
    }
    trigger.addEventListener('click', () => { if (menu.hidden) open(); else close(true); });
    trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      open();
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close(true); return;
      }
      if (event.key === 'Tab' && !supportsFavorites) { close(true); return; }
      const visible = rows.filter(choice => !choice.row.hidden);
      const index = visible.findIndex(choice => choice.row.contains(document.activeElement));
      const next = event.key === 'ArrowDown' ? (index + 1) % visible.length
        : event.key === 'ArrowUp' ? (index < 0 ? visible.length - 1 : (index - 1 + visible.length) % visible.length)
        : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      visible[next]?.button.focus();
    });
    select.addEventListener('change', refresh);
    if (floating || inWorkspacePanel) {
      document.addEventListener('scroll', event => { if ((floating || mobileWorkspacePanel()) && !menu.hidden && !menu.contains(event.target)) close(); }, true);
      window.addEventListener('resize', () => close());
    }
    refresh();
    return { contains: target => field.contains(target) || menu.contains(target), close, refresh };
  });

  function closeAll() { controls.forEach(control => control.close()); }
  // On touch browsers, moving between buttons can blur to the page before click.
  // Close on an actual outside interaction, not that temporary loss of focus.
  for (const eventName of ['pointerdown', 'focusin']) {
    document.addEventListener(eventName, event => {
      controls.forEach(control => { if (!control.contains(event.target)) control.close(); });
    });
  }
  return { close: closeAll, refresh: () => controls.forEach(control => control.refresh()) };
}
