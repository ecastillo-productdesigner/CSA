import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudienceSuggestionLibrary, audienceSuggestionLibrary, suggestedAudienceValue, demoAudienceSuggestions } from '../dist/audience-suggestions.js?v=20261119-trend-hunter';
import { draftOptions, getDraftOptions, populateDraftOptions, draftPreferenceValue, hasDraftSelection } from '../dist/draft-options.js';
import { createToolFavorites } from '../dist/tool-favorites.js';
import { saveDraftSetup, applySavedDraftSetup } from '../dist/saved-draft-setups.js';

const storageKey = 'csa.audience-suggestions.v1';
const choice = label => ({ value: suggestedAudienceValue(label), label });
function memoryStorage() {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
}

function audienceField(value = '') {
  const select = { value, children: [], get options() { return this.children; }, replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; } };
  return { select, dataset: { label: 'Audience' }, matches: selector => selector === '.composer-field',
    querySelector: selector => selector === 'select' ? select : null, querySelectorAll: () => [] };
}

function withDocument(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ dataset: {} }) } });
  try { run(); } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document;
  }
}

test('suggested audience IDs are stable across case, whitespace, and Unicode presentation', () => {
  assert.equal(suggestedAudienceValue('  Local   Readers  '), suggestedAudienceValue('local readers'));
  assert.equal(suggestedAudienceValue('Ｆｏｏ'), suggestedAudienceValue('Foo'));
  assert.notEqual(suggestedAudienceValue('Local Readers'), suggestedAudienceValue('Travel Readers'));
  for (const label of ['', '   ', null, 1, {}, 'x'.repeat(161), '\ud800']) assert.equal(suggestedAudienceValue(label), '');
});

test('registered suggestions persist across reloads and returned records cannot mutate the catalog', () => {
  const storage = memoryStorage();
  const first = createAudienceSuggestionLibrary({ storage: () => storage });
  const local = choice('Local Readers');
  assert.equal(first.remember([local, local]).persisted, true);
  assert.deepEqual(first.options(), [local]);
  const returned = first.options();
  returned[0].label = 'Changed outside the library';
  returned.push(choice('Other Readers'));
  assert.deepEqual(first.options(), [local]);
  assert.deepEqual(createAudienceSuggestionLibrary({ storage: () => storage }).options(), [local]);
});

test('unregistered, forged, and malformed records cannot become valid audience choices', () => {
  const storage = memoryStorage();
  for (const initial of ['{', 'null', '{}', 'true', '[null, false, 1]', '[{"value":"general","label":"Custom Audience"}]']) {
    storage.setItem(storageKey, initial);
    const library = createAudienceSuggestionLibrary({ storage: () => storage });
    assert.deepEqual(library.options(), []);
    assert.equal(library.remember([{ value: 'general', label: 'General Audience' }, { value: 'unexpected', label: 'New Readers' }, null]).persisted, false);
    assert.equal(storage.getItem(storageKey), initial);
  }
});

test('separate libraries merge additions made in another tab', () => {
  const storage = memoryStorage();
  const first = createAudienceSuggestionLibrary({ storage: () => storage });
  const second = createAudienceSuggestionLibrary({ storage: () => storage });
  first.remember([choice('Local Readers')]);
  second.remember([choice('Travel Readers')]);
  first.remember([choice('Sports Readers')]);
  assert.deepEqual(second.refresh().map(option => option.label), ['Local Readers', 'Travel Readers', 'Sports Readers']);
});

test('failed writes retain session choices and merge external updates after storage recovers', () => {
  const storage = memoryStorage();
  const persist = storage.setItem;
  const library = createAudienceSuggestionLibrary({ storage: () => storage });
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.equal(library.remember([choice('Local Readers')]).persisted, false);
  assert.deepEqual(library.refresh(), [choice('Local Readers')]);
  persist(storageKey, JSON.stringify([choice('Travel Readers')]));
  storage.setItem = persist;
  assert.equal(library.remember([choice('Sports Readers')]).persisted, true);
  assert.deepEqual(library.options().map(option => option.label), ['Travel Readers', 'Local Readers', 'Sports Readers']);
  assert.deepEqual(createAudienceSuggestionLibrary({ storage: () => storage }).options(), library.options());
});

test('unavailable storage preserves usable session suggestions', () => {
  for (const storage of [() => undefined, () => { throw new Error('Blocked'); }]) {
    const library = createAudienceSuggestionLibrary({ storage });
    assert.equal(library.remember([choice('Local Readers')]).persisted, false);
    assert.deepEqual(library.refresh(), [choice('Local Readers')]);
  }
});

