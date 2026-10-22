const validTarget = target => Boolean(target && typeof target.projectId === 'string' && target.projectId
  && typeof target.outputId === 'string' && target.outputId);
const sameTarget = (first, second) => validTarget(first) && validTarget(second)
  && first.projectId === second.projectId && first.outputId === second.outputId;
const validDestination = value => value === 'csa-gate-test';

export function createSendDestinationDialog({ getTarget, onSend }) {
  const dialog = document.querySelector('#send-destination-dialog');
  const form = document.querySelector('#send-destination-form');
  const site = document.querySelector('#send-destination-site');
  const dismiss = document.querySelector('#send-destination-close');
  const cancel = document.querySelector('#send-destination-cancel');
  const confirm = document.querySelector('#send-destination-confirm');
  const error = document.querySelector('#send-destination-error');
  let active = null;
  let sending = false;

  function updateControls() {
    dialog.dataset.busy = String(sending);
    dialog.setAttribute('aria-busy', String(sending));
    form.setAttribute('aria-busy', String(sending));
    site.disabled = sending;
    dismiss.disabled = sending;
    cancel.disabled = sending;
    confirm.disabled = sending || !active || !validDestination(site.value);
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
    if (dialog.open) dialog.close();
    return true;
  }

  function open(projectId) {
    if (sending) return false;
    const target = getTarget(projectId);
    if (!validTarget(target) || target.projectId !== projectId) return false;
    if (dialog.open) {
      if (!sameTarget(active?.target, target)) return false;
      site.focus({ preventScroll: true });
      return true;
    }
    active = { target: { projectId: target.projectId, outputId: target.outputId }, trigger: document.activeElement };
    error.hidden = true;
    error.textContent = '';
    updateControls();
    dialog.showModal();
    site.focus({ preventScroll: true });
    return true;
  }

  dismiss.addEventListener('click', close);
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const trigger = active?.trigger;
    active = null;
    sending = false;
    updateControls();
    restoreFocus(trigger);
  });
  site.addEventListener('change', updateControls);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!active || !dialog.open || sending) return;
    const destination = site.value;
    if (!validDestination(destination)) {
      showError('Choose a destination before sending');
      updateControls();
      site.focus({ preventScroll: true });
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
      if (sent === true) close();
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
  updateControls();
  return { open, close };
}
