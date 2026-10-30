import test from 'node:test';
import assert from 'node:assert/strict';
import { customVariantName, savedVariantName, initializeVariantNames } from '../dist/outputs.js';

const variant = (id, extra = {}) => ({ id, title: `Article ${id}`, draftText: 'Approved article content', isFavorite: true, favoritedAt: Number(id), ...extra });
const projects = outputs => [{ id: 'project', outputs }];

test('legacy article titles remain headings and unnamed saved variants receive numbered labels', () => {
  const first = variant('1', { name: 'Article 1' });
  const custom = variant('2', { name: 'Weekend feature' });
  const third = variant('3');
  initializeVariantNames(projects([first, custom, third]));
  assert.equal(savedVariantName(first), 'Saved Draft 1');
  assert.equal(savedVariantName(custom), 'Weekend feature');
  assert.equal(savedVariantName(third), 'Saved Draft 2');
  assert.equal(custom.title, 'Article 2');
  assert.equal(custom.draftText, 'Approved article content');
});

test('numbered names stay stable through sorting, removal, and saving another variant', () => {
  const first = variant('1');
  const second = variant('2');
  initializeVariantNames(projects([second, first]));
  first.isFavorite = false;
  second.favoritedAt = 100;
  const third = variant('3');
  initializeVariantNames(projects([third, second, first]));
  assert.equal(savedVariantName(second), 'Saved Draft 2');
  assert.equal(savedVariantName(third), 'Saved Draft 3');
  first.isFavorite = true;
  initializeVariantNames(projects([first, second, third]));
  assert.equal(savedVariantName(first), 'Saved Draft 1');
});

test('editing an article heading does not turn an automatic name into a custom saved name', () => {
  const output = variant('1', { name: 'Article 1' });
  initializeVariantNames(projects([output]));
  output.title = 'A revised article heading';
  initializeVariantNames(projects([output]));
  assert.equal(customVariantName(output), '');
  assert.equal(savedVariantName(output), 'Saved Draft 1');
});

test('custom saved names can match the heading and clearing one restores its numbered label', () => {
  const output = variant('1');
  initializeVariantNames(projects([output]));
  output.name = output.title;
  output.nameEdited = true;
  assert.equal(savedVariantName(output), 'Article 1');
  output.name = '';
  output.nameEdited = false;
  initializeVariantNames(projects([output]));
  assert.equal(savedVariantName(output), 'Saved Draft 1');
  assert.equal(output.title, 'Article 1');
});
