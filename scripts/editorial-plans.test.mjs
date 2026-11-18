import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditorialPlans, applyEditorialPlan, editorialPlanDraftContent } from '../dist/editorial-plans.js';

const output = (id, extra = {}) => ({
  id, title: 'The School Board Discussion',
  toolPreferences: { format: 'standard', audience: 'general', voice: '' },
  labels: [{ key: 'audience', label: 'Parents & Caregivers' }],
  sourceSnapshots: [{ title: 'Parents discuss school funding', type: 'link' }],
  editorialDirection: 'Explain the funding questions.',
  ...extra,
});
const baseContent = () => ({
  title: 'The School Board Discussion',
  shareText: 'A look at the school board discussion.',
  paragraphs: [
    'This imagined account is inspired by the selected source.',
    'School facilities are one part of the discussion.',
    'The funding questions connect the budget with oversight.',
    'The next meeting offers a point of context.',
    'The wider context brings the questions together.',
  ],
  sectionHeadings: ['Facilities', 'Funding', 'Timing', 'Wider context'],
});

test('plans reflect queued draft settings, source titles, and exact Editorial Direction without changing drafts', () => {
  const outputs = [output('a'), output('b', { toolPreferences: { format: 'listicle', audience: 'general', voice: 'us-weekly' } })];
  const before = structuredClone(outputs);
  const plans = buildEditorialPlans(outputs);
  assert.deepEqual(outputs, before);
  assert.equal(plans[0].outputId, 'a');
  assert.equal(plans[0].audience, 'Parents & Caregivers');
  assert.match(plans[0].focus, /Parents discuss school funding/);
  assert.match(plans[0].focus, /Explain the funding questions\./);
  assert.equal(plans[1].format, 'Listicle');
  assert.equal(plans[1].voice, 'Us Weekly');
  assert.match(plans[1].structure, /four numbered takeaways/);
  assert.match(plans[1].tone, /Conversational and lively/);
  assert.notEqual(plans[0].angle, plans[1].angle);
  assert.notEqual(plans[0].structure, plans[1].structure);
});

test('a saved plan survives opening review again and changing selection order', () => {
  const first = output('a');
  const plan = buildEditorialPlans([first, output('b')])[0];
  plan.angle = 'Focus on timing and next steps.';
  plan.focus = '';
  assert.equal(applyEditorialPlan(first, plan, 100), true);
  const reopened = buildEditorialPlans([output('b'), first])[1];
  assert.equal(reopened.angle, 'Focus on timing and next steps.');
  assert.equal(reopened.focus, '');
  assert.equal(reopened.variantIndex, 0);
  assert.equal(reopened.reviewedAt, 100);
  assert.equal(first.editorialDirection, 'Explain the funding questions.');
});

test('cleared settings suppress stale chips while legacy label-only drafts retain their labels', () => {
  const labels = [
    { key: 'format', label: 'Listicle' },
    { key: 'audience', label: 'Parents & Caregivers' },
    { key: 'voice', label: 'Us Weekly' },
  ];
  const [cleared] = buildEditorialPlans([output('cleared', {
    toolPreferences: { format: '', audience: '  ', voice: '' }, labels,
  })]);
  assert.equal(cleared.format, '');
  assert.equal(cleared.audience, '');
  assert.equal(cleared.voice, '');
  assert.match(cleared.angle, /Keep general readers in mind\./);
  const [emptyPreferences] = buildEditorialPlans([output('empty', { toolPreferences: {}, labels })]);
  assert.deepEqual([emptyPreferences.format, emptyPreferences.audience, emptyPreferences.voice], ['', '', '']);
  const legacy = output('legacy', { labels });
  delete legacy.toolPreferences;
  const [restored] = buildEditorialPlans([legacy]);
  assert.deepEqual([restored.format, restored.audience, restored.voice], ['Listicle', 'Parents & Caregivers', 'Us Weekly']);
  const [noSettings] = buildEditorialPlans([{ id: 'old', title: 'Draft without settings' }]);
  assert.deepEqual([noSettings.format, noSettings.audience, noSettings.voice], ['', '', '']);
});

