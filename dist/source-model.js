const isSource = value => value && typeof value === 'object' && !Array.isArray(value);

// A draft's captured sources never expand to include unrelated current sources.
export function draftSourcesFor(project, output) {
  if (Array.isArray(output?.sourceSnapshots)) return output.sourceSnapshots.filter(isSource);
  const sources = Array.isArray(project?.sources) ? project.sources : [];
  const indexes = Array.isArray(output?.selectedSourceIndexes) ? output.selectedSourceIndexes : [];
  return [...new Set(indexes)].filter(index => Number.isInteger(index) && index >= 0 && index < sources.length)
    .map(index => sources[index]).filter(isSource);
}

