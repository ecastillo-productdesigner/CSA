import { saveDocuments, deleteDocuments } from './documents.js?v=20261026-drafting-card-size';
import { createIcon } from './icons.js?v=20261026-drafting-card-size';

const supportedExtensions = new Set(['pdf', 'docx', 'pptx', 'txt', 'md']);
const maximumFileSize = 10 * 1024 * 1024;
const maximumFiles = 20;

function formatBytes(size) {
  return size < 1024 ? `${size} B` : size < 1048576 ? `${Math.round(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`;
}

export function createNewProjectUpload({ onCreate, saveFiles = saveDocuments, deleteFiles = deleteDocuments, isBlocked = () => false }) {
  if (typeof onCreate !== 'function') throw new TypeError('A project creation callback is required.');
  const get = name => document.querySelector(`#new-project-${name}`);
  const dialog = get('dialog');
  const input = get('file-input');
  const zone = get('drop-zone');
  const selection = get('upload-selection');
  const list = get('selected-files');
  const status = get('file-status');
  const create = get('use-material');
  const error = get('material-error');
  let files = [];
  let busy = false;

  function clearError() {
    error.textContent = '';
    error.hidden = true;
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  function renderFiles() {
    list.replaceChildren(...files.map((file, index) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `${file.name} · ${formatBytes(file.size)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.disabled = busy;
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.append(createIcon('close'));
      remove.addEventListener('click', () => {
        if (busy || isBlocked()) return;
        files.splice(index, 1);
        clearError();
        renderFiles();
        (list.querySelector('button') || input).focus();
      });
      item.append(name, remove);
      return item;
    }));
    selection.hidden = files.length === 0;
    status.textContent = files.length ? `${files.length} ${files.length === 1 ? 'document' : 'documents'} selected` : '';
    create.disabled = busy || files.length === 0;
  }

  function selectFiles(incoming) {
    if (busy || isBlocked()) return;
    clearError();
    const rejected = [];
    for (const file of Array.from(incoming || [])) {
      const extension = typeof file.name === 'string' ? file.name.split('.').pop().toLowerCase() : '';
      if (!supportedExtensions.has(extension) || !Number.isFinite(file.size) || file.size <= 0 || file.size > maximumFileSize) {
        rejected.push(file.name || 'Unnamed file');
      } else if (!files.some(entry => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified)) {
        if (files.length < maximumFiles) files.push(file);
        else rejected.push(file.name);
      }
    }
    if (rejected.length) showError(`Couldn't add ${rejected.join(', ')}. Choose a non-empty PDF, DOCX, PPTX, TXT or MD file up to 10 MB, with no more than 20 files at a time.`);
    renderFiles();
  }

  input.addEventListener('change', event => {
    selectFiles(event.target.files);
    input.value = '';
  });
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    if (!busy && !isBlocked()) zone.classList.add('dragging');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('dragging');
    selectFiles(event.dataTransfer?.files);
  });
  zone.addEventListener('click', event => { if (busy || isBlocked()) event.preventDefault(); });
  zone.addEventListener('keydown', event => {
    if (event.target !== zone || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!busy && !isBlocked()) input.click();
  });

  async function useFiles() {
    if (busy || isBlocked() || !files.length) return;
    busy = true;
    clearError();
    const label = create.textContent;
    const controls = [...dialog.querySelectorAll('button, input, textarea, select')].map(control => [control, control.disabled]);
    for (const [control] of controls) control.disabled = true;
    create.textContent = 'Saving Documents…';
    dialog.setAttribute('aria-busy', 'true');
    zone.setAttribute('aria-disabled', 'true');
    zone.classList.remove('dragging');
    let sources;
    let completed = false;
    try {
      sources = await saveFiles([...files]);
      if (await onCreate(sources) === false) throw new Error('The project could not be created.');
      completed = true;
    } catch (failure) {
      let cleanupFailed = false;
      const attachmentIds = (Array.isArray(sources) ? sources : []).map(source => source?.attachmentId).filter(id => typeof id === 'string' && id);
      if (attachmentIds.length) {
        try { await deleteFiles(attachmentIds); }
        catch { cleanupFailed = true; }
      }
      showError(cleanupFailed
        ? 'The project could not be created, and some uploaded documents could not be removed from browser storage. Your files are still selected so you can try again.'
        : failure?.name === 'QuotaExceededError'
          ? 'There is not enough browser storage for these documents. Try fewer or smaller files.'
          : 'These documents could not be used to create a project. Your files are still selected so you can try again.');
    } finally {
      busy = false;
      create.textContent = label;
      dialog.removeAttribute('aria-busy');
      zone.removeAttribute('aria-disabled');
      for (const [control, disabled] of controls) control.disabled = disabled;
      if (completed) reset();
      else renderFiles();
    }
  }

  create.addEventListener('click', useFiles);

  function reset() {
    if (busy) return false;
    files = [];
    input.value = '';
    zone.classList.remove('dragging');
    clearError();
    renderFiles();
    return true;
  }

  reset();
  return { reset, isBusy: () => busy || isBlocked() };
}
