import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProjectSearchInput } from '../dist/project-search-input.js';
import { parseSourceLinks } from '../dist/source-links.js';

test('blank project searches are empty and non-text input is invalid', () => {
  for (const input of ['', '  ', '\n\t']) {
    assert.deepEqual(classifyProjectSearchInput(input), { kind: 'empty' });
  }
  for (const input of [null, undefined, 42]) {
    assert.deepEqual(classifyProjectSearchInput(input), { kind: 'invalid' });
  }
});

test('project topics retain punctuation and normalize multiline whitespace', () => {
  const cases = [
    ['  local\n\tmusic   news  ', 'local music news'],
    ['U.S. fashion', 'U.S. fashion'],
    ['U.S fashion', 'U.S fashion'],
    ['e.g. fashion and food', 'e.g. fashion and food'],
    ['Dr. Smith on wellness.', 'Dr. Smith on wellness.'],
    ['Ph.D. students and mental health', 'Ph.D. students and mental health'],
    ['Fashion: spring trends', 'Fashion: spring trends'],
    ['What’s new in fashion? Style, comfort & cost.', 'What’s new in fashion? Style, comfort & cost.'],
    ['Version 2.0 of the housing plan', 'Version 2.0 of the housing plan'],
    ['The “new look” — what changed?', 'The “new look” — what changed?'],
  ];
  for (const [input, query] of cases) {
    assert.deepEqual(classifyProjectSearchInput(input), { kind: 'search', query }, input);
  }
});

test('valid source links retain all behavior of the existing link parser', () => {
  for (const input of [
    'https://example.com/story',
    'example.com\nwww.example.org/news',
    'https://example.com/a,https://example.org/b;www.example.net',
    'https://example.com/ahttps://example.org/b',
    'https://example.com/?redirect=https://other.example/a',
    'http://localhost:4173/article',
    'https://example.com/a\nhttps://example.com/a',
  ]) {
    assert.deepEqual(classifyProjectSearchInput(input), { kind: 'links', urls: parseSourceLinks(input) }, input);
  }
});

test('malformed URLs and unsupported schemes do not silently become topic searches', () => {
  for (const input of [
    'https://', 'http:/example.com', 'https//example.com', 'htps://example.com',
    'https ://example.com', 'www.', 'www . example.com',
    'ftp://example.com', 'mailto:editor@example.com', 'javascript:alert(1)',
    'data:text/html,hello', 'file:///tmp/article', 'tel:5551234',
    'example..com', '.example.com', 'example.c', '192.168.1.1',
    'example.com:invalid-port', 'example.com,example.net',
  ]) {
    assert.deepEqual(classifyProjectSearchInput(input), { kind: 'invalid' }, input);
  }
});

test('mixed topics and links are rejected rather than dropping the topic or searching the URLs', () => {
  for (const input of [
    'news about https://example.com',
    'https://example.com\nwellness news',
    'style.com trends',
    'example.com and example.org',
    'Review (example.com).',
    'Editor editor@example.com',
    'Read www.example.org next',
  ]) {
    assert.deepEqual(classifyProjectSearchInput(input), { kind: 'invalid' }, input);
  }
});
