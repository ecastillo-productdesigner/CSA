import { audienceSuggestionLibrary } from './audience-suggestions.js?v=20261111-audience-name-variation';

export const draftOptions = [
  {
    label: 'Format',
    key: 'format',
    options: [
      { value: '', label: 'None Selected' },
      { value: 'standard', label: 'Standard Format' },
      { value: 'celebrity-relationship-timeline', label: 'Celebrity Relationship Timeline' },
      { value: 'listicle', label: 'Listicle' },
      { value: 'whos-returning-to-show', label: 'Who’s Returning to the Show?' },
    ],
  },
  {
    label: 'Audience',
    key: 'audience',
    options: [
      { value: '', label: 'None Selected' },
      { value: 'general', label: 'General Audience' },
      { value: 'millennial-pop-culture', label: 'Millennial Pop-Culture Fan' },
      { value: 'wellness-enthusiast', label: 'Wellness Enthusiast' },
      { value: 'trend-chasing-fashion-shopper', label: 'Trend-Chasing Fashion Shopper' },
    ],
  },
  {
    label: 'Voice',
    key: 'voice',
    options: [
      { value: '', label: 'None Selected' },
      { value: 'us-weekly', label: 'Us Weekly' },
      { value: 'womans-world', label: "Woman's World" },
    ],
  },
];

export function getDraftOptions(key, { library = audienceSuggestionLibrary } = {}) {
  const configuration = draftOptions.find(item => item.key === key);
  if (!configuration) return [];
  return [...configuration.options, ...(key === 'audience' ? library.options() : [])]
    .map(option => ({ ...option }));
}

export function populateDraftOptions(root = document, { library = audienceSuggestionLibrary } = {}) {
  const fields = [...(root.matches?.('.composer-field') ? [root] : []), ...root.querySelectorAll('.composer-field')];
  for (const field of fields) {
    const configuration = draftOptions.find(item => item.label === field.dataset.label);
    const select = field.querySelector('select');
    if (!configuration || !select) continue;
    const previous = select.value;
    const options = getDraftOptions(configuration.key, { library }).map(item => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      return option;
    });
    select.replaceChildren(...options);
    select.value = draftPreferenceValue(configuration.key, previous, { library });
    delete field.dataset.fixedValue;
  }
}

export function draftPreferenceValue(key, value, { library = audienceSuggestionLibrary } = {}) {
  return getDraftOptions(key, { library }).some(option => option.value === value) ? value : '';
}

export function hasDraftSelection(preferences = {}, options = {}) {
  return draftOptions.some(({ key }) => Boolean(draftPreferenceValue(key, preferences?.[key], options)));
}
