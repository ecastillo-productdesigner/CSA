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
        const heading = document.createElement(href ? 'a' : 'strong');
        heading.textContent = source.title;
        if (href) { heading.href = href; heading.target = '_blank'; heading.rel = 'noopener noreferrer'; }
        content.append(heading);
        let preview = source.text || '';
        if (preview.startsWith('Fictional sample article · ') && preview.includes('\n\n')) {
          const divider = preview.indexOf('\n\n');
          const metadata = document.createElement('p');
          metadata.className = 'editor-source-meta';
          metadata.textContent = preview.slice(0, divider);
          content.append(metadata);
          preview = preview.slice(divider + 2);
        }
        const detail = document.createElement('p');
        detail.className = 'editor-source-preview';
        detail.textContent = preview ? preview.slice(0, 260) + (preview.length > 260 ? '…' : '') : href || (source.attachmentId ? 'Document saved in this browser' : 'Local source');
        content.append(detail);
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
