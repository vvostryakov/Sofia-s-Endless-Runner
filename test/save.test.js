import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, SCHEMA_VERSION_KEY, readVersion, migrateSave,
} from '../src/engine/save.js';

/**
 * Minimal in-memory SaveStore for tests.
 * @param {Record<string, string>} [init]
 * @returns {{ getItem(k: string): string|null, setItem(k: string, v: string): void }}
 */
const fakeStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) ?? null : null),
    setItem: (k, v) => { m.set(k, String(v)); },
  };
};

test('readVersion is 0 for a never-stamped (legacy) save', () => {
  assert.equal(readVersion(fakeStore()), 0);
  assert.equal(readVersion(fakeStore({ [SCHEMA_VERSION_KEY]: '1' })), 1);
});

test('migrateSave stamps the current version and is a no-op on legacy data', () => {
  const store = fakeStore({ ser_total_coins_v1: '72' });
  const applied = migrateSave(store);
  assert.equal(applied, 0); // no migrations defined yet
  assert.equal(store.getItem(SCHEMA_VERSION_KEY), String(SCHEMA_VERSION));
  assert.equal(store.getItem('ser_total_coins_v1'), '72'); // existing data untouched
});

test('migrateSave is idempotent', () => {
  const store = fakeStore();
  migrateSave(store);
  const applied = migrateSave(store);
  assert.equal(applied, 0);
  assert.equal(store.getItem(SCHEMA_VERSION_KEY), String(SCHEMA_VERSION));
});

test('migrations run in order, only the pending ones, then stamp target', () => {
  const store = fakeStore({ [SCHEMA_VERSION_KEY]: '1' });
  /** @type {number[]} */
  const calls = [];
  /** @type {import('../src/engine/save.js').Migration[]} */
  const migrations = [
    () => calls.push(0), // 0→1 (already applied, must be skipped)
    (s) => { calls.push(1); s.setItem('added_in_v2', 'yes'); }, // 1→2
    () => calls.push(2), // 2→3
  ];
  const applied = migrateSave(store, migrations, 3);
  assert.equal(applied, 2);
  assert.deepEqual(calls, [1, 2]); // skipped the already-applied 0→1
  assert.equal(store.getItem('added_in_v2'), 'yes');
  assert.equal(store.getItem(SCHEMA_VERSION_KEY), '3');
});
