import test from 'node:test';
import assert from 'node:assert/strict';
import { audienceSimilarityGroups, compareAudienceDrafts, draftAudienceLabel, audienceSimilarityVerdict } from '../dist/audience-similarity.js';

const draft = (id, extra = {}) => ({ id, title: 'School funding proposal', status: 'ready', draftText: 'Parents discussed the school budget.\n\nThe board meets next week.', toolPreferences: { audience: 'general' }, ...extra });
const score = (left, right, key) => compareAudienceDrafts(left, right)?.metrics.find(metric => metric.key === key)?.value;

test('groups completed drafts by audience in project order, independent of card selection', () => {
  const a = draft('a'), b = draft('b'), c = draft('c', { toolPreferences: { audience: 'wellness-enthusiast' } });
  const project = { outputs: [a, c, b], selectedOutputIds: ['c'] };
  const before = structuredClone(project);
  const groups = audienceSimilarityGroups(project);
  assert.deepEqual(groups, [{ key: 'general', label: 'General Audience', drafts: [a, b] }]);
  assert.equal(groups[0].drafts[0], a);
  assert.deepEqual(project, before);
});

test('pending, stale, empty, own-material, deleted and processing drafts cannot join a pair', () => {
  const project = { ownMaterialOutputId: 'own-id', outputProcessing: { ids: ['busy'] }, outputs: [
    draft('a'), draft('b'), draft('pending', { status: 'pending' }), draft('stale', { needsRegeneration: true }),
    draft('empty', { document: { ops: [] } }), draft('own', { ownMaterial: true }), draft('own-id'),
    draft('deleted', { deletedAt: 100 }), draft('busy'), draft('a'), null,
  ] };
  assert.deepEqual(audienceSimilarityGroups(project)[0].drafts.map(item => item.id), ['a', 'b']);
  assert.deepEqual(audienceSimilarityGroups({ ...project, deletedAt: 100 }), []);
  assert.deepEqual(audienceSimilarityGroups(null), []);
});

test('no audience or an explicitly cleared preference never falls back to stale labels', () => {
  const stale = [{ key: 'audience', label: 'General Audience' }];
  for (const audience of ['', ' ', 'None Selected', 'none']) {
    assert.deepEqual(audienceSimilarityGroups({ outputs: [draft('a', { toolPreferences: { audience }, labels: stale }), draft('b')] }), []);
  }
  assert.deepEqual(audienceSimilarityGroups({ outputs: [draft('a', { toolPreferences: {}, labels: stale }), draft('b')] }), []);
  assert.deepEqual(audienceSimilarityGroups({ outputs: [draft('a', { toolPreferences: undefined }), draft('b')] }), []);
});

test('legacy audience labels match catalog identities and suggested generation row identities are irrelevant', () => {
  const legacy = draft('legacy', { toolPreferences: undefined, labels: [{ key: 'audience', label: '  GENERAL  Audience ' }] });
  assert.equal(audienceSimilarityGroups({ outputs: [legacy, draft('a')] })[0].drafts.length, 2);
  const suggested = (id, row) => draft(id, { toolPreferences: { audience: 'suggested-audience:curious%20readers' }, audienceSuggestionRowId: row, labels: [{ key: 'audience', label: 'Curious Readers' }] });
  const legacySuggestion = draft('old', { toolPreferences: undefined, labels: [{ key: 'audience', label: 'Curious Readers' }] });
  assert.equal(audienceSimilarityGroups({ outputs: [suggested('one', 'group-a'), suggested('two', 'group-b'), legacySuggestion] })[0].drafts.length, 3);
});

test('different explicit audience values cannot be merged by a matching display label', () => {
  const labels = [{ key: 'audience', label: 'Readers' }];
  const a = draft('a', { toolPreferences: { audience: 'audience-a' }, labels });
  const b = draft('b', { toolPreferences: { audience: 'audience-b' }, labels });
  assert.deepEqual(audienceSimilarityGroups({ outputs: [a, b] }), []);
  const result = compareAudienceDrafts(a, b);
  assert.equal(result.audience, null);
  assert.deepEqual(result.audiences.map(item => item.key), ['audience-a', 'audience-b']);
  assert.equal(result.metrics[0].value, 100);
});

