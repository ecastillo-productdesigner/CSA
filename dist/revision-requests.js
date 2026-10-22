import { createIcon } from './icons.js?v=20261021-segment-case';

export function createRevisionButton(output, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'output-badge output-badge--sources revision-request-trigger';
  button.dataset.requestRevision = output.id;
  button.disabled = disabled;
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'revision-request-dialog');
  button.setAttribute('aria-expanded', 'false');
  button.append(createIcon('edit_note'), document.createTextNode('Request Revision'));
  return button;
}

export function createRevisionRequests({ onSubmit, closePanels }) {
  const dialog = document.querySelector('#revision-request-dialog');
  const form = document.querySelector('#revision-request-form');
  const instructions = document.querySelector('#revision-request-instructions');
  const submit = document.querySelector('#revision-request-submit');
  const error = document.querySelector('#revision-request-error');
  let target = null;
  const trigger = () => target && [...document.querySelectorAll('[data-request-revision]')].find(button => button.dataset.requestRevision === target.outputId);

  function refresh() {
    submit.disabled = !onSubmit || !target || !instructions.value.trim();
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
    form.reset();
    refresh();
    if (button && !button.disabled) button.focus({ preventScroll: true });
    else document.querySelector('.output-status-tabs [aria-selected="true"]')?.focus({ preventScroll: true });
  });

  return {
    open(project, output) {
      closePanels();
      target = { projectId: project.id, outputId: output.id };
      form.reset();
      error.hidden = true;
      const title = document.querySelector('#revision-request-title');
      title.textContent = output.title;
      title.title = output.title;
      refresh();
      trigger()?.setAttribute('aria-expanded', 'true');
      dialog.showModal();
      instructions.focus();
    },
  };
}
