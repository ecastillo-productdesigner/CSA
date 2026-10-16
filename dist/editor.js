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

export function createMaterialEditor({ onSave, onDownloadSource, onSendToCms, notify }) {
  const $ = (selector) => document.querySelector(selector);
  const root = $('#material-editor');
  const title = $('#editor-title');
  const status = $('#editor-save-status');
  const linkDialog = $('#editor-link-dialog');
  let quill = null;
  let project = null;
  let loading = false;
  let dirty = false;
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
    quill.on('text-change', () => { if (!loading) { updateCounts(); updateToolbar(); updateFind(); scheduleSave(); } });
    quill.on('selection-change', (range) => { if (range) { selection = range; updateToolbar(); } });
    const icons = Quill.import('ui/icons');
    for (const button of $('#editor-toolbar').querySelectorAll('[data-format], [data-list], [data-editor-action="clear"]')) {
      const icon = button.dataset.format ? icons[button.dataset.format] : button.dataset.list ? icons.list[button.dataset.list] : icons.clean;
      if (typeof icon === 'string') button.innerHTML = icon;
    }
  }

  function resizeTitle() { title.style.height = 'auto'; title.style.height = `${Math.max(44, title.scrollHeight)}px`; }

  function scheduleSave() {
    if (!project || loading) return;
    dirty = true;
    status.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 450);
  }

  function flush() {
    clearTimeout(saveTimer);
    if (!project || !quill || !dirty) return;
    const snapshot = {
      id: project.id, title: title.value.trim() || 'Untitled story', kind: 'draft',
      document: quill.getContents(), draftText: quill.getText().replace(/\n$/, ''),
      metadata: { author: $('#editor-author').value.trim(), tags: $('#editor-tags').value.trim() },
      toolPreferences: Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, $(`#composer-${key}`).value])),
      updatedAt: Date.now(),
    };
    const saved = onSave(snapshot);
    dirty = saved === false;
    status.textContent = dirty ? 'Couldn’t save · download a copy' : 'Saved on this device';
    status.classList.toggle('editor-save-error', dirty);
    document.title = `${snapshot.title} — CSA`;
  }

  function updateCounts() {
    const text = quill.getText().replace(/\n$/, '');
    const words = text.trim().match(/\S+/gu)?.length || 0;
    $('#editor-word-count').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    $('#editor-character-count').textContent = `${text.length.toLocaleString()} characters`;
    $('#editor-read-time').textContent = `${Math.ceil(words / 225)} min read`;
  }

  function updateToolbar() {
    if (!quill || !project) return;
    const value = quill.getFormat(selection.index, selection.length);
    for (const button of $('#editor-toolbar').querySelectorAll('[data-format]')) button.setAttribute('aria-pressed', String(value[button.dataset.format] === true));
    for (const button of $('#editor-toolbar').querySelectorAll('[data-list]')) button.setAttribute('aria-pressed', String(value.list === button.dataset.list));
    $('[data-editor-action="highlight"]').setAttribute('aria-pressed', String(Boolean(value.background)));
    $('#editor-block').value = value.blockquote ? 'quote' : String(value.header || '');
    $('#editor-font').value = typeof value.font === 'string' ? value.font : '';
    $('#editor-size').value = typeof value.size === 'string' ? value.size : '';
    $('#editor-align').value = typeof value.align === 'string' ? value.align : '';
    if (typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color)) $('#editor-color').value = value.color;
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
    if (button.dataset.format) { format(button.dataset.format, !quill.getFormat(selection.index, selection.length)[button.dataset.format]); return; }
    if (button.dataset.list) { format('list', quill.getFormat(selection.index, selection.length).list === button.dataset.list ? false : button.dataset.list); return; }
    switch (button.dataset.editorAction) {
      case 'undo': quill.history.undo(); break;
      case 'redo': quill.history.redo(); break;
      case 'link': openLink(); break;
      case 'highlight': format('background', quill.getFormat(selection.index, selection.length).background ? false : '#fff0a8'); break;
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
  for (const key of ['font', 'size', 'align']) $(`#editor-${key}`).addEventListener('change', () => format(key, $(`#editor-${key}`).value || false));
  $('#editor-color').addEventListener('input', () => format('color', $('#editor-color').value));
  title.addEventListener('input', () => { resizeTitle(); scheduleSave(); });
  let previousWidth = 0;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width > 0 && width !== previousWidth) { previousWidth = width; resizeTitle(); }
  }).observe(root);
  for (const key of ['author', 'tags']) $(`#editor-${key}`).addEventListener('input', scheduleSave);
  for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).addEventListener('change', scheduleSave);

  function setPanel(name, open) {
    for (const key of ['sources', 'metadata', 'find']) {
      const active = key === name && open;
      $(`#editor-${key}`).hidden = !active;
      $(`#editor-${key}-button`).setAttribute('aria-expanded', String(active));
    }
    if (name === 'sources' && open) renderSources();
    if (name === 'find' && open) $('#editor-find-text').focus();
  }
  for (const name of ['sources', 'metadata', 'find']) $(`#editor-${name}-button`).addEventListener('click', () => setPanel(name, $(`#editor-${name}`).hidden));
  for (const button of root.querySelectorAll('[data-editor-close]')) button.addEventListener('click', () => { setPanel(button.dataset.editorClose, false); $(`#editor-${button.dataset.editorClose}-button`).focus(); });

  function renderSources() {
    const list = $('#editor-source-list');
    list.replaceChildren();
    const sources = project?.sources || [];
    $('#editor-source-count').textContent = sources.length;
    if (!sources.length) { const empty = document.createElement('li'); empty.className = 'editor-sources-empty'; empty.textContent = 'Your own material is the starting point for this draft. Add reference links here whenever you need them.'; list.append(empty); }
    for (const source of sources) {
      const row = document.createElement('li');
      const href = source.type === 'link' && safeLink(source.url || '');
      const heading = document.createElement(href ? 'a' : 'strong');
      heading.textContent = source.title;
      if (href) { heading.href = href; heading.target = '_blank'; heading.rel = 'noopener noreferrer'; }
      const detail = document.createElement('p');
      detail.textContent = source.text ? source.text.slice(0, 260) + (source.text.length > 260 ? '…' : '') : href || (source.attachmentId ? 'Document saved in this browser' : 'Local source');
      row.append(heading, detail);
      if (source.attachmentId && onDownloadSource) {
        const download = document.createElement('button');
        download.type = 'button'; download.className = 'text-button document-download';
        download.textContent = 'Download document';
        download.setAttribute('aria-label', `Download ${source.title}`);
        download.addEventListener('click', () => onDownloadSource(source));
        row.append(download);
      }
      list.append(row);
    }
  }
  $('#editor-add-source').addEventListener('submit', event => {
    event.preventDefault();
    if (!project) return;
    const url = safeLink($('#editor-source-url').value);
    if (!url || !/^https?:/i.test(url)) { $('#editor-source-error').textContent = 'Enter a valid website URL.'; $('#editor-source-error').hidden = false; return; }
    $('#editor-source-error').hidden = true;
    if (!project.sources.some(source => source.url === url)) project.sources.push({ type: 'link', title: new URL(url).hostname.replace(/^www\./, ''), url });
    $('#editor-source-url').value = '';
    renderSources(); scheduleSave(); flush();
  });

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
    const text = `${heading}\n\n${quill.getText()}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${escaped(heading)}</title><style>body{max-width:760px;margin:60px auto;padding:24px;font:17px/1.8 system-ui,sans-serif;color:#26344a}h1,h2,h3{line-height:1.3}blockquote{border-left:3px solid #ccd3df;padding-left:20px}.ql-align-center{text-align:center}.ql-align-right{text-align:right}.ql-align-justify{text-align:justify}.ql-font-serif{font-family:Georgia,serif}.ql-font-monospace{font-family:monospace}.ql-size-small{font-size:.8em}.ql-size-large{font-size:1.5em}.ql-size-huge{font-size:2em}</style></head><body><h1>${escaped(heading)}</h1>${quill.getSemanticHTML()}</body></html>`;
    const blob = new Blob([type === 'html' ? html : text], { type: type === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${heading.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 90) || 'CSA-story'}.${type === 'html' ? 'html' : 'txt'}`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('#editor-download').open = false;
  }
  for (const button of root.querySelectorAll('[data-export]')) button.addEventListener('click', () => exportDocument(button.dataset.export));
  $('#editor-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${title.value.trim() || 'Untitled story'}\n\n${quill.getText()}`); notify('Story copied.'); }
    catch { notify('Select your text and use ⌘/Ctrl+C to copy.'); }
    $('#editor-download').open = false;
  });
  $('#editor-print').addEventListener('click', () => { $('#editor-download').open = false; flush(); window.print(); });
  $('#editor-wordpress').addEventListener('click', () => {
    if (!project) return;
    flush();
    onSendToCms(project.id);
  });
  document.addEventListener('keydown', event => {
    if (!project || root.hidden || linkDialog.open || !(event.metaKey || event.ctrlKey) || event.altKey) return;
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
      title.value = next.title === 'Untitled story' ? '' : next.title;
      $('#editor-wordpress').disabled = !next.selectedOutputId;
      $('#editor-wordpress').title = next.selectedOutputId ? 'Send this variant to CMS (demo)' : 'Select a generated variant to send to CMS';
      $('#editor-author').value = typeof next.metadata?.author === 'string' ? next.metadata.author : '';
      $('#editor-tags').value = typeof next.metadata?.tags === 'string' ? next.metadata.tags : '';
      const document = savedDocument(next.document);
      if (document) quill.setContents(document, 'silent'); else quill.setText(typeof next.draftText === 'string' ? next.draftText : '', 'silent');
      quill.history.clear(); selection = { index: 0, length: 0 }; findIndex = -1;
      $('#editor-find-text').value = ''; $('#editor-replace-text').value = ''; $('#editor-source-error').hidden = true;
      status.textContent = 'Saved on this device'; status.classList.remove('editor-save-error');
      for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = next.toolPreferences?.[key] || '';
      setPanel('', false); renderSources(); resizeTitle(); updateCounts(); updateToolbar(); updateFind();
      quill.root.scrollTop = 0;
      loading = false; dirty = false;
      if (!next.draftText) title.focus(); else quill.setSelection(0, 0, 'silent');
    },
    close() { flush(); project = null; root.hidden = true; setPanel('', false); if (linkDialog.open) linkDialog.close(); $('#editor-download').open = false; },
    showSources() { if (project) setPanel('sources', true); },
    flush,
  };
}