test('saving a plan rejects mismatched drafts and detaches editable data', () => {
  const draft = output('a');
  const plan = buildEditorialPlans([draft])[0];
  assert.equal(applyEditorialPlan(output('b'), plan, 100), false);
  assert.equal(applyEditorialPlan(draft, { ...plan, tone: null }, 100), false);
  assert.equal(draft.editorialPlan, undefined);
  assert.equal(applyEditorialPlan(draft, plan, 100), true);
  plan.focus = 'A later change in the popup';
  plan.sourceTitles.push('Another source');
  assert.notEqual(draft.editorialPlan.focus, plan.focus);
  assert.equal(draft.editorialPlan.sourceTitles.length, 1);
});

test('reviewed focus changes source paragraph priority without copying instructions or adding assertions', () => {
  const draft = output('a');
  const plan = buildEditorialPlans([draft])[0];
  plan.angle = 'Explain the budget.';
  plan.focus = 'Prioritize funding and oversight. DO NOT COPY THIS INSTRUCTION.';
  applyEditorialPlan(draft, plan, 100);
  const original = baseContent();
  const before = structuredClone(original);
  const result = editorialPlanDraftContent(draft, original);
  assert.equal(result.paragraphs[0], original.paragraphs[0]);
  assert.equal(result.paragraphs[1], original.paragraphs[2]);
  assert.equal(result.sectionHeadings[0], 'Funding');
  assert.deepEqual([...result.paragraphs].sort(), [...original.paragraphs].sort());
  assert.equal(result.paragraphs.at(-1), original.paragraphs.at(-1));
  assert.doesNotMatch(result.paragraphs.join(' '), /DO NOT COPY|Prioritize/);
  assert.deepEqual(original, before);
});

test('equally relevant plans get a stable different ordering while retaining source context', () => {
  const drafts = [output('a'), output('b')];
  const plans = buildEditorialPlans(drafts);
  drafts.forEach((draft, index) => applyEditorialPlan(draft, { ...plans[index], angle: '', focus: '' }, 100));
  const first = editorialPlanDraftContent(drafts[0], baseContent());
  const second = editorialPlanDraftContent(drafts[1], baseContent());
  assert.notDeepEqual(first.paragraphs, second.paragraphs);
  assert.equal(first.paragraphs[0], second.paragraphs[0]);
  assert.equal(first.paragraphs.at(-1), second.paragraphs.at(-1));
});

test('reviewed structure can request a list or continuous prose; negative list instructions win', () => {
  const draft = output('a');
  const plan = buildEditorialPlans([draft])[0];
  applyEditorialPlan(draft, { ...plan, structure: 'Use four numbered takeaways.' }, 100);
  assert.equal(editorialPlanDraftContent(draft, baseContent()).format, 'listicle');
  applyEditorialPlan(draft, { ...plan, structure: 'Use continuous prose, with no numbered list.' }, 100);
  assert.equal(editorialPlanDraftContent(draft, baseContent()).format, 'standard');
  assert.equal(editorialPlanDraftContent(draft, { paragraphs: ['Only an opening.'] }).format, 'standard');
});

test('concise tone uses shorter paragraphs without deleting sentences or changing numbers', () => {
  const draft = output('a');
  const plan = buildEditorialPlans([draft])[0];
  applyEditorialPlan(draft, { ...plan, angle: '', focus: '', tone: 'Use short paragraphs.' }, 100);
  const original = { paragraphs: ['The source is a demo.', 'The figure is 3.2 million. The second sentence adds context. The third sentence raises a question.'], sectionHeadings: [] };
  const result = editorialPlanDraftContent(draft, original);
  assert.equal(result.paragraphs.length, 3);
  assert.equal(result.paragraphs.join(' '), original.paragraphs.join(' '));
});

test('unreviewed, empty, and invalid data remain safe and do not apply a plan', () => {
  assert.deepEqual(buildEditorialPlans(null), []);
  assert.deepEqual(buildEditorialPlans([null]), []);
  assert.equal(editorialPlanDraftContent(output('a'), null), null);
  const original = baseContent();
  assert.deepEqual(editorialPlanDraftContent(output('a'), original).paragraphs, original.paragraphs);
  const draft = output('a', { editorialPlan: { angle: 'Funding' } });
  assert.deepEqual(editorialPlanDraftContent(draft, original).paragraphs, original.paragraphs);
});
