export function createToolDropdowns() {
  const controls = [...document.querySelectorAll('.composer-field')].map(field => {
    const select = field.querySelector('select');
    const label = field.dataset.label;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'tool-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${select.id}-options`);
    const text = document.createElement('span');
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm6 9 6 6 6-6');
    chevron.append(path);
    trigger.append(text, chevron);
    const menu = document.createElement('div');
    menu.id = `${select.id}-options`;
    menu.className = 'tool-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', label);
    menu.hidden = true;
    const options = [...select.options].map(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-dropdown-option';
      button.setAttribute('role', 'option');
      button.tabIndex = -1;
      button.textContent = option.textContent;
      button.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      });
      return button;
    });
    menu.append(...options);
    field.append(trigger, menu);

    function refresh() {
      const selected = select.options[select.selectedIndex];
      text.textContent = select.value ? selected.textContent : label;
      trigger.setAttribute('aria-label', `${label}: ${selected?.textContent || 'None Selected'}`);
      options.forEach((option, index) => option.setAttribute('aria-selected', String(index === select.selectedIndex)));
    }
    function close(restoreFocus = false) {
      menu.hidden = true;
      field.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }
    function open() {
      closeAll();
      refresh();
      menu.hidden = false;
      field.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      options[Math.max(0, select.selectedIndex)].focus();
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
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % options.length
        : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      options[next].focus();
    });
    select.addEventListener('change', refresh);
    refresh();
    return { field, close, refresh };
  });

  function closeAll() { controls.forEach(control => control.close()); }
  document.addEventListener('pointerdown', event => {
    controls.forEach(control => { if (!control.field.contains(event.target)) control.close(); });
  });
  return { close: closeAll, refresh: () => controls.forEach(control => control.refresh()) };
}
