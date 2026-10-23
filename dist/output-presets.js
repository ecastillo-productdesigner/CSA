import { tokenNumber } from './design-system/runtime.js?v=20261022-linked-stories-motion';
import { projectOutputs, createOutputBadges } from './outputs.js?v=20261022-linked-stories-motion';

import { presetConfiguration, savedPresetName } from './preset-settings.js?v=20261022-linked-stories-motion';

export function createOutputPresets({ onSelect, onDelete, onEdit }) {
  const root = document.querySelector('#output-presets');
  const trigger = document.querySelector('#output-presets-trigger');
  const menu = document.querySelector('#output-presets-options');
  let lastSignature = '';
  let actionTarget = null;
  const actions = document.createElement('div');
  actions.id = 'output-preset-actions';
  actions.className = 'output-preset-actions';
  actions.setAttribute('role', 'menu');
  actions.setAttribute('aria-label', 'Saved variant actions');
  actions.hidden = true;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.setAttribute('role', 'menuitem');
  remove.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span><span>Delete</span>';
  const edit = document.createElement('button');
  edit.type = 'button'; edit.className = 'output-preset-edit'; edit.setAttribute('role', 'menuitem');
  edit.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">edit</span><span>Edit</span>';
  edit.addEventListener('click', () => { const target = actionTarget; close(); if (target) onEdit(target.projectId, target.outputId); });
  actions.append(edit, remove);
  root.append(actions);

  function closeActions(restoreFocus = false) {
    const button = actionTarget?.button;
    actionTarget = null;
    actions.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && button?.isConnected) button.focus({ preventScroll: true });
  }
  function openActions(projectId, outputId, button) {
    if (actionTarget?.button === button) { closeActions(true); return; }
    closeActions();
    actionTarget = { projectId, outputId, button };
    button.setAttribute('aria-expanded', 'true');
    actions.hidden = false;
    const anchor = button.getBoundingClientRect();
    const bounds = actions.getBoundingClientRect();
    actions.style.left = `${Math.max(tokenNumber('foundation.space.12'), Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - tokenNumber('foundation.space.12')))}px`;
    actions.style.top = `${Math.max(tokenNumber('foundation.space.12'), Math.min(anchor.bottom + tokenNumber('foundation.space.4'), window.innerHeight - bounds.height - tokenNumber('foundation.space.12')))}px`;
    edit.focus({ preventScroll: true });
  }
  remove.addEventListener('click', () => {
    const target = actionTarget;
    close();
    if (target) onDelete(target.projectId, target.outputId);
  });
  actions.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeActions(true); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const items = [edit, remove]; const index = items.indexOf(document.activeElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (index + 1) % items.length; items[next].focus(); }
    else if (event.key === 'Tab') close(true);
  });
  menu.addEventListener('scroll', () => closeActions(), { passive: true });
  window.addEventListener('resize', () => closeActions());

  function settingsFor(output) {
    output = presetConfiguration(output);
    return ['format', 'audience', 'voice'].flatMap(key => {
      const saved = (Array.isArray(output?.labels) ? output.labels : []).find(label => label?.key === key && typeof label.label === 'string' && label.label.trim());
      const value = output?.toolPreferences?.[key];
      const option = [...document.querySelector(`#composer-${key}`).options].find(entry => entry.value && entry.value === value);
      const label = saved?.label || option?.textContent;
      return label ? [{ key, label }] : [];
    });
  }
  function summaryFor(output, settings) {
    return settings.map(setting => setting.label).join(' · ') || (presetConfiguration(output).editorialDirection.trim() ? 'Editorial direction' : 'Saved variant settings');
  }

  function close(restoreFocus = false) {
    closeActions();
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !root.hidden) trigger.focus({ preventScroll: true });
  }
  function open() {
    if (root.hidden) return;
    menu.hidden = false;
    const bounds = root.getBoundingClientRect();
    const below = document.documentElement.clientHeight - bounds.bottom - tokenNumber('foundation.space.16');
    const above = bounds.top - tokenNumber('foundation.space.16');
    const opensUp = below < tokenNumber('foundation.size.160') && above > below;
    menu.style.top = opensUp ? 'auto' : 'calc(100% + var(--csa-foundation-space-8))';
    menu.style.bottom = opensUp ? 'calc(100% + var(--csa-foundation-space-8))' : 'auto';
    menu.style.maxHeight = `${Math.max(tokenNumber('foundation.size.80'), Math.min(tokenNumber('foundation.size.320'), opensUp ? above : below))}px`;
    trigger.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-checked="true"]') || menu.querySelector('button'))?.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', () => { if (menu.hidden) open(); else close(true); });
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    closeActions();
    const items = [...menu.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (next !== null) { event.preventDefault(); items[next]?.focus(); }
  });
  for (const eventName of ['pointerdown', 'focusin']) {
    document.addEventListener(eventName, event => { if (!root.contains(event.target)) close(); });
  }

  return {
    close,
    render(projects, selection = null) {
      const entries = projects.filter(project => !project.archivedAt && !project.deletedAt)
        .flatMap(project => projectOutputs(project).filter(output => output.isFavorite).map(output => ({ project, output, settings: settingsFor(output) })))
        .sort((a, b) => (b.output.favoritedAt || 0) - (a.output.favoritedAt || 0));
      const selectedOutput = selection && projectOutputs(projects.find(project => project.id === selection.projectId)).find(output => output.id === selection.outputId);
      const selectedSettings = settingsFor(selectedOutput);
      const signature = JSON.stringify([selection?.projectId, selection?.outputId, selectedOutput && savedPresetName(selectedOutput), selectedSettings, entries.map(({ project, output, settings }) => [project.id, output.id, savedPresetName(output), settings, Boolean(presetConfiguration(output).editorialDirection.trim())])]);
      root.hidden = entries.length === 0 && !selection;
      if (signature === lastSignature) return;
      lastSignature = signature;
      close();
      const triggerLabel = selectedOutput ? savedPresetName(selectedOutput) : 'My Saved Variants';
      trigger.querySelector('span').textContent = triggerLabel;
      trigger.title = triggerLabel;
      trigger.setAttribute('aria-label', triggerLabel);
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'output-preset-option';
      clear.setAttribute('role', 'menuitemradio');
      clear.setAttribute('aria-checked', String(!selection));
      clear.tabIndex = -1;
      clear.textContent = 'None Selected';
      clear.addEventListener('click', () => { close(); onSelect(null, null); });
      menu.replaceChildren(clear, ...entries.flatMap(({ project, output, settings }) => {
        const row = document.createElement('div');
        row.className = 'output-preset-row';
        row.setAttribute('role', 'none');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'output-preset-option';
        button.setAttribute('role', 'menuitemradio');
        button.setAttribute('aria-checked', String(project.id === selection?.projectId && output.id === selection?.outputId));
        button.tabIndex = -1;
        button.setAttribute('aria-label', [savedPresetName(output), ...settings.map(setting => `${setting.key[0].toUpperCase() + setting.key.slice(1)}: ${setting.label}`)].join(', '));
        const choices = document.createElement('span');
        choices.className = 'output-preset-settings';
        if (settings.length) choices.append(...createOutputBadges({ labels: settings }, { maxLabelLength: 20, includeSourceCount: false }));
        else choices.textContent = summaryFor(output, settings);
        const name = document.createElement('strong');
        name.className = 'output-preset-name';
        name.textContent = savedPresetName(output);
        button.append(name, choices);
        if (presetConfiguration(output).editorialDirection.trim() && settings.length) {
          const detail = document.createElement('small');
          detail.textContent = 'Editorial direction included';
          button.append(detail);
        }
        button.addEventListener('click', () => { close(); onSelect(project.id, output.id); });
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'icon-button output-preset-more';
        more.tabIndex = -1;
        more.setAttribute('role', 'menuitem');
        more.setAttribute('aria-label', `Saved variant options: ${savedPresetName(output)}`);
        more.setAttribute('aria-haspopup', 'menu');
        more.setAttribute('aria-expanded', 'false');
        more.setAttribute('aria-controls', actions.id);
        more.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>';
        more.addEventListener('click', () => openActions(project.id, output.id, more));
        more.addEventListener('keydown', event => {
          if (['ArrowRight', 'Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); openActions(project.id, output.id, more); }
        });
        row.append(button, more);
        const divider = document.createElement('hr');
        divider.className = 'output-preset-divider';
        divider.setAttribute('aria-hidden', 'true');
        return [divider, row];
      }));
    },
  };
}
