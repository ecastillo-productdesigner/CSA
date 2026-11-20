import test from 'node:test';
import { createToolFavorites } from '../dist/tool-favorites.js';
import assert from 'node:assert/strict';
import { createProjectAudienceSuggestions } from '../dist/project-audience-suggestions.js';
import { createAudienceSuggestionLibrary, demoAudienceSuggestions, suggestedAudienceValue } from '../dist/audience-suggestions.js?v=20261119-trend-hunter';

const source = { title: 'Community garden', text: 'Local neighbors plan a community event' };
function setup(overrides = {}) {
  const stored = new Map();
  const storage = () => ({ getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) });
  const library = createAudienceSuggestionLibrary({ storage });
  let project = { id: 'one', sources: [{ ...source }] };
  let saved = 0;
  const provider = createProjectAudienceSuggestions({
    getProject: () => project, library, save: () => { saved += 1; }, ...overrides,
  });
  return { provider, library, storage, get project() { return project; }, set project(next) { project = next; }, get saved() { return saved; } };
}

test('suggestions use checked sources and persist without changing current draft settings', async () => {
  const state = setup();
  state.project.sources.push({ title: 'Fashion fashion style jeans fashion', selected: false });
  state.project.toolPreferences = { audience: 'general' };
  const choices = await state.provider.generate();
  assert.deepEqual(choices, demoAudienceSuggestions([source]));
  assert.deepEqual(state.provider.getContext().suggestions, choices);
  assert.deepEqual(state.provider.getOptions(), choices);
  assert.equal(state.project.toolPreferences.audience, 'general');
  assert.equal(state.saved, 1);
  choices[0].label = 'Changed returned value';
  assert.notEqual(state.provider.getContext().suggestions[0].label, choices[0].label);
  const restoredProject = JSON.parse(JSON.stringify(state.project));
  const restored = createProjectAudienceSuggestions({ getProject: () => restoredProject, library: createAudienceSuggestionLibrary({ storage: state.storage }) });
  assert.deepEqual(restored.getContext().suggestions, state.provider.getContext().suggestions);
});

test('Try Again produces another set and keeps earlier choices reusable', async () => {
  const state = setup();
  const first = await state.provider.generate();
  const second = await state.provider.generate();
  assert.equal(second.length, 3);
  assert.notDeepEqual(first, second);
  assert.equal(state.provider.getOptions().length, 6);
  assert.deepEqual(state.provider.getContext().suggestions, second);
});

test('changing source selection or text invalidates suggested results without deleting reusable choices', async () => {
  const state = setup();
  await state.provider.generate();
  const originalKey = state.provider.getContext().key;
  state.project.sources[0].text += ' Updated reporting';
  assert.notEqual(state.provider.getContext().key, originalKey);
  assert.deepEqual(state.provider.getContext().suggestions, []);
  assert.equal(state.provider.getOptions().length, 3);
  state.project.sources[0].selected = false;
  assert.equal(state.provider.getContext().available, false);
  await assert.rejects(state.provider.generate(), /Select a project source first/);
});

test('switching projects during a request does not save stale results or touch the new project', async () => {
  let resolve;
  const state = setup({ generateSuggestions: () => new Promise(done => { resolve = done; }) });
  const original = state.project;
  const request = state.provider.generate();
  state.project = { id: 'two', sources: [{ ...source }] };
  resolve(demoAudienceSuggestions([source]));
  await assert.rejects(request, /sources changed/);
  assert.equal(original.audienceSuggestions, undefined);
  assert.equal(state.project.audienceSuggestions, undefined);
  assert.equal(state.saved, 0);
  assert.deepEqual(state.provider.getOptions(), []);
});

