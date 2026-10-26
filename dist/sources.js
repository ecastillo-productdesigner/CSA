import { draftSourcesFor } from './source-model.js?v=20261026-source-selection-follow';
import { tokenNumber } from './design-system/runtime.js?v=20261026-source-selection-follow';
import { fictionalArticleParagraphs, sourceLinkArticles } from './source-links.js?v=20261026-source-selection-follow';
export function sourceSelectionFor(project, variant = null) {
  const available = project?.sources || [];
  if (!variant) return { sources: available, selectedSources: new Set(available.filter(source => source.selected !== false)) };
  const saved = draftSourcesFor(project, variant);
  const selectedSources = new Set();
  const historical = [];
  for (const snapshot of saved) {
    const match = available.find(source => !selectedSources.has(source) && (snapshot.attachmentId
      ? source.attachmentId === snapshot.attachmentId
      : source.type === snapshot.type && source.title === snapshot.title && source.url === snapshot.url && source.text === snapshot.text));
    selectedSources.add(match || snapshot);
    if (!match) historical.push(snapshot);
  }
  return { sources: [...available, ...historical], selectedSources };
}

function sourceUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function sourceDisplayTitle(source) {
  const url = source.type === 'link' ? sourceUrl(source.url) : null;
  return url ? sourceLinkArticles([source])[0].title : source.title;
}

export function sourcePreviewParagraphs(source) {
  let text = source.text || '';
  if (source.type === 'link' && sourceUrl(source.url) && !text.trim()) return fictionalArticleParagraphs(sourceDisplayTitle(source));
  if (text.startsWith('Fictional sample article · ') && text.includes('\n\n')) text = text.slice(text.indexOf('\n\n') + 2);
  return text.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
}

function sourceMetadata(label, value) {
  const line = document.createElement('span');
  const heading = document.createElement('span');
  heading.className = 'source-metadata-label';
  heading.textContent = `${label}: `;
  line.append(heading, document.createTextNode(value));
  return line;
}

