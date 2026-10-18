import test from 'node:test';
import assert from 'node:assert/strict';
import { formatContentPreview, countPreviewWords } from '../dist/content-preview.js';

test('preview retains the six requested content fields and paragraph spacing', () => {
  const text = formatContentPreview({ title: 'A community story', publishedDate: 'Oct 16, 2026', source: 'example.com', paragraphs: ['First paragraph.', 'Second paragraph.'], photoCaptions: ['Neighbors gather. Credit: Jane Doe.'], headings: ['How it started', 'What comes next'] });
  assert.match(text, /^# A community story\nPublished: Oct 16, 2026\nSource: example.com/);
  assert.ok(text.includes('First paragraph.\n\nSecond paragraph.'));
  assert.ok(text.includes('PHOTO CAPTIONS:\n- Neighbors gather. Credit: Jane Doe.'));
  assert.ok(text.includes('ARTICLE HEADINGS:\n- How it started\n- What comes next'));
});

test('missing article metadata stays explicit rather than inventing dates and captions', () => {
  const text = formatContentPreview({ title: 'Sample story', source: 'example.com', paragraphs: ['Sample text.'] });
  assert.match(text, /Published: Not available in this demo/);
  assert.match(text, /No photo captions provided\./);
  assert.match(text, /No article headings provided\./);
});

test('word count handles blank content, line breaks, and edited preview text', () => {
  assert.equal(countPreviewWords(' \n\t'), 0);
  assert.equal(countPreviewWords('One'), 1);
  assert.equal(countPreviewWords('One two\n\nthree\tfour.'), 4);
});
