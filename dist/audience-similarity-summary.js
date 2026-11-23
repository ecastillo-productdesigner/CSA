import { getEligibleAudienceDrafts, compareAudienceDrafts, audienceSimilarityVerdict } from './audience-similarity.js?v=20261123-score-first';
import { createSimilaritySourceDraft } from './audience-similarity-source.js?v=20261123-source-average';

const preparedProjects = new WeakMap();

/** A collision-safe, order-independent key for one draft pair. */
export function audienceSimilarityPairKey(leftId, rightId) {
  return JSON.stringify([leftId, rightId].sort());
}

/** Content and eligibility that can affect an existing prepared comparison. */
export function audienceSimilarityDraftSignature(draft) {
  return JSON.stringify([
    draft?.id, draft?.title, draft?.status, draft?.deletedAt, draft?.needsRegeneration, draft?.ownMaterial,
    Array.isArray(draft?.document?.ops) ? draft.document.ops : draft?.draftText,
    draft?.toolPreferences?.audience, draft?.labels,
  ]);
}

/** Average the available Overall percentages actually displayed in comparison rows. */
export function averageDisplayedSimilarities(comparisons) {
  const values = comparisons.map(comparison => audienceSimilarityVerdict(comparison?.metrics).score)
    .filter(value => value !== null);
  const { score, band } = audienceSimilarityVerdict(values.map(value => ({ value })));
  return { score, band, comparisonCount: values.length };
}

/** Prepare ready-to-view comparisons as drafts finish, and reuse them until content changes. */
export function prepareAudienceSimilarities(project) {
  const drafts = getEligibleAudienceDrafts(project);
  const candidateSource = drafts.length > 1 ? createSimilaritySourceDraft(project, drafts) : null;
  const sourceDraft = candidateSource && !drafts.some(draft => draft.id === candidateSource.id) ? candidateSource : null;
  const signature = JSON.stringify([drafts.map(audienceSimilarityDraftSignature), sourceDraft]);
  const canCache = project !== null && typeof project === 'object';
  const previous = canCache ? preparedProjects.get(project) : null;
  if (previous?.signature === signature && previous.result.drafts.length === drafts.length
    && drafts.every((draft, index) => previous.result.drafts[index] === draft)) return previous.result;

  const comparisons = new Map();
  const summaries = new Map();
  const rows = new Map(drafts.map(draft => [draft.id, []]));
  for (let left = 0; left < drafts.length; left++) {
    for (let right = left + 1; right < drafts.length; right++) {
      const comparison = compareAudienceDrafts(drafts[left], drafts[right]);
      if (!comparison) continue;
      comparisons.set(audienceSimilarityPairKey(drafts[left].id, drafts[right].id), comparison);
      rows.get(drafts[left].id).push(comparison);
      rows.get(drafts[right].id).push(comparison);
    }
  }
  // Use the exact same detached baseline and prepared values when opening the popup.
  const sourcePairs = sourceDraft ? drafts.map(draft => compareAudienceDrafts(sourceDraft, draft)) : [];
  const includeSource = sourcePairs.length > 0 && sourcePairs.every(Boolean);
  if (includeSource) drafts.forEach((draft, index) => {
    const comparison = sourcePairs[index];
    comparisons.set(audienceSimilarityPairKey(sourceDraft.id, draft.id), comparison);
    rows.get(draft.id).unshift(comparison);
  });
  for (const [id, comparisons] of rows) {
    if (drafts.length < 2) continue;
    const summary = averageDisplayedSimilarities(comparisons);
    if (summary.score === null) continue;
    summaries.set(id, { ...summary, includesSourceDraft: includeSource });
  }
  const result = {
    drafts,
    group: drafts.length > 1 ? { key: 'drafted-content', label: 'Drafted Content', drafts } : null,
    sourceDraft: includeSource ? sourceDraft : null,
    summaries,
    comparisons,
  };
  if (canCache) preparedProjects.set(project, { signature, result });
  return result;
}
