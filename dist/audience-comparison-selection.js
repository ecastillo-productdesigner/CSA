import { getEligibleAudienceDrafts, audienceSimilarityGroups } from './audience-similarity.js?v=20261119-comparison-selection';

/** Comparison selection is independent of pending selections and the open draft. */
export function currentAudienceComparison(project, selectedIds = []) {
  const eligible = new Map(getEligibleAudienceDrafts(project).map(draft => [draft.id, draft]));
  const ids = [...new Set(Array.isArray(selectedIds) ? selectedIds : [])].filter(id => eligible.has(id));
  const drafts = ids.map(id => eligible.get(id));
  let group = null;
  if (drafts.length > 1) {
    const shared = audienceSimilarityGroups({ ...project, outputs: drafts }).find(item => item.drafts.length === drafts.length);
    group = shared || { key: 'selected-drafts', label: 'Selected Drafts', drafts };
  }
  return { ids, group };
}

/** Keep every explicit eligible choice, regardless of audience. */
export function toggleAudienceComparison(project, selectedIds, outputId) {
  const current = currentAudienceComparison(project, selectedIds);
  if (current.ids.includes(outputId)) return { ids: current.ids.filter(id => id !== outputId), reason: '' };
  if (!getEligibleAudienceDrafts(project).some(draft => draft.id === outputId)) return { ids: current.ids, reason: 'unavailable' };
  return { ids: [...current.ids, outputId], reason: '' };
}
