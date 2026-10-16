import { projectOutputs, outputIsReady } from './outputs.js?v=20261016-drawers-metadata';

export function createOutputPresets({ onSelect }) {
  const root = document.querySelector('#output-presets');
  const trigger = document.querySelector('#output-presets-trigger');
  const menu = document.querySelector('#output-presets-options');
  let lastSignature = '';

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
    render(projects, activeProjectId) {
      const entries = projects.filter(project => !project.archivedAt && !project.deletedAt)
        .flatMap(project => projectOutputs(project).filter(output => output.isFavorite).map(output => ({ project, output })))
        .sort((a, b) => (b.output.favoritedAt || 0) - (a.output.favoritedAt || 0));
      const signature = JSON.stringify(entries.map(({ project, output }) => [project.id, project.title, output.id, output.title, outputIsReady(output), project.id === activeProjectId && project.selectedOutputId === output.id]));
      root.hidden = entries.length === 0;
      if (signature === lastSignature) return;
      lastSignature = signature;
      close();
      menu.replaceChildren(...entries.map(({ project, output }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'output-preset-option';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(project.id === activeProjectId && project.selectedOutputId === output.id));
        button.tabIndex = -1;
        const heading = document.createElement('strong');
        heading.textContent = output.title;
        const detail = document.createElement('small');
        detail.textContent = `${project.title}${outputIsReady(output) ? '' : ' · Pending output'}`;
        button.append(heading, detail);
        button.addEventListener('click', () => { close(); onSelect(project.id, output.id); });
        return button;
      }));
    },
  };
}
