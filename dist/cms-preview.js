import { readCmsPreviewRecord } from './cms-preview-model.js?v=20261124-cms-preview';

const $ = (id) => document.getElementById(id);
const draftId = new URLSearchParams(window.location.search).get('draft');
let record = null;
try { record = draftId ? readCmsPreviewRecord(draftId) : null; } catch { /* Show the recovery state if storage is unavailable. */ }

if (!record) {
  $('cms-empty').hidden = false;
} else {
  startPreview(record);
}

function startPreview(current) {
  const fields = {
    title: $('cms-title'), share: $('cms-share'), seoTitle: $('cms-seo-title'),
    description: $('cms-description'), keywords: $('cms-keywords'), body: $('cms-body')
  };
  fields.title.textContent = string(current.title);
  fields.share.textContent = string(current.shareText);
  fields.seoTitle.textContent = string(current.metadata?.seoTitle);
  fields.description.textContent = string(current.metadata?.metaDescription);
  fields.keywords.textContent = Array.isArray(current.metadata?.seoKeywords) ? current.metadata.seoKeywords.join(', ') : string(current.metadata?.seoKeywords);
  renderDocument(fields.body, current.document, string(current.body));
  $('channel-label').textContent = `${string(current.publication) || 'Training'} · Web channel`;
  $('info-publication').textContent = string(current.publication) || 'Training';
  $('info-id').textContent = string(current.outputId || current.id);
  $('info-created').textContent = formatDate(current.createdAt || current.exportedAt);
  $('info-modified').textContent = formatDate(current.updatedAt || current.exportedAt);
  $('cms-shell').hidden = false;
  document.title = `${string(current.title) || 'Untitled draft'} · CMS Training`;

  const title = fields.title.textContent;
  const share = fields.share.textContent;
  const body = fields.body.innerText.trim();
  $('info-slug').textContent = title || 'Untitled draft';
  $('title-count').textContent = countText(title);
  $('share-count').textContent = countText(share);
  $('seo-title-count').textContent = countText(fields.seoTitle.textContent);
  $('description-count').textContent = countText(fields.description.textContent);
  $('metric-title').textContent = countText(title);
  $('metric-share').textContent = countText(share);
  $('metric-seo').textContent = countText(fields.seoTitle.textContent);
  $('metric-body').textContent = countText(body);
  $('metric-total').textContent = countText([title, share, body].filter(Boolean).join('\n'));
  const minutes = Math.max(1, Math.ceil(words(body) / 200));
  $('metric-reading').textContent = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function string(value) { return typeof value === 'string' ? value : value == null ? '' : String(value); }
function words(text) { return text.trim() ? text.trim().split(/\s+/u).length : 0; }
function countText(text) { return `${Array.from(text).length} / ${words(text)}`; }
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
// Build only known document elements; exported content is never interpreted as HTML.
function renderDocument(container, source, fallback) {
  let doc = source;
  if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { doc = null; } }
  const ops = Array.isArray(doc?.ops) ? doc.ops : Array.isArray(doc) ? doc : null;
  if (!ops || !ops.some((op) => typeof op?.insert === 'string')) {
    fallback.split(/\n/).forEach((line) => { const p = document.createElement('p'); p.textContent = line; if (!line) p.append(document.createElement('br')); container.append(p); });
    return;
  }
  let segments = [];
  let previousList = null;
  function addLine(attributes = {}) {
    const heading = Number(attributes.header);
    const tag = attributes.list ? 'li' : heading >= 1 && heading <= 6 ? `h${Math.min(heading, 3)}` : attributes.blockquote ? 'blockquote' : 'p';
    const block = document.createElement(tag);
    segments.forEach(({ text, attributes: inline }) => block.append(makeInline(text, inline)));
    if (!segments.length) block.append(document.createElement('br'));
    if (attributes.list) {
      const listTag = attributes.list === 'ordered' ? 'ol' : 'ul';
      if (!previousList || previousList.tagName.toLowerCase() !== listTag) { previousList = document.createElement(listTag); container.append(previousList); }
      previousList.append(block);
    } else { previousList = null; container.append(block); }
    segments = [];
  }
  ops.forEach((op) => {
    if (typeof op?.insert !== 'string') return;
    const parts = op.insert.split('\n');
    parts.forEach((text, index) => {
      if (text) segments.push({ text, attributes: op.attributes || {} });
      if (index < parts.length - 1) addLine(op.attributes || {});
    });
  });
  if (segments.length) addLine();
}
function makeInline(text, attributes) {
  let node = document.createTextNode(text);
  const wrap = (tag) => { const element = document.createElement(tag); element.append(node); node = element; };
  if (attributes.bold) wrap('strong');
  if (attributes.italic) wrap('em');
  if (attributes.underline) wrap('u');
  if (attributes.strike) wrap('s');
  if (typeof attributes.link === 'string') {
    try {
      const url = new URL(attributes.link);
      if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
        wrap('span'); node.className = 'cms-inline-link';
      }
    } catch { /* Keep unsafe or malformed links as ordinary text. */ }
  }
  return node;
}
