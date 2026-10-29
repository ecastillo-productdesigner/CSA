import { revisionHistory, renderRevisionHistory } from './last-revision-note.js?v=20261029-revision-change-summary';
import { createIcon } from './icons.js?v=20261026-drafting-card-size';

export function createRevisionButton(output, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'output-badge output-badge--sources revision-request-trigger';
  button.dataset.requestRevision = output.id;
  button.disabled = disabled;
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'revision-request-dialog');
  button.setAttribute('aria-expanded', 'false');
  const dot = document.createElement('span');
  dot.className = 'revision-request-dot';
  dot.setAttribute('aria-hidden', 'true');
  button.append(createIcon('edit_document'), document.createTextNode('Request Revision'), dot);
  return updateRevisionButton(button, output, disabled);
}

export function updateRevisionButton(button, output, disabled = button.disabled) {
  button.disabled = disabled;
  const unread = Boolean((output.revisionRequestUnread ?? output.revisionUnread) && !disabled);
  button.querySelector('.revision-request-dot').hidden = !unread;
  if (unread) button.setAttribute('aria-description', 'Revision complete, unread');
  else button.removeAttribute('aria-description');
  return button;
}

export function createRevisionRequests({ onSubmit, closePanels, onRevisionRead = () => {} }) {
  const dialog = document.querySelector('#revision-request-dialog');
  const form = document.querySelector('#revision-request-form');
  const instructions = document.querySelector('#revision-request-instructions');
  const submit = document.querySelector('#revision-request-submit');
  const error = document.querySelector('#revision-request-error');
  const historyToggle = document.querySelector('#revision-request-history-toggle');
  const historyPanel = document.querySelector('#revision-request-history-panel');
  const historyLabel = document.querySelector('#revision-request-history-label');
  const historyList = document.querySelector('#revision-request-history-list');
  function setHistoryOpen(open) {
    historyPanel.hidden = !open;
    historyToggle.setAttribute('aria-expanded', String(open));
  }
  historyToggle.addEventListener('click', () => { if (!historyToggle.hidden) setHistoryOpen(historyPanel.hidden); });
  let target = null;
  const trigger = () => target && [...document.querySelectorAll('[data-request-revision]')].find(button => button.dataset.requestRevision === target.outputId);

  function refresh() {
    submit.disabled = !onSubmit || !target || !instructions.value.trim() || instructions.value.length > instructions.maxLength;
    if (instructions.value.trim()) error.hidden = true;
  }
  instructions.addEventListener('input', refresh);
  form.addEventListener('submit', event => {
    event.preventDefault();
    refresh();
    if (!target || submit.disabled || !onSubmit) return;
    const saved = onSubmit({ ...target, instructions: instructions.value.trim() });
    if (saved) dialog.close();
    else {
      error.textContent = 'Could not save your revision request. Please try again.';
      error.hidden = false;
    }
  });
  dialog.addEventListener('close', () => {
    const button = trigger();
    button?.setAttribute('aria-expanded', 'false');
    target = null;
    setHistoryOpen(false);
    historyToggle.hidden = true;
    historyList.replaceChildren();
    form.reset();
    refresh();
    if (button && !button.disabled) button.focus({ preventScroll: true });
    else (document.querySelector('#editor-variant-tabs [aria-selected="true"]') || document.querySelector('.output-status-tabs [aria-selected="true"]'))?.focus({ preventScroll: true });
  });

  return {
    open(project, output) {
      closePanels();
      target = { projectId: project.id, outputId: output.id };
      setHistoryOpen(false);
      const notes = revisionHistory(output);
      renderRevisionHistory(historyList, notes);
      historyToggle.hidden = !notes.length;
      historyLabel.textContent = notes.length > 1 ? `Revision History (${notes.length})` : 'Revision History';
      form.reset();
      error.hidden = true;
      refresh();
      const button = trigger();
      button?.setAttribute('aria-expanded', 'true');
      dialog.showModal();
      if (output.revisionRequestUnread || output.revisionUnread) {
        output.revisionRequestUnread = false;
        output.revisionUnread = false;
        if (button) updateRevisionButton(button, output);
        onRevisionRead(project, output);
      }
      instructions.focus();
    },
  };
}
