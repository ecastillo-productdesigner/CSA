import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimilaritySourceDraft } from '../dist/audience-similarity-source.js';
import { compareAudienceDrafts } from '../dist/audience-similarity.js';
import { sourceIdentityKey } from '../dist/source-model.js';

const draft = (id = 'draft', body = 'Families explore the new museum exhibit together.') => ({ id, title: 'A new museum exhibit', status: 'ready', draftText: body });
const source = (text, extra = {}) => ({ type: 'text', title: 'The source article', text, ...extra });

test('uses an explicit hidden source draft first and creates a detached read-only comparison record', () => {
  const original = { title: 'Original headline', document: { ops: [{ insert: 'Source body', attributes: { bold: true } }, { insert: '\n', attributes: { header: 2 } }] } };
  const project = { id: 'project-a', sourceDraft: original, draftText: 'Older project text', outputs: [draft()] };
  const before = structuredClone(project);
  const base = createSimilaritySourceDraft(project, project.outputs);
  assert.equal(base.id, 'similarity-source:project-a');
  assert.equal(base.isSimilaritySource, true);
  assert.equal(base.status, 'ready');
  assert.equal(base.title, 'Original headline');
  assert.deepEqual(base.toolPreferences, {});
  assert.deepEqual(base.labels, []);
  assert.equal(base.similaritySourceOrigin, 'source-draft');
  assert.equal(base.draftText, 'Source body');
  assert.notEqual(base.document, original.document);
  base.document.ops[0].attributes.bold = false;
  assert.deepEqual(project, before);
});

test('uses the stored original document before sourceStory, with a project-scoped stable identity', () => {
  const project = { id: 'project-a', title: 'Original headline', document: { ops: [{ insert: 'Original body\n' }] }, draftText: 'Stale text', sourceStory: { title: 'Story', paragraphs: ['Other body'] } };
  const first = createSimilaritySourceDraft(project);
  assert.equal(first.similaritySourceOrigin, 'original-draft');
  assert.equal(first.draftText, 'Original body');
  assert.equal(first.id, createSimilaritySourceDraft(project).id);
  assert.notEqual(first.id, createSimilaritySourceDraft({ ...project, id: 'project-b' }).id);
});

test('an explicitly cleared original document does not revive stale plain text', () => {
  const project = { id: 'project', document: { ops: [{ insert: '\n' }] }, draftText: 'Stale original', sourceStory: { title: 'Base story', paragraphs: ['First source paragraph.', 'Second source paragraph.'] } };
  const base = createSimilaritySourceDraft(project);
  assert.equal(base.similaritySourceOrigin, 'source-story');
  assert.equal(base.title, 'Base story');
  assert.equal(base.draftText, 'First source paragraph.\n\nSecond source paragraph.');
});

test('uses actual own material even when another own-material card is empty', () => {
  const original = { ...draft('own', 'Typed source material.'), ownMaterial: true };
  const project = { id: 'project', ownMaterialOutputId: 'empty', outputs: [{ ...draft('empty', ''), ownMaterial: true }, original, draft()] };
  const base = createSimilaritySourceDraft(project);
  assert.equal(base.similaritySourceOrigin, 'own-material');
  assert.equal(base.draftText, 'Typed source material.');
  assert.equal(base.ownMaterial, undefined);
  assert.ok(compareAudienceDrafts(base, project.outputs[2]));
});

test('captured source text wins over unrelated current sources and duplicate snapshots appear once', () => {
  const captured = source('Captured museum reporting.', { type: 'link', url: 'https://example.test/museum' });
  const one = { ...draft('one'), sourceSnapshots: [captured] };
  const two = { ...draft('two'), sourceSnapshots: [structuredClone(captured)] };
  const project = { id: 'project', sources: [source('Unrelated new reporting.')], outputs: [one, two] };
  const base = createSimilaritySourceDraft(project, [one, two]);
  assert.equal(base.similaritySourceOrigin, 'captured-sources');
  assert.equal(base.draftText, 'Captured museum reporting.');
  assert.equal(base.title, 'The source article');
});

test('multiple captured sources provide combined body text without inventing a single headline', () => {
  const one = { ...draft(), sourceSnapshots: [source('First article.', { title: 'First' }), source('Second article.', { title: 'Second' })] };
  const base = createSimilaritySourceDraft({ id: 'project' }, [one]);
  assert.equal(base.draftText, 'First article.\n\nSecond article.');
  assert.equal(base.title, '');
  assert.equal(compareAudienceDrafts(base, one).metrics.find(metric => metric.key === 'headline').value, null);
});

test('selected project sources exclude deselected, removed and search-query records', () => {
  const removed = source('Removed reporting.');
  const project = { id: 'project', removedSourceKeys: [sourceIdentityKey(removed)], sources: [
    source('Deselected reporting.', { selected: false }), removed,
    source('museum query', { type: 'search' }), source('Selected source reporting.'),
  ] };
  const base = createSimilaritySourceDraft(project);
  assert.equal(base.similaritySourceOrigin, 'project-sources');
  assert.equal(base.draftText, 'Selected source reporting.');
});

test('source metadata is removed and available publisher excerpts are used without creating sample prose', () => {
  const project = { id: 'project', sources: [source('Fictional sample article · Publisher · Date\n\nActual stored preview text.')] };
  assert.equal(createSimilaritySourceDraft(project).draftText, 'Actual stored preview text.');
  project.sources = [source('https://example.test/story', { type: 'link', description: 'Available publisher excerpt.' })];
  assert.equal(createSimilaritySourceDraft(project).draftText, 'Available publisher excerpt.');
});

test('the last-resort prototype fallback is marked and uses deterministic existing text', () => {
  const first = draft('one');
  const second = draft('two', 'Different existing words.');
  const project = { id: 'project', outputs: [first, second] };
  const before = structuredClone(project);
  const base = createSimilaritySourceDraft(project, [first, second]);
  assert.equal(base.similaritySourceOrigin, 'draft-fallback');
  assert.equal(base.similaritySourceFallback, true);
  assert.equal(base.similaritySourceDraftId, first.id);
  assert.match(base.similaritySourceNote, /Prototype baseline/);
  assert.equal(base.draftText, first.draftText);
  assert.equal(compareAudienceDrafts(base, first).metrics.find(metric => metric.key === 'body').value, 100);
  assert.deepEqual(createSimilaritySourceDraft(project, [first, second]), base);
  assert.deepEqual(project, before);
});

test('stored source text drives scores even when copying a draft would have produced complete overlap', () => {
  const target = draft();
  const project = { id: 'project', sources: [source('Scientists mapped distant stars during winter nights.')], outputs: [target] };
  const base = createSimilaritySourceDraft(project, [target]);
  const comparison = compareAudienceDrafts(base, target);
  assert.equal(base.similaritySourceOrigin, 'project-sources');
  assert.equal(base.similaritySourceFallback, undefined);
  assert.equal(comparison.metrics.find(metric => metric.key === 'body').value, 0);
});

test('returns null only when the active project has no usable source, base or ready draft content', () => {
  assert.equal(createSimilaritySourceDraft(null), null);
  assert.equal(createSimilaritySourceDraft({ id: 'empty' }), null);
  assert.equal(createSimilaritySourceDraft({ id: 'empty', outputs: [{ ...draft(), status: 'pending' }] }), null);
  assert.equal(createSimilaritySourceDraft({ id: 'deleted', deletedAt: 1, draftText: 'Content' }), null);
  assert.equal(createSimilaritySourceDraft({ id: 'archived', archivedAt: 1, draftText: 'Content' }), null);
});
