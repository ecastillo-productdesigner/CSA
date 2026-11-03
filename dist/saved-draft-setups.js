import { draftOptions } from './draft-options.js?v=20261026-drafting-card-size';
import { normalizeWordCount } from './variant-word-count.js?v=20261026-drafting-card-size';

const preferenceKeys = ['format', 'audience', 'voice'];
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';
const nameText = value => text(value).trim().slice(0, 180);
const outputsFor = project => Array.isArray(project?.outputs)
  ? project.outputs.filter(output => record(output) && typeof output.id === 'string' && typeof output.title === 'string')
  : [];
const available = value => record(value) && !value.deletedAt && !value.archivedAt;
const projectList = projects => Array.isArray(projects) ? projects : [];

function configurationFor(output) {
  const saved = record(output?.presetSettings) ? output.presetSettings : null;
  const preferences = saved?.toolPreferences ?? output?.toolPreferences;
  const labels = saved?.labels ?? output?.labels;
  return {
    // Keep historical values in the saved record, even if a current dropdown
    // cannot offer them. Missing keys remain distinguishable from cleared ones.
    toolPreferences: record(preferences)
      ? Object.fromEntries(preferenceKeys.filter(key => Object.hasOwn(preferences, key)).map(key => [key, text(preferences[key])]))
      : {},
    labels: (Array.isArray(labels) ? labels : [])
      .filter(label => record(label) && preferenceKeys.includes(label.key) && typeof label.label === 'string')
      .map(label => ({ ...label })),
    editorialDirection: text(saved?.editorialDirection ?? output?.editorialDirection),
    targetWordCount: normalizeWordCount(saved?.targetWordCount ?? output?.targetWordCount),
  };
}

function nameFor(output) {
  const presetName = nameText(output?.presetSettings?.name);
  const originalName = nameText(output?.name);
  const hasCustomName = output?.nameEdited ?? Boolean(originalName && originalName !== output?.title);
  return presetName || (hasCustomName ? originalName : '') || `Saved Draft ${output?.savedVariantNumber || 1}`;
}

function findOutput(projects, projectId, outputId) {
  const project = projectList(projects).find(entry => available(entry) && entry.id === projectId);
  const output = outputsFor(project).find(entry => available(entry) && entry.id === outputId);
  return output ? { project, output } : null;
}

export function listSavedDraftSetups(projects) {
  return projectList(projects).filter(available)
    .flatMap(project => outputsFor(project).filter(output => available(output) && output.isFavorite)
      .map(output => ({ project, output, name: nameFor(output), configuration: configurationFor(output) })))
    .sort((a, b) => (Number(b.output.favoritedAt) || Number(b.output.createdAt) || 0)
      - (Number(a.output.favoritedAt) || Number(a.output.createdAt) || 0));
}

export function saveDraftSetup(projects, projectId, outputId, { name, now = Date.now() } = {}) {
  const found = findOutput(projects, projectId, outputId);
  if (!found) return null;
  const { output } = found;
  if (!(Number.isInteger(output.savedVariantNumber) && output.savedVariantNumber > 0)) {
    output.savedVariantNumber = projectList(projects).flatMap(outputsFor)
      .reduce((highest, entry) => Number.isInteger(entry.savedVariantNumber) && entry.savedVariantNumber > highest
        ? entry.savedVariantNumber : highest, 0) + 1;
  }
  const configuration = configurationFor(output);
  const nextName = nameText(name) || nameFor(output);
  if (!output.isFavorite || !Number.isFinite(output.favoritedAt)) output.favoritedAt = now;
  output.isFavorite = true;
  output.presetSettings = { name: nextName, ...configuration };
  return output;
}

export function removeSavedDraftSetup(projects, projectId, outputId) {
  const found = findOutput(projects, projectId, outputId);
  if (!found || !found.output.isFavorite) return null;
  found.output.isFavorite = false;
  delete found.output.favoritedAt;
  for (const project of projectList(projects)) {
    if (project?.variantPreset?.projectId === projectId && project.variantPreset.outputId === outputId) delete project.variantPreset;
  }
  return found.output;
}

function currentPreference(key, configuration) {
  const options = draftOptions.find(option => option.key === key)?.options || [];
  const value = configuration.toolPreferences[key];
  // An explicit None Selected must not be undone by an older display label.
  if (Object.hasOwn(configuration.toolPreferences, key) && !value) return '';
  if (options.some(option => option.value === value)) return value;
  const label = configuration.labels.find(entry => entry.key === key)?.label.trim().toLowerCase();
  return options.find(option => option.value && option.label.trim().toLowerCase() === label)?.value || '';
}

export function applySavedDraftSetup(projects, currentProject, projectId, outputId) {
  const found = findOutput(projects, projectId, outputId);
  if (!record(currentProject) || !found?.output.isFavorite) return false;
  const configuration = configurationFor(found.output);
  currentProject.toolPreferences = Object.fromEntries(preferenceKeys.map(key => [key, currentPreference(key, configuration)]));
  currentProject.editorialDirection = configuration.editorialDirection;
  currentProject.targetWordCount = configuration.targetWordCount;
  currentProject.variantPreset = { projectId, outputId };
  return true;
}

export function clearSavedDraftSetup(currentProject) {
  if (!available(currentProject)) return false;
  delete currentProject.variantPreset;
  currentProject.toolPreferences = Object.fromEntries(preferenceKeys.map(key => [key, '']));
  currentProject.editorialDirection = '';
  currentProject.targetWordCount = normalizeWordCount(undefined);
  return true;
}
