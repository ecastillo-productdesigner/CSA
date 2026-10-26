import { createIcon } from './icons.js?v=20261026-us-weekly-case';
import { tokenNumber } from './design-system/runtime.js?v=20261026-us-weekly-case';
import { bindTapActivation } from './tap-activation.js?v=20261026-us-weekly-case';

export const sendDestinations = Object.freeze([
  { id: 'us-weekly', name: 'Us Weekly WordPress', url: 'https://www.usmagazine.com', adminView: true },
  { id: 'bargain-hunter', name: 'Bargain Hunter WordPress', url: 'https://www.bargainhunter.com', adminView: true },
  { id: 'womans-world', name: "Woman's World", url: 'https://www.womansworld.com', adminView: true },
  { id: 'soap-opera-digest', name: 'Soap Opera Digest', url: 'https://www.soapoperadigest.com', adminView: true },
].map(destination => Object.freeze(destination)));
export const isSendDestination = value => sendDestinations.some(destination => destination.id === value);

const validTarget = target => Boolean(target && typeof target.projectId === 'string' && target.projectId
  && typeof target.outputId === 'string' && target.outputId);
const sameTarget = (first, second) => validTarget(first) && validTarget(second)
  && first.projectId === second.projectId && first.outputId === second.outputId;

export function createSendDestinationDialog({ getTarget, onSend, onSent }) {
  const dialog = document.querySelector('#send-destination-dialog');
  const form = document.querySelector('#send-destination-form');
  const site = document.querySelector('#send-destination-site');
  const picker = document.querySelector('#send-destination-trigger');
  const pickerName = document.querySelector('#send-destination-name');
  const pickerUrl = document.querySelector('#send-destination-url');
  const pickerAdmin = document.querySelector('#send-destination-admin');
  const options = document.querySelector('#send-destination-options');
  const dismiss = document.querySelector('#send-destination-close');
  const cancel = document.querySelector('#send-destination-cancel');
  const confirm = document.querySelector('#send-destination-confirm');
  const error = document.querySelector('#send-destination-error');
  let active = null;
  let sending = false;
  const initialDestination = isSendDestination(site.value) ? site.value : sendDestinations[0].id;
  const rows = sendDestinations.map(destination => {
    const nativeOption = document.createElement('option');
    nativeOption.value = destination.id;
    nativeOption.textContent = destination.name;
    const button = document.createElement('button');
    button.id = `send-destination-option-${destination.id}`;
    button.type = 'button';
    button.className = 'send-destination-option';
    button.dataset.sendDestination = destination.id;
    button.tabIndex = -1;
    button.setAttribute('role', 'option');
    const preview = document.createElement('span');
    preview.className = 'send-destination-site-preview';
    const nameRow = document.createElement('span');
    nameRow.className = 'send-destination-name-row';
    const name = document.createElement('span');
    name.className = 'send-destination-site-name';
    name.textContent = destination.name;
    const admin = document.createElement('span');
    admin.className = 'send-destination-admin';
    admin.textContent = 'ADMIN VIEW';
    admin.hidden = !destination.adminView;
    const url = document.createElement('span');
    url.className = 'send-destination-site-url';
    url.textContent = destination.url;
    nameRow.append(name, admin);
    preview.append(nameRow, url);
    const check = createIcon('check', 'send-destination-option-check');
    button.append(preview, check);
    bindTapActivation(button, () => chooseDestination(destination.id));
    return { destination, nativeOption, button, check };
  });
  site.replaceChildren(...rows.map(row => row.nativeOption));
  site.value = initialDestination;
  options.replaceChildren(...rows.map(row => row.button));

  function updateDestination() {
    const selected = sendDestinations.find(destination => destination.id === site.value);
    pickerName.textContent = selected?.name || 'Choose a destination';
    pickerUrl.textContent = selected?.url || '';
    pickerAdmin.textContent = 'ADMIN VIEW';
    pickerAdmin.hidden = !selected?.adminView;
    for (const row of rows) {
      const selected = row.destination.id === site.value;
      row.button.setAttribute('aria-selected', String(selected));
      row.check.hidden = !selected;
    }
  }

  function closePicker(restoreFocus = false) {
    options.hidden = true;
    picker.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !picker.disabled) picker.focus({ preventScroll: true });
  }

  function positionPicker() {
    if (options.hidden) return;
    const bounds = picker.getBoundingClientRect();
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const limit = tokenNumber('foundation.size.420');
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const below = Math.max(0, height - bounds.bottom - gap - inset);
    const above = Math.max(0, bounds.top - gap - inset);
    const opensUp = below < limit && above > below;
    const menuWidth = Math.min(bounds.width, width - inset * 2);
    options.style.width = `${menuWidth}px`;
    options.style.left = `${Math.max(inset, Math.min(bounds.left, width - menuWidth - inset))}px`;
    options.style.maxHeight = `${Math.min(limit, opensUp ? above : below)}px`;
    const menuHeight = options.getBoundingClientRect().height;
    options.style.top = `${Math.max(inset, Math.min(opensUp ? bounds.top - gap - menuHeight : bounds.bottom + gap, height - menuHeight - inset))}px`;
  }

  function focusOption(index) {
    const button = rows[index]?.button;
    if (!button) return;
    button.focus({ preventScroll: true });
    const item = button.getBoundingClientRect();
    const list = options.getBoundingClientRect();
    if (item.top < list.top) options.scrollTop -= list.top - item.top;
    else if (item.bottom > list.bottom) options.scrollTop += item.bottom - list.bottom;
  }

  function openPicker(index = rows.findIndex(row => row.destination.id === site.value)) {
    if (!active || !dialog.open || sending || picker.disabled) return;
    updateDestination();
    options.hidden = false;
    picker.setAttribute('aria-expanded', 'true');
    positionPicker();
    focusOption(index < 0 ? 0 : index);
  }

  function chooseDestination(id) {
    if (!active || !dialog.open || sending || options.hidden || !isSendDestination(id)) return;
    site.value = id;
    site.dispatchEvent(new Event('change', { bubbles: true }));
    closePicker(true);
  }

  function updateControls() {
    dialog.dataset.busy = String(sending);
    dialog.setAttribute('aria-busy', String(sending));
    form.setAttribute('aria-busy', String(sending));
    site.disabled = sending;
    picker.disabled = sending;
    for (const row of rows) row.button.disabled = sending;
    dismiss.disabled = sending;
    cancel.disabled = sending;
    confirm.disabled = sending || !active || !isSendDestination(site.value);
    confirm.textContent = sending ? 'Exporting…' : 'Export';
    if (sending) closePicker();
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  function restoreFocus(trigger) {
    if (trigger?.isConnected && !trigger.disabled && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true });
    else document.querySelector('#main')?.focus({ preventScroll: true });
  }

  function close() {
    if (sending) return false;
    closePicker();
    if (dialog.open) dialog.close();
    return true;
  }

  function open(projectId) {
    if (sending) return false;
    const target = getTarget(projectId);
    if (!validTarget(target) || target.projectId !== projectId) return false;
    if (dialog.open) {
      if (!sameTarget(active?.target, target)) return false;
      picker.focus({ preventScroll: true });
      return true;
    }
    active = { target: { projectId: target.projectId, outputId: target.outputId }, trigger: document.activeElement };
    error.hidden = true;
    error.textContent = '';
    closePicker();
    updateDestination();
    updateControls();
    dialog.showModal();
    picker.focus({ preventScroll: true });
    return true;
  }

  dismiss.addEventListener('click', close);
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (!options.hidden) closePicker(true);
    else close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const trigger = active?.trigger;
    const sentTarget = active?.sentDestination ? { ...active.target } : null;
    const sentDestination = active?.sentDestination;
    active = null;
    sending = false;
    closePicker();
    updateControls();
    restoreFocus(trigger);
    if (sentTarget) onSent?.(sentTarget, sentDestination);
  });
  site.addEventListener('change', () => { updateDestination(); updateControls(); });
  picker.addEventListener('click', () => { if (options.hidden) openPicker(); else closePicker(true); });
  picker.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    openPicker(event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : undefined);
  });
  options.addEventListener('keydown', event => {
    if (options.hidden || sending) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePicker(true); return; }
    if (event.key === 'Tab') { closePicker(true); return; }
    const current = rows.findIndex(row => row.button === document.activeElement);
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (current >= 0) chooseDestination(rows[current].destination.id);
      return;
    }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % rows.length
        : event.key === 'ArrowUp' ? (current - 1 + rows.length) % rows.length : null;
    if (next !== null) { event.preventDefault(); focusOption(next); }
  });
  for (const eventName of ['pointerdown', 'focusin']) document.addEventListener(eventName, event => {
    if (!options.hidden && !picker.contains(event.target) && !options.contains(event.target)) closePicker();
  });
  document.addEventListener('scroll', event => { if (!options.hidden && !options.contains(event.target)) closePicker(); }, true);
  window.addEventListener('resize', positionPicker);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!active || !dialog.open || sending) return;
    const destination = site.value;
    if (!isSendDestination(destination)) {
      showError('Choose a destination before sending');
      updateControls();
      picker.focus({ preventScroll: true });
      return;
    }
    const request = active;
    if (!sameTarget(request.target, getTarget(request.target.projectId))) {
      showError('This content is no longer ready to send. Close this window and select an adapted draft.');
      return;
    }
    sending = true;
    updateControls();
    try {
      const sent = await onSend({ ...request.target }, destination);
      if (active !== request || !dialog.open) return;
      sending = false;
      updateControls();
      if (sent === true) {
        request.sentDestination = destination;
        close();
      }
      else {
        showError('Content could not be sent. Please try again.');
        confirm.focus({ preventScroll: true });
      }
    } catch {
      if (active !== request || !dialog.open) return;
      sending = false;
      updateControls();
      showError('Content could not be sent. Please try again.');
      confirm.focus({ preventScroll: true });
    }
  });
  updateDestination();
  updateControls();
  return { open, close };
}
