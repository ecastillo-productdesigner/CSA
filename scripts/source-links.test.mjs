import test from 'node:test';
import assert from 'node:assert/strict';
import { fictionalArticleParagraphs, formatSourceLinks, parseSourceLinks, sourceLinkArticles } from '../dist/source-links.js';
import { sourcePreviewParagraphs } from '../dist/sources.js';

test('pasted adjacent links are displayed on separate lines and parsed separately',()=>{
  const pasted='https://www.charlotteobserver.com/https://www.charlotteobserver.com/';
  assert.equal(formatSourceLinks(pasted),'https://www.charlotteobserver.com/\nhttps://www.charlotteobserver.com/');
  assert.equal(parseSourceLinks(pasted).length,2);
});
test('spaces, newlines, and list separators produce one line per link',()=>{
  assert.equal(formatSourceLinks('https://example.com/a https://example.org/b'), 'https://example.com/a\nhttps://example.org/b');
  assert.equal(formatSourceLinks('https://example.com/a,https://example.org/b;www.example.net'), 'https://example.com/a\nhttps://example.org/b\nwww.example.net');
  assert.deepEqual(parseSourceLinks('example.com\nwww.example.org'),['https://example.com/','https://www.example.org/']);
});
test('search topics and mixed prose remain intact instead of dropping text',()=>{
  for(const input of ['local music news','news about https://example.com and https://example.org','']) {
    assert.equal(formatSourceLinks(input),input);
    assert.equal(parseSourceLinks(input),null);
  }
});
test('embedded query and fragment URLs remain part of a single link',()=>{
  for(const input of ['https://example.com/?redirect=https://other.example/a','https://example.com/?first=1&redirect=http://other.example/a?next=https://third.example/','https://example.com/#https://other.example']) {
    assert.equal(formatSourceLinks(input),input);
    assert.deepEqual(parseSourceLinks(input),[input]);
  }
});
test('adjacent article links after a query value split individually and retain duplicates', () => {
  const urls = [
    'https://www.charlotteobserver.com/news/business/article317692436.html?tbref=hp',
    'https://www.charlotteobserver.com/latest-news/article317649444.html',
    'https://www.charlotteobserver.com/latest-news/article317649444.html',
  ];
  const pasted = urls.join('');
  assert.deepEqual(parseSourceLinks(pasted), urls);
  assert.equal(formatSourceLinks(pasted), urls.join('\n'));
  assert.deepEqual(parseSourceLinks(formatSourceLinks(pasted)), urls);
});
test('a four-link paste ending with a homepage produces four independently selectable cards', () => {
  const urls = [
    'https://www.charlotteobserver.com/news/business/article317692436.html?tbref=hp',
    'https://www.charlotteobserver.com/latest-news/article317649444.html',
    'https://www.charlotteobserver.com/news/local/article317529012.html',
    'https://www.charlotteobserver.com/',
  ];
  const pasted = urls.join('');
  assert.equal(formatSourceLinks(pasted), urls.join('\n'));
  const cards = sourceLinkArticles(parseSourceLinks(pasted));
  assert.deepEqual(cards.map(card => card.url), urls);
  assert.equal(new Set(cards.map(card => card.id)).size, 4);
});
test('formatting preserves an empty next line while adding more links',()=>{
  const input='https://example.com/a\nhttps://example.org/b\n';
  assert.equal(formatSourceLinks(input),input);
  assert.deepEqual(parseSourceLinks(input),['https://example.com/a','https://example.org/b']);
});

test('pasted links produce one selectable card each while retaining the complete source URL', () => {
  const urls = parseSourceLinks('https://example.com/creative-project?edition=2#story https://news.example.org/a-new-chapter.html');
  const cards = sourceLinkArticles(urls);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map(card => card.url), urls);
  assert.deepEqual(cards.map(card => card.title), ['creative project', 'a new chapter']);
  assert.equal(cards[0].source, 'example.com');
  assert.ok(cards.every(card => card.date === null && card.paragraphs.length === 0));
  assert.ok(cards.every(card => card.excerpt.split(/\s+/).length > 15));
  assert.ok(cards.every(card => !card.excerpt.includes(card.url) && !card.excerpt.includes(card.source)));
});

test('link cards handle root pages, encoded paths and duplicates without sharing selection IDs', () => {
  const cards = sourceLinkArticles(['https://www.example.com/', 'https://example.com/caf%C3%A9-news', 'https://example.com/caf%C3%A9-news', 'https://example.com/%E0%A4%A']);
  assert.ok(cards[0].title.split(/\s+/).length > 3);
  assert.ok(!cards[0].title.includes(cards[0].source));
  assert.equal(cards[1].title, 'café news');
  assert.equal(new Set(cards.map(card => card.id)).size, 4);
  assert.equal(cards[3].title, '%E0%A4%A');
});

test('opaque article IDs use fictional headlines consistently without altering source facts', () => {
  const urls = [
    'https://www.charlotteobserver.com/latest-news/article317649444.html?edition=2#story',
    'https://example.com/article123',
    'https://example.com/123456',
  ];
  const cards = sourceLinkArticles([...urls, urls[0]]);
  assert.deepEqual(cards.slice(0, 3).map(card => card.url), urls);
  assert.ok(cards.every(card => card.title.split(/\s+/).length > 3 && !/article\d+/i.test(card.title)));
  assert.ok(cards.every(card => card.date === null));
  assert.equal(cards[0].source, 'charlotteobserver.com');
  assert.equal(cards[0].title, cards[3].title);
  assert.equal(cards[0].excerpt, cards[3].excerpt);
  assert.notEqual(cards[0].id, cards[3].id);
});

test('URL-only Sources preview matches center article preview without saving demo text', () => {
  const source = { type: 'link', title: 'article317649444', url: 'https://www.charlotteobserver.com/latest-news/article317649444.html', selected: true };
  const original = structuredClone(source);
  const article = sourceLinkArticles([source.url])[0];
  assert.deepEqual(sourcePreviewParagraphs(source), fictionalArticleParagraphs(article.title));
  assert.equal(sourcePreviewParagraphs(source).length, 5);
  assert.deepEqual(source, original);
  assert.deepEqual(article.paragraphs, []);
});

test('Sources preview preserves saved article and document text instead of substituting demo copy', () => {
  assert.deepEqual(sourcePreviewParagraphs({ type: 'link', title: 'Saved article', url: 'https://example.com/story', text: 'Original introduction.\n\nOriginal conclusion.' }), ['Original introduction.', 'Original conclusion.']);
  assert.deepEqual(sourcePreviewParagraphs({ type: 'file', title: 'Notes', text: 'Document contents.' }), ['Document contents.']);
  assert.deepEqual(sourcePreviewParagraphs({ type: 'link', title: 'Legacy article', text: 'Fictional sample article · The State · 2026-10-12\n\nSaved fictional article.' }), ['Saved fictional article.']);
});
