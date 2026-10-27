import test from 'node:test';
import assert from 'node:assert/strict';
import { storyMetadata } from '../dist/story-metadata.js';

test('SEO title and description reflect the open draft and normalize whitespace', () => {
  assert.deepEqual(storyMetadata('  Community  Garden\nOpens ', 'Neighbors gathered to plant vegetables.  A second sentence adds context.'), {
    seoTitle: 'Community Garden Opens', metaDescription: 'Neighbors gathered to plant vegetables.',
    seoKeywords: 'community, garden, opens, neighbors, gathered, plant, vegetables',
  });
});

test('long descriptions stop at a complete word and stay within the original 180-character limit', () => {
  const metadata = storyMetadata('A useful headline', 'Community members '.repeat(20));
  assert.equal(metadata.metaDescription.length <= 180, true);
  assert.equal(metadata.metaDescription.endsWith('members…') || metadata.metaDescription.endsWith('Community…'), true);
  assert.equal(metadata.seoKeywords.split(', ').length <= 7, true);
});

test('keywords weight headline words and preserve Unicode and apostrophes', () => {
  const metadata = storyMetadata('Café Community', 'Community members visit the café. The community’s garden grows.');
  assert.equal(metadata.seoKeywords.startsWith('community, café'), true);
  assert.equal(metadata.seoKeywords.includes('the'), false);
  assert.equal(metadata.seoKeywords.includes('community’s'), false);
});

test('blank or missing draft fields produce empty values without stale metadata', () => {
  assert.deepEqual(storyMetadata(undefined, null), { seoTitle: '', metaDescription: '', seoKeywords: '' });
  assert.equal(storyMetadata('New draft', '').metaDescription, '');
});