test('invalid, self, blank and unfinished comparisons are rejected', () => {
  for (const other of [null, draft('a'), draft('pending', { status: 'pending' }), draft('empty', { draftText: '' }), draft('stale', { needsRegeneration: true })]) {
    assert.equal(compareAudienceDrafts(draft('a'), other), null);
  }
});

test('identical nonempty wording and quotes score 100 with exact metric names', () => {
  const body = 'Parents said, “The school needs better funding.”\n\nThe meeting continues tomorrow.';
  const result = compareAudienceDrafts(draft('a', { draftText: body }), draft('b', { draftText: body }));
  assert.deepEqual(result.metrics.map(metric => metric.label), ['Body overlap', 'Headline', 'Opening', 'Shared quotes', 'Structure']);
  assert.deepEqual(result.metrics.map(metric => metric.value), [100, 100, 100, 100, 100]);
  assert.deepEqual(result.draftIds, ['a', 'b']);
  assert.match(result.method, /wording and document structure/);
});

test('disjoint wording scores zero while paragraph-only shape can still match', () => {
  const a = draft('a', { title: 'Apple orchard harvest', draftText: 'Bright apples ripened quickly.\n\nFarmers celebrated abundant harvests.' });
  const b = draft('b', { title: 'Ocean currents shift', draftText: 'Deep oceans remain mysterious.\n\nScientists mapped hidden trenches.' });
  assert.equal(score(a, b, 'body'), 0);
  assert.equal(score(a, b, 'headline'), 0);
  assert.equal(score(a, b, 'opening'), 0);
  assert.equal(score(a, b, 'quotes'), null);
  assert.equal(score(a, b, 'structure'), 100);
});

test('partial overlap is symmetric, bounded and based on actual draft wording', () => {
  const a = draft('a', { title: 'Parents discuss school funding', draftText: 'Parents discuss school funding today. New grants could help.' });
  const b = draft('b', { title: 'Parents discuss classroom support', draftText: 'Parents discuss school funding today. Classroom space remains limited.' });
  const left = compareAudienceDrafts(a, b), right = compareAudienceDrafts(b, a);
  assert.ok(score(a, b, 'body') > 0 && score(a, b, 'body') < 100);
  assert.equal(score(a, b, 'headline'), 50);
  assert.deepEqual(left.metrics.map(metric => metric.value), right.metrics.map(metric => metric.value));
  assert.ok(left.metrics.every(metric => metric.value === null || Number.isInteger(metric.value) && metric.value >= 0 && metric.value <= 100));
});

test('current rich-text document is authoritative over stale draftText, including empty documents', () => {
  const a = draft('a', { document: { ops: [{ insert: 'Fresh text from the editor.\n' }] }, draftText: 'Stale body.' });
  const b = draft('b', { draftText: 'Fresh text from the editor.' });
  assert.equal(score(a, b, 'body'), 100);
  assert.equal(compareAudienceDrafts({ ...a, document: { ops: [] } }, b), null);
  assert.equal(compareAudienceDrafts({ ...a, document: { ops: [{ insert: { image: 'example' } }] } }, b), null);
});

test('opening skips rich-text headings and handles text split across formatting ops', () => {
  const a = draft('a', { document: { ops: [{ insert: 'Different heading' }, { insert: '\n', attributes: { header: 2 } }, { insert: 'Parents ' }, { insert: 'discuss funding.', attributes: { bold: true } }, { insert: '\n' }, { insert: 'Later detail.\n' }] } });
  const b = draft('b', { draftText: '# Another heading\nParents discuss funding.\nOther later detail.' });
  assert.equal(score(a, b, 'opening'), 100);
  assert.equal(score(a, b, 'structure'), 67);
});