test('demo generation returns three distinct topic-based suggestions using selected sources only', () => {
  const sources = [{ title: 'A practical wardrobe guide', text: 'Fashion and shopping ideas', selected: true },
    { title: 'Football basketball baseball sports team season', selected: false }];
  const options = demoAudienceSuggestions(sources);
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map(option => option.value)).size, 3);
  assert.ok(options.every(option => /style|outfit|wardrobe|fashion|shop/i.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions(sources.slice(0, 1)), options);
  assert.deepEqual(demoAudienceSuggestions(sources), options);
  const retry = demoAudienceSuggestions(sources, { iteration: 1 });
  assert.equal(retry.length, 3);
  assert.equal(new Set(retry.map(option => option.value)).size, 3);
  assert.notDeepEqual(retry, options);
  assert.notDeepEqual(demoAudienceSuggestions(sources, { iteration: 2 }), options);
  assert.notDeepEqual(demoAudienceSuggestions([{ title: 'An unusual story' }], { iteration: 1 }),
    demoAudienceSuggestions([{ title: 'An unusual story' }]));
  assert.notDeepEqual(demoAudienceSuggestions([{ title: 'Local community news' }]), options);
  for (const sourceList of [null, [], [{ title: 'Fashion', selected: false }], [{ title: ' ', text: '' }]]) {
    assert.deepEqual(demoAudienceSuggestions(sourceList), []);
  }
  assert.equal(demoAudienceSuggestions([{ title: 'An unusual story' }]).length, 3);
});

test('the DS can populate isolated suggestions without affecting the shared app catalog', () => {
  const library = createAudienceSuggestionLibrary({ storage: () => memoryStorage() });
  const option = choice('Isolated Specimen Readers');
  library.remember([option]);
  assert.equal(draftPreferenceValue('audience', option.value), '');
  assert.equal(draftPreferenceValue('audience', option.value, { library }), option.value);
  assert.equal(hasDraftSelection({ audience: option.value }, { library }), true);
  assert.equal(hasDraftSelection({ audience: option.value }), false);
  assert.equal(getDraftOptions('audience', { library }).at(-1).value, option.value);
  withDocument(() => {
    const field = audienceField(option.value);
    populateDraftOptions(field, { library });
    assert.equal(field.select.value, option.value);
    assert.equal(field.select.children.at(-1).textContent, option.label);
  });
  assert.equal(draftPreferenceValue('audience', option.value), '');
});

test('registered suggestions enable drafting, keep favorite IDs, and apply saved settings across projects after reload', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    audienceSuggestionLibrary.refresh();
    const option = choice('Registered Community Readers');
    assert.equal(draftPreferenceValue('audience', option.value), '');
    audienceSuggestionLibrary.remember([option]);
    assert.equal(draftPreferenceValue('audience', option.value), option.value);
    assert.equal(draftPreferenceValue('audience', suggestedAudienceValue('Never Registered')), '');
    assert.equal(draftPreferenceValue('format', option.value), '');
    assert.equal(hasDraftSelection({ audience: option.value }), true);
    assert.equal(draftOptions.find(item => item.key === 'audience').options.some(item => item.value === option.value), false);
    withDocument(() => {
      const field = audienceField(option.value);
      populateDraftOptions(field);
      assert.equal(field.select.value, option.value);
      assert.equal(field.select.children.at(-1).textContent, option.label);
    });
    const favorites = createToolFavorites({ storage: () => storage });
    assert.deepEqual(favorites.toggle('audience', option.value), { saved: true, persisted: true });
    assert.deepEqual(createToolFavorites({ storage: () => storage }).values('audience'), [option.value]);
    const output = { id: 'draft', title: 'Original story', toolPreferences: { format: '', audience: option.value, voice: '' },
      labels: [{ key: 'audience', label: option.label }], editorialDirection: 'Keep it local' };
    const sourceProject = { id: 'source-project', outputs: [output] };
    const currentProject = { id: 'current-project', sources: [{ title: 'Current source' }], outputs: [], toolPreferences: {} };
    const projects = [sourceProject, currentProject];
    saveDraftSetup(projects, 'source-project', 'draft', { name: 'Community guide', now: 10 });
    const restoredProjects = JSON.parse(JSON.stringify(projects));
    audienceSuggestionLibrary.refresh();
    assert.equal(applySavedDraftSetup(restoredProjects, restoredProjects[1], 'source-project', 'draft'), true);
    assert.equal(restoredProjects[1].toolPreferences.audience, option.value);
    assert.deepEqual(restoredProjects[1].sources, currentProject.sources);
    assert.equal(restoredProjects[0].outputs[0].presetSettings.labels[0].label, option.label);
    restoredProjects[0].outputs[0].presetSettings.toolPreferences.audience = '';
    applySavedDraftSetup(restoredProjects, restoredProjects[1], 'source-project', 'draft');
    assert.equal(restoredProjects[1].toolPreferences.audience, '');
  } finally {
    storage.setItem(storageKey, '[]');
    audienceSuggestionLibrary.refresh();
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage;
    audienceSuggestionLibrary.refresh();
  }
});


