import { tokenNumber, tokenValue, breakpointQuery } from './design-system/runtime.js?v=20261022-toast-copy';
import { createIcon } from './icons.js?v=20261022-toast-copy';
import { bindTapActivation } from './tap-activation.js?v=20261022-toast-copy';

export function createToolDropdowns({ root = document } = {}) {
  const controls = [...root.querySelectorAll('.composer-field, .results-sort-field, .feedback-select-field, .editor-style-field, .word-count-field')].map(field => {
    const select = field.querySelector('select');
    const label = field.dataset.label;
    const key = field.matches('.composer-field') && ['Format', 'Audience', 'Voice'].includes(label)
      ? label.toLowerCase() : select.id.replace(/^(composer-|output-edit-)/, '');
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
      return { contains: target => field.contains(target), close() {}, refresh };
    }
    const editorStyle = field.matches('.editor-style-field');
    const floating = Boolean(field.closest('#output-edit-menu')) || field.matches('.feedback-select-field') || editorStyle;
    const inWorkspacePanel = Boolean(field.closest('#composer-tools, .composer-tools'));
    const mobileWorkspacePanel = () => inWorkspacePanel && window.matchMedia(breakpointQuery()).matches;
    const placeholder = field.dataset.placeholder || (['format', 'audience', 'voice'].includes(key) ? `Select ${label}` : label);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'tool-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${select.id}-options`);
    const text = document.createElement('span');
    const chevron = createIcon('keyboard_arrow_down', 'tool-dropdown-chevron');
    trigger.append(text, chevron);

    const menu = document.createElement('div');
    menu.id = `${select.id}-options`;
    menu.className = 'tool-dropdown-menu';
    menu.hidden = true;
    const list = document.createElement('div');
    list.id = `${select.id}-choices`;
    list.className = 'tool-dropdown-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label);
    const rows = [...select.options].map(option => {
      const row = document.createElement('div');
      row.className = 'tool-dropdown-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-dropdown-option';
      button.setAttribute('role', 'option');
      button.tabIndex = -1;
      button.textContent = option.textContent;
      button.append(createIcon('check', 'tool-dropdown-check'));
      bindTapActivation(button, () => {
        if (menu.hidden || select.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      });
      row.append(button);
      list.append(row);
      return { row, button, option };
    });
    menu.append(list);
    field.append(trigger, menu);

    function refresh() {
      trigger.disabled = select.disabled;
      field.dataset.hasValue = String(Boolean(select.value));
      trigger.title = select.title;
      if (select.disabled) close();
      const selected = select.options[select.selectedIndex];
      text.textContent = select.value ? selected.textContent : placeholder;
      trigger.setAttribute('aria-label', select.value ? `${label}: ${selected.textContent}` : placeholder);
      rows.forEach(({ row, button, option }) => {
        row.dataset.selected = String(option.selected);
        button.setAttribute('aria-selected', String(option.selected));
      });
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
      if (inWorkspacePanel || editorStyle) {
        document.body.append(menu);
        menu.dataset.workspaceDropdown = 'true';
        menu.style.zIndex = tokenValue('foundation.layer.30');
      }
      menu.hidden = false;
      field.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      if (floating || inWorkspacePanel) {
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
      const selected = rows.find(choice => choice.option.selected);
      (selected && !selected.row.hidden ? selected.button : rows.find(choice => !choice.row.hidden)?.button).focus({ preventScroll: true });
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
      if (event.key === 'Tab') { close(true); return; }
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
      document.addEventListener('scroll', event => { if (!menu.hidden && !menu.contains(event.target)) close(); }, true);
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
