import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAudienceSimilarities, audienceSimilarityPairKey, averageDisplayedSimilarities } from '../dist/audience-similarity-summary.js';

const draft = (id, extra = {}) => ({
  id, title: 'School budget proposal', status: 'ready',
  draftText: 'Parents discussed the school budget.\n\nThe board meets next week.',
  toolPreferences: { audience: 'general' }, ...extra,
});
const distinct = id => draft(id, {
  title: 'Orchard harvest festival',
  draftText: 'Apples ripened quickly beside orchards.\n\nFarmers celebrated abundant harvests.',
  toolPreferences: { audience: 'wellness-enthusiast' },
});
const project = () => ({ outputs: [draft('a'), draft('b'), distinct('c')] });

test('averages all displayed rows including Source Draft, without adding it as a reference', () => {
  const item = project();
  item.outputs.unshift({ ...distinct('source'), isSimilaritySource: true });
  item.sourceDraft = draft('backend-source');
  const before = structuredClone(item);
  const result = prepareAudienceSimilarities(item);
  assert.deepEqual(result.drafts.map(value => value.id), ['a', 'b', 'c']);
  assert.deepEqual([...result.summaries], [
    ['a', { score: 75, band: 'medium', comparisonCount: 3, includesSourceDraft: true }],
    ['b', { score: 75, band: 'medium', comparisonCount: 3, includesSourceDraft: true }],
    ['c', { score: 25, band: 'low', comparisonCount: 3, includesSourceDraft: true }],
  ]);
  assert.equal(result.comparisons.size, 6);
  assert.equal(result.sourceDraft.isSimilaritySource, true);
  assert.equal(result.sourceDraft.similaritySourceOrigin, 'source-draft');
  assert.equal(result.group.drafts.includes(result.sourceDraft), false);
  assert.equal(result.comparisons.has(audienceSimilarityPairKey('a', 'a')), false);
  assert.equal(result.comparisons.has(audienceSimilarityPairKey('source', 'a')), false);
  assert.deepEqual(result.group.drafts, result.drafts);
  assert.deepEqual(item, before);
});

test('identical drafts and their baseline average100 without treating unavailable quotes as zero', () => {
  const result = prepareAudienceSimilarities({ outputs: [draft('a'), draft('b')] });
  assert.deepEqual([...result.summaries.values()], [
    { score: 100, band: 'high', comparisonCount: 2, includesSourceDraft: true },
    { score: 100, band: 'high', comparisonCount: 2, includesSourceDraft: true },
  ]);
  assert.equal(result.comparisons.get(audienceSimilarityPairKey('a', 'b')).metrics.find(value => value.key === 'quotes').value, null);
});

test('zero or one eligible draft has no group, score, or comparison', () => {
  for (const value of [null, {}, { outputs: [] }, { outputs: [draft('a')] }]) {
    const result = prepareAudienceSimilarities(value);
    assert.equal(result.group, null);
    assert.equal(result.summaries.size, 0);
    assert.equal(result.comparisons.size, 0);
  }
});

test('eligibility excludes unavailable records, duplicates, own material and Source Draft', () => {
  const item = { ownMaterialOutputId: 'own-id', outputProcessing: { ids: ['busy'] }, outputs: [
    draft('a'), draft('pending', { status: 'pending' }), draft('b'), draft('stale', { needsRegeneration: true }),
    draft('empty', { document: { ops: [] } }), draft('own', { ownMaterial: true }), draft('own-id'),
    draft('deleted', { deletedAt: 100 }), draft('busy'), draft('a'), draft('source', { isSimilaritySource: true }), null,
  ] };
  assert.deepEqual(prepareAudienceSimilarities(item).drafts.map(value => value.id), ['a', 'b']);
  for (const unavailable of [{ ...item, deletedAt: 100 }, { ...item, archivedAt: 100 }]) {
    assert.equal(prepareAudienceSimilarities(unavailable).summaries.size, 0);
  }
});

test('unchanged ready content reuses the prepared results without timestamp dependencies', () => {
  const item = project();
  const first = prepareAudienceSimilarities(item);
  assert.equal(prepareAudienceSimilarities(item), first);
  item.updatedAt = Date.now();
  item.outputs[0].shareText = 'Social caption is not part of similarity';
  item.outputs[0].updatedAt = Date.now();
  assert.equal(prepareAudienceSimilarities(item), first);
});

test('headline and body mutations refresh scores without requiring an updated timestamp', () => {
  const item = project();
  const first = prepareAudienceSimilarities(item);
  item.outputs[1].title = 'Unrelated new heading';
  const headline = prepareAudienceSimilarities(item);
  assert.notEqual(headline, first);
  assert.equal(headline.summaries.get('a').score, 67);
  item.outputs[1].title = item.outputs[0].title;
  item.outputs[2].title = item.outputs[0].title;
  item.outputs[2].draftText = item.outputs[0].draftText;
  const body = prepareAudienceSimilarities(item);
  assert.notEqual(body, headline);
  assert.deepEqual([...body.summaries.values()].map(value => value.score), [100, 100, 100]);
});

test('rich-text edits are authoritative and empty rich-text content removes the draft', () => {
  const item = project();
  const first = prepareAudienceSimilarities(item);
  item.outputs[2].title = item.outputs[0].title;
  item.outputs[2].document = { ops: [{ insert: item.outputs[0].draftText.replace('\n\n', '\n') + '\n' }] };
  const edited = prepareAudienceSimilarities(item);
  assert.notEqual(edited, first);
  assert.equal(edited.summaries.get('c').score, 100);
  item.outputs[2].document.ops[0].insert = '\n';
  const emptied = prepareAudienceSimilarities(item);
  assert.deepEqual(emptied.drafts.map(value => value.id), ['a', 'b']);
  assert.equal(emptied.summaries.get('a').comparisonCount, 2);
});