test('source edits during a request discard results, and pending requests deduplicate', async () => {
  let resolve;
  let count = 0;
  const state = setup({ generateSuggestions: () => { count += 1; return new Promise(done => { resolve = done; }); } });
  const first = state.provider.generate();
  const second = state.provider.generate();
  state.project.sources[0].text = 'Updated story';
  resolve(demoAudienceSuggestions([source]));
  const results = await Promise.allSettled([first, second]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(count, 1);
  assert.equal(state.saved, 0);
});

test('invalid or failed suggestions do not replace earlier results and can be retried', async () => {
  let mode = 'success';
  const state = setup({ generateSuggestions: (sources, options) => {
    if (mode === 'error') throw new Error('Temporary failure');
    if (mode === 'invalid') return [{ value: 'made-up', label: 'Not registered' }];
    return demoAudienceSuggestions(sources, options);
  } });
  const initial = await state.provider.generate();
  mode = 'invalid';
  await assert.rejects(state.provider.generate(), /Could not suggest audiences/);
  assert.deepEqual(state.provider.getContext().suggestions, initial);
  mode = 'error';
  await assert.rejects(state.provider.generate(), /Temporary failure/);
  mode = 'success';
  assert.notDeepEqual(await state.provider.generate(), initial);
  assert.equal(state.saved, 2);
});

test('flushes pending editor text before reading source context', async () => {
  let state;
  state = setup({ beforeGenerate: () => { state.project.sources[0] = { title: 'Latest fashion and style' }; } });
  assert.deepEqual(await state.provider.generate(), demoAudienceSuggestions([{ title: 'Latest fashion and style' }]));
});

test('unavailable storage leaves choices usable for the session and reports the limitation', async () => {
  const notices = [];
  const library = createAudienceSuggestionLibrary({ storage: () => { throw new Error('Blocked'); } });
  const state = setup({ library, notify: message => notices.push(message) });
  const suggestions = await state.provider.generate();
  assert.deepEqual(state.provider.getOptions(), suggestions);
  assert.deepEqual(notices, ['Suggested audiences are saved for this session only']);
});

test('missing, removed, archived, processing, and empty projects cannot generate', async () => {
  for (const project of [null, { id: 'one', sources: [] }, { id: 'one', sources: [{ url: 'https://example.com' }] },
    { id: 'one', sources: [source], deletedAt: 1 }, { id: 'one', sources: [source], archivedAt: 1 },
    { id: 'one', sources: [source], outputProcessing: { kind: 'draft' } }]) {
    const provider = createProjectAudienceSuggestions({ getProject: () => project });
    assert.equal(provider.getContext().available, false);
    await assert.rejects(provider.generate(), /Select a project source first/);
  }
});


test('generation keeps immutable source-title snapshots and restores groups after reload', async () => {
  const state = setup({ now: () => 1000 });
  state.project.sources = [{ id: 'garden', url: 'https://example.com/garden', title: 'Original garden title', text: 'Local community facts' },
    { id: 'excluded', title: 'Do not include this source', text: 'Fashion facts', selected: false }];
  const suggestions = await state.provider.generate();
  const groups = state.provider.getContext().groups;
  assert.equal(groups.length, 1);
  assert.deepEqual(Object.keys(groups[0]), ['id', 'key', 'generatedAt', 'sources', 'suggestions']);
  assert.equal(groups[0].generatedAt, 1000);
  assert.deepEqual(groups[0].sources, [{ id: 'garden', url: 'https://example.com/garden', title: 'Original garden title' }]);
  assert.deepEqual(groups[0].suggestions, suggestions);
  assert.equal(state.project.audienceSuggestions.groupId, groups[0].id);
  const expected = structuredClone(groups);
  groups[0].sources[0].title = 'Changed returned title';
  groups[0].suggestions[0].label = 'Changed returned suggestion';
  assert.deepEqual(state.provider.getContext().groups, expected);
  const restoredProject = JSON.parse(JSON.stringify(state.project));
  const restored = createProjectAudienceSuggestions({ getProject: () => restoredProject,
    library: createAudienceSuggestionLibrary({ storage: state.storage }) });
  assert.deepEqual(restored.getContext().groups, expected);
  assert.deepEqual(restored.getContext().suggestions, suggestions);
});

test('switching back to an earlier source configuration reuses its latest suggestion group', async () => {
  let now = 1000;
  const state = setup({ now: () => now++ });
  state.project.sources.push({ id: 'fashion', title: 'Fashion wardrobe shopping trends', selected: false });
  const first = await state.provider.generate();
  const firstKey = state.provider.getContext().key;
  state.project.sources[0].selected = false;
  state.project.sources[1].selected = true;
  assert.deepEqual(state.provider.getContext().suggestions, []);
  const second = await state.provider.generate();
  const secondKey = state.provider.getContext().key;
  assert.notDeepEqual(second, first);
  assert.deepEqual(state.provider.getContext().groups.map(group => group.key), [secondKey, firstKey]);
  state.project.sources[0].selected = true;
  state.project.sources[1].selected = false;
  assert.equal(state.provider.getContext().key, firstKey);
  assert.deepEqual(state.provider.getContext().suggestions, first);
  assert.equal(state.saved, 2, 'revisiting a configuration does not generate or save another group');
  const retry = await state.provider.generate();
  assert.notDeepEqual(retry, first, 'the earlier configuration retains its generation iteration');
  assert.deepEqual(state.provider.getContext().groups.map(group => group.key), [firstKey, secondKey, firstKey]);
});

test('identical audience labels preserve distinct generations and source configurations without duplicating library IDs', async () => {
  const choices = demoAudienceSuggestions([source]);
  const state = setup({ now: () => 1000, generateSuggestions: () => choices });
  await state.provider.generate();
  await state.provider.generate();
  state.project.sources[0].title = 'Another community story';
  await state.provider.generate();
  const groups = state.provider.getContext().groups;
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.map(group => group.id)).size, 3);
  assert.equal(new Set(groups.map(group => group.key)).size, 2);
  assert.deepEqual(groups.map(group => group.sources[0].title), ['Another community story', 'Community garden', 'Community garden']);
  assert.ok(groups.every(group => JSON.stringify(group.suggestions) === JSON.stringify(choices)));
  assert.deepEqual(state.provider.getOptions(), choices);
  assert.equal(state.project.audienceSuggestions.groupId, groups[0].id);
});

