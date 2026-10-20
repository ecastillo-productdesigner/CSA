export function sourceSelectionFor(project, variant = null) {
  const available = project?.sources || [];
  if (!variant) return { sources: available, selectedSources: new Set(available.filter(source => source.selected !== false)) };
  const saved = Array.isArray(variant.sourceSnapshots) ? variant.sourceSnapshots
    : (variant.selectedSourceIndexes || []).map(index => available[index]).filter(Boolean);
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
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function createProjectSources({ onSelectionChange, onDownloadSource, onAddSource, onRemoveSource, onVariantContextChange = () => {} }) {
  const list = document.querySelector('#editor-source-list');
  const status = document.querySelector('#editor-source-selection-status');
  const add = document.querySelector('#editor-add-source-button');
  const context = document.createElement('div');
  context.className = 'editor-source-variant-context';
  context.hidden = true;
  const contextText = document.createElement('span');
  context.append(contextText);
  add.after(context);
  let visibleSources = [];
  let selectedSources = new Set();
  let sourceVariant = null;
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
    menu.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))}px`;
    menu.style.top = `${Math.max(12, Math.min(anchor.bottom + 4, window.innerHeight - bounds.height - 12))}px`;
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
  const previewDialog = document.querySelector('#article-preview-dialog');
  let previewTrigger = null;
  previewDialog.addEventListener('close', () => {
    previewTrigger?.focus({ preventScroll: true });
    previewTrigger = null;
  });

  function openPreview(source, button) {
    previewTrigger = button;
    let text = source.text || '';
    const fictional = text.startsWith('Fictional ');
    const meta = document.querySelector('#article-preview-meta');
    meta.replaceChildren();
    meta.hidden = false;
    if (text.startsWith('Fictional sample article · ') && text.includes('\n\n')) {
      const divider = text.indexOf('\n\n');
      const parts = text.slice(0, divider).split('·').map(part => part.trim());
      const date = /^\d{4}-\d{2}-\d{2}$/.test(parts[2] || '') ? new Date(`${parts[2]}T12:00:00`) : null;
      meta.textContent = [parts[1], date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : parts[2]].filter(Boolean).join(' · ');
      text = text.slice(divider + 2);
    } else if (sourceUrl(source.url || '')) {
      const link = document.createElement('a');
      link.href = sourceUrl(source.url);
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = source.url;
      meta.append(link);
    } else meta.textContent = source.type === 'file' ? 'Document source' : 'Project source';
    document.querySelector('#article-preview-title').textContent = source.title;
    document.querySelector('.article-preview-badge').textContent = fictional ? 'Fictional article preview' : 'Source preview';
    document.querySelector('#article-preview-notice').hidden = !fictional;
    const paragraphs = text.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
    if (!paragraphs.length) paragraphs.push(source.attachmentId ? 'Download this document from Sources to read the original.' : 'No preview text is available for this source.');
    document.querySelector('#article-preview-body').replaceChildren(...paragraphs.map(value => {
      const paragraph = document.createElement('p'); paragraph.textContent = value; return paragraph;
    }));
    document.querySelector('#article-preview-back').textContent = 'Back to sources';
    previewDialog.showModal();
    document.querySelector('#article-preview-body').scrollTop = 0;
  }


  function updateSelectionStatus() {
    const sources = visibleSources;
    const selected = selectedSources.size;
    status.textContent = sources.length ? `${selected} of ${sources.length} selected ${sourceVariant ? 'for this variant' : 'for new variants'}` : '';
  }

  add.addEventListener('click', () => { if (project) onAddSource(project.id); });

  function render(next, { variant = null } = {}) {
    closeMenu();
    project = next;
    sourceVariant = variant;
    context.hidden = !variant;
    contextText.textContent = variant ? `${variant.sourceCount || 0} ${variant.sourceCount === 1 ? 'source' : 'sources'} used for this variant` : '';
    onVariantContextChange(variant?.id || null);
    const allSources = project?.sources || [];
    const selection = sourceSelectionFor(project, variant);
    visibleSources = selection.sources;
    selectedSources = selection.selectedSources;
    add.disabled = !project;
    list.replaceChildren();
    updateSelectionStatus();
    const sources = visibleSources;
    if (!sources.length) {
      const empty = document.createElement('li');
      empty.className = 'editor-sources-empty';
      empty.textContent = project ? 'No sources yet. Add a new source to this project.' : 'Open a project to view its sources.';
      list.append(empty);
    }
    for (const source of sources) {
      const row = document.createElement('li');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'editor-source-checkbox';
      checkbox.checked = selectedSources.has(source);
      const available = allSources.includes(source);
      if (!available) { checkbox.checked = true; checkbox.disabled = true; }
      checkbox.setAttribute('aria-label', `Include source: ${source.title}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedSources.add(source); else selectedSources.delete(source);
        if (sourceVariant) {
          const index = allSources.indexOf(source);
          allSources.forEach(entry => { entry.selected = selectedSources.has(entry); });
          onSelectionChange(project.id);
          render(project);
          list.querySelectorAll('.editor-source-checkbox')[index]?.focus({ preventScroll: true });
          return;
        }
        source.selected = checkbox.checked;
        updateSelectionStatus();
        onSelectionChange(project.id);
      });
      const content = document.createElement('div');
      content.className = 'editor-source-content';
      const href = source.type === 'link' && sourceUrl(source.url || '');
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'editor-source-open';
      open.setAttribute('aria-label', `Preview source: ${source.title}`);
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-controls', 'article-preview-dialog');
      open.addEventListener('click', () => openPreview(source, open));
      const heading = document.createElement('strong');
      heading.textContent = source.title;
      open.append(heading);
      const preview = source.text || '';
      const detail = document.createElement('span');
      detail.className = 'editor-source-preview';
      detail.textContent = preview ? preview.slice(0, 260) + (preview.length > 260 ? '…' : '') : href || (source.attachmentId ? 'Document saved in this browser' : 'Local source');
      open.append(detail);
      content.append(open);
      if (source.attachmentId) {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'text-button document-download';
        download.textContent = 'Download document';
        download.setAttribute('aria-label', `Download ${source.title}`);
        download.addEventListener('click', () => onDownloadSource(source));
        content.append(download);
      }
      row.append(checkbox, content);
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'icon-button editor-source-more';
      more.setAttribute('aria-label', `Source options: ${source.title}`);
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-controls', menu.id);
      more.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>';
      more.addEventListener('click', () => openMenu(source, more));
      more.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(source, more); } });
      if (available) row.append(more);
      list.append(row);
    }
  }
  return { render };
}
