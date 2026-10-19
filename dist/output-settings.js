import { outputName } from './outputs.js?v=20261019-independent-variant-names';

export function createOutputSettings({ onSave, onDelete, closeDropdowns }) {
  const menu = document.querySelector('#output-edit-menu');
  const form = document.querySelector('#output-edit-form');
  const name = document.querySelector('#output-edit-name');
  const submit = form.querySelector('[type="submit"]');
  let initialSettings = {};
  const voice = document.querySelector('#output-edit-voice');
  const direction = document.querySelector('#output-edit-direction');
  const error = document.querySelector('#output-edit-error');
  let active = null;
  let triggerContainer = null;

  function trigger() {
    return active && triggerContainer && [...triggerContainer.querySelectorAll('[data-edit-output]')].find(button => button.dataset.editOutput === active.outputId);
  }

  function close(restoreFocus = false) {
    closeDropdowns();
    const button = trigger();
    button?.setAttribute('aria-expanded', 'false');
    active = null;
    triggerContainer = null;
    menu.hidden = true;
    if (restoreFocus && button?.isConnected) button.focus({ preventScroll: true });
  }

  function position() {
    const button = trigger();
    if (!button || menu.hidden) return;
    const anchor = button.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const left = Math.max(12, Math.min(anchor.right - bounds.width, width - bounds.width - 12));
    const below = anchor.bottom + 8;
    const preferredTop = below + bounds.height <= height - 12 ? below : anchor.top - bounds.height - 8;
    const top = Math.max(12, Math.min(preferredTop, height - bounds.height - 12));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    button.setAttribute('aria-expanded', 'true');
  }

  function open(projectId, output, container = document.querySelector('#output-list')) {
    if (active?.projectId === projectId && active.outputId === output.id && triggerContainer === container) { close(true); return; }
    close();
    active = { projectId, outputId: output.id };
    triggerContainer = container;
    name.value = outputName(output);
    voice.value = output.toolPreferences?.voice || '';
    voice.dispatchEvent(new Event('change', { bubbles: true }));
    direction.value = typeof output.editorialDirection === 'string' ? output.editorialDirection : '';
    initialSettings = { voice: voice.value, editorialDirection: direction.value };
    updateSaveLabel();
    error.hidden = true;
    menu.hidden = false;
    position();
    document.querySelector('#output-edit-voice-trigger').focus({ preventScroll: true });
  }

  function updateSaveLabel() {
    submit.textContent = voice.value !== initialSettings.voice || direction.value !== initialSettings.editorialDirection ? 'Recreate variant' : 'Save changes';
  }
  voice.addEventListener('change', updateSaveLabel);
  direction.addEventListener('input', updateSaveLabel);

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!active) return;
    const variantName = name.value.trim();
    if (!variantName) { error.textContent = 'Enter a variant name.'; error.hidden = false; name.focus(); return; }
    const saved = onSave({ ...active, name: variantName, voice: voice.value, editorialDirection: direction.value });
    if (saved) close(true);
    else { error.textContent = 'Changes could not be saved. Please try again.'; error.hidden = false; position(); }
  });
  document.querySelector('#output-delete-variant').addEventListener('click', () => {
    if (!active) return;
    const deleted = onDelete({ ...active });
    if (deleted) close();
    else if (active) { error.textContent = 'Could not delete this variant. Please try again.'; error.hidden = false; position(); }
  });
  for (const button of menu.querySelectorAll('[data-close-output-edit]')) button.addEventListener('click', () => close(true));
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
  });
  menu.addEventListener('focusout', event => {
    if (active && event.relatedTarget && !menu.contains(event.relatedTarget) && event.relatedTarget !== trigger()) close();
  });
  document.addEventListener('pointerdown', event => {
    if (active && !menu.contains(event.target) && !event.target.closest('[data-edit-output]')) close();
  });
  document.addEventListener('scroll', event => {
    if (active && !menu.contains(event.target)) position();
  }, true);
  window.addEventListener('resize', position);

  return {
    open,
    close,
    sync(project) {
      if (!active) return;
      const output = project?.outputs?.find(entry => entry.id === active.outputId);
      if (project?.id !== active.projectId || !output || project.outputProcessing || !trigger()) close();
      else position();
    },
  };
}
