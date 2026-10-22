import { projectOutputs, outputIsReady, selectedOutputs } from './outputs.js?v=20261021-adapt-count';

const selectionKeys = ['selectedOutputId', 'selectedOutputIds', 'selectedPendingOutputIds', 'lastPendingOutputId', 'viewOriginalDraft'];
const selectionOf = project => Object.fromEntries(selectionKeys.map(key => [key, structuredClone(project[key])]));
const referencesVariant = (project, projectId, outputId) => project.variantPreset?.projectId === projectId && project.variantPreset.outputId === outputId;

export function removeVariant(projects, projectId, outputId, persist) {
  const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
  if (!project || project.outputProcessing) return null;
  const outputs = projectOutputs(project);
  const index = outputs.findIndex(output => output.id === outputId);
  if (index < 0) return null;
  const output = outputs[index];
  const remaining = outputs.filter(entry => entry.id !== outputId);
  const selectedIds = selectedOutputs(project).filter(entry => entry.id !== outputId).map(entry => entry.id);
  const pending = remaining.filter(entry => !outputIsReady(entry));
  const nextPending = pending.find(entry => selectedIds.includes(entry.id)) || pending[0];
  const wasActive = project.selectedOutputId === outputId || (project.viewOriginalDraft && project.lastPendingOutputId === outputId);
  const nextProject = { ...project, outputs: remaining, selectedOutputIds: selectedIds, updatedAt: Date.now() };
  if (Array.isArray(project.selectedPendingOutputIds)) nextProject.selectedPendingOutputIds = project.selectedPendingOutputIds.filter(id => id !== outputId);
  if (project.lastPendingOutputId === outputId) nextProject.lastPendingOutputId = nextPending?.id || null;
  if (wasActive || !remaining.length) {
    const selectedPending = pending.find(entry => selectedIds.includes(entry.id));
    const neighbors = [...outputs.slice(index + 1), ...outputs.slice(0, index).reverse()];
    const fallback = project.viewOriginalDraft && selectedPending ? null : neighbors.find(entry => outputIsReady(entry) || entry.needsRegeneration);
    nextProject.selectedOutputId = fallback?.id || null;
    nextProject.viewOriginalDraft = !fallback;
    if (fallback) nextProject.selectedOutputIds = outputIsReady(fallback) ? [fallback.id] : [...new Set([...selectedIds, fallback.id])];
    else {
      nextProject.lastPendingOutputId = nextPending?.id || null;
      nextProject.selectedOutputIds = selectedIds.length ? selectedIds : nextPending ? [nextPending.id] : [];
    }
  }
  const presetReferences = projects.filter(entry => referencesVariant(entry, projectId, outputId)).map(entry => entry.id);
  const next = projects.map(entry => {
    let value = entry.id === projectId ? nextProject : entry;
    if (presetReferences.includes(entry.id)) { value = { ...value }; delete value.variantPreset; }
    return value;
  });
  const undo = {
    projectId, output: structuredClone(output), index, wasActive,
    selection: selectionOf(project), afterSelection: selectionOf(nextProject), presetReferences,
  };
  persist(next);
  return { projects: next, undo };
}

export function restoreVariant(projects, undo, persist) {
  const project = projects.find(entry => entry.id === undo.projectId && !entry.deletedAt);
  if (!project || projectOutputs(project).some(output => output.id === undo.output.id)) return null;
  const outputs = [...projectOutputs(project)];
  outputs.splice(Math.min(undo.index, outputs.length), 0, structuredClone(undo.output));
  const nextProject = { ...project, outputs, updatedAt: Date.now() };
  if (!project.outputProcessing && JSON.stringify(selectionOf(project)) === JSON.stringify(undo.afterSelection)) Object.assign(nextProject, structuredClone(undo.selection));
  const next = projects.map(entry => {
    let value = entry.id === undo.projectId ? nextProject : entry;
    if (!entry.deletedAt && undo.presetReferences.includes(entry.id) && !value.variantPreset) value = { ...value, variantPreset: { projectId: undo.projectId, outputId: undo.output.id } };
    return value;
  });
  persist(next);
  return { projects: next };
}
