const storageKey = 'csa.tool-favorites.v1';
const categories = ['format', 'audience'];
const validValue = value => typeof value === 'string' && value.trim().length > 0;

function normalize(stored) {
  const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  return Object.fromEntries(categories.map(key => [key,
    Array.isArray(source[key]) ? [...new Set(source[key].filter(validValue))] : [],
  ]));
}

export function createToolFavorites({ storage = () => globalThis.localStorage } = {}) {
  let favorites = normalize(null);
  const pending = Object.fromEntries(categories.map(key => [key, new Map()]));
  const listeners = new Set();

  function load() {
    let target;
    let raw;
    try {
      target = storage();
      raw = target.getItem(storageKey);
    } catch { return null; }
    let stored;
    try { stored = JSON.parse(raw); }
    catch { stored = null; }
    favorites = normalize(stored);
    // Keep session changes when the browser allows reads but rejects writes.
    for (const key of categories) {
      const values = new Set(favorites[key]);
      for (const [value, saved] of pending[key]) {
        if (saved) values.add(value);
        else values.delete(value);
      }
      favorites[key] = [...values];
    }
    return target;
  }

  function notify() {
    for (const listener of [...listeners]) listener();
  }

  load();
  return {
    values(key) {
      return categories.includes(key) ? [...favorites[key]] : [];
    },
    toggle(key, value) {
      if (!categories.includes(key) || !validValue(value)) return { saved: false, persisted: false };
      // Merge with the latest record so another control or tab's choices survive.
      const target = load();
      const values = new Set(favorites[key]);
      const saved = !values.has(value);
      if (saved) values.add(value);
      else values.delete(value);
      favorites[key] = [...values];
      pending[key].set(value, saved);
      let persisted = false;
      if (target) {
        try {
          target.setItem(storageKey, JSON.stringify(favorites));
          persisted = true;
          for (const category of categories) pending[category].clear();
        } catch { /* Keep the updated choices available for this session. */ }
      }
      notify();
      return { saved, persisted };
    },
    refresh() {
      load();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const toolFavorites = createToolFavorites();
