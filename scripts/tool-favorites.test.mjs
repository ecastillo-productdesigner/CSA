import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolFavorites, toolFavorites } from '../dist/tool-favorites.js';

const storageKey = 'csa.tool-favorites.v1';
function memoryStorage(initial = null) {
  const records = new Map(initial === null ? [] : [[storageKey, initial]]);
  return {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
}
function setup(initial) {
  const storage = memoryStorage(initial);
  return { storage, favorites: createToolFavorites({ storage: () => storage }) };
}

test('legacy Format and Audience favorites are restored from the original storage key', () => {
  const { favorites } = setup(JSON.stringify({ format: ['what-to-know', 'listicle'], audience: ['general'] }));
  assert.deepEqual(favorites.values('format'), ['what-to-know', 'listicle']);
  assert.deepEqual(favorites.values('audience'), ['general']);
  const copy = favorites.values('format');
  copy.push('explainer');
  assert.deepEqual(favorites.values('format'), ['what-to-know', 'listicle']);
  assert.equal(typeof toolFavorites.toggle, 'function');
});

test('saving and removing a choice leaves the other category intact', () => {
  const { favorites, storage } = setup(JSON.stringify({ format: ['listicle'], audience: ['general'] }));
  assert.deepEqual(favorites.toggle('format', 'explainer'), { saved: true, persisted: true });
  assert.deepEqual(favorites.toggle('format', 'listicle'), { saved: false, persisted: true });
  assert.deepEqual(JSON.parse(storage.getItem(storageKey)), { format: ['explainer'], audience: ['general'] });
  assert.deepEqual(favorites.toggle('audience', 'general'), { saved: false, persisted: true });
  assert.deepEqual(favorites.values('format'), ['explainer']);
  assert.deepEqual(favorites.values('audience'), []);
});

test('invalid records and category values are ignored safely', () => {
  for (const initial of ['{', 'null', 'true', '4', '"format"', '[]', '{"format":{},"audience":"general"}']) {
    const { favorites } = setup(initial);
    assert.deepEqual(favorites.values('format'), [], initial);
    assert.deepEqual(favorites.values('audience'), [], initial);
    assert.deepEqual(favorites.toggle('format', 'listicle'), { saved: true, persisted: true });
  }
  const { favorites } = setup(JSON.stringify({ format: ['listicle', null, 0, false, {}, '', '  ', 'listicle'], audience: ['general'], voice: ['house-standard'] }));
  assert.deepEqual(favorites.values('format'), ['listicle']);
  assert.deepEqual(favorites.values('audience'), ['general']);
  assert.deepEqual(favorites.values('voice'), []);
});

test('unsupported categories and empty or non-string values cannot change storage', () => {
  const initial = JSON.stringify({ format: ['listicle'], audience: ['general'] });
  const { favorites, storage } = setup(initial);
  for (const [key, value] of [['voice', 'house-standard'], ['__proto__', 'x'], ['format', ''], ['format', '  '], ['format', null], ['format', 42]]) {
    assert.deepEqual(favorites.toggle(key, value), { saved: false, persisted: false });
  }
  assert.equal(storage.getItem(storageKey), initial);
});

test('unavailable storage keeps favorites usable in session memory', () => {
  for (const storage of [() => undefined, () => { throw new Error('Access denied'); }, () => ({ getItem() { throw new Error('Read denied'); } })]) {
    const favorites = createToolFavorites({ storage });
    assert.deepEqual(favorites.toggle('format', 'listicle'), { saved: true, persisted: false });
    favorites.refresh();
    assert.deepEqual(favorites.values('format'), ['listicle']);
    assert.deepEqual(favorites.toggle('format', 'listicle'), { saved: false, persisted: false });
    assert.deepEqual(favorites.values('format'), []);
  }
});

test('failed writes survive refresh and merge with external changes when saving recovers', () => {
  const storage = memoryStorage(JSON.stringify({ format: ['listicle'], audience: ['general'] }));
  const persist = storage.setItem;
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  const favorites = createToolFavorites({ storage: () => storage });
  assert.deepEqual(favorites.toggle('format', 'listicle'), { saved: false, persisted: false });
  assert.deepEqual(favorites.toggle('format', 'explainer'), { saved: true, persisted: false });
  favorites.refresh();
  assert.deepEqual(favorites.values('format'), ['explainer']);
  persist(storageKey, JSON.stringify({ format: ['listicle'], audience: ['local'] }));
  storage.setItem = persist;
  assert.deepEqual(favorites.toggle('audience', 'general'), { saved: true, persisted: true });
  assert.deepEqual(JSON.parse(storage.getItem(storageKey)), { format: ['explainer'], audience: ['local', 'general'] });
});

test('separate instances preserve updates to both categories', () => {
  const storage = memoryStorage();
  const first = createToolFavorites({ storage: () => storage });
  const second = createToolFavorites({ storage: () => storage });
  first.toggle('format', 'listicle');
  second.toggle('audience', 'general');
  first.toggle('format', 'explainer');
  second.toggle('audience', 'local');
  assert.deepEqual(JSON.parse(storage.getItem(storageKey)), { format: ['listicle', 'explainer'], audience: ['general', 'local'] });
  first.refresh();
  assert.deepEqual(first.values('audience'), ['general', 'local']);
});

test('subscribers observe toggles and refreshed external changes until unsubscribed', () => {
  const { favorites, storage } = setup();
  const observed = [];
  const unsubscribe = favorites.subscribe(() => observed.push(favorites.values('format')));
  favorites.toggle('format', 'listicle');
  storage.setItem(storageKey, JSON.stringify({ format: ['explainer'], audience: [] }));
  favorites.refresh();
  unsubscribe();
  favorites.toggle('format', 'what-to-know');
  assert.deepEqual(observed, [['listicle'], ['explainer']]);
});
