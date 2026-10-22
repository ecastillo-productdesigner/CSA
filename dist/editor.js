import { documentStyles } from './design-system/export-styles.js?v=20261021-editor-subhead';
import { tokenNumber, tokenValue } from './design-system/runtime.js?v=20261021-editor-subhead';
import './vendor/quill-2.0.3.js';

const Quill = window.Quill;
const Delta = Quill.import('delta');
const formats = ['bold', 'italic', 'underline', 'strike', 'link', 'font', 'size', 'color', 'background', 'header', 'blockquote', 'list', 'indent', 'align'];

function safeLink(value) {
  try {
    const input = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function savedDocument(value) {
  if (!value || !Array.isArray(value.ops) || value.ops.length > 30000) return null;
  const ops = [];
  for (const op of value.ops) {
    if (!op || typeof op.insert !== 'string') return null;
    const attributes = {};
    for (const [key, attribute] of Object.entries(op.attributes || {})) {
      if (!formats.includes(key)) continue;
      if (key === 'link') { const link = typeof attribute === 'string' && safeLink(attribute); if (link) attributes.link = link; }
      else if (['bold', 'italic', 'underline', 'strike', 'blockquote'].includes(key) && attribute === true) attributes[key] = true;
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

export function createMaterialEditor({ onSave, onSendToCms, onContentChange = () => {}, onToolbarChange = () => {}, notify }) {
  const $ = (selector) => document.querySelector(selector);
  const root = $('#material-editor');
  const title = $('#editor-title');
  const shareText = $('#editor-share-text');
  const status = $('#editor-save-status');
  const linkDialog = $('#editor-link-dialog');
  let quill = null;
  let project = null;
  let loading = false;
  let dirty = false;
  let revisionBusy = false;
  let sentContent = null;
  let saveTimer;
  let selection = { index: 0, length: 0 };
  let linkSelection = selection;
  let findIndex = -1;

  function initialize() {
    if (quill) return;
    quill = new Quill('#rich-text-editor', { theme: 'snow', placeholder: 'Start writing, or paste your material here…', formats, modules: { toolbar: false, history: { delay: 650, maxStack: 200, userOnly: true } } });
    quill.root.setAttribute('role', 'textbox');
    quill.root.setAttribute('aria-label', 'Story body');
    quill.root.setAttribute('aria-multiline', 'true');
    quill.root.setAttribute('spellcheck', 'true');
    quill.on('text-change', () => { if (!loading) { updateCounts(); updateToolbar(); updateFind(); scheduleSave(); onContentChange(); } });
    quill.on('selection-change', (range) => { if (range) { selection = range; updateToolbar(); } });

  }

  function resizeTitle() { title.style.height = 'auto'; title.style.height = `${Math.max(tokenNumber('foundation.space.44'), title.scrollHeight)}px`; }
  function syncShareText() { $('#editor-share-text-print').textContent = shareText.value.trim(); }

  function contentSignature() {
    const ops = quill.getContents().ops.map(op => ({
      insert: op.insert,
      ...(op.attributes ? { attributes: Object.fromEntries(Object.entries(op.attributes).sort(([a], [b]) => a.localeCompare(b))) } : {}),
    }));
    return JSON.stringify([title.value.trim() || 'Untitled story', ops, ...(shareText.value.trim() ? [shareText.value.trim()] : [])]);
  }

  function canSend() {
    return Boolean(!revisionBusy && project?.selectedOutputId && project.status !== 'pending' && !project.needsRegeneration && quill && (sentContent === null || contentSignature() !== sentContent));
  }

  function updateSendButton() {
    const button = $('#editor-wordpress');
    button.disabled = !canSend();
    button.title = !project?.selectedOutputId ? 'Select a generated variant to send to CMS'
      : project.status === 'pending' || project.needsRegeneration ? 'Create this variant again to apply its updated settings before sending.'
      : button.disabled ? 'This version has been sent. Edit the title or content to send an update.'
        : 'Send this variant to CMS (demo)';
  }

  function scheduleSave() {
    if (!project || loading) return;
    updateSendButton();
    dirty = true;
    status.textContent = 'Saving…';
    status.hidden = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 450);
  }

  function flush() {
    clearTimeout(saveTimer);
    if (!project || !quill || !dirty) return;
    const snapshot = {
      id: project.id, title: title.value.trim() || 'Untitled story', shareText: shareText.value, kind: 'draft',
      document: quill.getContents(), draftText: quill.getText().replace(/\n$/, ''),
      sources: project.sources,
      metadata: { ...project.metadata },
      toolPreferences: Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, $(`#composer-${key}`).value])),
      updatedAt: Date.now(),
      ...(sentContent !== null ? { cmsSentContent: sentContent } : {}),
    };
    const saved = onSave(snapshot);
    dirty = saved === false;
    status.textContent = dirty ? 'Couldn’t save · download a copy' : '';
    status.hidden = !dirty;
    status.classList.toggle('editor-save-error', dirty);
    document.title = `${snapshot.title} — CSA`;
  }

  function updateCounts() {
    const text = quill.getText().replace(/\n$/, '');
    const words = text.trim().match(/\S+/gu)?.length || 0;
    $('#editor-word-count').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  }

  function updateToolbar() {
    if (!quill || !project) return;
    const value = quill.getFormat(selection.index, selection.length);
    for (const button of $('#editor-toolbar').querySelectorAll('[data-format]')) button.setAttribute('aria-pressed', String(value[button.dataset.format] === true));
    for (const button of $('#editor-toolbar').querySelectorAll('[data-list]')) button.setAttribute('aria-pressed', String(value.list === button.dataset.list));
    for (const button of $('#editor-toolbar').querySelectorAll('[data-header]')) button.setAttribute('aria-pressed', String(value.header === Number(button.dataset.header)));
    $('[data-editor-action="link"]').setAttribute('aria-pressed', String(Boolean(value.link)));
    $('[data-editor-action="highlight"]').setAttribute('aria-pressed', String(Boolean(value.background)));
    $('#editor-block').value = value.blockquote ? 'quote' : String(value.header || '');
    $('#editor-align').value = typeof value.align === 'string' ? value.align : '';
    if (typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color)) $('#editor-color').value = value.color;
    onToolbarChange();
  }

  function restoreSelection() {
    if (!quill) return;
    const index = Math.min(selection.index, quill.getLength() - 1);
    quill.setSelection(index, Math.min(selection.length, quill.getLength() - 1 - index), 'silent');
  }

  function format(name, value) { restoreSelection(); quill.history.cutoff(); quill.format(name, value, 'user'); quill.history.cutoff(); updateToolbar(); }

  $('#editor-toolbar').addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
  $('#editor-toolbar').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !quill) return;
    if (button.dataset.header) {
      const level = Number(button.dataset.header);
      restoreSelection();
      quill.history.cutoff();
      quill.formatLine(selection.index, selection.length, { header: quill.getFormat(selection.index, selection.length).header === level ? false : level, blockquote: false }, 'user');
      quill.history.cutoff();
      updateToolbar();
      return;
    }
    if (button.dataset.format === 'blockquote') {
      const active = Boolean(quill.getFormat(selection.index, selection.length).blockquote);
      restoreSelection();
      quill.history.cutoff();
      quill.formatLine(selection.index, selection.length, { blockquote: !active, header: false, list: false }, 'user');
      quill.history.cutoff();
      updateToolbar();
      return;
    }
    if (button.dataset.format) { format(button.dataset.format, !quill.getFormat(selection.index, selection.length)[button.dataset.format]); return; }
    if (button.dataset.list) { format('list', quill.getFormat(selection.index, selection.length).list === button.dataset.list ? false : button.dataset.list); return; }
    switch (button.dataset.editorAction) {
      case 'undo': quill.history.undo(); break;
      case 'redo': quill.history.redo(); break;
      case 'link': openLink(); break;
      case 'highlight': format('background', quill.getFormat(selection.index, selection.length).background ? false : tokenValue('foundation.color.orange.100')); break;
      case 'indent': format('indent', '+1'); break;
      case 'outdent': format('indent', '-1'); break;
      case 'clear': restoreSelection(); quill.history.cutoff(); quill.removeFormat(selection.index, selection.length, 'user'); quill.history.cutoff(); break;
    }
    updateToolbar();
  });
  $('#editor-block').addEventListener('change', () => {
    const block = $('#editor-block').value;
    restoreSelection();
    quill.history.cutoff();
    quill.formatLine(selection.index, selection.length, { header: block && block !== 'quote' ? Number(block) : false, blockquote: block === 'quote' }, 'user');
    quill.history.cutoff();
    updateToolbar();
  });
  $('#editor-align').addEventListener('change', () => format('align', $('#editor-align').value || false));
  $('#editor-color').addEventListener('input', () => format('color', $('#editor-color').value));
  title.addEventListener('input', () => { resizeTitle(); scheduleSave(); });
  shareText.addEventListener('input', () => { syncShareText(); scheduleSave(); });
  let previousWidth = 0;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width > 0 && width !== previousWidth) { previousWidth = width; resizeTitle(); }
  }).observe(root);
  for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).addEventListener('change', scheduleSave);

  function setPanel(name, open) {
    const active = name === 'find' && open;
    $('#editor-find').hidden = !active;
    $('#editor-find-button').setAttribute('aria-expanded', String(active));
    if (active) $('#editor-find-text').focus();
  }
  $('#editor-find-button').addEventListener('click', () => setPanel('find', $('#editor-find').hidden));
  for (const button of root.querySelectorAll('[data-editor-close]')) button.addEventListener('click', () => { setPanel(button.dataset.editorClose, false); $(`#editor-${button.dataset.editorClose}-button`).focus(); });

  function openLink() {
    if (!quill || !project) return;
    linkSelection = { ...selection };
    $('#editor-link-text').value = quill.getText(selection.index, selection.length);
    const link = quill.getFormat(selection.index, selection.length).link;
    $('#editor-link-url').value = typeof link === 'string' ? link : '';
    $('#editor-remove-link').hidden = !link;
    $('#editor-link-error').hidden = true;
    linkDialog.showModal(); $('#editor-link-url').focus();
  }
  $('#editor-link-form').addEventListener('submit', event => {
    event.preventDefault();
    const url = safeLink($('#editor-link-url').value);
    if (!url) { $('#editor-link-error').textContent = 'Use a website, email, or phone link.'; $('#editor-link-error').hidden = false; return; }
    const text = $('#editor-link-text').value.trim() || url;
    const previousFormats = quill.getFormat(linkSelection.index, linkSelection.length);
    quill.history.cutoff();
    quill.updateContents(new Delta().retain(linkSelection.index).delete(linkSelection.length).insert(text, { ...previousFormats, link: url }), 'user');
    quill.history.cutoff(); linkDialog.close();
    quill.setSelection(linkSelection.index, text.length, 'user');
  });
  $('#editor-remove-link').addEventListener('click', () => { quill.formatText(linkSelection.index, linkSelection.length, 'link', false, 'user'); linkDialog.close(); quill.setSelection(linkSelection, 'user'); });

  function matches() {
    const needle = $('#editor-find-text').value.toLowerCase();
    if (!needle || !quill) return [];
    const text = quill.getText().toLowerCase();
    const indices = [];
    let index = text.indexOf(needle);
    while (index !== -1) { indices.push(index); index = text.indexOf(needle, index + needle.length); }
    return indices;
  }
  function updateFind() {
    const count = matches().length;
    $('#editor-find-count').textContent = !$('#editor-find-text').value ? 'Enter text to find' : `${count} ${count === 1 ? 'match' : 'matches'}`;
    for (const key of ['find-next', 'replace-one', 'replace-all']) $(`#editor-${key}`).disabled = count === 0;
  }
  function nextMatch() {
    const indices = matches();
    if (!indices.length) return -1;
    findIndex = indices.find(index => index > findIndex) ?? indices[0];
    quill.setSelection(findIndex, $('#editor-find-text').value.length, 'user');
    return findIndex;
  }
  $('#editor-find-text').addEventListener('input', () => { findIndex = -1; updateFind(); });
  $('#editor-find-text').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); nextMatch(); } });
  $('#editor-find-next').addEventListener('click', nextMatch);
  $('#editor-replace-one').addEventListener('click', () => {
    const indices = matches();
    const index = indices.includes(findIndex) ? findIndex : indices[0];
    if (index === undefined) return;
    const replacement = $('#editor-replace-text').value;
    const length = $('#editor-find-text').value.length;
    const attributes = quill.getFormat(index, length);
    quill.history.cutoff(); quill.updateContents(new Delta().retain(index).delete(length).insert(replacement, attributes), 'user'); quill.history.cutoff();
    findIndex = index + replacement.length - 1;
    quill.setSelection(index, replacement.length, 'user');
  });
  $('#editor-replace-all').addEventListener('click', () => {
    const indices = matches();
    if (!indices.length) return;
    const length = $('#editor-find-text').value.length;
    const replacement = $('#editor-replace-text').value;
    const changes = new Delta(); let previous = 0;
    for (const index of indices) { changes.retain(index - previous).delete(length).insert(replacement, quill.getFormat(index, length)); previous = index + length; }
    quill.history.cutoff(); quill.updateContents(changes, 'user'); quill.history.cutoff();
    findIndex = -1; updateFind();
    notify(`Replaced ${indices.length} ${indices.length === 1 ? 'match' : 'matches'}.`);
  });

  function escaped(text) { return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function exportDocument(type) {
    if (!quill || !project) return;
    flush();
    const heading = title.value.trim() || 'Untitled story';
    const text = [heading, shareText.value.trim(), quill.getText()].filter(Boolean).join('\n\n');
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${escaped(heading)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&amp;display=swap"><style>${documentStyles}</style></head><body><h1>${escaped(heading)}</h1>${shareText.value.trim() ? `<p>${escaped(shareText.value.trim())}</p>` : ''}${quill.getSemanticHTML()}</body></html>`;
    const blob = new Blob([type === 'html' ? html : text], { type: type === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${heading.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 90) || 'CSA-story'}.${type === 'html' ? 'html' : 'txt'}`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('#editor-download').open = false;
  }
  for (const button of root.querySelectorAll('[data-export]')) button.addEventListener('click', () => exportDocument(button.dataset.export));
  $('#editor-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText([title.value.trim() || 'Untitled story', shareText.value.trim(), quill.getText()].filter(Boolean).join('\n\n')); notify('Story copied.'); }
    catch { notify('Select your text and use ⌘/Ctrl+C to copy.'); }
    $('#editor-download').open = false;
  });
  $('#editor-print').addEventListener('click', () => { $('#editor-download').open = false; flush(); window.print(); });
  $('#editor-wordpress').addEventListener('click', () => {
    if (!canSend()) return;
    flush();
    onSendToCms(project.id);
  });
  document.addEventListener('keydown', event => {
    if (!project || root.hidden || document.querySelector('dialog[open]') || !(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); flush(); }
    if (key === 'f') { event.preventDefault(); setPanel('find', true); }
    if (key === 'k' && quill.hasFocus()) { event.preventDefault(); openLink(); }
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', event => { flush(); if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  return {
    open(next) {
      flush(); project = next; loading = true; root.hidden = false;
      initialize();
      revisionBusy = false;
      quill.enable(true);
      title.disabled = false;
      shareText.disabled = false;
      title.value = next.title === 'Untitled story' ? '' : next.title;
      shareText.value = typeof next.shareText === 'string' ? next.shareText : '';
      syncShareText();
      const created = new Date(next.createdAt);
      const hasCreatedAt = next.createdAt != null && next.createdAt !== '' && Number.isFinite(created.getTime());
      $('#editor-created').hidden = !hasCreatedAt;
      const createdTime = $('#editor-created-time');
      createdTime.textContent = hasCreatedAt ? new Intl.DateTimeFormat('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
      }).format(created) : '';
      if (hasCreatedAt) createdTime.dateTime = created.toISOString();
      else createdTime.removeAttribute('datetime');
      const document = savedDocument(next.document);
      if (document) quill.setContents(document, 'silent'); else quill.setText(typeof next.draftText === 'string' ? next.draftText : '', 'silent');
      sentContent = Number.isFinite(next.cmsSentAt) && next.cmsSentAt > 0
        ? (typeof next.cmsSentContent === 'string' ? next.cmsSentContent : contentSignature()) : null;
      updateSendButton();
      quill.history.clear(); selection = { index: 0, length: 0 }; findIndex = -1;
      $('#editor-find-text').value = ''; $('#editor-replace-text').value = '';
      status.textContent = ''; status.hidden = true; status.classList.remove('editor-save-error');
      for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = next.toolPreferences?.[key] || '';
      setPanel('', false); resizeTitle(); updateCounts(); updateToolbar(); updateFind();
      quill.root.scrollTop = 0;
      loading = false; dirty = false;
      if (!next.draftText) title.focus(); else quill.setSelection(0, 0, 'silent');
    },
    close() { flush(); revisionBusy = false; title.disabled = false; quill?.enable(true); project = null; root.hidden = true; setPanel('', false); if (linkDialog.open) linkDialog.close(); $('#editor-download').open = false; },
    setRevisionBusy(value) {
      revisionBusy = value;
      quill?.enable(!value);
      title.disabled = value;
      shareText.disabled = value;
      for (const control of $('#editor-toolbar').querySelectorAll('button, input, select')) control.disabled = value;
      onToolbarChange();
      updateSendButton();
    },
    closePanels() { setPanel('', false); },
    hasContent() { return Boolean(project && quill && quill.getText().replace(/[\s\u200B-\u200D\uFEFF]/gu, '')); },
    canSend,
    markSent() {
      sentContent = contentSignature();
      updateSendButton();
      return sentContent;
    },
    flush,
  };
}
