import { audienceSuggestionLibrary, demoAudienceSuggestions, suggestedAudienceValue } from './audience-suggestions.js?v=20261119-trend-hunter';

const materialIdentityKeys = ['ownMaterialOutputId', 'attachmentId'];
function materialIdentities(source) {
  return Object.fromEntries(materialIdentityKeys.filter(key => typeof source[key] === 'string' && source[key].trim())
    .map(key => [key, source[key]]));
}

function sourceContext(project) {
  if (!project || project.deletedAt || project.archivedAt) return [];
  return (Array.isArray(project.sources) ? project.sources : [])
    .filter(source => source && source.selected !== false && !source.deletedAt)
    .map(source => ({ ...Object.fromEntries(['id', 'url', 'title', 'text', 'description', 'summary']
      .map(key => [key, typeof source[key] === 'string' ? source[key] : ''])), ...materialIdentities(source) }))
    .filter(source => [source.title, source.text, source.description, source.summary].some(value => value.trim()));
}

// Fingerprint only: project storage already holds the actual source text.
function contextKey(project, sources) {
  const input = JSON.stringify(sources);
  let hash = 2166136261;
  let second = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ input.charCodeAt(index);
  }
  return `${project?.id || ''}:${input.length}:${hash >>> 0}:${second >>> 0}`;
}

function validSuggestions(choices) {
  if (!Array.isArray(choices) || choices.length !== 3) return [];
  const result = choices.filter(choice => typeof choice?.label === 'string'
    && choice.label.trim() && choice.value && choice.value === suggestedAudienceValue(choice.label))
    .map(choice => ({ value: choice.value, label: choice.label.trim() }));
  return result.length === 3 && new Set(result.map(choice => choice.value)).size === 3 ? result : [];
}

function validProject(project) {
  return project && typeof project.id === 'string' && project.id && !project.deletedAt && !project.archivedAt;
}

function projectContextKey(project, key) {
  if (!validProject(project) || typeof key !== 'string') return false;
  const prefix = `${project.id}:`;
  return key.startsWith(prefix) && /^\d+:\d+:\d+$/.test(key.slice(prefix.length));
}

function sourceSnapshots(sources) {
  if (!Array.isArray(sources) || sources.some(source => !source || typeof source !== 'object'
    || Array.isArray(source) || typeof source.title !== 'string'
    || (source.id !== undefined && typeof source.id !== 'string')
    || (source.url !== undefined && typeof source.url !== 'string')
    || materialIdentityKeys.some(key => source[key] !== undefined && typeof source[key] !== 'string'))) return null;
  return sources.map(source => ({ id: source.id || '', url: source.url || '', title: source.title, ...materialIdentities(source) }));
}

function captureSources(sources) {
  return sources.map(source => {
    const content = [source.text, source.description, source.summary]
      .find(value => typeof value === 'string' && value.trim()) || '';
    const excerpt = content.trim().split(/\s+/).slice(0, 8).join(' ');
    const title = typeof source.title === 'string' ? source.title.trim() : '';
    const url = typeof source.url === 'string' ? source.url : '';
    return { id: typeof source.id === 'string' ? source.id : '', url,
      title: title || excerpt || url.trim() || 'Untitled source', ...materialIdentities(source) };
  });
}

function matchSource(snapshot, liveSources) {
  let hasIdentity = false;
  for (const key of ['id', ...materialIdentityKeys, 'url']) {
    if (typeof snapshot[key] !== 'string' || !snapshot[key].trim()) continue;
    hasIdentity = true;
    const matches = liveSources.filter(source => source[key] === snapshot[key]);
    if (matches.length > 1) return null;
    if (matches.length === 1) return matches[0];
  }
  if (hasIdentity || !snapshot.title.trim()) return null;
  // Older records have no stable identity. A unique captured display title is
  // the only available fallback; never choose the first of several matches.
  const matches = liveSources.filter(source => captureSources([source])[0].title === snapshot.title.trim());
  return matches.length === 1 ? matches[0] : null;
}

function historyFor(project, key, sources) {
  if (!validProject(project)) return [];
  const seen = new Set();
  const history = (Array.isArray(project.audienceSuggestionHistory) ? project.audienceSuggestionHistory : [])
    .flatMap(group => {
      const suggestions = validSuggestions(group?.suggestions);
      const snapshots = sourceSnapshots(group?.sources);
      if (typeof group?.id !== 'string' || !group.id || seen.has(group.id)
        || !projectContextKey(project, group.key) || !Number.isSafeInteger(group.generatedAt)
        || group.generatedAt < 0 || !suggestions.length || !snapshots) return [];
      seen.add(group.id);
      return [{ id: group.id, key: group.key, generatedAt: group.generatedAt, sources: snapshots, suggestions,
        iteration: Number.isSafeInteger(group.iteration) && group.iteration >= 0 ? group.iteration : 0 }];
    });
  const cache = project.audienceSuggestions;
  const cachedSuggestions = validSuggestions(cache?.suggestions);
  const legacyId = `audience:legacy:${cache?.key}`;
  const cacheExists = history.some(group => group.id === cache?.groupId || group.id === legacyId
    || (group.key === cache?.key && JSON.stringify(group.suggestions) === JSON.stringify(cachedSuggestions)));
  if (projectContextKey(project, cache?.key) && cachedSuggestions.length && !cacheExists) {
    history.push({ id: legacyId, key: cache.key,
      generatedAt: Number.isSafeInteger(cache.generatedAt) && cache.generatedAt >= 0 ? cache.generatedAt : 0,
      // A legacy fingerprint cannot identify old sources after they have changed.
      sources: cache.key === key ? captureSources(sources) : [],
      suggestions: cachedSuggestions,
      iteration: Number.isSafeInteger(cache.iteration) && cache.iteration >= 0 ? cache.iteration : 0 });
  }
  history.sort((first, second) => second.generatedAt - first.generatedAt);
  // Normalize in the project record so its next ordinary save also persists migrations.
  // Reading context must not call the app save hook during startup.
  if (history.length || project.audienceSuggestionHistory !== undefined) project.audienceSuggestionHistory = history;
  return history;
}