test('new source configurations use fresh wording while retaining relevant reader perspectives', () => {
  const sources = [
    { title: 'Panthers stadium history and longtime fans' },
    { title: 'Panthers stadium memories from season ticket holders' },
    { title: 'Panthers stadium business and investment' },
  ];
  const first = demoAudienceSuggestions(sources.slice(0, 2));
  const next = demoAudienceSuggestions(sources, { previousSuggestions: first });
  assert.equal(next.length, 3);
  assert.ok(next.every(option => !first.some(previous => previous.value === option.value)));
  assert.ok(next.some(option => /Panthers/.test(option.label)));
  assert.ok(next.some(option => /stadium|venue/i.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions([...sources].reverse(), { previousSuggestions: first }), next);
  const sameCount = demoAudienceSuggestions([sources[0], sources[2]], { previousSuggestions: [...first, ...next] });
  assert.ok(sameCount.every(option => ![...first, ...next].some(previous => previous.value === option.value)));
  for (const option of [...first, ...next, ...sameCount]) {
    assert.equal(option.value, suggestedAudienceValue(option.label));
    assert.ok(option.label.length <= 160);
  }
});

test('mixed sources contribute distinct reader perspectives without inventing a team or location', () => {
  const sources = [
    { title: 'Remember Bank of America Stadium’s opening in 1996? Check out these Observer photos' },
    { title: 'Democrats break 36-year drought and turn Cabarrus County blue — at least this year' },
  ];
  const labels = demoAudienceSuggestions(sources).map(option => option.label);
  assert.ok(labels.some(label => /stadium/i.test(label)));
  assert.ok(labels.some(label => /election|voters|political|politics/i.test(label)));
  assert.ok(labels.every(label => !/Panthers|Charlotte/.test(label)));
  const charlotte = demoAudienceSuggestions([{ title: 'Charlotte council discusses public policy' }]);
  assert.ok(charlotte.every(option => /Charlotte/.test(option.label)));
});

test('long articles cannot hide later source topics, and excluded sources never influence names', () => {
  const sources = [
    { title: 'Panthers stadium history', text: 'Sports team season '.repeat(5000) },
    { title: 'Charlotte election and public spending decisions' },
  ];
  const options = demoAudienceSuggestions(sources);
  assert.ok(options.some(option => /Charlotte/.test(option.label)));
  assert.ok(options.some(option => /Panthers/.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions([...sources, { title: 'fashion wardrobe shopping', selected: false },
    { title: 'travel tourism destinations', deletedAt: 1 }, null, false, 5]), options);
});


test('specific team and location wording requires evidence in the corresponding topic sources', () => {
  const teamOnly = demoAudienceSuggestions([{ title: 'Panthers quarterback injury update' }]);
  assert.ok(teamOnly.some(option => /Panthers/.test(option.label)));
  assert.ok(teamOnly.every(option => !/stadium|venue/i.test(option.label)));
  const mixed = demoAudienceSuggestions([
    { title: 'Charlotte restaurant opens new location' },
    { title: 'Congress votes on federal technology policy' },
  ]);
  assert.ok(mixed.every(option => !/Charlotte/.test(option.label)));
});


test('school and college articles suggest families, educators, and policy readers in their own context', () => {
  const schools = [{ title: 'Angry CMS parents question new school boundaries',
    text: 'Charlotte-Mecklenburg Schools shared the school district plan with families. Teachers asked the school board how students and classrooms would be affected.', selected: true }];
  const schoolOptions = demoAudienceSuggestions(schools);
  assert.equal(schoolOptions.length, 3);
  assert.equal(new Set(schoolOptions.map(option => option.value)).size, 3);
  assert.ok(schoolOptions.some(option => /parents|families/i.test(option.label)));
  assert.ok(schoolOptions.some(option => /teachers|educators|staff/i.test(option.label)));
  assert.ok(schoolOptions.some(option => /policy|funding|accountability/i.test(option.label)));
  assert.ok(schoolOptions.every(option => /school|education|classroom/i.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions([...schools,
    { title: 'Fashion shopping wardrobe guide', selected: false },
    { title: 'Museum exhibition news', deletedAt: 10 }]), schoolOptions);
  const collegeOptions = demoAudienceSuggestions([{ title: 'University tuition changes for college students',
    description: 'Campus faculty discuss higher education funding.' }]);
  assert.equal(new Set(collegeOptions.map(option => option.value)).size, 3);
  assert.ok(collegeOptions.every(option => /college|university|higher education|campus/i.test(option.label)));
  assert.notDeepEqual(collegeOptions, schoolOptions);
  const retry = demoAudienceSuggestions(schools, { iteration: 1, previousSuggestions: schoolOptions });
  assert.ok(retry.every(option => !schoolOptions.some(previous => previous.value === option.value)));
});

test('Discovery Place and museum stories keep suggestions tied to visits, learning, and institutions', () => {
  const discovery = [{ title: 'Discovery Place museum introduces a new science exhibit',
    text: 'Families can explore hands-on exhibits and science education programs at Discovery Place.' }];
  const options = demoAudienceSuggestions(discovery);
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map(option => option.value)).size, 3);
  assert.ok(options.some(option => /Discovery Place/.test(option.label)));
  assert.ok(options.some(option => /families|parents/i.test(option.label)));
  assert.ok(options.every(option => /Discovery Place|science|museum/i.test(option.label)));
  assert.ok(options.every(option => !/school|wardrobe|shopping|fitness|travel/i.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions([...discovery, { title: 'Schools teachers students', selected: false }]), options);
  const museum = demoAudienceSuggestions([{ title: 'History museum opens a new exhibition',
    summary: 'The museum is expanding its collection and visitor programs.' }]);
  assert.equal(new Set(museum.map(option => option.value)).size, 3);
  assert.ok(museum.every(option => /museum|cultural institution/i.test(option.label)));
  assert.ok(museum.every(option => !/Discovery Place|science|school/i.test(option.label)));
  assert.notDeepEqual(museum, options);
});

test('additional topic families provide three distinct relevant perspectives through each rotation', () => {
  for (const [source, relevant] of [
    [{ title: 'Art gallery exhibition features paintings and sculptures' }, /art|gallery|exhibition|museum|cultural/i],
    [{ title: 'Music festival announces concert performances' }, /culture|cultural|music|performance|entertainment|event|creative|concert|theater/i],
    [{ title: 'Small business owners hire employees for new company jobs' }, /business|work|career|employees|company|industry|entrepreneur|job/i],
    [{ title: 'Inflation and grocery prices reshape household budgets' }, /household|consumer|economic|economy|prices|cost of living/i],
  ]) {
    for (let iteration = 0; iteration < 4; iteration++) {
      const options = demoAudienceSuggestions([source], { iteration });
      assert.equal(options.length, 3);
      assert.equal(new Set(options.map(option => option.value)).size, 3);
      assert.ok(options.every(option => relevant.test(option.label)), JSON.stringify(options));
      assert.ok(options.every(option => option.value === suggestedAudienceValue(option.label)));
    }
  }
});

test('unclassified articles use bounded plain-text subjects and retain selected-source context', () => {
  const algae = [{ title: 'Breaking: Rare bioluminescent algae bloom illuminates tidal pools' }];
  const options = demoAudienceSuggestions(algae);
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map(option => option.value)).size, 3);
  assert.ok(options.every(option => /Rare bioluminescent algae bloom/.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions([...algae, { title: 'Unrelated comet observations', selected: false }]), options);
  const comet = { title: 'Distant comet reveals icy fragments' };
  const other = demoAudienceSuggestions([comet]);
  assert.ok(other.every(option => /Distant comet/.test(option.label)));
  assert.notDeepEqual(options, other);
  const mixed = demoAudienceSuggestions([...algae, comet]);
  assert.ok(mixed.some(option => /algae/.test(option.label)));
  assert.ok(mixed.some(option => /comet/.test(option.label)));
  assert.deepEqual(demoAudienceSuggestions([comet, ...algae]), mixed);
  assert.ok(demoAudienceSuggestions([{ text: 'Bioluminescent algae illuminate tidal pools.' }])
    .every(option => /Bioluminescent algae/.test(option.label)));
  for (const title of [
    '<img src=x onerror=alert(1)>Rare algae <script>alert("oops")</script>',
    '<style>bad-selector</style>Rare algae &amp; coral: a report',
    `Rare algae ${'x'.repeat(500)} ${'bloom '.repeat(200)}`,
    '\ud800 Rare algae',
  ]) {
    const safe = demoAudienceSuggestions([{ title }]);
    assert.equal(safe.length, 3);
    assert.equal(new Set(safe.map(option => option.value)).size, 3);
    assert.ok(safe.every(option => option.label.length <= 160 && option.value));
    assert.ok(safe.every(option => !/[<>&]|script|onerror|alert|bad-selector/.test(option.label)));
    assert.ok(safe.every(option => /Rare algae/.test(option.label)));
  }
});
