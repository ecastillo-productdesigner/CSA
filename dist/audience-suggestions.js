const storageKey = 'csa.audience-suggestions.v1';

function audienceLabel(value) {
  if (typeof value !== 'string') return '';
  const label = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return label.length <= 160 ? label : '';
}

// Stable IDs let the same suggestion retain its favorite and saved-setting references.
export function suggestedAudienceValue(label) {
  const normalized = audienceLabel(label).toLowerCase();
  if (!normalized) return '';
  try { return `suggested-audience:${encodeURIComponent(normalized)}`; }
  catch { return ''; }
}

function validOptions(records) {
  const options = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const label = audienceLabel(record?.label);
    const value = suggestedAudienceValue(label);
    if (value && record?.value === value) options.set(value, { value, label });
  }
  return options;
}

export function createAudienceSuggestionLibrary({ storage = () => globalThis.localStorage } = {}) {
  let records = new Map();
  const pending = new Map();
  const options = () => [...records.values()].map(option => ({ ...option }));
  function refresh() {
    try {
      const target = storage();
      if (typeof target?.getItem !== 'function') return options();
      const raw = target.getItem(storageKey);
      let saved;
      try { saved = raw ? JSON.parse(raw) : []; } catch { saved = []; }
      records = new Map([...validOptions(saved), ...pending]);
    } catch { /* Keep session choices if storage cannot be read. */ }
    return options();
  }
  function remember(choices) {
    const additions = validOptions(choices);
    if (!additions.size) return { persisted: false, options: options() };
    refresh();
    for (const [value, option] of additions) {
      records.set(value, option);
      pending.set(value, option);
    }
    let persisted = false;
    try {
      const target = storage();
      if (typeof target?.setItem === 'function') {
        target.setItem(storageKey, JSON.stringify(options()));
        pending.clear();
        persisted = true;
      }
    } catch { /* Suggestions remain selectable for this session. */ }
    return { persisted, options: options() };
  }
  refresh();
  return { options, remember, refresh };
}

export const audienceSuggestionLibrary = createAudienceSuggestionLibrary();

