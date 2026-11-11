import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount } from '../dist/editorial-word-count.js';

test('recognizes explicit numeric draft lengths without treating 500 as over the limit', () => {
  assert.equal(INITIAL_DRAFT_WORD_LIMIT, 500);
  for (const [direction, expected] of [
    ['Write a 501-word draft.', 501],
    ['Generate 1,000 words about the selected sources.', 1000],
    ['Create a 1k-word article.', 1000],
    ['Make it 1.5k words.', 1500],
    ['Target length: 700 words', 700],
    ['600 words', 600],
    ['Please write exactly 500 words.', 500],
    ['Write exactly 500 words.', 500],
    ['Write 300 words.', 300],
  ]) assert.equal(requestedEditorialWordCount(direction), expected, direction);
});

test('recognizes ranges and strict versus inclusive lower bounds', () => {
  for (const [direction, expected] of [
    ['Write 500–700 words.', 700],
    ['Write 500-700 words.', 700],
    ['Aim for 500 to 700 words.', 700],
    ['Draft between 500 and 700 words.', 700],
    ['Write over 500 words.', 501],
    ['More than 500 words, please.', 501],
    ['At least 500 words.', 500],
    ['No fewer than 600 words.', 600],
    ['Not less than 600 words.', 600],
    ['500+ words', 500],
  ]) assert.equal(requestedEditorialWordCount(direction), expected, direction);
});

test('recognizes common written numbers', () => {
  for (const [direction, expected] of [
    ['Write six hundred words.', 600],
    ['Draft one thousand words.', 1000],
    ['Create a seven-hundred-word article.', 700],
    ['Write five hundred and one words.', 501],
    ['Write one thousand two hundred words.', 1200],
    ['More than five hundred words.', 501],
    ['Write five hundred to seven hundred words.', 700],
    ['Make it a thousand words.', 1000],
  ]) assert.equal(requestedEditorialWordCount(direction), expected, direction);
});

test('source descriptions and unrelated numbers do not become requested lengths', () => {
  for (const [direction, expected] of [
    ['The source is 1,000 words; write 300 words.', 300],
    ['The source is 1,000 words, write 300 words.', 300],
    ['Use the 1,000-word source to write a 300-word draft.', 300],
    ['Expand a 1,000-word source into a 300-word draft.', 300],
    ['The source contains 1,000 words.', null],
    ['The existing article is 1,000 words.', null],
    ['Write 300 words based on a source of 1,000 words.', 300],
    ['Use 500 characters and cite the 2026 report.', null],
    ['Include the number 1000 in the title.', null],
  ]) assert.equal(requestedEditorialWordCount(direction), expected, direction);
});

test('negated lengths and upper bounds do not falsely require a longer draft', () => {
  for (const [direction, expected] of [
    ['Do not write 1,000 words.', null],
    ["Don't generate a 600-word draft.", null],
    ['Avoid a 700-word article.', null],
    ['Write 300 words, not 1,000 words.', 300],
    ['Keep it under 700 words.', null],
    ['No more than 500 words.', null],
    ['Do not exceed 500 words.', null],
    ['Write 1000 words; do not exceed 500 words.', 500],
    ['Write 600 words, but keep it under 500 words.', 499],
    ['Write 700 words, with a maximum of 800 words.', 700],
    ['Avoid jargon; write 600 words.', 600],
    ['Write 1,000 words. Actually, make it 300 words.', 300],
  ]) assert.equal(requestedEditorialWordCount(direction), expected, direction);
});

test('invalid input is harmless and repeated calls do not retain parser state', () => {
  for (const direction of [null, undefined, false, 600, {}, [], '', '   ']) assert.equal(requestedEditorialWordCount(direction), null);
  for (let index = 0; index < 3; index++) {
    assert.equal(requestedEditorialWordCount('Write 600 words.'), 600);
    assert.equal(requestedEditorialWordCount('The source is 900 words.'), null);
  }
  assert.equal(requestedEditorialWordCount('x'.repeat(8000) + ' Write 1000 words.'), null);
});
