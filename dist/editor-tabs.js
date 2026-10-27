import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { projectOutputs, outputIsReady, outputIsSent, outputLoadingSelectionKeys } from './outputs.js?v=20261026-drafting-card-size';

import { createRevisionAnimation } from './drafting-animation.js?v=20261027-revision-tabs';

export function createEditorTabs({ onSelect, createAnimation = createRevisionAnimation }) {
  const root = document.querySelector('#editor-variant-tabs');
  const panel = document.querySelector('#editor-canvas-content');
  let signature = '';
  const animations = new Set();
  function clearAnimations() {
    for (const animation of animations) animation.destroy();
    animations.clear();
  }

  function revealSelected() {
    const tab = root.querySelector('[aria-selected="true"]');
    if (!tab || root.hidden) return;
    const row = root.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    if (item.left < row.left + 8) root.scrollLeft += item.left - row.left - 8;
    else if (item.right > row.right - 8) root.scrollLeft += item.right - row.right + 8;
  }
  const resizeObserver = new ResizeObserver(revealSelected);
  resizeObserver.observe(root);

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
      const revisingIds = project?.outputProcessing?.kind === 'revision' ? project.outputProcessing.ids || [] : [];
      const nextSignature = JSON.stringify([project?.id, activeId, showCreateTab, revisingIds, outputs.map(output => [output.id, output.title, output.cmsSentAt, output.revisionUnread, revisingIds.includes(output.id) ? outputLoadingSelectionKeys(output) : null])]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      clearAnimations();
      const hasTabs = showCreateTab || Boolean(outputs.length);
      root.hidden = !hasTabs;
      panel.classList.toggle('has-variant-tabs', hasTabs);
      if (!hasTabs) {
        root.replaceChildren();
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        return;
      }
      const entries = [...(showCreateTab ? [{ id: null, title: 'Content to Draft', preview: true }] : []), ...outputs];
      root.replaceChildren(...entries.map(output => {
        const { id, cmsSentAt, preview } = output;
        const title = output.title;
        const sent = outputIsSent({ cmsSentAt });
        const status = preview ? 'To Draft' : sent ? 'Sent' : 'Draft';
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
        tab.setAttribute('aria-description', preview ? 'Content to draft' : status);
        if (!preview) {
          const label = document.createElement('span');
          label.className = 'editor-tab-title';
          const titleText = document.createElement('span');
          titleText.className = 'editor-tab-title-text';
          titleText.textContent = title;
          if (output.revisionUnread) {
            const dot = document.createElement('span');
            dot.className = 'editor-tab-revision-dot';
            dot.setAttribute('aria-hidden', 'true');
            label.append(dot);
            tab.setAttribute('aria-description', `${status} · Revision complete, unread`);
          }
          label.append(titleText);
          tab.append(label);
        }
        tab.title = preview ? title : `${title} · ${status}${output.revisionUnread ? " · Revision complete" : ""}`;
        if (!preview && id !== activeId && revisingIds.includes(id)) {
          tab.dataset.revising = 'true';
          tab.setAttribute('aria-description', 'Revising Draft');
          tab.title = `${title} · Revising Draft`;
          const animation = createAnimation({ selectionKeys: outputLoadingSelectionKeys(output) });
          animation.element.setAttribute('aria-hidden', 'true');
          animations.add(animation);
          tab.append(animation.element);
        }
        return tab;
      }));
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `editor-tab-${activeId || 'original'}`);
      requestAnimationFrame(revealSelected);
    },
    destroy() { clearAnimations(); resizeObserver.disconnect(); },
  };
}