test('renaming, editing, or removing current sources never relabels prior suggestion provenance', async () => {
  const state = setup({ now: () => 1000 });
  await state.provider.generate();
  const original = state.provider.getContext().groups;
  state.project.sources[0].title = 'Renamed source';
  state.project.sources[0].text = 'Updated reporting';
  assert.deepEqual(state.provider.getContext().groups, original);
  assert.deepEqual(state.provider.getContext().suggestions, []);
  state.project.sources = [];
  assert.equal(state.provider.getContext().available, false);
  assert.deepEqual(state.provider.getContext().groups, original);
});

test('a legacy matching cache migrates source snapshots once and preserves its iteration', async () => {
  const state = setup();
  const key = state.provider.getContext().key;
  const suggestions = demoAudienceSuggestions([source]);
  state.project.audienceSuggestions = { key, iteration: 4, suggestions };
  const groups = state.provider.getContext().groups;
  assert.equal(groups.length, 1);
  assert.equal(groups[0].generatedAt, 0, 'unknown legacy generation time is not invented');
  assert.deepEqual(groups[0].sources, [{ id: '', url: '', title: source.title }]);
  assert.deepEqual(state.provider.getContext().suggestions, suggestions);
  assert.equal(state.project.audienceSuggestionHistory[0].iteration, 4);
  state.project.sources[0].title = 'Renamed later';
  assert.deepEqual(state.provider.getContext().groups, groups);
  state.project.sources[0].title = source.title;
  await state.provider.generate();
  assert.equal(state.project.audienceSuggestions.iteration, 5);
  assert.equal(state.provider.getContext().groups.length, 2);
});

test('a legacy mismatched cache retains unknown provenance even if the old configuration is revisited', () => {
  const state = setup();
  const originalKey = state.provider.getContext().key;
  const suggestions = demoAudienceSuggestions([source]);
  state.project.audienceSuggestions = { key: originalKey, iteration: 0, suggestions };
  state.project.sources[0].title = 'Different source context';
  const groups = state.provider.getContext().groups;
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].sources, []);
  assert.deepEqual(state.provider.getContext().suggestions, []);
  state.project.sources[0].title = source.title;
  assert.deepEqual(state.provider.getContext().suggestions, suggestions);
  assert.deepEqual(state.provider.getContext().groups[0].sources, [], 'do not guess provenance after migration');
  const restoredProject = JSON.parse(JSON.stringify(state.project));
  const restored = createProjectAudienceSuggestions({ getProject: () => restoredProject });
  assert.deepEqual(restored.getContext().groups[0].sources, []);
});

