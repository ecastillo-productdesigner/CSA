import { parseSourceLinks, formatSourceLinks } from '../source-links.js?v=20261026-listicle-format';

const mounted = new WeakMap();

/** Mount isolated examples of the current text-entry and document-upload fields. */
export function mountFormSpecimens(root) {
  if (!root) return null;
  mounted.get(root)?.destroy();
  root.innerHTML = `
    <div class="ds-form-grid">
      <section class="ds-form-example" aria-labelledby="ds-form-password-title">
        <h4 id="ds-form-password-title">Single-line input</h4>
        <label class="field-label" for="ds-form-password">Password</label>
        <div class="demo-password-field"><input id="ds-form-password" type="password" value="example" autocomplete="off"><button id="ds-form-password-visible" type="button" aria-label="Show password example" aria-controls="ds-form-password" aria-pressed="false">Show</button></div>
        <p class="ds-caption">The demo access field pairs a password input with a Show control. Focus the input to see its shared outline.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-disabled-title">
        <h4 id="ds-form-disabled-title">Disabled input</h4>
        <label class="field-label" for="ds-form-password-disabled">Password</label>
        <div class="demo-password-field"><input id="ds-form-password-disabled" type="password" value="example" autocomplete="off" disabled><button type="button" aria-label="Show password example unavailable" disabled>Show</button></div>
        <p class="ds-caption">Disabled controls keep their field shape and cannot be edited or activated.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-links-title">
        <h4 id="ds-form-links-title">Article URLs</h4>
        <form class="new-project-search" id="ds-form-links" novalidate>
          <label for="ds-form-query">Article URLs</label>
          <div class="new-project-input"><span class="material-symbols-outlined" aria-hidden="true">search</span><textarea id="ds-form-query" aria-describedby="ds-form-link-error" rows="5" wrap="soft" placeholder="Search for articles or paste article URL (1 per line or separated by commas)&#10;&#10;Examples:&#10;https://www.centredaily.com/news/local/article123.html&#10;https://www.miamiherald.com/sports/article456.html" autocomplete="off" maxlength="4000" required></textarea></div>
          <p class="form-error" id="ds-form-link-error" role="status" hidden>Paste a valid website link to continue.</p>
          <div class="ds-form-actions"><button class="ds-text-action" id="ds-form-validate" type="button">Validate example</button><button class="new-project-continue" id="ds-form-continue" type="submit" disabled>Continue</button></div>
          <p class="ds-caption" id="ds-form-validation" role="status" aria-live="polite"></p>
        </form>
        <p class="ds-caption">New Project accepts one or more article URLs. This example validates links locally.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-error-title">
        <h4 id="ds-form-error-title">Validation error</h4>
        <div class="new-project-search">
          <label for="ds-form-invalid-query">Article URLs</label>
          <div class="new-project-input"><span class="material-symbols-outlined" aria-hidden="true">search</span><textarea id="ds-form-invalid-query" aria-describedby="ds-form-invalid-error" aria-invalid="true" rows="5" wrap="soft" readonly>not-a-website</textarea></div>
          <p class="form-error" id="ds-form-invalid-error" role="status">Paste a valid website link to continue.</p>
        </div>
        <p class="ds-caption">Validation pairs the field's invalid state with the app's inline error message.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-upload-title">
        <h4 id="ds-form-upload-title">Upload documents</h4>
        <label class="new-project-material new-project-upload" id="ds-form-upload-zone" for="ds-form-upload-input" tabindex="0" aria-describedby="ds-form-upload-help"><span class="new-project-material-icon"><span class="material-symbols-outlined" aria-hidden="true">upload</span></span><span><strong>Upload documents</strong><small><span class="new-project-upload-desktop">Drop files here or <span class="browse-label">browse files</span></span><span class="new-project-upload-mobile">Choose files to upload</span></small></span><input class="visually-hidden" id="ds-form-upload-input" type="file" aria-label="Upload example documents" multiple accept=".pdf,.docx,.pptx,.txt,.md"></label>
        <p class="new-project-upload-help" id="ds-form-upload-help">PDF, DOCX, PPTX, TXT or MD · Up to 10 MB each · 20 files max</p>
        <div class="new-project-upload-selection" id="ds-form-upload-selection" hidden><ul class="selected-files" id="ds-form-upload-files"></ul><p class="file-status" id="ds-form-upload-status" role="status" aria-live="polite"></p><button class="new-project-continue" id="ds-form-upload-create" type="button" disabled>Start creating</button></div>
        <p class="form-error" id="ds-form-upload-error" role="status" hidden></p>
        <p class="ds-caption" id="ds-form-upload-result" role="status" aria-live="polite"></p>
        <p class="ds-caption">Choose or drop files to preview selection and removal. This example does not save files or create a project.</p>
      </section>
    </div>`;

  const field = root.querySelector('#ds-form-query');
  const error = root.querySelector('#ds-form-link-error');
  const continuation = root.querySelector('#ds-form-continue');
  const result = root.querySelector('#ds-form-validation');
  const form = root.querySelector('#ds-form-links');
  const validateButton = root.querySelector('#ds-form-validate');
  const password = root.querySelector('#ds-form-password');
  const visibility = root.querySelector('#ds-form-password-visible');
  const uploadInput = root.querySelector('#ds-form-upload-input');
  const uploadZone = root.querySelector('#ds-form-upload-zone');
  const uploadSelection = root.querySelector('#ds-form-upload-selection');
  const uploadList = root.querySelector('#ds-form-upload-files');
  const uploadStatus = root.querySelector('#ds-form-upload-status');
  const uploadCreate = root.querySelector('#ds-form-upload-create');
  const uploadError = root.querySelector('#ds-form-upload-error');
  const uploadResult = root.querySelector('#ds-form-upload-result');
  const supportedExtensions = new Set(['pdf', 'docx', 'pptx', 'txt', 'md']);
  let selectedFiles = [];

  function clearUploadResult() {
    uploadError.hidden = true;
    uploadError.textContent = '';
    uploadResult.textContent = '';
  }
  function renderUploadFiles() {
    uploadList.replaceChildren(...selectedFiles.map((file, index) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const size = file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${Math.round(file.size / 1024)} KB` : `${(file.size / 1048576).toFixed(1)} MB`;
      name.textContent = `${file.name} · ${size}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'close';
      remove.append(icon);
      remove.addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        clearUploadResult();
        renderUploadFiles();
        (uploadList.querySelector('button') || uploadInput).focus();
      });
      item.append(name, remove);
      return item;
    }));
    uploadSelection.hidden = selectedFiles.length === 0;
    uploadCreate.disabled = selectedFiles.length === 0;
    uploadStatus.textContent = selectedFiles.length ? `${selectedFiles.length} ${selectedFiles.length === 1 ? 'document' : 'documents'} selected` : '';
  }
  function selectUploadFiles(incoming) {
    clearUploadResult();
    const rejected = [];
    for (const file of Array.from(incoming || [])) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!supportedExtensions.has(extension) || file.size <= 0 || file.size > 10 * 1024 * 1024) rejected.push(file.name);
      else if (!selectedFiles.some(entry => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified)) {
        if (selectedFiles.length < 20) selectedFiles.push(file);
        else rejected.push(file.name);
      }
    }
    if (rejected.length) {
      uploadError.textContent = `Choose a non-empty PDF, DOCX, PPTX, TXT or MD file up to 10 MB, with no more than 20 files at a time. Not added: ${rejected.join(', ')}`;
      uploadError.hidden = false;
    }
    renderUploadFiles();
  }
  function onUploadInput(event) {
    selectUploadFiles(event.target.files);
    uploadInput.value = '';
  }
  function onUploadDragOver(event) {
    event.preventDefault();
    uploadZone.classList.add('dragging');
  }
  function onUploadDragLeave() { uploadZone.classList.remove('dragging'); }
  function onUploadDrop(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragging');
    selectUploadFiles(event.dataTransfer?.files);
  }
  function onUploadKey(event) {
    if (event.target !== uploadZone || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    uploadInput.click();
  }
  function onUploadCreate() {
    if (!selectedFiles.length) return;
    uploadResult.textContent = `Example ready with ${selectedFiles.length} ${selectedFiles.length === 1 ? 'document' : 'documents'}`;
  }


  function validate(showEmptyError = false) {
    const formatted = formatSourceLinks(field.value);
    if (formatted !== field.value) field.value = formatted;
    const links = parseSourceLinks(field.value);
    const invalid = !links && (Boolean(field.value.trim()) || showEmptyError);
    field.setCustomValidity(invalid ? 'Paste a valid website link to continue.' : '');
    field.setAttribute('aria-invalid', String(invalid));
    error.hidden = !invalid;
    continuation.disabled = !links;
    return links;
  }
  function onInput() {
    result.textContent = '';
    validate();
  }
  function onValidate() {
    const links = validate(true);
    result.textContent = links ? `${links.length} valid article ${links.length === 1 ? 'URL' : 'URLs'}` : '';
    if (!links) field.focus();
  }
  function onSubmit(event) {
    event.preventDefault();
    onValidate();
  }
  function onVisibility() {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    visibility.textContent = visible ? 'Hide' : 'Show';
    visibility.setAttribute('aria-label', visible ? 'Hide password example' : 'Show password example');
    visibility.setAttribute('aria-pressed', String(visible));
  }
  field.addEventListener('input', onInput);
  form.addEventListener('submit', onSubmit);
  validateButton.addEventListener('click', onValidate);
  visibility.addEventListener('click', onVisibility);
  uploadInput.addEventListener('change', onUploadInput);
  uploadZone.addEventListener('dragover', onUploadDragOver);
  uploadZone.addEventListener('dragleave', onUploadDragLeave);
  uploadZone.addEventListener('drop', onUploadDrop);
  uploadZone.addEventListener('keydown', onUploadKey);
  uploadCreate.addEventListener('click', onUploadCreate);

  const api = {
    destroy() {
      field.removeEventListener('input', onInput);
      form.removeEventListener('submit', onSubmit);
      validateButton.removeEventListener('click', onValidate);
      visibility.removeEventListener('click', onVisibility);
      uploadInput.removeEventListener('change', onUploadInput);
      uploadZone.removeEventListener('dragover', onUploadDragOver);
      uploadZone.removeEventListener('dragleave', onUploadDragLeave);
      uploadZone.removeEventListener('drop', onUploadDrop);
      uploadZone.removeEventListener('keydown', onUploadKey);
      uploadCreate.removeEventListener('click', onUploadCreate);
      selectedFiles = [];

      mounted.delete(root);
    },
  };
  mounted.set(root, api);
  return api;
}
