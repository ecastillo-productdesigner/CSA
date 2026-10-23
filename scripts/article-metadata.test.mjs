import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleMetadata, resolveArticleMetadata } from '../dist/article-metadata.js';

const articleUrl = 'https://www.charlotteobserver.com/opinion/article317717272.html';
const visibleHeadline = 'NC Democrats see the strongest start to early voting ‘in the entire country’ | Opinion';

function documentFor({ ld = [], h1, articleH1, itemHeadline, mainH1, title, ogTitle, twitterTitle, ogDescription, description } = {}) {
  const nodes = new Map();
  for (const [selector, value] of [['article h1', articleH1], ['[itemprop="headline"]', itemHeadline], ['main h1', mainH1], ['h1', h1], ['title', title]]) {
    if (value !== undefined) nodes.set(selector, { textContent: value });
  }
  for (const [selector, value] of [['meta[property="og:title"]', ogTitle], ['meta[name="twitter:title"]', twitterTitle], ['meta[property="og:description"]', ogDescription], ['meta[name="description"]', description]]) {
    if (value !== undefined) nodes.set(selector, { getAttribute: name => name === 'content' ? value : null });
  }
  return {
    querySelector: selector => nodes.get(selector) || null,
    querySelectorAll: selector => selector === 'script[type="application/ld+json"]' ? ld.map(value => ({ textContent: typeof value === 'string' ? value : JSON.stringify(value) })) : [],
  };
}
const htmlResponse = (html = '<html>fixture</html>', url = articleUrl) => ({ ok: true, status: 200, url, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => html });
const jsonResponse = data => ({ ok: true, status: 200, json: async () => data });
const relayResult = (title = visibleHeadline) => ({ status: 'success', statusCode: 200, data: { visibleHeadline: title, title: 'A different SEO title', description: 'Public description' } });
const flush = () => new Promise(resolve => setImmediate(resolve));

 test('article JSON-LD takes priority over a different SEO title and selects the matching article in a graph', () => {
  const document = documentFor({
    ld: ['{malformed', { '@graph': [
      { '@type': 'NewsArticle', url: 'https://news.example.com/related', headline: 'A different related article' },
      { '@type': ['CreativeWork', 'OpinionNewsArticle'], mainEntityOfPage: { '@id': articleUrl }, headline: visibleHeadline, description: 'Public article summary' },
    ] }],
    articleH1: visibleHeadline,
    title: 'Democrats are off to a strong start in NC early voting | Charlotte Observer',
  });
  assert.deepEqual(extractArticleMetadata(document, articleUrl), { title: visibleHeadline, description: 'Public article summary', headlineSource: 'json-ld' });
});

test('article H1, Open Graph, Twitter and document title form ordered fallbacks without losing punctuation', () => {
  const choices = [
    [{ articleH1: visibleHeadline, h1: 'Site navigation', ogTitle: 'Social title', title: 'SEO title' }, visibleHeadline, 'article-h1'],
    [{ mainH1: 'Families &amp; neighbors: what’s next?', title: 'SEO title' }, 'Families & neighbors: what’s next?', 'article-h1'],
    [{ ogTitle: 'Open Graph title', twitterTitle: 'Twitter title', title: 'Document title' }, 'Open Graph title', 'og-title'],
    [{ twitterTitle: 'Twitter title', title: 'Document title' }, 'Twitter title', 'twitter-title'],
    [{ title: 'Document title' }, 'Document title', 'document-title'],
  ];
  for (const [fixture, title, headlineSource] of choices) {
    assert.deepEqual(extractArticleMetadata(documentFor(fixture), articleUrl), { title, description: '', headlineSource });
  }
  assert.equal(extractArticleMetadata(documentFor({ title: 'Just a moment...' }), articleUrl), null);
  assert.equal(extractArticleMetadata(documentFor(), articleUrl), null);
});

