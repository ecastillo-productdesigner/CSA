import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProjectTitle, normalizeProjectTitles, projectUpdatedDate } from '../dist/dashboard.js';

const now = Date.parse('2026-10-20T16:00:00Z');

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
