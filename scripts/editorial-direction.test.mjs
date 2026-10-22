import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleVariant } from '../dist/outputs.js';

const selections = [
  { key: 'format', value: 'standard', label: 'Standard Format' },
  { key: 'audience', value: 'general', label: 'General Audience' },
  { key: 'voice', value: 'us-weekly', label: 'US Weekly' },
];

test('each pending piece snapshots its direction while later additions retain the project guidance', () => {
  const project = { sources: [], outputs: [], editorialDirection: 'Focus on the economy\nUse a conversational tone.' };
  const first = sampleVariant(project, selections);
  project.outputs.push(first);
  const second = sampleVariant(project, selections);
  assert.equal(first.editorialDirection, project.editorialDirection);
  assert.equal(second.editorialDirection, project.editorialDirection);
  project.editorialDirection = 'Focus on local businesses';
  const third = sampleVariant(project, selections);
  assert.equal(third.editorialDirection, 'Focus on local businesses');
  assert.equal(first.editorialDirection, 'Focus on the economy\nUse a conversational tone.');
  assert.equal(second.editorialDirection, first.editorialDirection);
});

test('optional direction defaults to empty and clearing it affects only subsequent pieces', () => {
  for (const editorialDirection of [undefined, null, '']) {
    const project = { sources: [], outputs: [], editorialDirection };
    assert.equal(sampleVariant(project, selections).editorialDirection, '');
  }
  const project = { sources: [], outputs: [], editorialDirection: 'Keep this piece concise' };
  const original = sampleVariant(project, selections);
  project.editorialDirection = '';
  assert.equal(sampleVariant(project, selections).editorialDirection, '');
  assert.equal(original.editorialDirection, 'Keep this piece concise');
});
