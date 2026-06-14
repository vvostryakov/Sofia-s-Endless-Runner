// ─── Persistent storage (platform adapter) ──────────────────────────────────
// The ONE place that talks to localStorage. Guarded so private-browsing (where
// localStorage throws) transparently falls back to an in-memory store, which
// also makes this module import-safe under Node (no `localStorage` global).
// This is a platform adapter per docs/TDD.md §4.1 — engine/game code depends on
// the small interface below, never on localStorage directly.

/** @type {{ getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void }} */
export const storage = (() => {
  try {
    const probe = '__ser_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k),
    };
  }
})();

export const saveNumber = (key, value) => storage.setItem(key, String(Math.max(0, Math.floor(value))));
export const loadNumber = (key) => Number(storage.getItem(key) || 0);
export const saveString = (key, value) => storage.setItem(key, value);
export const loadString = (key) => storage.getItem(key);