test('malformed or other-project history is discarded and source snapshots exclude full text', async () => {
  const state = setup({ now: () => 1000 });
  await state.provider.generate();
  const valid = structuredClone(state.project.audienceSuggestionHistory[0]);
  valid.sources[0].text = 'Full source text must not be copied to provenance';
  state.project.audienceSuggestionHistory = [null, {}, valid, structuredClone(valid),
    { ...valid, id: 'other-project', key: valid.key.replace('one:', 'two:') },
    { ...valid, id: 'invalid-time', generatedAt: -1 },
    { ...valid, id: 'invalid-source', sources: [{ title: 12 }] },
    { ...valid, id: 'invalid-suggestion', suggestions: [{ value: 'general', label: 'General Audience' }] }];
  assert.equal(state.provider.getContext().groups.length, 1);
  assert.equal(state.project.audienceSuggestionHistory.length, 1);
  assert.deepEqual(state.provider.getContext().groups[0].sources, [{ id: '', url: '', title: source.title }]);
  const originalProject = state.project;
  state.project = { id: 'two', sources: [{ ...source }], audienceSuggestionHistory: structuredClone(originalProject.audienceSuggestionHistory),
    audienceSuggestions: structuredClone(originalProject.audienceSuggestions) };
  assert.deepEqual(state.provider.getContext().groups, []);
  assert.deepEqual(state.provider.getContext().suggestions, []);
  assert.equal(originalProject.audienceSuggestionHistory.length, 1);
});


test('new and matching legacy snapshots capture a stable display title for untitled source material', async () => {
  const state = setup();
  state.project.sources = [{ id: 'notes', title: ' ', text: 'First second third fourth fifth sixth seventh eighth ninth tenth' }];
  await state.provider.generate();
  const firstGroup = state.provider.getContext().groups[0];
  assert.equal(firstGroup.sources[0].title, 'First second third fourth fifth sixth seventh eighth');
  state.project.sources[0].text = 'These revised words must not rename the earlier source snapshot';
  assert.equal(state.provider.getContext().groups[0].sources[0].title, firstGroup.sources[0].title);
  const legacy = setup();
  legacy.project.sources = [{ title: '', description: 'Community garden description used as a source name' }];
  const key = legacy.provider.getContext().key;
  legacy.project.audienceSuggestions = { key, suggestions: demoAudienceSuggestions(legacy.project.sources) };
  assert.equal(legacy.provider.getContext().groups[0].sources[0].title, 'Community garden description used as a source name');
  legacy.project.sources[0].title = 'A later explicit title';
  assert.equal(legacy.provider.getContext().groups[0].sources[0].title, 'Community garden description used as a source name');
});


test('selecting a generation restores only its live sources without changing history or draft snapshots', async () => {
  const state = setup();
  state.project.sources = [{ id: 'garden', ...source, selected: true },
    { id: 'fashion', title: 'Fashion trends', selected: false }];
  const choices = await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  const history = structuredClone(state.project.audienceSuggestionHistory);
  state.project.outputs = [{ sourceSnapshots: [{ id: 'fashion', title: 'Original draft source' }] }];
  const outputs = structuredClone(state.project.outputs);
  state.project.sources[0].selected = false;
  state.project.sources[1].selected = true;
  assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 1, missingCount: 0 });
  assert.deepEqual(state.project.sources.map(item => item.selected), [true, false]);
  assert.deepEqual(state.provider.getContext().suggestions, choices);
  assert.deepEqual(state.project.audienceSuggestionHistory, history);
  assert.deepEqual(state.project.outputs, outputs);
  assert.equal(state.saved, 2);
});

test('stable article, own-material, and attachment IDs survive source renaming and reload', async () => {
  const state = setup();
  state.project.sources = [{ id: 'article', ...source },
    { ownMaterialOutputId: 'material-one', title: 'My notes' },
    { attachmentId: 'attachment-one', title: 'Uploaded document' }];
  await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  assert.deepEqual(group.sources, [{ id: 'article', url: '', title: source.title },
    { id: '', url: '', title: 'My notes', ownMaterialOutputId: 'material-one' },
    { id: '', url: '', title: 'Uploaded document', attachmentId: 'attachment-one' }]);
  state.project = JSON.parse(JSON.stringify(state.project));
  state.project.sources.forEach((item, index) => {
    item.title = `Renamed source ${index}`;
    item.text = 'Updated text';
    item.selected = false;
  });
  state.project.sources.push({ id: 'other', title: source.title, selected: true });
  assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 3, missingCount: 0 });
  assert.deepEqual(state.project.sources.map(item => item.selected), [true, true, true, false]);
  assert.deepEqual(state.provider.getContext().groups[0].sources, group.sources);
});

test('unique URLs are identity fallbacks, but missing identified sources never fall back to titles', async () => {
  const state = setup();
  state.project.sources = [{ id: 'original', url: 'https://example.com/garden', ...source },
    { ownMaterialOutputId: 'removed-material', title: 'Original notes' }];
  await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  state.project.sources = [{ id: 'replacement', url: 'https://example.com/garden', title: 'Updated article', selected: false },
    { title: 'Original notes', selected: true }];
  assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 1, missingCount: 1 });
  assert.deepEqual(state.project.sources.map(item => item.selected), [true, false]);
});

