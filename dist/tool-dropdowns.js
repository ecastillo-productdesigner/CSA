import { createDropdownTransition } from './dropdown-transition.js?v=20261026-drafting-card-size';
import { tokenNumber, tokenValue, breakpointQuery } from './design-system/runtime.js?v=20261026-drafting-card-size';
import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { bindTapActivation } from './tap-activation.js?v=20261026-drafting-card-size';
import { toolFavorites } from './tool-favorites.js?v=20261105-filter-settings';

export function createToolDropdowns({ root = document, favoritesStore = toolFavorites, notify = () => {} } = {}) {
  const controls = [...root.querySelectorAll('.composer-field, .results-sort-field, .results-source-field, .feedback-select-field, .editor-style-field, .word-count-field')].map(field => {
    const select = field.querySelector('select');
    const label = field.dataset.label;
    const draftSetting = field.matches('.composer-field') && ['Format', 'Audience', 'Voice'].includes(label);
    const sourceFilter = field.matches('.results-source-field');
    if (sourceFilter) select.multiple = true;
    const key = sourceFilter ? 'source' : draftSetting ? label.toLowerCase() : select.id.replace(/^(composer-|output-edit-)/, '');
    const supportsFavorites = sourceFilter || (draftSetting && ['format', 'audience'].includes(key));
    const favoriteChoice = option => Boolean(option.value) && !(sourceFilter && option.value === 'all');
    let opensUp = false;
    field.dataset.tool = key;
    if (field.dataset.fixedValue) {
      const value = field.dataset.fixedValue;
      const display = document.createElement('div');
      display.className = 'tool-fixed-value';
      display.textContent = [...select.options].find(option => option.value === value).textContent;
      display.setAttribute('aria-label', `${label}: ${display.textContent}`);
      field.append(display);
      function refresh() {
        select.value = value;
        field.dataset.hasValue = 'true';
      }
      select.addEventListener('change', refresh);
      refresh();
      return { connected: () => field.isConnected, contains: target => field.contains(target), close() {}, refresh };
    }
    const editorStyle = field.matches('.editor-style-field');
    const floating = field.matches('.feedback-select-field') || editorStyle || sourceFilter;
    const inWorkspacePanel = Boolean(field.closest('#composer-tools, .composer-tools'));
    const mobileWorkspacePanel = () => inWorkspacePanel && window.matchMedia(breakpointQuery()).matches;
    const placeholder = draftSetting ? label : field.dataset.placeholder || (['format', 'audience', 'voice'].includes(key) ? `Select ${label}` : label);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'tool-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', supportsFavorites ? 'dialog' : 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${select.id}-options`);
    const text = document.createElement('span');
    const singleChevron = draftSetting || sourceFilter || field.matches('.results-sort-field');
    const chevron = createIcon(singleChevron ? 'keyboard_arrow_down' : 'unfold_less', 'tool-dropdown-chevron');
    trigger.append(text, chevron);

    const menu = document.createElement('div');
    menu.id = `${select.id}-options`;
    menu.className = 'tool-dropdown-menu';
    menu.hidden = true;
    if (supportsFavorites) {
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', `${label} options`);
    }
    const list = document.createElement('div');
    list.id = `${select.id}-choices`;
    list.className = 'tool-dropdown-list';
    list.setAttribute('role', supportsFavorites ? 'group' : 'listbox');
    list.setAttribute('aria-label', label);
    let rows = [];
    let displayedRows = [];
    let optionsSignature = '';
    function refreshRows() {
      const options = [...select.options];
      const signature = JSON.stringify(options.map(option => [option.value, option.textContent, option.disabled]));
      if (signature === optionsSignature && options.every((option, index) => rows[index]?.option === option)) return;
      optionsSignature = signature;
      list.replaceChildren();
      rows = options.map(option => {
        const row = document.createElement('div');
        row.className = 'tool-dropdown-row';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tool-dropdown-option';
        button.disabled = option.disabled;
        if (sourceFilter) button.setAttribute('role', 'checkbox');
        else if (!supportsFavorites) button.setAttribute('role', 'option');
        button.tabIndex = supportsFavorites ? 0 : -1;
        button.textContent = option.textContent;
        button.append(createIcon('check', 'tool-dropdown-check'));
        bindTapActivation(button, () => {
          if (!transition.expanded || select.disabled || option.disabled) return;
          if (sourceFilter && option.value !== 'all') {
            option.selected = !option.selected;
            const all = [...select.options].find(choice => choice.value === 'all');
            if (all) all.selected = false;
            if (![...select.options].some(choice => choice.selected)) select.value = 'all';
          } else select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          if (sourceFilter) button.focus({ preventScroll: true });
          else close(true);
        });
        row.append(button);
        let favorite;
        if (supportsFavorites && favoriteChoice(option)) {
          favorite = document.createElement('button');
          favorite.type = 'button';
          favorite.className = 'tool-option-favorite';
          favorite.append(createIcon('favorite'));
          bindTapActivation(favorite, () => {
            if (!transition.expanded || select.disabled) return;
            const { persisted } = favoritesStore.toggle(key, option.value);
            if (!persisted) notify('Favorites updated for this session only. Browser storage is unavailable');
          });
          row.append(favorite);
        }
        list.append(row);
        return { row, button, favorite, option };
      });
      displayedRows = rows;
    }
    menu.append(list);
    field.append(trigger, menu);
    const transition = createDropdownTransition(menu, { onClosed: settleMenu });

    function settleMenu() {
      if (menu.parentElement !== field) field.append(menu);
      delete menu.dataset.workspaceDropdown;
      menu.removeAttribute('style');
    }
    function refreshFavorites() {
      if (!supportsFavorites) return;
      const favorites = new Set(favoritesStore.values(key));
      for (const { favorite, option } of rows) {
        if (!favorite) continue;
        const saved = favorites.has(option.value);
        favorite.setAttribute('aria-pressed', String(saved));
        const favoriteLabel = saved ? `Remove ${option.textContent} from favorites` : `Add ${option.textContent} to favorites`;
        favorite.setAttribute('aria-label', favoriteLabel);
        favorite.title = favoriteLabel;
      }
      // Keep reset first, then favorites and remaining choices in catalog order.
      const rank = ({ option }) => !favoriteChoice(option) ? 0 : favorites.has(option.value) ? 1 : 2;
      const ordered = [...rows].sort((a, b) => rank(a) - rank(b));
      if (ordered.some((choice, index) => choice !== displayedRows[index])) {
        const active = list.contains(document.activeElement) ? document.activeElement : null;
        list.append(...ordered.map(({ row }) => row));
        if (active && document.activeElement !== active) active.focus({ preventScroll: true });
      }
      displayedRows = ordered;
      if (transition.expanded) positionMenu();
    }
    const unsubscribeFavorites = supportsFavorites ? favoritesStore.subscribe(refreshFavorites) : () => {};
    function refresh() {
      refreshRows();
      trigger.disabled = select.disabled;
      field.dataset.hasValue = String(Boolean(select.value));
      trigger.title = select.title;
      if (select.disabled) close(false, { animate: false });
      const selected = select.options[select.selectedIndex];
      const selectedPublications = sourceFilter ? [...select.options].filter(option => option.selected && option.value !== 'all').map(option => option.textContent) : [];
      const selectedLabel = sourceFilter
        ? selectedPublications.length > 2 ? `${selectedPublications.length} publications` : selectedPublications.join(' + ') || 'All sources'
        : select.value && selected ? selected.textContent : placeholder;
      text.textContent = selectedLabel;
      const accessibleLabel = sourceFilter ? selectedPublications.join(', ') || 'All sources' : selectedLabel;
      trigger.setAttribute('aria-label', select.value ? `${label}: ${accessibleLabel}` : accessibleLabel);
      if (sourceFilter) trigger.title = accessibleLabel;
      rows.forEach(({ row, button, option }) => {
        row.dataset.selected = String(option.selected);
        button.setAttribute(sourceFilter ? 'aria-checked' : supportsFavorites ? 'aria-pressed' : 'aria-selected', String(option.selected));
      });
      refreshFavorites();
    }
    function close(restoreFocus = false, { animate = true } = {}) {
      field.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
      transition.close({ animate });
    }
    function positionMenu() {
      if (floating || inWorkspacePanel) {
        const bounds = trigger.getBoundingClientRect();
        const below = document.documentElement.clientHeight - bounds.bottom - tokenNumber('foundation.space.12');
        const topLimit = mobileWorkspacePanel() ? tokenNumber('foundation.size.90') : tokenNumber('foundation.space.12');
        const above = bounds.top - topLimit - tokenNumber('foundation.space.8');
        opensUp = below < tokenNumber('foundation.size.160') && above > below;
        const menuWidth = editorStyle ? Math.min(tokenNumber('foundation.size.220'), document.documentElement.clientWidth - tokenNumber('foundation.space.24')) : bounds.width;
        menu.style.position = 'fixed';
        menu.style.left = `${editorStyle ? Math.max(tokenNumber('foundation.space.12'), Math.min(bounds.left, document.documentElement.clientWidth - menuWidth - tokenNumber('foundation.space.12'))) : bounds.left}px`;
        menu.style.right = 'auto';
        menu.style.width = `${menuWidth}px`;
        menu.style.maxHeight = `${Math.max(tokenNumber('foundation.size.80'), Math.min(tokenNumber('foundation.size.360'), opensUp ? above : below))}px`;
        menu.style.top = `${opensUp ? Math.max(topLimit, bounds.top - menu.getBoundingClientRect().height - tokenNumber('foundation.space.8')) : bounds.bottom + tokenNumber('foundation.space.8')}px`;
      }
    }
    function open() {
      if (select.disabled) return;
      closeAll(menu);
      if (supportsFavorites) favoritesStore.refresh();
      refresh();
      if (inWorkspacePanel || editorStyle || sourceFilter) {
        document.body.append(menu);
        menu.dataset.workspaceDropdown = 'true';
        menu.style.zIndex = tokenValue('foundation.layer.30');
      }
      menu.hidden = false;
      field.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      positionMenu();
      transition.open({ opensUp });
      const selected = displayedRows.find(choice => choice.option.selected && !choice.button.disabled);
      (selected?.button || displayedRows.find(choice => !choice.button.disabled)?.button)?.focus({ preventScroll: true });
    }
    trigger.addEventListener('click', () => { if (!transition.expanded) open(); else close(true); });
    trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      open();
    });
    menu.addEventListener('keydown', event => {
      if (!transition.expanded || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close(true); return;
      }
      const visible = displayedRows.filter(choice => !choice.button.disabled);
      if (event.key === 'Tab') {
        if (!supportsFavorites) { close(true); return; }
        const targets = visible.flatMap(choice => [choice.button, choice.favorite].filter(Boolean));
        if (document.activeElement === (event.shiftKey ? targets[0] : targets.at(-1))) close(true);
        return;
      }
      if (!visible.length) return;
      const index = visible.findIndex(choice => choice.row.contains(document.activeElement));
      if (supportsFavorites && index >= 0 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        (event.key === 'ArrowRight' ? visible[index].favorite || visible[index].button : visible[index].button).focus();
        return;
      }
      const next = event.key === 'ArrowDown' ? (index + 1) % visible.length
        : event.key === 'ArrowUp' ? (index < 0 ? visible.length - 1 : (index - 1 + visible.length) % visible.length)
        : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      const moveFavorite = supportsFavorites && index >= 0 && document.activeElement === visible[index].favorite;
      (moveFavorite ? visible[next]?.favorite || visible[next]?.button : visible[next]?.button)?.focus();
    });
    select.addEventListener('change', refresh);
    if (floating || inWorkspacePanel) {
      document.addEventListener('scroll', event => {
        if (menu.hidden || menu.contains(event.target)) return;
        if (sourceFilter && transition.expanded) {
          // Filtering can change the results height and adjust the canvas scroll.
          // Keep the multi-select anchored so another publication can be chosen.
          const bounds = trigger.getBoundingClientRect();
          if (bounds.bottom > 0 && bounds.top < document.documentElement.clientHeight) {
            positionMenu();
            return;
          }
        }
        close();
      }, true);
      window.addEventListener('resize', () => close());
    }
    refresh();
    return {
      menu,
      connected: () => field.isConnected,
      contains: target => field.contains(target) || menu.contains(target),
      close,
      refresh() { transition.settle(); refresh(); },
      destroy() { unsubscribeFavorites(); transition.destroy(); },
    };
  });

  function closeAll(exceptMenu = null) { controls.forEach(control => { if (control.menu !== exceptMenu) control.close(); }); }
  const removalObserver = typeof MutationObserver === 'function' ? new MutationObserver(() => {
    controls.forEach(control => { if (!control.connected()) control.close(false, { animate: false }); });
  }) : null;
  removalObserver?.observe(document.body, { childList: true, subtree: true });
  // On touch browsers, moving between buttons can blur to the page before click.
  // Close on an actual outside interaction, not that temporary loss of focus.
  for (const eventName of ['pointerdown', 'focusin']) {
    document.addEventListener(eventName, event => {
      controls.forEach(control => { if (!control.contains(event.target)) control.close(); });
    });
  }
  const onStorage = () => favoritesStore.refresh();
  window.addEventListener('storage', onStorage);
  return {
    close: closeAll,
    refresh: () => controls.forEach(control => control.refresh()),
    destroy() { window.removeEventListener('storage', onStorage); removalObserver?.disconnect(); controls.forEach(control => control.destroy?.()); closeAll(); },
  };
}
