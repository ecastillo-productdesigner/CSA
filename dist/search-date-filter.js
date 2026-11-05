import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { createDropdownTransition } from './dropdown-transition.js?v=20261026-drafting-card-size';
import { tokenNumber } from './design-system/runtime.js?v=20261029-revision-indicator-location';

const dayMilliseconds = 86400000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const modes = [['any', 'Any Date'], ['after', 'On or After'], ['range', 'Date Range']];
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthDate = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const isoDate = date => date.toISOString().slice(0, 10);
const dateValue = value => new Date(`${value}T12:00:00Z`);

export function validCalendarDate(value) {
  return typeof value === 'string' && datePattern.test(value) && !Number.isNaN(dateValue(value).getTime()) && isoDate(dateValue(value)) === value;
}

export function normalizeDateFilter({ after = '', before = '' } = {}) {
  after = validCalendarDate(after) ? after : '';
  before = validCalendarDate(before) ? before : '';
  if (!after) return { after: '', before: '' };
  return before && before < after ? { after: before, before: after } : { after, before };
}

export function dateFilterLabel(selection) {
  const { after, before } = normalizeDateFilter(selection);
  if (!after) return 'Any Date';
  if (!before) return `On or after ${shortDate.format(dateValue(after))}`;
  const start = dateValue(after);
  const end = dateValue(before);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${startMonth} ${start.getUTCDate()}–${startMonth === endMonth ? '' : `${endMonth} `}${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${shortDate.format(start)} – ${shortDate.format(end)}`;
}

export function selectCalendarDate(selection, value) {
  if (!validCalendarDate(value)) return { ...selection };
  if (selection.mode === 'after') return { mode: 'after', after: value, before: '' };
  if (!selection.after || selection.before) return { mode: 'range', after: value, before: '' };
  const [after, before] = [selection.after, value].sort();
  return { mode: 'range', after, before };
}

export function calendarMonthDays(value) {
  if (!validCalendarDate(value)) throw new TypeError('A valid calendar date is required');
  const first = dateValue(value);
  first.setUTCDate(1);
  const start = first.getTime() - first.getUTCDay() * dayMilliseconds;
  return Array.from({ length: 42 }, (_, index) => isoDate(new Date(start + index * dayMilliseconds)));
}

export function moveCalendarDate(value, amount, unit = 'day') {
  const date = dateValue(value);
  if (unit === 'month') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + amount);
    const last = new Date(date.getTime());
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, last.getUTCDate()));
  } else date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
}

export function createSearchDateFilter({ root, onChange = () => {} } = {}) {
  const afterInput = root?.querySelector('#results-after');
  const beforeInput = root?.querySelector('#results-before');
  if (!root || !afterInput || !beforeInput) return { sync() {}, close() {}, destroy() {} };
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const prefix = root.id || 'results-date-filter';
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  function element(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, action) {
    const node = element('button', className, text);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }
  let applied = normalizeDateFilter({ after: afterInput.value, before: beforeInput.value });
  let draft = { mode: 'any', after: '', before: '' };
  let focusedDate = applied.after || today();
  let visibleMonth = focusedDate.slice(0, 7);
  let destroyed = false;
  const trigger = button('tool-dropdown-trigger search-date-trigger', undefined, () => transition.expanded ? close(true) : open());
  trigger.id = `${prefix}-trigger`;
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${prefix}-menu`);
  const triggerLabel = element('span');
  trigger.append(triggerLabel, createIcon('keyboard_arrow_down'));
  root.append(trigger);
  const menu = element('div', 'search-date-menu');
  menu.id = `${prefix}-menu`;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Published Date');
  root.append(menu);
  const transition = createDropdownTransition(menu, { onClosed() { menu.removeAttribute('style'); } });
  const modeList = element('div', 'search-date-modes');
  modeList.setAttribute('role', 'group');
  modeList.setAttribute('aria-label', 'Date filter type');
  const modeButtons = modes.map(([mode, label]) => {
    const choice = button('tool-dropdown-option search-date-mode', undefined, () => {
      if (draft.mode !== mode) {
        draft = { mode, after: mode === 'any' ? '' : draft.after, before: mode === 'range' ? draft.before : '' };
      }
      render();
    });
    choice.dataset.dateMode = mode;
    choice.append(element('span', '', label), createIcon('check', 'search-date-mode-check'));
    modeList.append(choice);
    return choice;
  });
  const calendar = element('div', 'search-date-calendar');
  const summary = element('p', 'search-date-selection');
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  const heading = element('div', 'search-date-month-heading');
  const previous = button('icon-button search-date-month-button', undefined, () => changeMonth(-1));
  previous.setAttribute('aria-label', 'Previous Month');
  previous.append(createIcon('chevron_forward', 'search-date-previous'));
  const monthHeading = element('h3', 'search-date-month-title');
  monthHeading.id = `${prefix}-month`;
  monthHeading.setAttribute('aria-live', 'polite');
  const next = button('icon-button search-date-month-button', undefined, () => changeMonth(1));
  next.setAttribute('aria-label', 'Next Month');
  next.append(createIcon('chevron_forward'));
  heading.append(previous, monthHeading, next);
  const grid = element('div', 'search-date-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-labelledby', monthHeading.id);
  const help = element('p', 'search-date-help');
  help.id = `${prefix}-help`;
  grid.setAttribute('aria-describedby', help.id);
  calendar.append(summary, heading, grid, help);
  const footer = element('div', 'search-date-actions');
  const cancel = button('secondary-button search-date-cancel', 'Cancel', () => close(true));
  const apply = button('primary-button search-date-apply', 'Apply', () => {
    if (apply.disabled) return;
    applied = normalizeDateFilter(draft.mode === 'any' ? {} : draft);
    afterInput.value = applied.after;
    beforeInput.value = applied.before;
    updateTrigger();
    close(true);
    onChange({ ...applied });
  });
  footer.append(cancel, apply);
  menu.append(modeList, calendar, footer);

  function updateTrigger() {
    triggerLabel.textContent = dateFilterLabel(applied);
    trigger.setAttribute('aria-label', `Published date: ${triggerLabel.textContent}`);
  }
  function changeMonth(amount) {
    focusedDate = moveCalendarDate(focusedDate, amount, 'month');
    visibleMonth = focusedDate.slice(0, 7);
    render();
  }
  function renderCalendar(focus = false) {
    grid.setAttribute('aria-multiselectable', String(draft.mode === 'range'));
    monthHeading.textContent = monthDate.format(dateValue(`${visibleMonth}-01`));
    const weekday = element('div', 'search-date-week');
    weekday.setAttribute('role', 'row');
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    names.forEach(name => {
      const cell = element('span', 'search-date-weekday', name.slice(0, 1));
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('aria-label', name);
      weekday.append(cell);
    });
    const days = calendarMonthDays(`${visibleMonth}-01`);
    if (!days.includes(focusedDate)) focusedDate = `${visibleMonth}-01`;
    const rows = [];
    for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
      const row = element('div', 'search-date-week');
      row.setAttribute('role', 'row');
      for (const value of days.slice(rowIndex * 7, rowIndex * 7 + 7)) {
        const day = button('search-date-day', String(dateValue(value).getUTCDate()), () => {
          draft = selectCalendarDate(draft, value);
          focusedDate = value;
          visibleMonth = value.slice(0, 7);
          render(true);
        });
        day.dataset.date = value;
        day.dataset.outsideMonth = String(value.slice(0, 7) !== visibleMonth);
        const selected = value === draft.after || value === draft.before;
        const inRange = Boolean(draft.mode === 'range' && draft.after && draft.before && value > draft.after && value < draft.before);
        day.dataset.inRange = String(inRange);
        day.setAttribute('role', 'gridcell');
        day.setAttribute('aria-label', fullDate.format(dateValue(value)));
        day.setAttribute('aria-selected', String(selected || inRange));
        day.dataset.endpoint = String(selected);
        if (value === today()) day.setAttribute('aria-current', 'date');
        day.tabIndex = value === focusedDate ? 0 : -1;
        row.append(day);
      }
      rows.push(row);
    }
    grid.replaceChildren(weekday, ...rows);
    if (focus) grid.querySelector(`[data-date="${focusedDate}"]`)?.focus({ preventScroll: true });
  }
  function render(focus = false) {
    modeButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.dateMode === draft.mode)));
    calendar.hidden = draft.mode === 'any';
    if (draft.mode !== 'any') {
      summary.textContent = draft.mode === 'range'
        ? draft.after && draft.before ? dateFilterLabel(draft) : draft.after ? `Start: ${shortDate.format(dateValue(draft.after))} · Choose an end date` : 'Choose a start date, then an end date'
        : draft.after ? `On or after ${shortDate.format(dateValue(draft.after))}` : 'Choose a publication date';
      help.textContent = draft.mode === 'range' ? 'Both dates are included' : 'Includes the selected date';
      renderCalendar(focus);
    }
    apply.disabled = draft.mode !== 'any' && (!draft.after || draft.mode === 'range' && !draft.before);
    if (transition.expanded) position();
  }
  function position() {
    if (!transition.expanded || destroyed) return;
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const width = Math.min(Math.max(trigger.getBoundingClientRect().width, tokenNumber('foundation.size.320')), doc.documentElement.clientWidth - inset * 2);
    const height = doc.documentElement.clientHeight;
    menu.style.position = 'fixed';
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${height - inset * 2}px`;
    const bounds = trigger.getBoundingClientRect();
    const menuHeight = menu.getBoundingClientRect().height;
    const below = bounds.bottom + gap;
    const above = bounds.top - gap - menuHeight;
    const top = below + menuHeight <= height - inset ? below : above >= inset ? above : Math.max(inset, height - inset - menuHeight);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(inset, Math.min(bounds.left, doc.documentElement.clientWidth - inset - width))}px`;
  }
  function open() {
    if (destroyed || trigger.disabled) return;
    draft = { mode: applied.before ? 'range' : applied.after ? 'after' : 'any', ...applied };
    focusedDate = applied.after || today();
    visibleMonth = focusedDate.slice(0, 7);
    render();
    doc.dispatchEvent(new view.CustomEvent('csa:dropdown-open', { detail: { trigger } }));
    doc.body.append(menu);
    trigger.setAttribute('aria-expanded', 'true');
    transition.open();
    position();
    modeButtons.find(choice => choice.dataset.dateMode === draft.mode)?.focus({ preventScroll: true });
  }
  function close(restoreFocus = false) {
    trigger.setAttribute('aria-expanded', 'false');
    transition.close();
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function outside(event) {
    if (transition.expanded && !menu.contains(event.target) && !root.contains(event.target)) close();
  }
  function onDropdownOpen(event) {
    if (event.detail?.trigger !== trigger && transition.expanded) close();
  }
  function onDocumentClick(event) {
    const otherTrigger = event.target.closest?.('.tool-dropdown-trigger');
    if (otherTrigger && otherTrigger !== trigger && transition.expanded) close();
  }
  function onMenuKey(event) {
    if (!transition.expanded) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') {
      const focusable = [...menu.querySelectorAll('button:not([disabled])')].filter(node => !node.closest('[hidden]') && node.tabIndex >= 0);
      const boundary = event.shiftKey ? focusable[0] : focusable.at(-1);
      if (doc.activeElement === boundary) { event.preventDefault(); close(true); }
      return;
    }
    const day = event.target.closest('[data-date]');
    if (!day) return;
    let value;
    const weekday = dateValue(day.dataset.date).getUTCDay();
    if (event.key === 'ArrowLeft') value = moveCalendarDate(day.dataset.date, -1);
    if (event.key === 'ArrowRight') value = moveCalendarDate(day.dataset.date, 1);
    if (event.key === 'ArrowUp') value = moveCalendarDate(day.dataset.date, -7);
    if (event.key === 'ArrowDown') value = moveCalendarDate(day.dataset.date, 7);
    if (event.key === 'Home') value = moveCalendarDate(day.dataset.date, -weekday);
    if (event.key === 'End') value = moveCalendarDate(day.dataset.date, 6 - weekday);
    if (event.key === 'PageUp') value = moveCalendarDate(day.dataset.date, event.shiftKey ? -12 : -1, 'month');
    if (event.key === 'PageDown') value = moveCalendarDate(day.dataset.date, event.shiftKey ? 12 : 1, 'month');
    if (!value) return;
    event.preventDefault();
    focusedDate = value;
    visibleMonth = value.slice(0, 7);
    renderCalendar(true);
  }
  function onTriggerKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
    if (event.key === 'Escape' && transition.expanded) { event.preventDefault(); close(true); }
  }
  trigger.addEventListener('keydown', onTriggerKey);
  menu.addEventListener('keydown', onMenuKey);
  doc.addEventListener('pointerdown', outside);
  doc.addEventListener('click', onDocumentClick);
  doc.addEventListener('csa:dropdown-open', onDropdownOpen);
  view.addEventListener('resize', position);
  doc.addEventListener('scroll', position, true);
  updateTrigger();
  return {
    sync(value = {}) {
      applied = normalizeDateFilter(value);
      afterInput.value = applied.after;
      beforeInput.value = applied.before;
      updateTrigger();
      close();
    },
    close,
    destroy() {
      destroyed = true;
      transition.destroy();
      doc.removeEventListener('pointerdown', outside);
      doc.removeEventListener('click', onDocumentClick);
      doc.removeEventListener('csa:dropdown-open', onDropdownOpen);
      view.removeEventListener('resize', position);
      doc.removeEventListener('scroll', position, true);
      trigger.remove();
      menu.remove();
    },
  };
}
