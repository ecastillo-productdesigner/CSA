const caches = new WeakMap();
const maximumConcurrency = 3;
const maximumHtmlLength = 2_000_000;
const sensitiveParameter = /^(?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|key|auth|authorization|signature|sig|credential|credentials|password|passwd|session|sessionid|jwt|code|x-amz-.+|x-goog-.+)$/i;

function text(value, maximum = 700) {
  if (typeof value !== 'string') return '';
  return value.replace(/&#(x[\da-f]+|\d+);|&(amp|quot|apos|lt|gt|nbsp);/gi, (match, numeric, named) => {
    if (named) return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[named.toLowerCase()];
    const code = numeric[0].toLowerCase() === 'x' ? Number.parseInt(numeric.slice(1), 16) : Number.parseInt(numeric, 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
  }).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function headline(value) {
  const title = text(value);
  return /^(?:just a moment(?:\.{0,3})?|access denied|forbidden|403(?: forbidden)?|404(?: not found)?|page not found|checking your browser|verify you are human|attention required!?)(?:\s*[|—-].*)?$/i.test(title) ? '' : title;
}

function publicUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host.includes('.') && !host.includes(':')) return null;
  if (host === 'localhost' || /\.(?:localhost|local|internal|lan|home|test|invalid|onion)$/.test(host)) return null;
  if (/^[\d.]+$/.test(host)) {
    const [a, b, c] = host.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19].includes(b))
      || (a === 192 && b === 0) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return null;
  } else if (host.includes(':') && (!/^[23][\da-f]{0,3}:/.test(host) || /^2001:db8(?::|$)/.test(host))) return null;
  return url;
}

function relayAllowed(url) {
  if ([...url.searchParams.keys()].some(key => sensitiveParameter.test(key))) return false;
  if (/(?:^|[?&#])(?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|auth|authorization|signature|sig|credential|password|session|jwt|code)=/i.test(url.hash)) return false;
  return !/\/(?:tokens?|signed|auth|sessions?|reset-password|password-reset)(?:\/|$)/i.test(url.pathname);
}

function fallback(value, metadataStatus = 'fallback') {
  let url;
  try { url = new URL(value); } catch { return { url: String(value ?? ''), title: text(String(value ?? '')) || 'Article link', description: '', headlineSource: 'url', metadataStatus }; }
  let slug = url.pathname.split('/').filter(Boolean).pop() || '';
  try { slug = decodeURIComponent(slug); } catch { /* A malformed escape can still be shown as a link. */ }
  slug = text(slug.replace(/\.(?:html?|aspx?|php)$/i, '').replace(/[-_]+/g, ' '));
  const usableSlug = !url.username && !url.password && relayAllowed(url) && slug && !/^(?:article\s*)?\d+$/i.test(slug);
  return { url: url.href, title: usableSlug ? slug : url.hostname.replace(/^www\./, '') || 'Article link', description: '', headlineSource: 'url', metadataStatus };
}

function defaultParseHtml(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function meta(document, selector) {
  return text(document.querySelector(selector)?.getAttribute('content'), 2000);
}

export function extractArticleMetadata(document, url) {
  const articles = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.some(type => typeof type === 'string' && /(?:^|\/)\w*Article$/i.test(type)) && headline(value.headline)) articles.push(value);
    for (const nested of Object.values(value)) if (nested && typeof nested === 'object') visit(nested);
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.textContent)); } catch { /* Other valid metadata may still be available. */ }
  }
  const identities = article => [article.url, article['@id'], article.mainEntityOfPage?.['@id'], article.mainEntityOfPage].filter(value => typeof value === 'string');
  const matchesUrl = article => identities(article).some(value => value.split('#')[0] === url.split('#')[0]);
  const article = articles.find(matchesUrl) || articles.find(value => !identities(value).length);
  const h1 = document.querySelector('article h1') || document.querySelector('[itemprop="headline"]') || document.querySelector('main h1') || document.querySelector('h1');
  const choices = [
    ['json-ld', article?.headline], ['article-h1', h1?.textContent], ['json-ld', articles[0]?.headline],
    ['og-title', meta(document, 'meta[property="og:title"]')],
    ['twitter-title', meta(document, 'meta[name="twitter:title"]') || meta(document, 'meta[property="twitter:title"]')],
    ['document-title', document.querySelector('title')?.textContent],
  ];
  const selected = choices.find(([, value]) => headline(value));
  if (!selected) return null;
  return {
    title: headline(selected[1]),
    description: text(article?.description, 2000) || meta(document, 'meta[property="og:description"]') || meta(document, 'meta[name="description"]') || meta(document, 'meta[name="twitter:description"]'),
    headlineSource: selected[0],
  };
}