test('legacy snapshots use only unique display titles and leave selections intact when ambiguous', async () => {
  const state = setup();
  state.project.sources = [{ text: 'Notes for a community garden event', selected: true }];
  await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  state.project.sources[0].selected = false;
  state.project.sources.push({ title: 'Other source', selected: true });
  assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 1, missingCount: 0 });
  state.project.sources.push({ title: group.sources[0].title, selected: false });
  const before = structuredClone(state.project.sources);
  assert.equal(state.provider.selectSources(group.id), null);
  assert.deepEqual(state.project.sources, before);
  assert.equal(state.saved, 2);
});

test('duplicate live identities, URLs, or history matches are never selected arbitrarily', async () => {
  for (const identity of [{ id: 'duplicate' }, { url: 'https://example.com/same' },
    { ownMaterialOutputId: 'duplicate-material' }, { attachmentId: 'duplicate-document' }]) {
    const state = setup();
    state.project.sources = [{ ...identity, title: 'Original source' }, { id: 'unique', title: 'Unique source' }];
    await state.provider.generate();
    const [group] = state.provider.getContext().groups;
    state.project.sources.push({ ...identity, title: 'Duplicate source', selected: true });
    state.project.sources[1].selected = false;
    assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 1, missingCount: 1 });
    assert.deepEqual(state.project.sources.map(item => item.selected), [false, true, false]);
  }
  const state = setup();
  state.project.sources = [{ id: 'same', ...source }, { id: 'same', ...source }];
  await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  state.project.sources.pop();
  state.project.sources[0].selected = false;
  assert.equal(state.provider.selectSources(group.id), null);
  assert.equal(state.project.sources[0].selected, false);
  assert.equal(state.saved, 1);
});

test('deleted, archived, and removed sources count as missing, and zero matches never clear the current selection', async () => {
  const state = setup();
  state.project.sources = ['remaining', 'deleted', 'archived', 'removed'].map(id => ({ id, title: `${id} source` }));
  await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  state.project.sources[0].selected = false;
  state.project.sources[1].deletedAt = 1;
  state.project.sources[2].archivedAt = 1;
  state.project.sources.pop();
  state.project.sources.push({ id: 'other', title: 'Other source', selected: true });
  assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 1, missingCount: 3 });
  assert.equal(state.project.sources[0].selected, true);
  assert.equal(state.project.sources[3].selected, false);
  state.project.sources.shift();
  state.project.sources.at(-1).selected = true;
  const before = structuredClone(state.project.sources);
  assert.equal(state.provider.selectSources(group.id), null);
  assert.deepEqual(state.project.sources, before);
  assert.equal(state.saved, 2);
});

test('selection flushes editor changes first and guards against project switches or processing', async () => {
  let flush = () => {};
  const state = setup({ beforeGenerate: () => flush() });
  state.project.sources = [{ ownMaterialOutputId: 'notes', ...source }];
  await state.provider.generate();
  const [group] = state.provider.getContext().groups;
  flush = () => {
    state.project.sources[0] = { ownMaterialOutputId: 'notes', title: 'Flushed title', selected: false };
  };
  assert.deepEqual(state.provider.selectSources(group.id), { selectedCount: 1, missingCount: 0 });
  assert.equal(state.project.sources[0].title, 'Flushed title');
  assert.equal(state.project.sources[0].selected, true);
  const original = state.project;
  flush = () => { state.project = { id: 'two', sources: [{ ...source, selected: true }] }; };
  assert.equal(state.provider.selectSources(group.id), null);
  assert.equal(state.project.sources[0].selected, true);
  state.project.audienceSuggestionHistory = structuredClone(original.audienceSuggestionHistory);
  flush = () => {};
  assert.equal(state.provider.selectSources(group.id), null);
  assert.deepEqual(state.project.audienceSuggestionHistory, []);
  state.project = original;
  for (const flag of ['deletedAt', 'archivedAt', 'outputProcessing']) {
    original[flag] = 1;
    assert.equal(state.provider.selectSources(group.id), null);
    delete original[flag];
  }
  assert.equal(state.provider.selectSources('unknown-group'), null);
  assert.equal(state.provider.selectSources(null), null);
  flush = () => { original.outputProcessing = { kind: 'draft' }; };
  assert.equal(state.provider.selectSources(group.id), null);
  assert.equal(state.saved, 2);
});


