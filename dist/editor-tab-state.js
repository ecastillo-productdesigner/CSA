import { projectOutputs, outputIsReady } from './outputs.js?v=20261123-score-first';

// Tab visibility is workspace state; a closed tab never removes its draft.
export function openEditorOutputs(project) {
  const closed = new Set(Array.isArray(project?.closedEditorOutputIds) ? project.closedEditorOutputIds : []);
  return projectOutputs(project).filter(output => (outputIsReady(output) || output.needsRegeneration) && !closed.has(output.id));
}

export function reopenEditorOutput(project, outputId) {
  const output = projectOutputs(project).find(output => output.id === outputId && (outputIsReady(output) || output.needsRegeneration));
  if (!output) return false;
  if (Array.isArray(project.closedEditorOutputIds)) {
    project.closedEditorOutputIds = project.closedEditorOutputIds.filter(id => id !== outputId);
  }
  return true;
}

export function closeEditorOutput(project, outputId) {
  const open = openEditorOutputs(project);
  const index = open.findIndex(output => output.id === outputId);
  if (index < 0) return project?.selectedOutputId ?? null;
  const existing = Array.isArray(project.closedEditorOutputIds) ? project.closedEditorOutputIds : [];
  project.closedEditorOutputIds = [...new Set([...existing, outputId])];
  if (project.selectedOutputId === outputId) {
    const remaining = open.filter(output => output.id !== outputId);
    project.selectedOutputId = remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
  }
  return project.selectedOutputId ?? null;
}