async function boundedRequest(fetcher, url, timeout, signal, read) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(url, { method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (!response.ok) throw new Error('Metadata request failed');
    return await read(response);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

async function resolveOne(url, { fetcher, parseHtml, directTimeoutMs, relayTimeoutMs }, signal) {
  const empty = fallback(url.href);
  try {
    const direct = await boundedRequest(fetcher, url.href, directTimeoutMs, signal, async response => {
      const contentType = response.headers?.get('content-type') || '';
      if (contentType && !/(?:html|xhtml)/i.test(contentType)) throw new Error('Not an HTML page');
      const html = await response.text();
      if (html.length > maximumHtmlLength) throw new Error('HTML is too large');
      return extractArticleMetadata(parseHtml(html), response.url || url.href);
    });
    if (direct) return { url: url.href, ...direct, metadataStatus: 'resolved' };
  } catch { /* CORS restrictions, timeouts and inaccessible pages use the bounded fallback below. */ }
  if (signal.aborted) return { ...empty, metadataStatus: 'aborted' };
  if (!relayAllowed(url)) return empty;
  const endpoint = new URL('https://api.microlink.io/');
  endpoint.searchParams.set('url', url.href);
  endpoint.searchParams.set('data.visibleHeadline.selector', 'h1');
  endpoint.searchParams.set('data.visibleHeadline.attr', 'text');
  endpoint.searchParams.set('data.visibleHeadline.type', 'string');
  try {
    const result = await boundedRequest(fetcher, endpoint.href, relayTimeoutMs, signal, response => response.json());
    if (result.status !== 'success' || (result.statusCode && result.statusCode >= 400)) return empty;
    const visible = headline(result.data?.visibleHeadline);
    const title = visible || headline(result.data?.title);
    if (!title) return empty;
    return { url: url.href, title, description: text(result.data?.description, 2000), headlineSource: visible ? 'microlink-h1' : 'microlink-title', metadataStatus: 'resolved' };
  } catch { return { ...empty, ...(signal.aborted ? { metadataStatus: 'aborted' } : {}) }; }
}

function cacheScope(fetcher) {
  let scope = caches.get(fetcher);
  if (!scope) { scope = { records: new Map(), queue: [], running: 0 }; caches.set(fetcher, scope); }
  return scope;
}

function queueWork(scope, callback) {
  return new Promise(resolve => {
    scope.queue.push({ callback, resolve });
    function drain() {
      while (scope.running < maximumConcurrency && scope.queue.length) {
        const next = scope.queue.shift();
        scope.running += 1;
        Promise.resolve().then(next.callback).then(next.resolve, () => next.resolve(null)).finally(() => { scope.running -= 1; drain(); });
      }
    }
    drain();
  });
}

function subscribe(entry, empty, signal) {
  if (signal?.aborted) return Promise.resolve({ ...empty, metadataStatus: 'aborted' });
  return new Promise(resolve => {
    const consumer = {};
    entry.consumers.add(consumer);
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', onAbort);
      entry.consumers.delete(consumer);
      resolve({ ...(value || empty), url: empty.url });
    };
    const onAbort = () => {
      finish({ ...empty, metadataStatus: 'aborted' });
      if (!entry.settled && !entry.consumers.size) entry.controller.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(finish);
  });
}

export async function resolveArticleMetadata(urls, options = {}) {
  const values = Array.from(urls || []);
  const fetcher = options.fetch || globalThis.fetch;
  const parseHtml = options.parseHtml || defaultParseHtml;
  const signal = options.signal;
  if (typeof fetcher !== 'function') return values.map(value => fallback(value));
  const scope = cacheScope(fetcher);
  const configuration = { fetcher, parseHtml, directTimeoutMs: options.directTimeoutMs ?? 8000, relayTimeoutMs: options.relayTimeoutMs ?? 20000 };
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      const value = values[index];
      const url = publicUrl(value);
      const empty = fallback(value, signal?.aborted ? 'aborted' : 'fallback');
      if (!url || signal?.aborted) { results[index] = empty; continue; }
      const key = url.href;
      let entry = scope.records.get(key);
      if (!entry || entry.controller.signal.aborted) {
        entry = { controller: new AbortController(), consumers: new Set(), settled: false, promise: null };
        scope.records.set(key, entry);
        const current = entry;
        entry.promise = queueWork(scope, () => current.controller.signal.aborted ? { ...empty, metadataStatus: 'aborted' } : resolveOne(url, configuration, current.controller.signal)).then(result => {
          current.settled = true;
          if (result?.metadataStatus !== 'resolved' && scope.records.get(key) === current) scope.records.delete(key);
          return result || empty;
        });
      }
      results[index] = await subscribe(entry, empty, signal);
    }
  }
  const concurrency = Math.max(1, Math.min(maximumConcurrency, Number.isInteger(options.concurrency) ? options.concurrency : maximumConcurrency));
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}
