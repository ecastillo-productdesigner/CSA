import { savedVariantName } from './outputs.js?v=20261020-preset-settings';
const keys = ['format', 'audience', 'voice'];
export function presetConfiguration(output) {
  const saved = output?.presetSettings;
  return {
    toolPreferences: saved?.toolPreferences || output?.toolPreferences || {},
    labels: saved?.labels || output?.labels || [],
    editorialDirection: saved?.editorialDirection ?? output?.editorialDirection ?? '',
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
  };
}
