import { tokenNumber } from './design-system/runtime.js?v=20261026-us-weekly-case';
import { createIcon } from './icons.js?v=20261026-us-weekly-case';
import { draftSourcesFor } from './source-model.js?v=20261026-us-weekly-case';
export { draftSourcesFor };

let nextPopoverId = 0;
export function createDraftSourcesPopover({ onDownloadSource = () => {}, onOpenSource = () => {} } = {}) {
  const popover = document.createElement('section');
  popover.id = `draft-sources-popover-${++nextPopoverId}`;
  popover.className = 'draft-sources-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.setAttribute('aria-labelledby', `${popover.id}-title`);
  popover.tabIndex = -1;
  popover.hidden = true;
  const heading = document.createElement('div');
  heading.className = 'draft-sources-heading';
  const title = document.createElement('h2');
  title.id = `${popover.id}-title`;
  title.className = 'draft-sources-title';
  title.textContent = 'Sources Used';
  const folder = createIcon('folder_open', 'draft-sources-folder');
  folder.setAttribute('data-icon-fill', '0');
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'icon-button draft-sources-close';
  dismiss.setAttribute('aria-label', 'Close sources');
  dismiss.append(createIcon('close'));
  heading.append(folder, title, dismiss);
  const list = document.createElement('ul');
  list.className = 'draft-sources-list';
  list.setAttribute('aria-label', 'Sources used for this draft');
  const empty = document.createElement('p');
  empty.className = 'draft-sources-empty';
  popover.append(heading, list, empty);
  document.body.append(popover);
  let active = null;
  let destroyed = false;

  function close(restoreFocus = false) {
    const trigger = active?.trigger;
    active = null;
    popover.hidden = true;
    observer?.disconnect();
    trigger?.setAttribute('aria-expanded', 'false');
    if (trigger?.getAttribute('aria-controls') === popover.id) trigger.removeAttribute('aria-controls');
    if (restoreFocus && trigger?.isConnected && !trigger.disabled
      && !trigger.closest('[hidden], [inert], [aria-hidden="true"]')
      && (!trigger.getClientRects || trigger.getClientRects().length)) {
      trigger.focus({ preventScroll: true });
    }
  }

  function openerAvailable() {
    const trigger = active?.trigger;
    return Boolean(trigger && trigger.isConnected && popover.isConnected && !trigger.disabled
      && !trigger.closest('[hidden], [inert], [aria-hidden="true"]')
      && (!trigger.getClientRects || trigger.getClientRects().length)
      && trigger.dataset.variantSources === active.sourceKey);
  }

  function checkContext() { if (active && !openerAvailable()) close(); }
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(checkContext) : null;

  function render(project, output) {
    const sources = draftSourcesFor(project, output);
    title.textContent = sources.length === 1 ? 'Source Used' : 'Sources Used';
    list.replaceChildren();
    list.hidden = !sources.length;
    empty.hidden = Boolean(sources.length);
    const savedCount = Number.isInteger(output.sourceCount) && output.sourceCount > 0
      || Array.isArray(output.selectedSourceIndexes) && output.selectedSourceIndexes.some(index => Number.isInteger(index) && index >= 0);
    const explicitEmpty = Array.isArray(output.sourceSnapshots) && output.sourceSnapshots.length === 0;
    empty.textContent = !explicitEmpty && savedCount ? 'Source details were not saved for this draft.' : 'No sources were saved for this draft.';
    for (const source of sources) {
      const row = document.createElement('li');
      row.className = 'draft-sources-item';
      const kind = source.type === 'file' || source.attachmentId ? 'Document source'
        : source.type === 'text' ? 'Text source' : source.type === 'link' ? 'Link source' : source.type === 'search' ? 'Search source' : 'Source';
      const sourceTitle = typeof source.title === 'string' && source.title.trim() ? source.title : kind;
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'draft-sources-source-title';
      label.textContent = sourceTitle;
      label.setAttribute('aria-haspopup', 'dialog');
      label.setAttribute('aria-controls', 'article-preview-dialog');
      label.addEventListener('click', () => {
        const opener = active?.trigger;
        if (!opener) return;
        close();
        onOpenSource(source, opener);
      });
      row.append(label);
      if (source.type === 'file' || source.attachmentId) {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'text-button draft-sources-download';
        download.textContent = 'Download Document';
        download.setAttribute('aria-label', `Download ${sourceTitle}`);
        download.addEventListener('click', () => onDownloadSource(source));
        row.append(download);
      }
      list.append(row);
    }
  }

  function position() {
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const width = Math.max(0, Math.min(tokenNumber('foundation.size.360'), viewportWidth - inset * 2));
    const maxHeight = tokenNumber('foundation.size.420');
    popover.style.width = `${width}px`;
    popover.style.maxHeight = `${maxHeight}px`;
    const bounds = active.trigger.getBoundingClientRect();
    const chipHeight = Math.min(bounds.height, tokenNumber('component.chip.height'));
    const chipTop = bounds.top + (bounds.height - chipHeight) / 2;
    const anchor = { left: bounds.left, top: chipTop, bottom: chipTop + chipHeight };
    const above = Math.max(0, anchor.top - inset - gap);
    const below = Math.max(0, viewportHeight - anchor.bottom - inset - gap);
    const desired = Math.min(popover.scrollHeight || maxHeight, maxHeight);
    const opensAbove = below < desired && above > below;
    popover.style.maxHeight = `${Math.min(maxHeight, opensAbove ? above : below)}px`;
    const height = popover.getBoundingClientRect().height;
    const top = opensAbove ? anchor.top - height - gap : anchor.bottom + gap;
    popover.style.left = `${Math.max(inset, Math.min(anchor.left, viewportWidth - width - inset))}px`;
    popover.style.top = `${Math.max(inset, Math.min(top, viewportHeight - height - inset))}px`;
  }

  function toggle(trigger, { project, output } = {}) {
    if (destroyed) return;
    if (active?.trigger === trigger && active.output === output && active.project === project) { close(true); return; }
    close();
    if (!trigger || !output) return;
    active = { trigger, project, output, sourceKey: trigger.dataset.variantSources };
    if (!openerAvailable()) { close(); return; }
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', popover.id);
    trigger.setAttribute('aria-expanded', 'true');
    render(project, output);
    popover.hidden = false;
    position();
    observer?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'disabled', 'class', 'style', 'data-variant-sources'] });
    popover.focus({ preventScroll: true });
  }

  function outside(event) {
    if (active && !popover.contains(event.target) && !active.trigger.contains(event.target)) close();
  }
  function focusout(event) {
    if (event.relatedTarget) outside({ target: event.relatedTarget });
  }
  function keydown(event) {
    if (!active || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }
  function scroll(event) { if (active && !popover.contains(event.target)) close(); }
  const dismissClick = () => close(true);
  const resize = () => close();
  dismiss.addEventListener('click', dismissClick);
  popover.addEventListener('focusout', focusout);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('focusin', outside);
  document.addEventListener('keydown', keydown);
  document.addEventListener('scroll', scroll, true);
  window.addEventListener('resize', resize);

  return {
    toggle,
    close,
    get outputId() { return active?.output.id || null; },
    get isOpen() { return Boolean(active); },
    destroy() {
      if (destroyed) return;
      close();
      destroyed = true;
      dismiss.removeEventListener('click', dismissClick);
      popover.removeEventListener('focusout', focusout);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
      popover.remove();
    },
  };
}
