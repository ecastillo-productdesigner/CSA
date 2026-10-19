import { projectOutputs, createOutputBadges } from './outputs.js?v=20261018-variant-controls';

export function createOutputPresets({ onSelect }) {
  const root = document.querySelector('#output-presets');
  const trigger = document.querySelector('#output-presets-trigger');
  const menu = document.querySelector('#output-presets-options');
  let lastSignature = '';

  function settingsFor(output) {
    return ['format', 'audience', 'voice'].flatMap(key => {
      const saved = (Array.isArray(output?.labels) ? output.labels : []).find(label => label?.key === key && typeof label.label === 'string' && label.label.trim());
      const value = output?.toolPreferences?.[key];
      const option = [...document.querySelector(`#composer-${key}`).options].find(entry => entry.value && entry.value === value);
      const label = saved?.label || option?.textContent;
      return label ? [{ key, label }] : [];
    });
  }
  function summaryFor(output, settings) {
    return settings.map(setting => setting.label).join(' · ') || (output?.editorialDirection?.trim() ? 'Editorial direction' : 'Saved variant settings');
  }

  function close(restoreFocus = false) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !root.hidden) trigger.focus({ preventScroll: true });
  }
  function open() {
    if (root.hidden) return;
    menu.hidden = false;
    const bounds = root.getBoundingClientRect();
    const below = document.documentElement.clientHeight - bounds.bottom - 16;
    const above = bounds.top - 16;
    const opensUp = below < 160 && above > below;
    menu.style.top = opensUp ? 'auto' : 'calc(100% + 8px)';
    menu.style.bottom = opensUp ? 'calc(100% + 8px)' : 'auto';
    menu.style.maxHeight = `${Math.max(80, Math.min(320, opensUp ? above : below))}px`;
    trigger.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-selected="true"]') || menu.querySelector('button'))?.focus();
  }
  trigger.addEventListener('click', () => { if (menu.hidden) open(); else close(true); });
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    const items = [...menu.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (next !== null) { event.preventDefault(); items[next]?.focus(); }
  });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });

  return {
    close,
    render(projects, selection = null) {
      const entries = projects.filter(project => !project.archivedAt && !project.deletedAt)
        .flatMap(project => projectOutputs(project).filter(output => output.isFavorite).map(output => ({ project, output, settings: settingsFor(output) })))
        .sort((a, b) => (b.output.favoritedAt || 0) - (a.output.favoritedAt || 0));
      const selectedOutput = selection && projectOutputs(projects.find(project => project.id === selection.projectId)).find(output => output.id === selection.outputId);
      const selectedSettings = settingsFor(selectedOutput);
      const signature = JSON.stringify([selection?.projectId, selection?.outputId, selectedSettings, entries.map(({ project, output, settings }) => [project.id, output.id, settings, Boolean(output.editorialDirection?.trim())])]);
      root.hidden = entries.length === 0 && !selection;
      if (signature === lastSignature) return;
      lastSignature = signature;
      close();
      const triggerLabel = selection ? `Preset: ${summaryFor(selectedOutput, selectedSettings)}` : 'Presets';
      trigger.querySelector('span').textContent = triggerLabel;
      trigger.title = triggerLabel;
      trigger.setAttribute('aria-label', triggerLabel);
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'output-preset-option';
      clear.setAttribute('role', 'option');
      clear.setAttribute('aria-selected', String(!selection));
      clear.tabIndex = -1;
      clear.textContent = 'None Selected';
      clear.addEventListener('click', () => { close(); onSelect(null, null); });
      menu.replaceChildren(clear, ...entries.flatMap(({ project, output, settings }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'output-preset-option';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(project.id === selection?.projectId && output.id === selection?.outputId));
        button.tabIndex = -1;
        button.setAttribute('aria-label', settings.map(setting => `${setting.key[0].toUpperCase() + setting.key.slice(1)}: ${setting.label}`).join(', ') || summaryFor(output, settings));
        const choices = document.createElement('span');
        choices.className = 'output-preset-settings';
        if (settings.length) choices.append(...createOutputBadges({ labels: settings }, { maxLabelLength: 20 }));
        else choices.textContent = summaryFor(output, settings);
        button.append(choices);
        if (output.editorialDirection?.trim() && settings.length) {
          const detail = document.createElement('small');
          detail.textContent = 'Editorial direction included';
          button.append(detail);
        }
        button.addEventListener('click', () => { close(); onSelect(project.id, output.id); });
        const divider = document.createElement('hr');
        divider.className = 'output-preset-divider';
        divider.setAttribute('aria-hidden', 'true');
        return [divider, button];
      }));
    },
  };
}
