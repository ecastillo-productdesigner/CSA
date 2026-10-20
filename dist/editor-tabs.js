import { projectOutputs, outputIsReady, outputIsSent } from './outputs.js?v=20261020-empty-create-label';

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
      const allOutputs = projectOutputs(project);
      const outputs = allOutputs.filter(output => outputIsReady(output) || output.needsRegeneration);
      const showCreateTab = Boolean(project?.viewOriginalDraft || allOutputs.some(output => output.id === project?.lastPendingOutputId && !outputIsReady(output)));
      const activeId = project?.viewOriginalDraft ? null : outputs.some(output => output.id === project?.selectedOutputId) ? project.selectedOutputId : outputs[0]?.id;
      const nextSignature = JSON.stringify([project?.id, activeId, showCreateTab, outputs.map(output => [output.id, output.title, output.cmsSentAt])]);
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
      const entries = [...(showCreateTab ? [{ id: null, title: 'Create Variant', preview: true }] : []), ...outputs];
      root.replaceChildren(...entries.map(output => {
        const { id, cmsSentAt, preview } = output;
        const title = output.title;
        const sent = outputIsSent({ cmsSentAt });
        const status = sent ? 'Sent' : 'Draft';
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `editor-tab-${id || 'original'}`;
        tab.dataset.editorOutput = id || '';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', String(id === activeId));
        tab.tabIndex = id === activeId ? 0 : -1;
        tab.setAttribute('aria-label', title);
        if (!preview) {
          const badge = document.createElement('span');
          badge.className = 'editor-tab-draft';
          badge.setAttribute('aria-hidden', 'true');
          if (sent) {
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#icon-sent');
            icon.append(use);
            badge.append(icon);
          } else {
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.textContent = 'draw';
            badge.append(icon);
          }
          badge.append(document.createTextNode(status));
          badge.dataset.sent = String(sent);
          tab.append(badge);
        }
        tab.setAttribute('aria-description', preview ? 'Content preview for creating variants' : status);
        const label = document.createElement('span');
        label.className = 'editor-tab-title';
        label.textContent = title;
        tab.append(label);
        tab.title = preview ? title : `${title} · ${status}`;
        return tab;
      }));
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `editor-tab-${activeId || 'original'}`);
      requestAnimationFrame(revealSelected);
    },
  };
}
