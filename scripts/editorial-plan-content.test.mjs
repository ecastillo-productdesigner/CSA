import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditorialPlans, applyEditorialPlan } from '../dist/editorial-plans.js';
import { populateOutputContent } from '../dist/outputs.js';

test('completed demo drafts use reviewed structure and retain their original request', () => {
  const output = {
    id: 'reviewed', title: 'A Community Garden',
    toolPreferences: { format: 'standard', audience: 'general', voice: '' },
    sourceSnapshots: [{ title: 'Neighbors plan a community garden', text: 'Neighbors discuss planting schedules and how to maintain a shared garden.' }],
    editorialDirection: 'Explain the practical context.',
  };
  const plan = buildEditorialPlans([output])[0];
  plan.structure = 'Use four numbered takeaways.';
  plan.focus = 'Prioritize practical context. DO NOT COPY THIS PLANNING INSTRUCTION.';
  applyEditorialPlan(output, plan, 100);
  populateOutputContent(output);
  assert.ok(output.document.ops.some(op => op.attributes?.header === 2));
  assert.match(output.draftText, /1\./);
  assert.doesNotMatch(output.draftText, /DO NOT COPY|Use four numbered|Prioritize practical/);
  assert.equal(output.editorialDirection, 'Explain the practical context.');
  assert.equal(output.editorialPlan.reviewedAt, 100);
  const saved = structuredClone(output);
  populateOutputContent(output);
  assert.deepEqual(output, saved, 'Reopening a completed draft must not apply the plan twice');
});

test('two reviewed plans produce different source-based demo openings for the same source', () => {
  const outputs = ['one', 'two'].map(id => ({ id, title: 'A Community Garden', toolPreferences: { format: 'standard' }, sourceSnapshots: [{ title: 'Neighbors plan a community garden' }] }));
  buildEditorialPlans(outputs).forEach((plan, index) => applyEditorialPlan(outputs[index], plan, 100));
  outputs.forEach(populateOutputContent);
  assert.notEqual(outputs[0].draftText, outputs[1].draftText);
  assert.ok(outputs.every(output => output.contentVersion === 3 && output.editorialPlan));
});
