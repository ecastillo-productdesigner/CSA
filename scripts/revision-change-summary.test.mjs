import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionChangeSummary } from '../dist/revision-change-summary.js';

test('ordinary summaries report body, formatting, and share-text differences without echoing unverified instructions', () => {
  const before = { draftText: 'Same text', document: { ops: [{ insert: 'Same text' }] }, shareText: 'Same share text' };
  assert.equal(revisionChangeSummary(before, { ...before, draftText: 'Updated text' }, 'Make the story funny'), 'Updated the draft body. No other changes.');
  assert.equal(revisionChangeSummary(before, { ...before, document: { ops: [{ insert: 'Same text', attributes: { bold: true } }] } }, 'Use bold'), 'Updated the draft formatting. No other changes.');
  assert.equal(revisionChangeSummary(before, { ...before, draftText: 'Updated text', shareText: 'Updated share text' }, 'Update both'), 'Updated the draft body. Updated the share text. No other changes.');
  assert.equal(revisionChangeSummary(before, structuredClone(before), 'Unchanged preview'), 'No other changes.');
});
