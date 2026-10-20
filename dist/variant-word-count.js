export const audienceWordCounts = {
  short: { min: 500, max: 800 },
  medium: { min: 800, max: 1200 },
  long: { min: 1200, max: 1500 },
};

export function normalizeWordCount(value) {
  return Object.hasOwn(audienceWordCounts, value) ? value : 'short';
}

export function setProjectWordCount(project, value) {
  const next = normalizeWordCount(value);
  const detached = Boolean(project.variantPreset && normalizeWordCount(project.targetWordCount) !== next);
  if (detached) delete project.variantPreset;
  project.targetWordCount = next;
  return detached;
}
