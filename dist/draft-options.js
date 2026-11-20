import { audienceSuggestionLibrary, demoAudienceSuggestions } from './audience-suggestions.js?v=20261119-trend-hunter';

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

const trendHunterOptions = {
  format: [
    { value: '', label: 'None Selected' },
    { value: 'what-to-know', label: 'What to Know' },
    { value: 'video-script', label: 'Video Script' },
    { value: 'listicle', label: 'Listicle' },
  ],
  audience: [
    { value: '', label: 'None Selected' },
    { value: 'general', label: 'General Audience' },
  ],
  voice: [
    { value: '', label: 'None Selected' },
    { value: 'house-standard', label: 'House Standard', description: 'McClatchy brand voice, tone, and style preferences' },
    { value: 'apple-news', label: 'Apple News' },
    { value: 'centre-daily-times', label: 'Centre Daily Times', description: 'Emphasize local perspectives and community relevance' },
    { value: 'idaho-statesman', label: 'Idaho Statesman Voice Guide' },
    { value: 'msn-syndication', label: 'MSN Syndication' },
    { value: 'national-team', label: 'National Team Voice Guide' },
    { value: 'kansas-city-star', label: 'The Kansas City Star Voice Guide' },
    { value: 'news-observer', label: 'The News & Observer Voice Guide' },
    { value: 'trend-hunter-b2c', label: 'Trend Hunter B2C' },
    { value: 'us-weekly', label: 'Us Weekly Voice Guide' },
    { value: 'womans-world', label: "Woman's World" },
    { value: 'yahoo-news', label: 'Yahoo News' },
  ],
};

let draftOptionsContext = () => ({});

// Runtime context keeps shared catalogs independent of browser storage and lets
// design-system specimens continue to use their existing role-neutral choices.
export function setDraftOptionsContext(provider) {
  draftOptionsContext = typeof provider === 'function' ? provider : () => ({});
}

function resolveContext(options) {
  const context = draftOptionsContext() || {};
  return { library: audienceSuggestionLibrary, role: context.role, sources: context.sources, ...options };
}

function catalogOptions(key, { library = audienceSuggestionLibrary, role, sources }) {
  const configuration = draftOptions.find(item => item.key === key);
  if (!configuration) return [];
  const trendHunter = role === 'Trend Hunter';
  const contextual = key === 'audience' && trendHunter
    ? demoAudienceSuggestions(sources).map(option => ({ ...option, contextual: true })) : [];
  const options = [...(trendHunter ? trendHunterOptions[key] : configuration.options), ...contextual,
    ...(key === 'audience' ? library.options() : [])];
  const seen = new Set();
  return options.filter(option => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  }).map(option => ({ ...option }));
}

export function getDraftOptions(key, options = {}) {
  return catalogOptions(key, resolveContext(options));
}

export function populateDraftOptions(root = document, options = {}) {
  const context = resolveContext(options);
  const fields = [...(root.matches?.('.composer-field') ? [root] : []), ...root.querySelectorAll('.composer-field')];
  for (const field of fields) {
    const configuration = draftOptions.find(item => item.label === field.dataset.label);
    const select = field.querySelector('select');
    if (!configuration || !select) continue;
    const previous = select.value;
    const choices = catalogOptions(configuration.key, context);
    const current = [...select.options];
    const unchanged = current.length === choices.length && choices.every((item, index) => {
      const option = current[index];
      return option.value === item.value && option.textContent === item.label
        && (option.title || '') === (item.description || '')
        && (option.dataset.contextual === 'true') === Boolean(item.contextual);
    });
    if (!unchanged) {
      select.replaceChildren(...choices.map(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        option.title = item.description || '';
        option.dataset.contextual = String(Boolean(item.contextual));
        return option;
      }));
    }
    const value = choices.some(option => option.value === previous) ? previous : '';
    if (select.value !== value) select.value = value;
    delete field.dataset.fixedValue;
  }
}

export function draftPreferenceValue(key, value, options = {}) {
  return getDraftOptions(key, options).some(option => option.value === value) ? value : '';
}

export function hasDraftSelection(preferences = {}, options = {}) {
  const context = resolveContext(options);
  return draftOptions.some(({ key }) => catalogOptions(key, context)
    .some(option => Boolean(option.value) && option.value === preferences?.[key]));
}
