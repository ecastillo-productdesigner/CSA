// Retain only an empty ID marker so built-in demo projects stay deleted on reload.
export function removeProjectContent(projects, projectId, persist) {
  const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
  if (!project) return null;
  const remaining = projects.filter(entry => entry.id !== projectId);
  const sharedAttachments = new Set(remaining.flatMap(entry => entry.sources || []).map(source => source.attachmentId).filter(Boolean));
  const attachmentIds = [...new Set(project.sources.map(source => source.attachmentId).filter(id => id && !sharedAttachments.has(id)))];
  const next = projects.map(entry => entry.id === projectId ? {
    id: entry.id, title: 'Deleted project', createdAt: entry.createdAt, sources: [], deletedAt: Date.now(),
  } : entry);
  // Persist before the caller changes its current state. A failed write cancels deletion.
  persist(next);
  return { projects: next, attachmentIds };
}
