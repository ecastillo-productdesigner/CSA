import { fictionalTopicParagraphs } from './topic-draft.js?v=20261026-listicle-format';

function safeUrl(value) {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : /^(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(value) ? `https://${value}` : null;
    if (!candidate) return null;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch { return null; }
}

function linkParts(input) {
  const text = input.trim().replace(/[,;](?=\s*(?:https?:\/\/|www\.))/gi, '\n');
  if (!text) return null;
  const parts = text.split(/\s+/).flatMap(part => {
    const links = [];
    let offset = 0;
    for (const match of part.matchAll(/https?:\/\//gi)) {
      if (match.index <= offset) continue;
      const prefix = part.slice(offset, match.index);
      // A URL that starts a query value or sits inside a fragment belongs to
      // the current link. A protocol appended after a value is another paste.
      const embeddedUrl = prefix.includes('#') || /[?&][^?&#=]*=$/.test(prefix);
      if (!embeddedUrl && safeUrl(prefix)) {
        links.push(prefix);
        offset = match.index;
      }
    }
    links.push(part.slice(offset));
    return links;
  });
  return parts.every(part => safeUrl(part)) ? parts : null;
}

export function parseSourceLinks(input) {
  return linkParts(input)?.map(safeUrl) || null;
}

export function formatSourceLinks(input) {
  const parts = linkParts(input);
  if (!parts || parts.length < 2) return input;
  return parts.join('\n') + (input.match(/\n+$/)?.[0] || '');
}

// Preview prose is explicitly fictional; it is never fetched article body text.
export function fictionalArticleParagraphs(title) {
  return fictionalTopicParagraphs(title);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readablePathPart(value) {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Keep the submitted path when escapes are malformed. */ }
  return decoded.replace(/\.(?:html?|aspx?|php)$/i, '').replace(/[-_]+/g, ' ').trim();
}

function opaqueTitle(value) {
  return /^(?:article\s*)?\d+(?:\.(?:html?|aspx?|php))?$/i.test(value) || /^[a-f\d]{12,}$/i.test(value);
}

function fallbackTitle(url) {
  const hostname = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean).map(readablePathPart);
  const last = parts.at(-1);
  if (last && !opaqueTitle(last) && !/%[a-f\d]{2}/i.test(last)) return last;
  const section = parts.slice(0, -1).filter(part => part && !opaqueTitle(part) && !/%[a-f\d]{2}/i.test(part)).join(' / ');
  return section ? `${hostname} — ${section}` : hostname;
}

function storedTitle(source, url) {
  const title = text(source.title);
  if (!title || opaqueTitle(title) || /^https?:\/\//i.test(title) || title.toLowerCase() === 'untitled story') return '';
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  return [hostname, url.hostname.toLowerCase()].includes(title.toLowerCase()) ? '' : title;
}

function articleDate(value) {
  const date = text(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return date && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ? date : null;
}

// URL strings remain supported. Stored sources carry fetched metadata through
// every render instead of rebuilding a headline from the URL on each visit.
export function sourceLinkArticles(values) {
  return values.map((value, index) => {
    const saved = value && typeof value === 'object' ? value : {};
    const href = safeUrl(typeof value === 'string' ? value : saved.url);
    if (!href) throw new TypeError('A valid article URL is required');
    const url = new URL(href);
    const title = storedTitle(saved, url) || fallbackTitle(url);
    const description = text(saved.description);
    const excerpt = text(saved.excerpt) || description || `Fictional preview: ${fictionalArticleParagraphs(title)[0]}`;
    return {
      ...saved,
      id: `link-${index + 1}`, url: url.href, title,
      source: url.hostname.replace(/^www\./, ''),
      date: articleDate(saved.date || saved.publishedDate || saved.publishedAt),
      excerpt, description,
      paragraphs: Array.isArray(saved.paragraphs) ? saved.paragraphs.filter(paragraph => typeof paragraph === 'string' && paragraph.trim()) : [],
    };
  });
}
