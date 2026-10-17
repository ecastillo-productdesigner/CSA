function sourceUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function createProjectSources({ onSelectionChange, onDownloadSource, onAddSource }) {
  const list = document.querySelector('#editor-source-list');
  const status = document.querySelector('#editor-source-selection-status');
  const add = document.querySelector('#editor-add-source-button');
  let project = null;
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
    const sources = project?.sources || [];
    const selected = sources.filter(source => source.selected !== false).length;
    status.textContent = sources.length ? `${selected} of ${sources.length} selected for new variants` : '';
  }

  add.addEventListener('click', () => { if (project) onAddSource(project.id); });

  return {
    render(next) {
      project = next;
      add.disabled = !project;
      list.replaceChildren();
      updateSelectionStatus();
      const sources = project?.sources || [];
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
        checkbox.checked = source.selected !== false;
        checkbox.setAttribute('aria-label', `Include source: ${source.title}`);
        checkbox.addEventListener('change', () => {
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
        list.append(row);
      }
    },
  };
}