test('two and three same-topic sources get different names while old favorites and history stay intact', async () => {
  const state = setup();
  state.project.sources = [
    { id: 'one', title: 'Panthers stadium memories' },
    { id: 'two', title: 'Panthers stadium season ticket holders' },
    { id: 'three', title: 'Panthers stadium investment', selected: false },
  ];
  const first = await state.provider.generate();
  const firstGroup = state.provider.getContext().groups[0];
  const favorites = createToolFavorites({ storage: state.storage });
  favorites.toggle('audience', first[0].value);
  state.project.toolPreferences = { audience: first[0].value };
  state.project.sources[2].selected = true;
  const second = await state.provider.generate();
  assert.ok(second.every(option => !first.some(previous => previous.value === option.value)));
  assert.deepEqual(state.provider.getContext().groups.find(group => group.id === firstGroup.id), firstGroup);
  assert.deepEqual(favorites.values('audience'), [first[0].value]);
  assert.equal(state.project.toolPreferences.audience, first[0].value);
  assert.deepEqual(state.provider.getOptions().find(option => option.value === first[0].value), first[0]);
  state.project.sources[2].selected = false;
  const restored = createProjectAudienceSuggestions({ getProject: () => state.project, library: state.library });
  assert.deepEqual(restored.getContext().suggestions, first);
});

test('new generation preserves legacy audience names, references, and favorite IDs verbatim', async () => {
  const state = setup();
  const key = state.provider.getContext().key;
  const legacy = ['Curious General Readers', 'People Following the Story', 'Readers Seeking Practical Context']
    .map(label => ({ label, value: suggestedAudienceValue(label) }));
  state.project.audienceSuggestions = { key, suggestions: legacy };
  state.library.remember(legacy);
  const favorites = createToolFavorites({ storage: state.storage });
  favorites.toggle('audience', legacy[0].value);
  state.project.sources.push({ title: 'Local community volunteers' });
  await state.provider.generate();
  assert.deepEqual(state.provider.getContext().groups.find(group => group.key === key).suggestions, legacy);
  assert.deepEqual(favorites.values('audience'), [legacy[0].value]);
  assert.deepEqual(state.provider.getOptions().filter(option => legacy.some(old => old.value === option.value)), legacy.map(({value, label}) => ({value, label})));
});


test('rememberChoice persists one contextual audience without generating history or changing draft settings', () => {
  const state = setup();
  state.project.toolPreferences = { audience: 'general', format: 'listicle' };
  const originalProject = structuredClone(state.project);
  const [choice] = demoAudienceSuggestions(state.project.sources);
  const result = state.provider.rememberChoice({ ...choice, contextual: true });
  assert.equal(result.persisted, true);
  assert.deepEqual(result.options, [choice]);
  assert.equal(state.saved, 0);
  assert.deepEqual(state.project, originalProject);
  assert.deepEqual(state.provider.getContext().groups, []);
  state.provider.rememberChoice(choice);
  assert.deepEqual(state.provider.getOptions(), [choice], 'repeat selection and hearting use the same stable audience ID');
  result.options[0].label = 'Changed returned label';
  assert.deepEqual(state.provider.getOptions(), [choice]);
  state.project.sources = [{ title: 'Software technology and digital tools' }];
  assert.deepEqual(state.provider.getOptions(), [choice]);
  const library = createAudienceSuggestionLibrary({ storage: state.storage });
  const restored = createProjectAudienceSuggestions({ getProject: () => ({ id: 'different-project', sources: [] }), library });
  assert.deepEqual(restored.getOptions(), [choice]);
  assert.deepEqual(restored.getContext().groups, []);
  assert.equal(restored.getContext().available, false);
});

test('rememberChoice preserves contextual selections for the session when storage rejects writes', () => {
  const notices = [];
  const library = createAudienceSuggestionLibrary({ storage: () => ({
    getItem: () => null,
    setItem() { throw new Error('Storage unavailable'); },
  }) });
  const state = setup({ library, notify: message => notices.push(message) });
  const [choice] = demoAudienceSuggestions(state.project.sources);
  assert.equal(state.provider.rememberChoice(choice).persisted, false);
  assert.deepEqual(state.provider.getOptions(), [choice]);
  state.project = { id: 'new-project', sources: [] };
  assert.deepEqual(state.provider.getOptions(), [choice]);
  assert.deepEqual(notices, ['Audience saved for this session only']);
  assert.equal(state.saved, 0);
});