test('newly completed drafts join results, and removals and busy drafts refresh counts', () => {
  const item = { outputs: [draft('a'), draft('b', { status: 'pending' })] };
  assert.equal(prepareAudienceSimilarities(item).summaries.size, 0);
  item.outputs[1].status = 'ready';
  assert.equal(prepareAudienceSimilarities(item).summaries.get('a').comparisonCount, 2);
  item.outputs.push(distinct('c'));
  assert.equal(prepareAudienceSimilarities(item).summaries.get('a').comparisonCount, 3);
  item.outputProcessing = { ids: ['c'] };
  assert.equal(prepareAudienceSimilarities(item).summaries.get('a').comparisonCount, 2);
  delete item.outputProcessing;
  item.outputs.splice(1, 1);
  assert.deepEqual([...prepareAudienceSimilarities(item).summaries.keys()], ['a', 'c']);
  item.outputs[1].deletedAt = 100;
  assert.equal(prepareAudienceSimilarities(item).summaries.size, 0);
});

test('replacement objects and changed audience metadata do not retain stale references', () => {
  const item = project();
  const first = prepareAudienceSimilarities(item);
  item.outputs[0] = structuredClone(item.outputs[0]);
  const replaced = prepareAudienceSimilarities(item);
  assert.notEqual(replaced, first);
  assert.equal(replaced.drafts[0], item.outputs[0]);
  item.outputs[0].toolPreferences.audience = 'wellness-enthusiast';
  const renamed = prepareAudienceSimilarities(item);
  assert.notEqual(renamed, replaced);
  assert.equal(renamed.comparisons.get(audienceSimilarityPairKey('a', 'c')).audience.key, 'wellness-enthusiast');
});

test('pair keys are symmetric and cannot collide when IDs contain separators', () => {
  assert.equal(audienceSimilarityPairKey('a', 'b'), audienceSimilarityPairKey('b', 'a'));
  assert.notEqual(audienceSimilarityPairKey('a:b', 'c'), audienceSimilarityPairKey('a', 'b:c'));
});

test('displayed Overall rows of12,85,77,77 average to63 rather than the source-excluding80', () => {
  const rows = [12, 85, 77, 77].map(value => ({ metrics: [{ key: 'body', value }] }));
  assert.deepEqual(averageDisplayedSimilarities(rows), { score: 63, band: 'medium', comparisonCount: 4 });
  assert.deepEqual(averageDisplayedSimilarities([...rows, { metrics: [{ value: null }] }]),
    { score: 63, band: 'medium', comparisonCount: 4 });
});

test('source-only changes invalidate prepared comparisons even when regular drafts are unchanged', () => {
  const item = project();
  item.sourceDraft = draft('backend');
  const before = prepareAudienceSimilarities(item);
  assert.equal(before.summaries.get('a').score, 75);
  const originalRegulars = item.outputs;
  item.sourceDraft.title = distinct('backend').title;
  item.sourceDraft.draftText = distinct('backend').draftText;
  const after = prepareAudienceSimilarities(item);
  assert.equal(item.outputs, originalRegulars);
  assert.notEqual(after, before);
  assert.notEqual(after.sourceDraft, before.sourceDraft);
  assert.equal(after.summaries.get('a').score, 50);
  assert.equal(after.summaries.get('c').score, 50);
  assert.equal(prepareAudienceSimilarities(item), after);
});

test('changes in source snapshots refresh the same detached source used in row averages', () => {
  const item = project();
  item.sources = [{ id: 'article', type: 'link', selected: true, title: draft('source').title, text: draft('source').draftText }];
  const before = prepareAudienceSimilarities(item);
  assert.equal(before.sourceDraft.similaritySourceOrigin, 'project-sources');
  item.sources[0].text = distinct('source').draftText;
  item.sources[0].title = distinct('source').title;
  const after = prepareAudienceSimilarities(item);
  assert.notEqual(after, before);
  assert.equal(after.sourceDraft.draftText, item.sources[0].text);
  assert.equal(after.summaries.get('a').score, 50);
});

test('every average equals its visible row scores including a refreshed fallback after the first draft is edited', () => {
  const item = project();
  const assertRowsMatch = result => {
    for (const reference of result.drafts) {
      const visible = [result.sourceDraft, ...result.drafts.filter(draft => draft.id !== reference.id)].filter(Boolean);
      const rows = visible.map(draft => result.comparisons.get(audienceSimilarityPairKey(reference.id, draft.id)));
      assert.ok(rows.every(Boolean));
      const expected = averageDisplayedSimilarities(rows);
      assert.deepEqual(result.summaries.get(reference.id), { ...expected, includesSourceDraft: true });
    }
  };
  const before = prepareAudienceSimilarities(item);
  assert.equal(before.sourceDraft.similaritySourceOrigin, 'draft-fallback');
  assertRowsMatch(before);
  item.outputs[0].draftText = distinct('edited').draftText;
  item.outputs[0].title = distinct('edited').title;
  const after = prepareAudienceSimilarities(item);
  assert.notEqual(after.sourceDraft, before.sourceDraft);
  assert.equal(after.sourceDraft.draftText, item.outputs[0].draftText);
  assertRowsMatch(after);
});