test('direct fetch omits credentials and referrers, parses inertly and returns metadata without retaining HTML', async () => {
  const calls = [];
  const parsed = [];
  const result = await resolveArticleMetadata([articleUrl], {
    fetch: async (url, options) => { calls.push({ url, options }); return htmlResponse('<html>public metadata only</html>'); },
    parseHtml: html => { parsed.push(html); return documentFor({ h1: visibleHeadline, description: 'Public summary' }); },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, articleUrl);
  assert.equal(calls[0].options.mode, 'cors');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.deepEqual(parsed, ['<html>public metadata only</html>']);
  assert.deepEqual(result, [{ url: articleUrl, title: visibleHeadline, description: 'Public summary', headlineSource: 'article-h1', metadataStatus: 'resolved' }]);
  assert.equal('html' in result[0], false);
});

test('CORS failure falls back to one keyless Microlink call and prefers its visible H1', async () => {
  const calls = [];
  const result = await resolveArticleMetadata([articleUrl], {
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (!url.startsWith('https://api.microlink.io/')) throw new TypeError('CORS blocked');
      return jsonResponse(relayResult());
    },
  });
  assert.equal(calls.length, 2);
  const endpoint = new URL(calls[1].url);
  assert.equal(endpoint.searchParams.get('url'), articleUrl);
  assert.equal(endpoint.searchParams.get('data.visibleHeadline.selector'), 'h1');
  assert.equal(endpoint.searchParams.get('data.visibleHeadline.attr'), 'text');
  assert.equal(endpoint.searchParams.get('data.visibleHeadline.type'), 'string');
  assert.equal(calls[1].options.credentials, 'omit');
  assert.equal(calls[1].options.referrerPolicy, 'no-referrer');
  assert.equal(result[0].title, visibleHeadline);
  assert.equal(result[0].headlineSource, 'microlink-h1');
});

test('unavailable metadata returns readable URL or hostname fallbacks and never drops a source', async () => {
  const urls = ['https://news.example.com/what-happens-next.html', 'https://news.example.com/article317717272.html', 'not a link'];
  const result = await resolveArticleMetadata(urls, { fetch: async () => ({ ok: false, status: 429 }) });
  assert.equal(result.length, urls.length);
  assert.deepEqual(result.map(value => value.url), urls);
  assert.deepEqual(result.map(value => value.title), ['what happens next', 'news.example.com', 'not a link']);
  assert.equal(result.every(value => value.metadataStatus === 'fallback' && value.headlineSource === 'url'), true);
  assert.equal(result.some(value => /Neighborhood Project|Local Business|Unexpected Collaboration/.test(value.title)), false);
});

test('private, local, non-http and credentialed URLs are never fetched or relayed', async () => {
  const urls = ['http://localhost/story', 'http://127.0.0.1/story', 'http://2130706433/story', 'http://10.0.0.1/story', 'http://172.16.3.2/story', 'http://192.168.1.2/story', 'http://169.254.169.254/latest', 'http://[::1]/story', 'http://[fd00::1]/story', 'http://printer.local/story', 'https://intranet/story', 'https://user:secret@news.example.com/story', 'file:///tmp/story.html'];
  let calls = 0;
  const result = await resolveArticleMetadata(urls, { fetch: async () => { calls++; throw new Error('Must not fetch'); } });
  assert.equal(calls, 0);
  assert.equal(result.length, urls.length);
  assert.equal(result.every(value => value.metadataStatus === 'fallback'), true);
});

test('signed and token URLs may fetch directly but are never sent to the third-party relay', async () => {
  const urls = ['https://news.example.com/story?token=private', 'https://news.example.com/story?X-Amz-Signature=private', 'https://news.example.com/story#access_token=private', 'https://news.example.com/token/private', 'https://news.example.com/story?api_key=private'];
  const calls = [];
  const results = await resolveArticleMetadata(urls, { fetch: async url => { calls.push(url); throw new Error('Direct blocked'); } });
  assert.deepEqual(calls.sort(), [...urls].sort());
  assert.equal(calls.some(url => url.startsWith('https://api.microlink.io/')), false);
  assert.equal(results.every(value => value.metadataStatus === 'fallback' && value.title === 'news.example.com'), true);
  const direct = await resolveArticleMetadata([urls[0]], { fetch: async () => htmlResponse(), parseHtml: () => documentFor({ h1: 'A valid public headline' }) });
  assert.equal(direct[0].title, 'A valid public headline');
});

test('batch results preserve input order while all callers share a three-request concurrency ceiling', async () => {
  const pending = [];
  let active = 0;
  let peak = 0;
  const fetch = url => new Promise(resolve => {
    active++;
    peak = Math.max(active, peak);
    pending.push({ url, finish() { active--; resolve(htmlResponse(url, url)); } });
  });
  const parseHtml = html => documentFor({ h1: `Headline for ${new URL(html).pathname}` });
  const urls = Array.from({ length: 5 }, (_, index) => `https://news.example.com/story-${index}`);
  const first = resolveArticleMetadata(urls, { fetch, parseHtml });
  const second = resolveArticleMetadata(['https://news.example.com/another'], { fetch, parseHtml });
  await flush();
  assert.equal(pending.length, 3);
  pending[2].finish();
  await flush();
  pending[0].finish();
  await flush();
  pending[1].finish();
  await flush();
  assert.equal(pending.length, 6);
  pending.slice(3).reverse().forEach(request => request.finish());
  const result = await first;
  await second;
  assert.equal(peak, 3);
  assert.deepEqual(result.map(value => value.url), urls);
  assert.deepEqual(result.map(value => value.title), urls.map(value => `Headline for ${new URL(value).pathname}`));
});