export function createSourcePreview() {
  const previewDialog = document.querySelector('#article-preview-dialog');
  let previewTrigger = null;
  previewDialog.addEventListener('close', () => {
    if (previewTrigger?.isConnected && !previewTrigger.closest('[hidden], [inert]')) previewTrigger.focus({ preventScroll: true });
    previewTrigger = null;
  });

  function openPreview(source, button) {
    previewTrigger = button;
    const text = source.text || '';
    const linkOnly = source.type === 'link' && sourceUrl(source.url) && !text.trim();
    const fictional = Boolean(linkOnly) || text.startsWith('Fictional ');
    const meta = document.querySelector('#article-preview-meta');
    meta.replaceChildren();
    meta.hidden = false;
    if (linkOnly) {
      const date = sourceLinkArticles([source])[0].date;
      const published = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Not available';
      meta.append(sourceMetadata('Publish Date', published), sourceMetadata('URL', sourceUrl(source.url)));
    } else if (text.startsWith('Fictional sample article · ') && text.includes('\n\n')) {
      const divider = text.indexOf('\n\n');
      const parts = text.slice(0, divider).split('·').map(part => part.trim());
      const date = /^\d{4}-\d{2}-\d{2}$/.test(parts[2] || '') ? new Date(`${parts[2]}T12:00:00`) : null;
      meta.textContent = [parts[1], date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : parts[2]].filter(Boolean).join(' · ');
    } else if (sourceUrl(source.url || '')) {
      const link = document.createElement('a');
      link.href = sourceUrl(source.url);
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = source.url;
      meta.append(link);
    } else meta.textContent = source.type === 'file' ? 'Document source' : 'Project source';
    document.querySelector('#article-preview-title').textContent = sourceDisplayTitle(source);
    document.querySelector('.article-preview-badge').textContent = fictional ? 'Fictional article preview' : 'Source preview';
    document.querySelector('#article-preview-notice').hidden = !fictional;
    const paragraphs = sourcePreviewParagraphs(source);
    if (!paragraphs.length) paragraphs.push(source.attachmentId ? 'Download this document from Project Sources to read the original.' : 'No preview text is available for this source.');
    document.querySelector('#article-preview-body').replaceChildren(...paragraphs.map(value => {
      const paragraph = document.createElement('p'); paragraph.textContent = value; return paragraph;
    }));
    previewDialog.showModal();
    document.querySelector('#article-preview-body').scrollTop = 0;
  }

  const close = () => previewDialog.close();
  previewDialog.querySelector('[aria-label="Close article preview"]').addEventListener('click', close);
  previewDialog.addEventListener('click', event => {
    if (event.target !== previewDialog) return;
    const bounds = previewDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  return { open: openPreview, close };
}

export function createProjectSources({ onBeforeSelectionChange = () => {}, onSelectionChange = () => {}, onDownloadSource, onRemoveSource, onVariantContextChange = () => {} }) {
  const list = document.querySelector('#editor-source-list');
  const status = document.querySelector('#editor-source-selection-status');
  const sourcePanel = document.createElement('div');
  sourcePanel.id = 'editor-source-status-content';
  sourcePanel.className = 'source-status-content';
  list.before(sourcePanel);
  sourcePanel.append(list);
  let sourceRows = [];
  let emptyRow = null;
  const titleTooltip = document.createElement('div');
  titleTooltip.id = 'editor-source-title-tooltip';
  titleTooltip.className = 'navigation-tooltip source-title-tooltip';
  titleTooltip.setAttribute('role', 'tooltip');
  titleTooltip.hidden = true;
  document.body.append(titleTooltip);
  let tooltipTrigger = null;

  function hideTitleTooltip() {
    titleTooltip.hidden = true;
    tooltipTrigger?.removeAttribute('aria-describedby');
    tooltipTrigger = null;
  }

  function showTitleTooltip(button, heading, fullTitle) {
    if (heading.textContent === fullTitle && heading.scrollHeight <= heading.clientHeight) return;
    hideTitleTooltip();
    tooltipTrigger = button;
    titleTooltip.textContent = fullTitle;
    titleTooltip.hidden = false;
    button.setAttribute('aria-describedby', titleTooltip.id);
    const anchor = button.getBoundingClientRect();
    const bounds = titleTooltip.getBoundingClientRect();
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    titleTooltip.style.left = `${Math.max(inset, Math.min(anchor.left, window.innerWidth - bounds.width - inset))}px`;
    titleTooltip.style.top = `${Math.max(inset, anchor.bottom + gap + bounds.height <= window.innerHeight - inset ? anchor.bottom + gap : anchor.top - bounds.height - gap)}px`;
  }

  function applySourceView() {
    closeMenu();
    hideTitleTooltip();
    emptyRow.hidden = sourceRows.length > 0;
    emptyRow.textContent = project ? 'No sources yet. Add a new source to this project.' : 'Open a project to view its sources.';
    list.setAttribute('aria-label', 'Project Sources');
    updateSelectionStatus();
  }
  document.addEventListener('scroll', hideTitleTooltip, true);
  window.addEventListener('resize', hideTitleTooltip);
  let visibleSources = [];
  let selectedSources = new Set();
  let sourceVariant = null;
  let editingNextDraft = false;
  let project = null;
  let menuTarget = null;
  const menu = document.createElement('div');
  menu.id = 'editor-source-menu';
  menu.className = 'editor-source-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Source actions');
  menu.hidden = true;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.setAttribute('role', 'menuitem');
  remove.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span><span>Delete</span>';
  menu.append(remove);
  list.parentElement.append(menu);

  function closeMenu(restoreFocus = false) {
    const button = menuTarget?.button;
    menuTarget = null;
    menu.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && button?.isConnected) button.focus({ preventScroll: true });
  }

  function openMenu(source, button) {
    if (menuTarget?.button === button) { closeMenu(true); return; }
    closeMenu();
    menuTarget = { source, button, projectId: project.id };
    button.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    const anchor = button.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(tokenNumber('foundation.space.12'), Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - tokenNumber('foundation.space.12')))}px`;
    menu.style.top = `${Math.max(tokenNumber('foundation.space.12'), Math.min(anchor.bottom + tokenNumber('foundation.space.4'), window.innerHeight - bounds.height - tokenNumber('foundation.space.12')))}px`;
    remove.focus({ preventScroll: true });
  }
  remove.addEventListener('click', () => {
    const target = menuTarget;
    closeMenu();
    if (target) onRemoveSource(target.projectId, target.source);
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); remove.focus(); }
    else if (event.key === 'Tab') closeMenu(true);
  });
  document.addEventListener('pointerdown', event => { if (menuTarget && !menu.contains(event.target) && !menuTarget.button.contains(event.target)) closeMenu(); });
  document.addEventListener('scroll', event => { if (menuTarget && !menu.contains(event.target)) closeMenu(); }, true);
  window.addEventListener('resize', () => closeMenu());
  const { open: openPreview } = createSourcePreview();

  function updateSelectionStatus() {
    const sources = visibleSources;
    status.hidden = false;
    const usage = sourceVariant && !editingNextDraft ? 'used in this draft' : 'selected for new drafts';
    status.textContent = sources.length ? `${selectedSources.size} of ${sources.length} ${usage}` : '';
    if (sourceVariant && !editingNextDraft && !selectedSources.size
      && !Array.isArray(sourceVariant.sourceSnapshots) && sourceVariant.sourceCount > 0) {
      status.textContent = 'Source details were not saved for this draft.';
    }
  }


  function render(next, { variant = null } = {}) {
    closeMenu();
    hideTitleTooltip();
    const contextChanged = project !== next || sourceVariant?.id !== variant?.id || Boolean(sourceVariant) !== Boolean(variant);
    project = next;
    sourceVariant = variant;
    if (contextChanged) editingNextDraft = false;
    onVariantContextChange(variant?.id || null);
    const allSources = project?.sources || [];
    const selection = sourceSelectionFor(project, variant);
    visibleSources = selection.sources;
    let selectionChanged = false;
    if (contextChanged && sourceVariant) {
      for (const source of allSources) {
        const selected = selection.selectedSources.has(source);
        if ((source.selected !== false) !== selected) {
          source.selected = selected;
          selectionChanged = true;
        }
      }
    }
    selectedSources = sourceVariant && !editingNextDraft ? selection.selectedSources
      : new Set(allSources.filter(source => source.selected !== false));
    list.replaceChildren();
    updateSelectionStatus();
    const sources = visibleSources;
    sourceRows = [];
    emptyRow = document.createElement('li');
    emptyRow.className = 'editor-sources-empty';
    emptyRow.setAttribute('role', 'status');
    list.append(emptyRow);
    for (const source of sources) {
      const title = sourceDisplayTitle(source);
      const row = document.createElement('li');
      const available = allSources.includes(source);
      {
        const selectionControl = document.createElement('label');
        selectionControl.className = 'editor-source-selection';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'editor-source-checkbox';
        checkbox.checked = selectedSources.has(source);
        checkbox.disabled = !available;
        checkbox.setAttribute('aria-label', `Use source for new drafts: ${title}`);
        checkbox.addEventListener('change', () => {
          closeMenu();
          hideTitleTooltip();
          onBeforeSelectionChange();
          if (!available || !project?.sources.includes(source)) {
            checkbox.checked = source.selected !== false;
            return;
          }
          editingNextDraft = true;
          source.selected = checkbox.checked;
          selectedSources = new Set(project.sources.filter(entry => entry.selected !== false));
          updateSelectionStatus();
          onSelectionChange(project.id);
        });
        selectionControl.append(checkbox);
        row.append(selectionControl);
      }
      const content = document.createElement('div');
      content.className = 'editor-source-content';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'editor-source-open';
      open.setAttribute('aria-label', `Preview source: ${title}`);
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-controls', 'article-preview-dialog');
      open.addEventListener('click', () => openPreview(source, open));
      const heading = document.createElement('strong');
      const titleCharacters = Array.from(title);
      heading.textContent = titleCharacters.length > 70 ? `${titleCharacters.slice(0, 69).join('').trimEnd()}…` : title;
      for (const eventName of ['mouseenter', 'focus']) open.addEventListener(eventName, () => showTitleTooltip(open, heading, title));
      for (const eventName of ['mouseleave', 'blur', 'click']) open.addEventListener(eventName, hideTitleTooltip);
      open.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !titleTooltip.hidden) { event.preventDefault(); event.stopPropagation(); hideTitleTooltip(); }
      });
      open.append(heading);
      content.append(open);
      if (source.attachmentId) {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'text-button document-download';
        download.textContent = 'Download Document';
        download.setAttribute('aria-label', `Download ${title}`);
        download.addEventListener('click', () => onDownloadSource(source));
        content.append(download);
      }
      row.append(content);
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'icon-button editor-source-more';
      more.setAttribute('aria-label', `Source options: ${title}`);
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-controls', menu.id);
      more.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>';
      more.addEventListener('click', () => openMenu(source, more));
      more.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(source, more); } });
      if (available) row.append(more);
      list.append(row);
      sourceRows.push({ source, row });
    }
    applySourceView();
    return { selectionChanged };
  }
  return { render, openPreview };
}