function publicGroup(group) {
  return { id: group.id, key: group.key, generatedAt: group.generatedAt,
    sources: group.sources.map(source => ({ ...source })), suggestions: group.suggestions.map(choice => ({ ...choice })) };
}

export function createProjectAudienceSuggestions({
  getProject,
  library = audienceSuggestionLibrary,
  generateSuggestions = demoAudienceSuggestions,
  beforeGenerate = () => {},
  save = () => {},
  notify = () => {},
  now = () => Date.now(),
} = {}) {
  const pending = new Map();
  function getContext() {
    const project = getProject?.();
    const sources = sourceContext(project);
    const key = contextKey(project, sources);
    const groups = historyFor(project, key, sources);
    const matching = groups.find(group => group.key === key);
    return {
      key,
      available: Boolean(validProject(project) && sources.length && !project.outputProcessing),
      suggestions: matching ? matching.suggestions.map(choice => ({ ...choice })) : [],
      groups: groups.map(publicGroup),
    };
  }
  function selectSources(groupId) {
    if (typeof groupId !== 'string' || !groupId) return null;
    const initialProject = getProject?.();
    if (!validProject(initialProject) || initialProject.outputProcessing) return null;
    beforeGenerate();
    const project = getProject?.();
    if (project !== initialProject || !validProject(project) || project.outputProcessing) return null;
    const sources = sourceContext(project);
    const group = historyFor(project, contextKey(project, sources), sources).find(entry => entry.id === groupId);
    if (!group?.sources.length || !Array.isArray(project.sources)) return null;
    const liveSources = project.sources.filter(source => source && typeof source === 'object'
      && !Array.isArray(source) && !source.deletedAt && !source.archivedAt);
    const matches = group.sources.map(snapshot => matchSource(snapshot, liveSources));
    const counts = new Map();
    for (const source of matches) if (source) counts.set(source, (counts.get(source) || 0) + 1);
    const selected = new Set(matches.filter(source => source && counts.get(source) === 1));
    if (!selected.size) return null;
    for (const source of liveSources) source.selected = selected.has(source);
    save();
    return { selectedCount: selected.size, missingCount: group.sources.length - selected.size };
  }
  async function generate() {
    beforeGenerate();
    const project = getProject?.();
    const context = getContext();
    if (!context.available) throw new Error('Select a project source first');
    if (pending.has(context.key)) return pending.get(context.key);
    const sources = sourceContext(project);
    const snapshots = captureSources(sources);
    const priorGroups = historyFor(project, context.key, sources);
    const previous = priorGroups.find(group => group.key === context.key);
    const previousSuggestions = priorGroups.flatMap(group => group.suggestions.map(choice => ({ ...choice })));
    const iteration = previous ? previous.iteration + 1 : 0;
    const request = (async () => {
      const suggestions = validSuggestions(await generateSuggestions(sources, { iteration, previousSuggestions }));
      if (getProject?.() !== project || getContext().key !== context.key || !getContext().available) {
        throw new Error('The project sources changed');
      }
      if (!suggestions.length) throw new Error('Could not suggest audiences. Try again');
      const { persisted } = library.remember(suggestions);
      const history = historyFor(project, context.key, sources);
      const timestamp = now();
      const generatedAt = Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : Date.now();
      let sequence = 0;
      let id;
      do { id = `audience:${context.key}:${generatedAt}:${sequence++}`; }
      while (history.some(group => group.id === id));
      const group = { id, key: context.key, generatedAt, sources: snapshots, suggestions, iteration };
      project.audienceSuggestionHistory = [group, ...history];
      project.audienceSuggestions = { key: context.key, iteration, suggestions: suggestions.map(choice => ({ ...choice })), generatedAt, groupId: id };
      save();
      if (!persisted) notify('Suggested audiences are saved for this session only');
      return suggestions.map(choice => ({ ...choice }));
    })();
    pending.set(context.key, request);
    try { return await request; }
    finally { if (pending.get(context.key) === request) pending.delete(context.key); }
  }
  return { prepare: beforeGenerate, getContext, getOptions: () => library.refresh(), generate, selectSources,
    rememberChoice(choice) {
      const result = library.remember([choice]);
      if (!result.persisted) notify('Audience saved for this session only');
      return result;
    },
  };
}