// Each column is a reader perspective; rows provide different ways to name it.
const demoTopics = [
  { key: 'style', terms: /\b(fashion|style|clothing|dresses|dress|wardrobe|shopping|shoppers?|jeans)\b/g,
    names: [
      ['Practical Style Seekers', 'Value-Conscious Shoppers', 'Trend-Curious Readers'],
      ['Everyday Wardrobe Planners', 'Budget-Minded Style Shoppers', 'Fashion Discovery Readers'],
      ['Readers Building a Versatile Wardrobe', 'Shoppers Comparing Style and Value', 'Followers of Everyday Fashion'],
      ['Everyday Outfit Planners', 'Readers Looking for Affordable Style', 'Readers Exploring New Style Ideas'],
    ] },
  { key: 'civic', terms: /\b(politics|political|policy|elections?|government|civic|governor|congress|democrats?|republicans?|voters?|taxpayers?|council|public spending)\b/g,
    names: [
      ['Local Election Watchers', 'Civic Accountability Readers', 'Public Policy Followers'],
      ['Voters Following Community Change', 'Readers Tracking Local Decisions', 'Readers Seeking Policy Context'],
      ['Readers Following Political Shifts', 'Community Affairs Readers', 'Readers Exploring Public Issues'],
      ['Election Context Seekers', 'Readers Following Civic Life', 'Readers Tracking Policy Changes'],
    ] },
  { key: 'sports', terms: /\b(sports?|football|basketball|baseball|soccer|athletes?|teams?|season|panthers|stadiums?|arena|season ticket)\b/g,
    names: [
      ['Longtime Sports Fans', 'Fans Following the Season', 'Sports Business Readers'],
      ['Game-Day Regulars', 'Readers Following Team Stories', 'Readers Exploring the Business of Sports'],
      ['Fans Revisiting Team History', 'Season Highlights Followers', 'Sports Industry Observers'],
      ['Dedicated Team Supporters', 'Readers Looking Beyond the Score', 'Readers Following Sports Investment'],
    ] },
  { key: 'health', terms: /\b(health|wellness|fitness|exercise|nutrition|medical)\b/g,
    names: [
      ['Everyday Wellness Readers', 'Evidence-Curious Health Readers', 'Healthy Habit Seekers'],
      ['Readers Exploring Wellbeing', 'Health Research Followers', 'Practical Fitness Readers'],
      ['Readers Building Healthy Routines', 'Readers Seeking Health Context', 'Everyday Movement Enthusiasts'],
      ['Wellbeing News Followers', 'Readers Exploring Medical Research', 'Readers Making Everyday Health Choices'],
    ] },
  { key: 'technology', terms: /\b(technology|tech|software|digital|computers?|artificial intelligence)\b/g,
    names: [
      ['Technology-Curious Readers', 'Everyday Tech Users', 'Digital Trend Followers'],
      ['Readers Exploring New Technology', 'Practical Digital Learners', 'Technology News Followers'],
      ['New Technology Explorers', 'Readers Choosing Digital Tools', 'Readers Following Digital Change'],
      ['Readers Curious About Innovation', 'Everyday Software Users', 'Readers Tracking Technology Trends'],
    ] },
  { key: 'food', terms: /\b(food|cooking|recipes?|restaurants?|meals?|chefs?)\b/g,
    names: [
      ['Home Cooking Enthusiasts', 'Local Food Explorers', 'Everyday Meal Planners'],
      ['Recipe Discovery Readers', 'Readers Following Food Culture', 'Practical Kitchen Learners'],
      ['Cooks Trying New Ideas', 'Neighborhood Dining Followers', 'Readers Planning Seasonal Meals'],
      ['Everyday Home Cooks', 'Readers Exploring Restaurant Stories', 'Readers Building Kitchen Skills'],
    ] },
  { key: 'travel', terms: /\b(travel|trips?|tourism|vacations?|destinations?|tourists?)\b/g,
    names: [
      ['Curious Travelers', 'Weekend Explorers', 'Practical Trip Planners'],
      ['Readers Exploring Destinations', 'Travel Inspiration Seekers', 'Readers Planning Their Next Trip'],
      ['Destination Discovery Readers', 'Local Adventure Readers', 'Travel Itinerary Planners'],
      ['Readers Curious About New Places', 'Short Getaway Planners', 'Readers Comparing Travel Options'],
    ] },
  { key: 'community', terms: /\b(local|community|neighborhood|city|town|residents?|volunteers?)\b/g,
    names: [
      ['Local Community Readers', 'Neighborhood Changemakers', 'Readers Seeking Local Context'],
      ['Community News Followers', 'Neighborhood Volunteers', 'Readers Exploring Local Life'],
      ['Readers Following Neighborhood Change', 'Community Project Supporters', 'Local History Enthusiasts'],
      ['Readers Keeping Up with Local Stories', 'Neighbors Shaping Community Life', 'Readers Exploring Community Connections'],
    ] },
];

const generalNames = [
  ['Curious General Readers', 'People Following the Story', 'Readers Seeking Practical Context'],
  ['Readers Exploring the Topic', 'Readers Following New Developments', 'Readers Looking for Useful Takeaways'],
  ['Readers Seeking a Fresh Perspective', 'Readers Connecting the Stories', 'Readers Looking for Everyday Relevance'],
  ['Readers Getting to Know the Subject', 'Readers Following the Bigger Picture', 'Readers Exploring What Comes Next'],
];

function sourceEvidence(sources) {
  // Bound each source separately so a long first article cannot hide later ones.
  const normalize = value => typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
  return (Array.isArray(sources) ? sources : [])
    .filter(source => source && source.selected !== false && !source.deletedAt)
    .map(source => ({ title: normalize(source.title).slice(0, 500),
      body: ['text', 'description', 'summary'].map(key => normalize(source[key]).slice(0, 4000)).join(' ').trim() }))
    .filter(source => source.title || source.body);
}

