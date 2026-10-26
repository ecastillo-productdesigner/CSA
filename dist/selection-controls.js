// Selection state stays with the caller; these helpers share ARIA and keyboard behavior.
export function syncSelection(items, value, { getValue = item => item.value, selectedAttribute = 'aria-selected', roving = true } = {}) {
  let selected = null;
  for (const item of items) {
    const active = getValue(item) === value;
    item.setAttribute(selectedAttribute, String(active));
    if (roving) item.tabIndex = active ? 0 : -1;
    if (active) selected = item;
  }
  return selected;
}

export function bindRovingSelection({ root, items, getValue = item => item.value, onSelect, selectedAttribute = 'aria-pressed', roving = false, orientation = 'horizontal' }) {
  const controls = [...items];
  const enabled = item => !item.disabled && !item.hidden && item.getAttribute('aria-disabled') !== 'true';
  const targetControl = target => controls.find(item => item === target || item.contains(target));
  function click(event) {
    const item = targetControl(event.target);
    if (item && enabled(item)) onSelect(getValue(item), item);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    if (![previousKey, nextKey, 'Home', 'End'].includes(event.key)) return;
    const available = controls.filter(enabled);
    const current = available.indexOf(targetControl(event.target));
    if (current < 0) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1
      : (current + (event.key === nextKey ? 1 : -1) + available.length) % available.length;
    const item = available[index];
    onSelect(getValue(item), item);
    item.focus({ preventScroll: true });
  }
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  return {
    sync: value => syncSelection(controls, value, { getValue, selectedAttribute, roving }),
    destroy() {
      root.removeEventListener('click', click);
      root.removeEventListener('keydown', keydown);
    },
  };
}

export function bindTabSelection({ root, items, panel, orientation = 'horizontal', ...options }) {
  const tabs = [...items];
  root.setAttribute('role', 'tablist');
  root.setAttribute('aria-orientation', orientation);
  for (const tab of tabs) {
    tab.setAttribute('role', 'tab');
    if (panel?.id) tab.setAttribute('aria-controls', panel.id);
  }
  panel?.setAttribute('role', 'tabpanel');
  const selection = bindRovingSelection({ root, items: tabs, ...options, orientation, selectedAttribute: 'aria-selected', roving: true });
  return {
    sync(value) {
      const selected = selection.sync(value);
      if (panel && selected?.id) panel.setAttribute('aria-labelledby', selected.id);
      return selected;
    },
    destroy: selection.destroy,
  };
}