test('structure observes heading, list and quote order rather than chosen format names', () => {
  const body = { ops: [{ insert: 'Heading' }, { insert: '\n', attributes: { header: 2 } }, { insert: 'First point' }, { insert: '\n', attributes: { list: 'ordered' } }, { insert: 'A quote' }, { insert: '\n', attributes: { blockquote: true } }] };
  const a = draft('a', { document: body });
  const b = draft('b', { document: structuredClone(body), toolPreferences: { audience: 'general', format: 'listicle' } });
  assert.equal(score(a, b, 'structure'), 100);
  assert.equal(score(a, draft('c', { draftText: 'First paragraph.\nSecond paragraph.' }), 'structure'), 0);
});

test('quotation comparison normalizes punctuation and does not interpret contractions as quotations', () => {
  const a = draft('a', { draftText: 'She said, “We need funding now.”' });
  const b = draft('b', { draftText: 'He added, "We need funding now!"' });
  const c = draft('c', { draftText: 'They said, "Classroom space is limited."' });
  assert.equal(score(a, b, 'quotes'), 100);
  assert.equal(score(a, c, 'quotes'), 0);
  assert.equal(score(a, draft('d', { draftText: "Don't forget the school’s budget." }), 'quotes'), null);
});

test('missing headlines are unavailable and unicode text can be compared without errors', () => {
  const a = draft('a', { title: '', draftText: 'Écoles publiques — soutien aux élèves.' });
  const b = draft('b', { draftText: 'ÉCOLES publiques: soutien aux élèves!' });
  assert.equal(score(a, b, 'headline'), null);
  assert.equal(score(a, b, 'body'), 100);
  assert.deepEqual(audienceSimilarityGroups({ outputs: [draft('bad', { toolPreferences: { audience: 'suggested-audience:%zz' } }), draft('b')] }), []);
});


test('drafts with different or missing audiences can be compared with clear audience metadata', () => {
  const a = draft('a', { toolPreferences: { audience: 'general' } });
  const b = draft('b', { toolPreferences: { audience: '' }, labels: [{ key: 'audience', label: 'Stale name' }] });
  const result = compareAudienceDrafts(a, b);
  assert.equal(result.audience, null);
  assert.deepEqual(result.audiences, [{ key: 'general', label: 'General Audience' }, null]);
  assert.equal(result.metrics[0].value, 100);
  assert.equal(draftAudienceLabel(a), 'General Audience');
  assert.equal(draftAudienceLabel(b), 'None Selected');
  assert.equal(compareAudienceDrafts(b, { ...b, id: 'c' }).metrics[0].value, 100);
});

test('overall verdict averages available scores without treating missing scores as zero', () => {
  const result = audienceSimilarityVerdict([90, 67, 100, 100, 71].map(value => ({ value })));
  assert.deepEqual(result, { score: 86, band: 'high', label: 'Highly similar' });
  assert.deepEqual(audienceSimilarityVerdict([50, null, 100].map(value => ({ value }))), { score: 75, band: 'medium', label: 'Some overlap' });
  assert.deepEqual(audienceSimilarityVerdict([{ value: 0 }, { value: 100 }]), { score: 50, band: 'low', label: 'Well differentiated' });
  assert.deepEqual(audienceSimilarityVerdict([{ value: 76 }]), { score: 76, band: 'high', label: 'Highly similar' });
  assert.deepEqual(audienceSimilarityVerdict([{ value: 51 }]), { score: 51, band: 'medium', label: 'Some overlap' });
});
test('overall verdict has a neutral fallback for missing or invalid evidence', () => {
  for (const metrics of [undefined, [], [{value:null},{value:NaN},{value:Infinity},{value:-1},{value:101}]]) {
    assert.deepEqual(audienceSimilarityVerdict(metrics), { score: null, band: null, label: 'Not available' });
  }
});
