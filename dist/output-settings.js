import { tokenNumber } from './design-system/runtime.js?v=20261022-linked-stories-motion';
import { normalizeWordCount } from './variant-word-count.js?v=20261022-linked-stories-motion';
import { presetConfiguration, savedPresetName } from './preset-settings.js?v=20261022-linked-stories-motion';
import { customVariantName, savedVariantName } from './outputs.js?v=20261022-linked-stories-motion';

export function createOutputSettings({ onSave, onDelete, onSavePreset, onDeletePreset, closeDropdowns }) {
  const menu = document.querySelector('#output-edit-menu');
  const form = document.querySelector('#output-edit-form');
  const name = document.querySelector('#output-edit-name');
  const submit = form.querySelector('[type="submit"]');
  let initialSettings = {};
  const voice = document.querySelector('#output-edit-voice');
  const direction = document.querySelector('#output-edit-direction');
  const wordCount = document.querySelector('#output-edit-target-word-count');
  const error = document.querySelector('#output-edit-error');
  let active = null;
  let triggerContainer = null;

  function trigger() {
    if (active?.preset) return document.querySelector('#output-presets-trigger');
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
    const left = Math.max(tokenNumber('foundation.space.12'), Math.min(anchor.right - bounds.width, width - bounds.width - tokenNumber('foundation.space.12')));
    const below = anchor.bottom + tokenNumber('foundation.space.8');
    const preferredTop = below + bounds.height <= height - tokenNumber('foundation.space.12') ? below : anchor.top - bounds.height - tokenNumber('foundation.space.8');
    const top = Math.max(tokenNumber('foundation.space.12'), Math.min(preferredTop, height - bounds.height - tokenNumber('foundation.space.12')));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    button.setAttribute('aria-expanded', 'true');
  }

  function open(projectId, output, container = document.querySelector('#output-list'), preset = false) {
    if (active?.projectId === projectId && active.outputId === output.id && triggerContainer === container && active.preset === preset) { close(true); return; }
    close();
    active = { projectId, outputId: output.id, preset };
    triggerContainer = container;
    const config = preset ? presetConfiguration(output) : output;
    name.value = preset ? output.presetSettings?.name ?? customVariantName(output) : customVariantName(output);
    name.placeholder = preset ? savedPresetName(output) : output.savedVariantNumber ? savedVariantName(output) : 'Name this saved variant';
    document.querySelector('#output-delete-variant').setAttribute('aria-label', preset ? 'Delete saved preset' : 'Delete variant');
    document.querySelector('#output-delete-variant').title = preset ? 'Delete saved preset' : 'Delete variant';
    voice.value = config.toolPreferences?.voice || '';
    voice.dispatchEvent(new Event('change', { bubbles: true }));
    direction.value = typeof config.editorialDirection === 'string' ? config.editorialDirection : '';
    wordCount.closest('.variant-word-count').hidden = !config.toolPreferences?.audience;
    wordCount.value = normalizeWordCount(config.targetWordCount);
    wordCount.dispatchEvent(new Event('change', { bubbles: true }));
    initialSettings = { name: name.value.trim(), voice: voice.value, editorialDirection: direction.value, targetWordCount: wordCount.value };
    updateSaveState();
    error.hidden = true;
    menu.hidden = false;
    position();
    document.querySelector('#output-edit-voice-trigger').focus({ preventScroll: true });
  }

  function updateSaveState() {
    const settingsChanged = voice.value !== initialSettings.voice || direction.value !== initialSettings.editorialDirection || wordCount.value !== initialSettings.targetWordCount;
    const nameChanged = name.value.trim() !== initialSettings.name;
    submit.textContent = settingsChanged && !active?.preset ? 'Recreate Variant' : 'Save Changes';
    submit.disabled = !active || !(settingsChanged || nameChanged);
  }
  name.addEventListener('input', updateSaveState);
  voice.addEventListener('change', updateSaveState);
  direction.addEventListener('input', updateSaveState);
  wordCount.addEventListener('change', updateSaveState);

  form.addEventListener('submit', event => {
    event.preventDefault();
    updateSaveState();
    if (!active || submit.disabled) return;
    const variantName = name.value.trim();
    const saved = (active.preset ? onSavePreset : onSave)({ ...active, name: variantName, voice: voice.value, editorialDirection: direction.value, targetWordCount: wordCount.value });
    if (saved) close(true);
    else { error.textContent = 'Changes could not be saved. Please try again.'; error.hidden = false; position(); }
  });
  document.querySelector('#output-delete-variant').addEventListener('click', () => {
    if (!active) return;
    const deleted = (active.preset ? onDeletePreset : onDelete)({ ...active });
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
    openPreset(projectId, output) { open(projectId, output, document.querySelector('#output-presets'), true); },
    close,
    sync(project) {
      if (!active) return;
      if (active.preset) { position(); return; }
      const output = project?.outputs?.find(entry => entry.id === active.outputId);
      if (project?.id !== active.projectId || !output || project.outputProcessing || !trigger()) close();
      else position();
    },
  };
}