function topicNames(topic, context) {
  if (topic.key === 'sports' && /\b(stadiums?|arena|panthers)\b/.test(context)) {
    const fans = /\bpanthers\b/.test(context)
      ? ['Longtime Panthers Fans', 'Panthers Season Ticket Holders', 'Panthers Game-Day Regulars', 'Fans Following Panthers History']
      : ['Longtime Stadium-Goers', 'Stadium History Enthusiasts', 'Stadium Game-Day Regulars', 'Fans Revisiting Stadium Memories'];
    const industry = ['Stadium Business Readers', 'Sports Venue Industry Observers', 'Readers Following Stadium Investment', 'Readers Exploring the Stadium Economy'];
    return topic.names.map((names, index) => [fans[index], names[1],
      /\b(stadiums?|arena)\b/.test(context) ? industry[index] : names[2]]);
  }
  if (topic.key === 'civic' && /\bcharlotte\b/.test(context)) {
    return [
      ['Charlotte Civic Affairs Readers', 'Charlotte Accountability Readers', 'Charlotte Public Policy Followers'],
      ['Charlotte Community Decision Watchers', 'Readers Following Charlotte City Decisions', 'Readers Tracking Charlotte Policy'],
      ['Charlotte Voters Following Local Change', 'Charlotte Civic Life Readers', 'Readers Exploring Charlotte Public Issues'],
      ['Readers Following Charlotte Politics', 'Charlotte Community Affairs Readers', 'Charlotte Policy Context Seekers'],
    ];
  }
  return topic.names;
}

// The static prototype has no AI service. New generations combine topic-based
// reader perspectives and prefer wording not already used in this project.
// Persisted generations and label-based favorite IDs are never rewritten.
export function demoAudienceSuggestions(sources, { iteration = 0, previousSuggestions = [] } = {}) {
  const evidence = sourceEvidence(sources);
  if (!evidence.length) return [];
  const ranked = demoTopics.map(topic => ({ ...topic, score: evidence.reduce((score, source) => {
    const titleMatches = new Set(source.title.match(topic.terms) || []).size;
    const bodyMatches = new Set(source.body.match(topic.terms) || []).size;
    return score + Math.min(titleMatches, 4) * 3 + Math.min(bodyMatches, 4);
  }, 0) })).filter(topic => topic.score > 0).sort((first, second) => second.score - first.score);
  const themes = ranked.slice(0, 3).map(topic => {
    const context = evidence.filter(source => `${source.title} ${source.body}`.match(topic.terms))
      .map(source => `${source.title} ${source.body}`).join(' ');
    return topicNames(topic, context);
  });
  if (!themes.length) themes.push(generalNames);
  // Include the secondary topic instead of making every audience describe only
  // the largest story. With two themes, the third choice adds a different angle.
  const perspectives = themes.length === 1 ? [[0, 0], [0, 1], [0, 2]]
    : themes.length === 2 ? [[0, 0], [1, 0], [0, 2]] : [[0, 0], [1, 0], [2, 0]];
  let fingerprint = 2166136261;
  for (const character of JSON.stringify(evidence.map(source => [source.title, source.body]).sort())) {
    fingerprint = Math.imul(fingerprint ^ character.charCodeAt(0), 16777619);
  }
  const generation = Number.isSafeInteger(iteration) && iteration >= 0 ? iteration : 0;
  const used = new Map();
  for (const previous of Array.isArray(previousSuggestions) ? previousSuggestions : []) {
    const value = suggestedAudienceValue(previous?.label);
    if (value) used.set(value, (used.get(value) || 0) + 1);
  }
  return perspectives.map(([theme, angle]) => {
    const names = themes[theme];
    const offset = ((fingerprint >>> 0) + evidence.length + generation) % names.length;
    const candidates = names.map((_, index) => names[(index + offset) % names.length][angle]);
    candidates.sort((first, second) => (used.get(suggestedAudienceValue(first)) || 0) - (used.get(suggestedAudienceValue(second)) || 0));
    const label = candidates[0];
    return { value: suggestedAudienceValue(label), label };
  });
}
