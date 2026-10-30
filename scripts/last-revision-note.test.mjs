import test from 'node:test';
import assert from 'node:assert/strict';
import { latestRevisionNote, latestRevisionDetails, revisionHistory, revisionRequestLabel } from '../dist/last-revision-note.js';

test('unrevised drafts and invalid history have no revision note', () => {
  for (const output of [undefined, {}, { revisionRequests: {} }, { revisionRequests: [null, {}, { instructions: '  ' }] }]) assert.equal(latestRevisionNote(output), '');
});

test('the last submitted revision note keeps its exact multiline text without altering history', () => {
  const output = { revisionRequests: [{ instructions: 'First request' }, { instructions: 'Make subheads into questions\nKeep the quotes intact' }] };
  const before = structuredClone(output);
  assert.equal(latestRevisionNote(output), 'Make subheads into questions\nKeep the quotes intact');
  assert.deepEqual(output, before);
});

test('revision notes belong to each draft and ignore malformed trailing records', () => {
  const first = { revisionRequests: [{ instructions: 'Shorten the intro' }, { instructions: null }] };
  const second = { revisionRequests: [{ instructions: 'Use shorter paragraphs' }] };
  assert.equal(latestRevisionNote(first), 'Shorten the intro');
  assert.equal(latestRevisionNote(second), 'Use shorter paragraphs');
  assert.equal(latestRevisionNote({ revisionRequests: [] }), '');
});

test('revision details use the completion time and never invent one from the request time', () => {
  assert.deepEqual(latestRevisionDetails({ revisionRequests: [{ instructions: 'Shorten the intro', requestedAt: 10, completedAt: 20 }] }), { instructions: 'Shorten the intro', completedAt: 20 });
  for (const completedAt of [undefined, null, '', Infinity, -1, 1e20]) {
    assert.deepEqual(latestRevisionDetails({ revisionRequests: [{ instructions: 'Keep the quotes', requestedAt: 10, completedAt }] }), { instructions: 'Keep the quotes', completedAt: null });
  }
  assert.equal(latestRevisionDetails({}), null);
});

test('revision history is normalized chronologically without reordering stored records', () => {
  const output = { revisionRequests: [{ instructions: 'Third revision', completedAt: 30 }, { instructions: 'First revision', completedAt: 10 }, { instructions: 'Second revision', completedAt: 20 }] };
  const before = structuredClone(output);
  assert.deepEqual(revisionHistory(output).map(note => note.instructions), ['First revision', 'Second revision', 'Third revision']);
  assert.deepEqual(output, before);
  assert.equal(latestRevisionDetails(output).instructions, 'Third revision');
});

test('the footer and popup share the requested singular or plural revision label', () => {
  assert.equal(revisionRequestLabel(1), 'Requested Revision');
  assert.equal(revisionRequestLabel(2), 'Requested Revisions');
  assert.equal(revisionRequestLabel(12), 'Requested Revisions');
});


test('completed revision notes show the saved result while retaining the original request', () => {
  const output = { revisionRequests: [{ instructions: 'Shorten the intro', completedAt: 20, changeSummary: 'Updated the draft body. No other changes.' }] };
  const before = structuredClone(output);
  assert.equal(latestRevisionNote(output), 'Updated the draft body. No other changes.');
  assert.equal(latestRevisionDetails(output).instructions, 'Shorten the intro');
  assert.deepEqual(output, before);
});

test('legacy and malformed summaries fall back to the saved instructions', () => {
  for (const changeSummary of [undefined, null, '', '  ', 42]) {
    assert.equal(latestRevisionNote({ revisionRequests: [{ instructions: 'Original request', changeSummary }] }), 'Original request');
  }
});


test('revision history preserves a valid applied flag for the refusal presentation', () => {
  for (const applied of [false, true]) {
    assert.deepEqual(revisionHistory({ revisionRequests: [{ instructions: 'A request', completedAt: 20, applied }] }), [{ instructions: 'A request', completedAt: 20, applied }]);
  }
  assert.deepEqual(revisionHistory({ revisionRequests: [{ instructions: 'A request', applied: 'false' }] }), [{ instructions: 'A request', completedAt: null }]);
});
