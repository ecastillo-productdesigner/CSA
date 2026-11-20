import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { setCompactChipLabel } from './chip-label.js?v=20261120-chip-tooltips';
import { draftAudienceLabel } from './audience-similarity.js?v=20261119-similarity-rings';
import { storyMetadata } from './story-metadata.js?v=20261027-metadata';

const formats = ['bold', 'italic', 'underline', 'strike', 'link', 'font', 'size', 'color', 'background', 'header', 'blockquote', 'list', 'indent', 'align'];

// Match the main editor's saved-document restrictions without importing its singleton UI.
function savedDocument(value) {
  if (!value || !Array.isArray(value.ops) || value.ops.length > 30000) return null;
  const ops = [];
  for (const op of value.ops) {
    if (!op || typeof op.insert !== 'string') return null;
    const attributes = {};
    for (const [key, attribute] of Object.entries(op.attributes || {})) {
      if (!formats.includes(key)) continue;
      if (key === 'link' && typeof attribute === 'string') {
        try {
          const input = attribute.trim();
          const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
          if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) attributes.link = url.href;
        } catch { /* Ignore invalid saved links. */ }
      } else if (['bold', 'italic', 'underline', 'strike', 'blockquote'].includes(key) && attribute === true) attributes[key] = true;
      else if (key === 'header' && [1, 2, 3].includes(attribute)) attributes.header = attribute;
      else if (key === 'indent' && Number.isInteger(attribute) && attribute >= 0 && attribute <= 8) attributes.indent = attribute;
      else if (key === 'list' && ['bullet', 'ordered', 'checked', 'unchecked'].includes(attribute)) attributes.list = attribute;
      else if (key === 'font' && ['serif', 'monospace'].includes(attribute)) attributes.font = attribute;
      else if (key === 'size' && ['small', 'large', 'huge'].includes(attribute)) attributes.size = attribute;
      else if (key === 'align' && ['center', 'right', 'justify'].includes(attribute)) attributes.align = attribute;
      else if (['color', 'background'].includes(key) && typeof attribute === 'string' && /^(#[\da-f]{3,8}|[a-z]{1,20}|rgba?\([\d.,%\s]+\))$/i.test(attribute)) attributes[key] = attribute;
    }
    ops.push({ insert: op.insert, ...(Object.keys(attributes).length ? { attributes } : {}) });
  }
  return { ops };
}

export function createSimilarityDraftEditor({ host, onSave = () => false, onBack = () => {} }) {
  const doc = host.ownerDocument;
  const view = doc.defaultView || globalThis;
  const node = (tag, className = '', text) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (className, text) => {
    const element = node('button', className, text);
    element.type = 'button';
    return element;
  };
  const root = node('div', 'audience-similarity-editor');
  const body = node('div', 'audience-similarity-editor-body');
  const audience = node('span', 'audience-similarity-editor-audience');
  const title = node('textarea', 'audience-similarity-editor-title');
  title.rows = 1;
  title.maxLength = 180;
  title.placeholder = 'Untitled story';
  const share = node('textarea', 'audience-similarity-editor-share');
  share.rows = 1;
  share.maxLength = 500;
  share.placeholder = 'Add share text';
  const field = (label, control) => {
    const element = node('label', 'audience-similarity-editor-field');
    element.append(node('span', 'audience-similarity-editor-label visually-hidden', label), control);
    return element;
  };
  const toolbar = node('div', 'editor-toolbar audience-similarity-editor-toolbar');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Draft formatting');
  const controls = [];
  const groups = [
    [['Bold', 'format_bold', 'format', 'bold'], ['Italic', 'format_italic', 'format', 'italic'], ['Underline', 'format_underlined', 'format', 'underline']],
    [['Heading 2', 'format_h2', 'header', '2'], ['Heading 3', 'format_h3', 'header', '3'], ['Block Quote', 'format_quote', 'format', 'blockquote']],
    [['Bulleted List', 'format_list_bulleted', 'list', 'bullet'], ['Numbered List', 'format_list_numbered', 'list', 'ordered']],
    [['Undo', 'undo', 'action', 'undo'], ['Redo', 'redo', 'action', 'redo']],
  ];
  for (const entries of groups) {
    const group = node('div', 'editor-toolbar-group');
    for (const [label, icon, kind, value] of entries) {
      const control = button('icon-button');
      control.title = label;
      control.setAttribute('aria-label', label);
      control.dataset[kind] = value;
      if (kind !== 'action') control.setAttribute('aria-pressed', 'false');
      control.append(createIcon(icon));
      controls.push(control);
      group.append(control);
    }
    toolbar.append(group);
  }
  const content = node('div', 'audience-similarity-editor-content');
  const error = node('p', 'audience-similarity-editor-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  body.append(audience, field('Title', title), field('Share Text', share), toolbar, content, error);
  const footer = node('div', 'dialog-footer audience-similarity-editor-footer');
  const back = button('secondary-button', 'Back to Similarity');
  const save = button('primary-button', 'Recalculate Similarities');
  save.disabled = true;
  footer.append(back, save);
  root.append(body, footer);
  host.append(root);

  let draft = null;
  let quill = null;
  let initializing = null;
  let ready = false;
  let loading = false;
  let saving = false;
  let destroyed = false;
  let generation = 0;
  let baseline = '';
  let shareTextEdited = false;
  let metadata = {};
  let selection = { index: 0, length: 0 };
  let fieldWidth = 0;
  const fieldObserver = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width || body.clientWidth;
    if (width > 0 && width !== fieldWidth) { fieldWidth = width; resizeFields(); }
  }) : null;

  function resizeFields() {
    if (destroyed) return;
    for (const field of [title, share]) {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight}px`;
    }
  }
  fieldObserver?.observe(body);
  view.addEventListener?.('resize', resizeFields);
  doc.fonts?.ready.then(() => { if (!destroyed) resizeFields(); });

  function signature(titleText = title.value, shareText = share.value) {
    const ops = quill.getContents().ops.map(op => ({
      insert: op.insert,
      ...(op.attributes ? { attributes: Object.fromEntries(Object.entries(op.attributes).sort(([a], [b]) => a.localeCompare(b))) } : {}),
    }));
    return JSON.stringify([titleText, shareText, ops]);
  }

  function updateControls() {
    const available = ready && !saving && !destroyed && Boolean(draft);
    save.disabled = !available || signature() === baseline;
    save.textContent = saving ? 'Recalculating…' : 'Recalculate Similarities';
    back.disabled = saving;
    title.disabled = saving;
    share.disabled = saving;
    for (const control of controls) control.disabled = !available;
    root.setAttribute('aria-busy', String(loading || saving));
    quill?.enable(available);
  }

  function updateToolbar() {
    if (!quill || !ready) return;
    const value = quill.getFormat(selection.index, selection.length);
    for (const control of controls) {
      if (control.dataset.format) control.setAttribute('aria-pressed', String(value[control.dataset.format] === true));
      else if (control.dataset.header) control.setAttribute('aria-pressed', String(value.header === Number(control.dataset.header)));
      else if (control.dataset.list) control.setAttribute('aria-pressed', String(value.list === control.dataset.list));
    }
  }

  function change() {
    resizeFields();
    if (loading || destroyed) return;
    error.hidden = true;
    updateControls();
    updateToolbar();
  }

  function selectionChange(range) {
    if (!range) return;
    selection = { index: range.index, length: range.length };
    updateToolbar();
  }

  async function initialize() {
    if (quill) return;
    if (!initializing) initializing = (async () => {
      if (!view.Quill) await import('./vendor/quill-2.0.3.js?v=20261026-drafting-card-size');
      if (destroyed) return;
      const Quill = view.Quill || globalThis.Quill;
      if (!Quill) throw new Error('Editor unavailable');
      quill = new Quill(content, {
        theme: 'snow', placeholder: 'Start writing, or paste your material here…', formats,
        modules: { toolbar: false, history: { delay: 650, maxStack: 200, userOnly: true } },
      });
      quill.root.setAttribute('role', 'textbox');
      quill.root.setAttribute('aria-label', 'Story body');
      quill.root.setAttribute('aria-multiline', 'true');
      quill.root.setAttribute('spellcheck', 'true');
      quill.on('text-change', change);
      quill.on('selection-change', selectionChange);
    })();
    try { await initializing; } catch (error) { initializing = null; throw error; }
  }

  function restoreSelection() {
    const end = Math.max(0, quill.getLength() - 1);
    selection = { index: Math.min(selection.index, end), length: Math.min(selection.length, Math.max(0, end - selection.index)) };
    quill.setSelection(selection.index, selection.length, 'silent');
  }

  toolbar.addEventListener('mousedown', event => {
    if (event.target.closest('button')) event.preventDefault();
  });
  toolbar.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control || control.disabled || !ready || saving) return;
    restoreSelection();
    const value = quill.getFormat(selection.index, selection.length);
    quill.history.cutoff();
    if (control.dataset.header) {
      const level = Number(control.dataset.header);
      quill.formatLine(selection.index, selection.length, { header: value.header === level ? false : level, blockquote: false }, 'user');
    } else if (control.dataset.format === 'blockquote') {
      quill.formatLine(selection.index, selection.length, { blockquote: value.blockquote !== true, header: false, list: false }, 'user');
    } else if (control.dataset.format) {
      quill.format(control.dataset.format, value[control.dataset.format] !== true, 'user');
    } else if (control.dataset.list) {
      quill.format('list', value.list === control.dataset.list ? false : control.dataset.list, 'user');
    } else if (control.dataset.action === 'undo') quill.history.undo();
    else if (control.dataset.action === 'redo') quill.history.redo();
    quill.history.cutoff();
    updateControls();
    updateToolbar();
  });
  title.addEventListener('input', change);
  share.addEventListener('input', () => { shareTextEdited = true; change(); });
  back.addEventListener('click', () => {
    if (saving) return;
    generation += 1;
    ready = false;
    draft = null;
    updateControls();
    onBack();
  });
  save.addEventListener('click', async () => {
    if (save.disabled || !draft || !quill) return;
    const currentGeneration = generation;
    const currentDraft = draft;
    const patch = {
      title: title.value.trim() || 'Untitled story',
      titleProvided: Boolean(title.value.trim()),
      shareText: share.value,
      shareTextEdited,
      document: quill.getContents(),
      draftText: quill.getText().replace(/\n$/, ''),
      metadata: { ...metadata, ...storyMetadata(title.value, quill.getText()) },
      updatedAt: Date.now(),
    };
    saving = true;
    error.hidden = true;
    updateControls();
    try {
      if (await onSave(currentDraft, patch) === false) throw new Error('Save rejected');
      if (destroyed || generation !== currentGeneration) return;
      title.value = patch.titleProvided ? patch.title : '';
      metadata = { ...patch.metadata };
      baseline = signature();
    } catch {
      if (destroyed || generation !== currentGeneration) return;
      error.textContent = 'Couldn’t save your changes. Try again.';
      error.hidden = false;
    } finally {
      if (!destroyed && generation === currentGeneration) {
        saving = false;
        updateControls();
      }
    }
  });

  async function open(nextDraft) {
    if (destroyed) return;
    const currentGeneration = ++generation;
    draft = nextDraft;
    ready = false;
    loading = true;
    saving = false;
    selection = { index: 0, length: 0 };
    shareTextEdited = nextDraft.shareTextEdited === true;
    metadata = { ...nextDraft.metadata };
    const initialTitle = nextDraft.titleProvided === false ? '' : typeof nextDraft.title === 'string' ? nextDraft.title : '';
    const initialShare = typeof nextDraft.shareText === 'string' ? nextDraft.shareText : '';
    title.value = initialTitle;
    share.value = initialShare;
    resizeFields();
    const audienceLabel = draftAudienceLabel(nextDraft);
    audience.className = 'audience-similarity-editor-audience';
    if (audienceLabel !== 'None Selected') audience.classList.add('output-badge', 'output-badge--audience');
    setCompactChipLabel(audience, audienceLabel, { ariaLabel: `Audience: ${audienceLabel}` });
    error.hidden = true;
    updateControls();
    title.focus({ preventScroll: true });
    try {
      await initialize();
      if (destroyed || generation !== currentGeneration) return;
      const document = savedDocument(nextDraft.document);
      if (document) quill.setContents(document, 'silent');
      else quill.setText(typeof nextDraft.draftText === 'string' ? nextDraft.draftText : '', 'silent');
      quill.history.clear();
      quill.setSelection(null, 'silent');
      baseline = signature(initialTitle, initialShare);
      ready = true;
    } catch {
      if (destroyed || generation !== currentGeneration) return;
      error.textContent = 'Couldn’t open the editor. Go back and try again.';
      error.hidden = false;
    } finally {
      if (!destroyed && generation === currentGeneration) {
        loading = false;
        resizeFields();
        updateControls();
        updateToolbar();
      }
    }
  }

  function destroy() {
    destroyed = true;
    fieldObserver?.disconnect();
    view.removeEventListener?.('resize', resizeFields);
    generation += 1;
    if (quill) {
      quill.off('text-change', change);
      quill.off('selection-change', selectionChange);
      quill.disable();
    }
    draft = null;
    root.remove();
  }

  updateControls();
  return { open, destroy };
}
