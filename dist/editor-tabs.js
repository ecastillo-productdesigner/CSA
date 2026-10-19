import { projectOutputs, outputIsReady, outputIsSent } from './outputs.js?v=20261017-disabled-sent';

export function createEditorTabs({ onSelect }) {
  const root = document.querySelector('#editor-variant-tabs');
  const panel = document.querySelector('#editor-canvas-content');
  let signature = '';

  function revealSelected() {
    const tab = root.querySelector('[aria-selected="true"]');
    if (!tab || root.hidden) return;
    const row = root.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    if (item.left < row.left + 8) root.scrollLeft += item.left - row.left - 8;
    else if (item.right > row.right - 8) root.scrollLeft += item.right - row.right + 8;
  }
  new ResizeObserver(revealSelected).observe(root);

  function select(tab) {
    if (tab.getAttribute('aria-selected') === 'true') return;
    onSelect(tab.dataset.editorOutput || null);
    const current = root.querySelector('[aria-selected="true"]');
    current?.focus({ preventScroll: true });
    revealSelected();
  }

  root.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[next]);
  });

  return {
    render(project) {
      const outputs = projectOutputs(project).filter(outputIsReady);
      const activeId = outputs.some(output => output.id === project?.selectedOutputId) ? project.selectedOutputId : outputs[0]?.id;
      const nextSignature = JSON.stringify([project?.id, activeId, outputs.map(({ id, title, cmsSentAt }) => [id, title, cmsSentAt])]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      root.hidden = !outputs.length;
      panel.classList.toggle('has-variant-tabs', Boolean(outputs.length));
      if (!outputs.length) {
        root.replaceChildren();
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        return;
      }
      const entries = outputs;
      root.replaceChildren(...entries.map(({ id, title, cmsSentAt }) => {
        const sent = outputIsSent({ cmsSentAt });
        const status = sent ? 'Sent' : 'Draft';
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `editor-tab-${id || 'original'}`;
        tab.dataset.editorOutput = id;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', String(id === activeId));
        tab.tabIndex = id === activeId ? 0 : -1;
        tab.setAttribute('aria-label', title);
        const badge = document.createElement('span');
        badge.className = 'editor-tab-draft';
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = status;
        badge.dataset.sent = String(sent);
        tab.setAttribute('aria-description', status);
        const label = document.createElement('span');
        label.className = 'editor-tab-title';
        label.textContent = title;
        tab.append(badge, label);
        tab.title = `${title} · ${status}`;
        return tab;
      }));
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `editor-tab-${activeId || 'original'}`);
      requestAnimationFrame(revealSelected);
    },
  };
}
