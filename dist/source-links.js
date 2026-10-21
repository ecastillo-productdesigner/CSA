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
      // An embedded URL in a query or fragment belongs to the current link.
      if (!/[?#]/.test(prefix) && safeUrl(prefix)) {
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

// Cards reflect the submitted links; no article metadata is fetched in this demo.
export function sourceLinkArticles(urls) {
  return urls.map((value, index) => {
    const url = new URL(value);
    const source = url.hostname.replace(/^www\./, '');
    const slug = url.pathname.split('/').filter(Boolean).pop() || '';
    let title = slug;
    try { title = decodeURIComponent(slug); } catch { /* Keep malformed escapes as submitted. */ }
    title = title.replace(/\.(?:html?|aspx?|php)$/i, '').replace(/[-_]+/g, ' ').trim();
    return {
      id: `link-${index + 1}`, url: url.href, title: title || source,
      source, date: null, excerpt: url.href, paragraphs: [],
    };
  });
}
