import { draftSourcesFor, sourceIdentityKey } from './source-model.js?v=20261106-own-material-source';

const text = value => typeof value === 'string' ? value : '';
const hasWords = value => /[\p{L}\p{N}]/u.test(text(value));
const title = value => text(value).replace(/\s+/gu, ' ').trim();

// Keep the comparison baseline detached from stored drafts and source snapshots.
function content(record) {
  if (!record || typeof record !== 'object' || record.deletedAt) return null;
  if (Array.isArray(record.document?.ops)) {
    const ops = record.document.ops.filter(op => typeof op?.insert === 'string').map(op => {
      const attributes = Object.fromEntries(Object.entries(op.attributes || {}).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)));
      return { insert: op.insert, ...(Object.keys(attributes).length ? { attributes } : {}) };
    });
    const draftText = ops.map(op => op.insert).join('').replace(/\n$/, '');
    // An explicitly cleared rich document takes precedence over stale plain text.
    return hasWords(draftText) ? { draftText, document: { ops } } : null;
  }
  const draftText = typeof record.draftText === 'string' ? record.draftText
    : typeof record.text === 'string' ? record.text
      : Array.isArray(record.paragraphs) ? record.paragraphs.filter(value => typeof value === 'string').join('\n\n') : '';
  return hasWords(draftText) ? { draftText } : null;
}

function sourceContent(source) {
  if (!source || source.type === 'search' || source.deletedAt) return null;
  let body = text(source.text);
  if (body.startsWith('Fictional sample article · ')) {
    const split = body.indexOf('\n\n');
    body = split >= 0 ? body.slice(split + 2) : '';
  }
  if (/^https?:\/\/\S+$/u.test(body.trim())) body = '';
  if (!hasWords(body)) body = text(source.description) || text(source.excerpt);
  const value = content({ ...source, text: body });
  return value && { ...value, title: title(source.title) };
}

function combineSources(sources) {
  const seen = new Set();
  const available = [];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const key = sourceIdentityKey(source);
    if (seen.has(key)) continue;
    const value = sourceContent(source);
    if (!value) continue;
    seen.add(key);
    available.push(value);
  }
  if (!available.length) return null;
  // Several source headlines are not one headline; leave that metric unavailable.
  return available.length === 1 ? available[0] : { title: '', draftText: available.map(value => value.draftText).join('\n\n') };
}

/**
 * Build a read-only comparison baseline, never a persisted or editable output.
 * Existing original/base content wins. Source text is used for the local demo;
 * copying an available draft is the final, explicitly marked prototype fallback.
 */
export function createSimilaritySourceDraft(project, comparisonDrafts = []) {
  if (!project || project.deletedAt || project.archivedAt) return null;
  const id = `similarity-source:${text(project.id) || 'project'}`;
  const drafts = (Array.isArray(comparisonDrafts) ? comparisonDrafts : []).filter(draft => draft && !draft.isSimilaritySource);
  const outputs = Array.isArray(project.outputs) ? project.outputs : [];
  const baseline = (record, origin, extra = {}) => {
    const value = content(record);
    return value ? {
      id, title: title(record.title), status: 'ready', isSimilaritySource: true,
      toolPreferences: {}, labels: [], ...value, similaritySourceOrigin: origin, ...extra,
    } : null;
  };
  // sourceDraft is an optional explicit backend record; current local projects
  // store their original draft on the project or in sourceStory.
  let result = baseline(project.sourceDraft, 'source-draft')
    || baseline(project, 'original-draft')
    || baseline(project.sourceStory, 'source-story');
  if (result) return result;
  const ownMaterial = [outputs.find(output => output?.id === project.ownMaterialOutputId), ...outputs.filter(output => output?.ownMaterial === true)];
  for (const output of ownMaterial) {
    result = baseline(output, 'own-material');
    if (result) return result;
  }

  const captured = drafts.flatMap(draft => draftSourcesFor(project, draft));
  result = baseline(combineSources(captured), 'captured-sources');
  if (result) return result;
  const removed = new Set(Array.isArray(project.removedSourceKeys) ? project.removedSourceKeys : []);
  const selected = (Array.isArray(project.sources) ? project.sources : []).filter(source => source && source.selected !== false && !removed.has(sourceIdentityKey(source)));
  result = baseline(combineSources(selected), 'project-sources');
  if (result) return result;
  result = baseline(project.contentPreview, 'content-preview');
  if (result) return result;

  for (const draft of [...drafts, ...outputs]) {
    if (!draft || draft.isSimilaritySource || draft.deletedAt || draft.needsRegeneration
      || (draft.status && draft.status !== 'ready')) continue;
    result = baseline(draft, 'draft-fallback', {
      similaritySourceFallback: true,
      similaritySourceDraftId: draft.id,
      similaritySourceNote: 'Prototype baseline copied from an available draft because no source text is stored.',
    });
    if (result) return result;
  }
  return null;
}
