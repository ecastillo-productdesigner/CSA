import { savedVariantName } from './outputs.js?v=20261030-draft-status-and-history';
import { normalizeWordCount } from './variant-word-count.js?v=20261026-drafting-card-size';
const keys = ['format', 'audience', 'voice'];
export function presetConfiguration(output) {
  const saved = output?.presetSettings;
  return {
    toolPreferences: saved?.toolPreferences || output?.toolPreferences || {},
    labels: saved?.labels || output?.labels || [],
    editorialDirection: saved?.editorialDirection ?? output?.editorialDirection ?? '',
    targetWordCount: normalizeWordCount(saved?.targetWordCount ?? output?.targetWordCount),
  };
}
export function savedPresetName(output) {
  return output?.presetSettings?.name?.trim() || savedVariantName(output);
}
export function updatePresetPreferences(project, preferences) {
  const next = Object.fromEntries(keys.map(key => [key, preferences[key] || '']));
  const detached = Boolean(project.variantPreset && keys.some(key => (project.toolPreferences?.[key] || '') !== next[key]));
  if (detached) delete project.variantPreset;
  project.toolPreferences = next;
  return detached;
}
export function setSavedPresetSettings(output, settings) {
  output.presetSettings = {
    name: settings.name.trim().slice(0, 180),
    toolPreferences: Object.fromEntries(keys.map(key => [key, settings.toolPreferences[key] || ''])),
    labels: settings.labels.map(label => ({ ...label })),
    editorialDirection: settings.editorialDirection,
    targetWordCount: normalizeWordCount(settings.targetWordCount ?? presetConfiguration(output).targetWordCount),
  };
}
