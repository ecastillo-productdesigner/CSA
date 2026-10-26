import test from 'node:test';
import assert from 'node:assert/strict';
import { topicDraftContent } from '../dist/topic-draft.js';

const source = title => ({ type: 'link', title, url: 'https://news.example.com/story', selected: true });
const profiles = [
  ['NC Democrats see a strong start as early voting begins', /early start|campaign/i, /campaign|early start/i],
  ['Early voting locations and hours: Plan before election day', /early voting|calendar/i, /calendar|early voting/i],
  ['Mayoral election debate raises questions for voters', /political development/i, /political development/i],
  ['Court filing raises new legal questions', /stage|case/i, /stage|case/i],
  ['Hurricane forecast brings changing weather', /weather|daily plans/i, /weather|day/i],
  ['Basketball playoff expectations', /sporting moment/i, /sporting|moment/i],
  ['Returning TV show: A fresh entertainment conversation', /familiar work|audience/i, /familiar work|audience/i],
  ['Sleep and wellness research in context', /health|personal concerns/i, /health|personal concern/i],
  ['Fashion shopping guide and wardrobe choices', /style idea|familiar/i, /fashion|familiar/i],
  ['Housing market and business development', /households|workers|businesses/i, /household|worker|business owner/i],
  ['An unfamiliar public issue draws attention', /first impression|questions/i, /first impression|questions/i],
];

test('every topic profile and the fallback supply four meaningful, unnumbered body-section headings', () => {
  for (const [headline, headingSubject, paragraphSubject] of profiles) {
    const draft = topicDraftContent([source(headline)]);
    assert.equal(draft.sectionHeadings.length, 4, headline);
    assert.equal(draft.paragraphs.length, draft.sectionHeadings.length + 1, headline);
    assert.equal(new Set(draft.sectionHeadings).size, 4, headline);
    for (const heading of draft.sectionHeadings) {
      assert.equal(typeof heading, 'string');
      assert.ok(heading.trim().length > 10, headline);
      assert.doesNotMatch(heading, /^\d+[.)]\s/, 'The formatter owns numbering');
    }
    assert.match(draft.sectionHeadings[0], headingSubject, headline);
    assert.match(draft.paragraphs[1], paragraphSubject, headline);
  }
});

test('revisions keep every heading paired with its paragraph and keep the final section last', () => {
  for (const [headline] of profiles) {
    const base = topicDraftContent([source(headline)]);
    const headingForParagraph = new Map(base.paragraphs.slice(1).map((paragraph, index) => [paragraph, base.sectionHeadings[index]]));
    for (const revision of [1, 2, 3, 4, 5, -1, NaN, 2.9]) {
      const revised = topicDraftContent([source(headline)], { revision });
      assert.deepEqual(revised.sectionHeadings, revised.paragraphs.slice(1).map(paragraph => headingForParagraph.get(paragraph)), headline);
      assert.equal(revised.sectionHeadings.at(-1), base.sectionHeadings.at(-1), headline);
    }
  }
});

test('title variants and related sources preserve section alignment without sharing mutable arrays', () => {
  const sources = [source(profiles[0][0]), source('Local organizers explain the turnout context')];
  const before = structuredClone(sources);
  const first = topicDraftContent(sources);
  const nextTitle = topicDraftContent(sources, { variant: 1 });
  assert.notEqual(nextTitle.title, first.title);
  assert.deepEqual(nextTitle.sectionHeadings, first.sectionHeadings);
  assert.deepEqual(nextTitle.paragraphs, first.paragraphs);
  assert.match(first.paragraphs.at(-1), /Local organizers explain the turnout context/);
  first.sectionHeadings[0] = 'Changed only in this caller';
  assert.notEqual(topicDraftContent(sources).sectionHeadings[0], first.sectionHeadings[0]);
  assert.deepEqual(sources, before);
});
