// ─── Save schema & migrations (pure) ────────────────────────────────────────
// The seam that lets the save format evolve (premium currency, new item types,
// new modes — docs/GDD.md §9.1, §14.2) without breaking existing players' data.
// Pure: it operates on an injected store interface, so it is Node-importable and
// unit-tested (docs/TDD.md §4, D4). Wiring to real storage happens at boot.

/** @typedef {{ getItem(k:string): string|null, setItem(k:string, v:string): void }} SaveStore */
/** @typedef {(store: SaveStore) => void} Migration */

/** Bump this whenever the persisted format changes, and append a MIGRATION. */
export const SCHEMA_VERSION = 1;
export const SCHEMA_VERSION_KEY = 'ser_schema_version';

// Ordered migrations. MIGRATIONS[k] upgrades a save from version k → k+1.
// Empty today: every existing key is still v1-shaped, so reaching v1 is a no-op
// stamp. The seam exists now so future changes are additive and individually
// testable.
/** @type {Migration[]} */
export const MIGRATIONS = [];

/**
 * The schema version currently stamped in `store` (0 if never stamped — which
 * is the case for every save written before this module existed).
 * @param {SaveStore} store @returns {number}
 */
export const readVersion = (store) => Number(store.getItem(SCHEMA_VERSION_KEY) || 0);

/**
 * Bring `store` up to `target` by applying pending migrations in order, then
 * stamp the version. Idempotent: running it on an up-to-date store changes
 * nothing but the (already-current) stamp. Returns how many migrations ran.
 * @param {SaveStore} store
 * @param {Migration[]} [migrations] @param {number} [target]
 * @returns {number}
 */
export const migrateSave = (store, migrations = MIGRATIONS, target = SCHEMA_VERSION) => {
  const from = readVersion(store);
  let applied = 0;
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (typeof step === 'function') { step(store); applied++; }
  }
  store.setItem(SCHEMA_VERSION_KEY, String(target));
  return applied;
};
