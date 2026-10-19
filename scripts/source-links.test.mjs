import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSourceLinks, parseSourceLinks } from '../dist/source-links.js';

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
