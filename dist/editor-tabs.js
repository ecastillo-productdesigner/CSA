import { createIcon } from './icons.js?v=20261021-editor-subhead';
import { projectOutputs, outputIsReady, outputIsSent } from './outputs.js?v=20261021-editor-subhead';

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
      const showCreateTab = !outputs.length && Boolean(project?.linkCards || project?.viewOriginalDraft || project?.awaitingOutput || allOutputs.some(output => output.id === project?.lastPendingOutputId && !outputIsReady(output)));
      const activeId = showCreateTab && project?.viewOriginalDraft ? null : outputs.some(output => output.id === project?.selectedOutputId) ? project.selectedOutputId : outputs[0]?.id ?? null;
      const nextSignature = JSON.stringify([project?.id, activeId, showCreateTab, outputs.map(output => [output.id, output.title, output.cmsSentAt])]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      const hasTabs = showCreateTab || Boolean(outputs.length);
      root.hidden = !hasTabs;
      panel.classList.toggle('has-variant-tabs', hasTabs);
      if (!hasTabs) {
        root.replaceChildren();
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        return;
      }
      const entries = [...(showCreateTab ? [{ id: null, title: 'Content to Create', preview: true }] : []), ...outputs];
      root.replaceChildren(...entries.map(output => {
        const { id, cmsSentAt, preview } = output;
        const title = output.title;
        const sent = outputIsSent({ cmsSentAt });
        const status = preview ? 'To Create' : sent ? 'Sent' : 'Draft';
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `editor-tab-${id || 'original'}`;
        tab.dataset.editorOutput = id || '';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', String(id === activeId));
        tab.tabIndex = id === activeId ? 0 : -1;
        tab.setAttribute('aria-label', title);
        const badge = document.createElement('span');
        badge.className = 'editor-tab-draft';
        badge.setAttribute('aria-hidden', 'true');
        badge.append(createIcon(preview ? 'article' : sent ? 'send' : 'draw'));
        badge.append(document.createTextNode(status));
        badge.dataset.sent = String(sent);
        if (preview) badge.dataset.pending = 'true';
        tab.append(badge);
        tab.setAttribute('aria-description', preview ? 'Content to adapt' : status);
        if (!preview) {
          const label = document.createElement('span');
          label.className = 'editor-tab-title';
          label.textContent = title;
          tab.append(label);
        }
        tab.title = preview ? title : `${title} · ${status}`;
        return tab;
      }));
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `editor-tab-${activeId || 'original'}`);
      requestAnimationFrame(revealSelected);
    },
  };
}
