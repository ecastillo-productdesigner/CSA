import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProjectTitle, normalizeProjectTitles, projectTitleFromSources, projectUpdatedDate, projectContentCountLabel } from '../dist/dashboard.js';

const now = Date.parse('2026-10-20T16:00:00Z');

test('project content counts include adapted and legacy drafts while excluding pending and invalid records', () => {
  const ready = { id: 'ready', title: 'Adapted article', status: 'ready' };
  const pending = { id: 'pending', title: 'Pending article', status: 'pending' };
  const legacy = { id: 'legacy', title: 'Older article', draftText: 'Saved article body' };
  assert.equal(projectContentCountLabel({ outputs: [] }), '0 Pieces of Content');
  assert.equal(projectContentCountLabel({ outputs: [pending, null, { status: 'ready' }] }), '0 Pieces of Content');
  assert.equal(projectContentCountLabel({ outputs: [ready, pending] }), '1 Piece of Content');
  assert.equal(projectContentCountLabel({ outputs: [ready, legacy, pending] }), '2 Pieces of Content');
});

test('project titles lose only a trailing Draft suffix and keep the meaningful name', () => {
  assert.equal(cleanProjectTitle('A neighborhood story — Draft'), 'A neighborhood story');
  assert.equal(cleanProjectTitle('A neighborhood story — draft  '), 'A neighborhood story');
  assert.equal(cleanProjectTitle('Draft of a neighborhood story'), 'Draft of a neighborhood story');
  assert.equal(cleanProjectTitle('A story — Draft notes'), 'A story — Draft notes');
  assert.equal(cleanProjectTitle('— Draft'), 'Untitled story');
});

test('title migration is repeatable and leaves variant headings and activity times untouched', () => {
  const projects = [{ title: 'My project — Draft', updatedAt: 12, outputs: [{ title: 'An article — Draft' }] }];
  assert.equal(normalizeProjectTitles(projects), true);
  assert.equal(projects[0].title, 'My project');
  assert.equal(projects[0].updatedAt, 12);
  assert.equal(projects[0].outputs[0].title, 'An article — Draft');
  assert.equal(normalizeProjectTitles(projects), false);
});

test('link project headings use the first article headline without changing sources', () => {
  const sources = [
    { type: 'link', title: 'A Café Opens a New Chapter', url: 'https://www.charlotteobserver.com/latest-news/article317649444.html' },
    { type: 'link', title: 'Another Story', url: 'https://example.com/another-story' },
  ];
  const original = structuredClone(sources);
  assert.equal(projectTitleFromSources(sources), 'A Café Opens a New Chapter');
  assert.deepEqual(sources, original);
});

test('domain and opaque link titles receive a readable existing demo headline', () => {
  const url = 'https://www.charlotteobserver.com/latest-news/article317649444.html';
  for (const title of ['charlotteobserver.com', 'www.charlotteobserver.com', 'article317649444', 'article317649444.html', '317649444', url, '', undefined, null]) {
    assert.equal(projectTitleFromSources([{ type: 'link', title, url }]), 'A Neighborhood Project Brings a Community Together');
  }
  assert.equal(projectTitleFromSources([{ type: 'link', title: 'charlotteobserver.com', url: 'https://www.charlotteobserver.com/' }]), 'An Unexpected Collaboration Opens a New Chapter');
});

test('only exact automatic domain names migrate and preserve saved sources, URLs, outputs, and dates', () => {
  const joinedUrl = 'https://www.charlotteobserver.com/firsthttps://www.charlotteobserver.com/second';
  const source = { type: 'link', title: 'A Saved Article Heading', url: joinedUrl, selected: false };
  const projects = [
    { title: 'charlotteobserver.com', sources: [source], updatedAt: 12, outputs: [{ title: 'My edited draft', sourceSnapshots: [structuredClone(source)] }] },
    { title: 'My custom project', sources: [structuredClone(source)] },
    { title: 'charlotteobserver.com notes', sources: [structuredClone(source)] },
    { title: 'www.charlotteobserver.com', sources: [structuredClone(source)] },
  ];
  const original = structuredClone(projects);
  assert.equal(normalizeProjectTitles(projects), true);
  assert.equal(projects[0].title, 'A Saved Article Heading');
  assert.deepEqual({ ...projects[0], title: original[0].title }, original[0]);
  assert.deepEqual(projects.slice(1), original.slice(1));
  assert.equal(projects[0].sources[0].url, joinedUrl);
  assert.equal(normalizeProjectTitles(projects), false);
});

test('missing and malformed source URLs cannot interrupt loading saved projects', () => {
  const projects = [undefined, '', 'not a URL', 'https://', 'javascript:alert(1)'].map(url => ({
    title: 'charlotteobserver.com', sources: [{ type: 'link', title: 'Saved article', ...(url === undefined ? {} : { url }) }],
  }));
  const original = structuredClone(projects);
  assert.equal(normalizeProjectTitles(projects), false);
  assert.deepEqual(projects, original);
  for (const project of projects) assert.equal(projectTitleFromSources(project.sources), '');
  assert.equal(projectTitleFromSources(), '');
  assert.equal(projectTitleFromSources([{ type: 'text', title: 'Existing notes' }]), '');
});

test('dashboard labels the last edit rather than the creation date', () => {
  const createdAt = Date.parse('2026-10-18T16:00:00Z');
  const updatedAt = Date.parse('2026-10-19T16:00:00Z');
  assert.equal(projectUpdatedDate({ createdAt, updatedAt }, now).label, 'Updated Oct 19');
  assert.equal(projectUpdatedDate({ createdAt, updatedAt: now }, now).label, 'Updated Today');
  assert.equal(projectUpdatedDate({ createdAt, updatedAt: NaN }, now).label, 'Oct 18');
  assert.equal(projectUpdatedDate({ createdAt, updatedAt }, now).timestamp, updatedAt);
});

test('older dates include their year and use the project date timezone at midnight', () => {
  assert.equal(projectUpdatedDate({ createdAt: Date.parse('2025-10-19T16:00:00Z') }, now).label, 'Oct 19, 2025');
  assert.equal(projectUpdatedDate({ createdAt: Date.parse('2026-10-20T02:00:00Z') }, now).label, 'Oct 19');
});

test('unedited projects show only the creation date, including a same-time initial timestamp', () => {
  for (const updatedAt of [undefined, now, now - 1, NaN, Infinity]) {
    const result = projectUpdatedDate({ createdAt: now, updatedAt }, now);
    assert.equal(result.label, 'Today');
    assert.equal(result.timestamp, now);
  }
  const createdAt = Date.parse('2026-10-19T16:00:00Z');
  assert.equal(projectUpdatedDate({ createdAt }, now).label, 'Oct 19');
  assert.equal(projectUpdatedDate({ createdAt, updatedAt: now }, now).label, 'Updated Today');
  assert.equal(projectUpdatedDate({ createdAt: Date.parse('2024-10-18T16:00:00Z'), updatedAt: Date.parse('2025-10-19T16:00:00Z') }, now).label, 'Updated Oct 19, 2025');
});