test('duplicate URLs share in-flight work and successful metadata is cached without retaining a body', async () => {
  let finish;
  let calls = 0;
  const fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const parseHtml = () => documentFor({ h1: visibleHeadline });
  const first = resolveArticleMetadata([articleUrl, articleUrl], { fetch, parseHtml });
  const second = resolveArticleMetadata([articleUrl], { fetch, parseHtml });
  await flush();
  assert.equal(calls, 1);
  finish(htmlResponse());
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one.length, 2);
  assert.deepEqual(one[0], two[0]);
  const cached = await resolveArticleMetadata([articleUrl], { fetch, parseHtml });
  assert.equal(calls, 1);
  assert.equal(cached[0].title, visibleHeadline);
});

test('failed lookups are not permanently cached, so a later successful fetch can recover', async () => {
  let succeeds = false;
  let calls = 0;
  const fetch = async () => { calls++; return succeeds ? htmlResponse() : { ok: false, status: 503 }; };
  const parseHtml = () => documentFor({ h1: 'Recovered headline' });
  assert.equal((await resolveArticleMetadata([articleUrl], { fetch, parseHtml }))[0].metadataStatus, 'fallback');
  assert.equal(calls, 2);
  succeeds = true;
  assert.equal((await resolveArticleMetadata([articleUrl], { fetch, parseHtml }))[0].title, 'Recovered headline');
  assert.equal(calls, 3);
});

test('aborting one shared caller does not cancel another caller that still needs the result', async () => {
  const aborter = new AbortController();
  let finish;
  let requestSignal;
  let calls = 0;
  const fetch = (url, options) => { calls++; requestSignal = options.signal; return new Promise(resolve => { finish = resolve; }); };
  const parseHtml = () => documentFor({ h1: visibleHeadline });
  const first = resolveArticleMetadata([articleUrl], { fetch, parseHtml, signal: aborter.signal });
  const second = resolveArticleMetadata([articleUrl], { fetch, parseHtml });
  await flush();
  aborter.abort();
  assert.equal((await first)[0].metadataStatus, 'aborted');
  assert.equal(requestSignal.aborted, false);
  finish(htmlResponse());
  assert.equal((await second)[0].title, visibleHeadline);
  assert.equal(calls, 1);
});

test('aborting the only caller cancels its network request and does not start the relay', async () => {
  const aborter = new AbortController();
  let calls = 0;
  let requestSignal;
  const fetch = (url, options) => {
    calls++;
    requestSignal = options.signal;
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  };
  const work = resolveArticleMetadata([articleUrl], { fetch, signal: aborter.signal });
  await flush();
  aborter.abort();
  assert.equal((await work)[0].metadataStatus, 'aborted');
  await flush();
  assert.equal(requestSignal.aborted, true);
  assert.equal(calls, 1);
  const stopped = new AbortController();
  stopped.abort();
  assert.equal((await resolveArticleMetadata([articleUrl], { fetch, signal: stopped.signal }))[0].metadataStatus, 'aborted');
  assert.equal(calls, 1);
});

test('direct timeouts are bounded and can recover through the relay without using credentials', async () => {
  let directAborted = false;
  const result = await resolveArticleMetadata([articleUrl], {
    directTimeoutMs: 5,
    relayTimeoutMs: 100,
    fetch: (url, options) => {
      if (url.startsWith('https://api.microlink.io/')) return Promise.resolve(jsonResponse(relayResult()));
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { directAborted = true; reject(new DOMException('Timeout', 'AbortError')); }, { once: true }));
    },
  });
  assert.equal(directAborted, true);
  assert.equal(result[0].headlineSource, 'microlink-h1');
  assert.equal(result[0].metadataStatus, 'resolved');
});


test('a related article’s structured headline cannot override the current page’s visible H1', () => {
  const document = documentFor({
    ld: [{ '@type': 'NewsArticle', url: 'https://news.example.com/related-story', headline: 'A related story' }],
    articleH1: visibleHeadline,
    title: 'Different SEO title',
  });
  assert.equal(extractArticleMetadata(document, articleUrl).title, visibleHeadline);
  assert.equal(extractArticleMetadata(document, articleUrl).headlineSource, 'article-h1');
});
