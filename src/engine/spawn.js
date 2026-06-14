// ─── Spawn fairness & selection (pure) ──────────────────────────────────────
// The "no cheap deaths" guarantee lives here: given the objects currently on the
// track, which lanes are blocked near a spawn depth, and therefore which lanes
// stay survivable. Plus the weighted pattern picker. Pure, Phaser-free,
// JSDoc-typed, Node-importable and unit-tested (docs/TDD.md §6 step 5, GDD §6.2).
//
// The patterns themselves still build Phaser objects in GameScene; they consult
// these functions to keep at least one lane open. The full pattern-table
// extraction waits for the spawn-primitive seam (step 6).

import { LANES } from './grid.js';

/** Object types that block a lane (a coin/pickup never blocks). */
export const BLOCKING_TYPES = new Set(['obstacle', 'gate', 'wagon']);

/** @typedef {{ type: string, lane: number, z: number, worldL?: number }} TrackObject */

/**
 * Lanes occupied by a blocking object within `range` of depth `z`. An object's
 * footprint runs from its front (`z`) back through its length (`worldL`).
 * @param {ReadonlyArray<TrackObject>} objects @param {number} z @param {number} range
 * @returns {Set<number>}
 */
export const blockedLanes = (objects, z, range) => {
  /** @type {Set<number>} */
  const blocked = new Set();
  for (const o of objects) {
    if (BLOCKING_TYPES.has(o.type) && o.z + (o.worldL || 0) > z - range && o.z < z + range) {
      blocked.add(o.lane);
    }
  }
  return blocked;
};

/**
 * Lanes NOT blocked near depth `z` — the survivable paths.
 * @param {ReadonlyArray<TrackObject>} objects @param {number} z @param {number} range
 * @param {number} [lanes] @returns {number[]}
 */
export const freeLanes = (objects, z, range, lanes = LANES) => {
  const blocked = blockedLanes(objects, z, range);
  /** @type {number[]} */
  const out = [];
  for (let l = 0; l < lanes; l++) if (!blocked.has(l)) out.push(l);
  return out;
};

/**
 * Sum of `.w` weights across `items`.
 * @param {ReadonlyArray<{ w: number }>} items @returns {number}
 */
export const totalWeight = (items) => items.reduce((s, it) => s + it.w, 0);

/**
 * Pick a weighted item for a given `roll` in [0, totalWeight). Walks the list
 * subtracting weights; falls back to the first item (matches the legacy picker).
 * @template {{ w: number }} T
 * @param {ReadonlyArray<T>} items @param {number} roll @returns {T}
 */
export const pickWeighted = (items, roll) => {
  let r = roll;
  return items.find(it => (r -= it.w) <= 0) || items[0];
};
