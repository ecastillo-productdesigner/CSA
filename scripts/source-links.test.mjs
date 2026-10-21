import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSourceLinks, parseSourceLinks, sourceLinkArticles } from '../dist/source-links.js';

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
  for(const input of ['https://example.com/?redirect=https://other.example/a','https://example.com/#https://other.example']) {
    assert.equal(formatSourceLinks(input),input);
    assert.deepEqual(parseSourceLinks(input),[input]);
  }
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
});

test('link cards handle root pages, encoded paths and duplicates without sharing selection IDs', () => {
  const cards = sourceLinkArticles(['https://www.example.com/', 'https://example.com/caf%C3%A9-news', 'https://example.com/caf%C3%A9-news', 'https://example.com/%E0%A4%A']);
  assert.equal(cards[0].title, 'example.com');
  assert.equal(cards[1].title, 'café news');
  assert.equal(new Set(cards.map(card => card.id)).size, 4);
  assert.equal(cards[3].title, '%E0%A4%A');
});
