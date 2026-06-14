// ─── Difficulty & pacing (pure) ─────────────────────────────────────────────
// Pure math for the run's pacing — no Phaser, no DOM, no globals. This is the
// first module of the Phaser-free engine core (see docs/TDD.md §4). Being pure
// makes it Node-importable and unit-tested (docs/TDD.md D4). Callers pass in
// tuning values (base/max speed) so this module never imports `constants.js`,
// which touches `window` at load time.

/**
 * Clamp `v` into [lo, hi].
 * @param {number} v @param {number} lo @param {number} hi @returns {number}
 */
export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Linear interpolate a→b by t (matches Phaser.Math.Linear).
 * @param {number} a @param {number} b @param {number} t @returns {number}
 */
export const lerp = (a, b, t) => a + (b - a) * t;

// Tuning (mirrors the values previously inlined in GameScene).
export const DIFFICULTY_RAMP_MS = 150000; // run time to reach full difficulty
export const LEVEL_DISTANCE     = 4500;   // world units per level step
export const SPEED_RAMP_PER_MS  = 0.0035; // speed gained per ms of run time
export const WORLD_SPEED_BONUS  = 60;     // max-speed bonus per world advanced
export const SPAWN_GAP = { // ms between spawns, lerped by difficulty 0→1
  minEasy: 1300, minHard: 850,
  maxEasy: 2100, maxHard: 1350,
};

/**
 * 0..1 difficulty from elapsed run time (ms).
 * @param {number} runTimeMs @returns {number}
 */
export const difficultyAt = (runTimeMs) => clamp(runTimeMs / DIFFICULTY_RAMP_MS, 0, 1);

/**
 * Current speed (world units/s). Ramps from base, capped at max + world bonus.
 * @param {number} runTimeMs @param {number} worldIdx
 * @param {number} baseSpeed @param {number} maxSpeed @returns {number}
 */
export const speedAt = (runTimeMs, worldIdx, baseSpeed, maxSpeed) =>
  Math.min(maxSpeed + worldIdx * WORLD_SPEED_BONUS, baseSpeed + runTimeMs * SPEED_RAMP_PER_MS);

/**
 * 1-based level from distance travelled (world units).
 * @param {number} distance @returns {number}
 */
export const levelAt = (distance) => 1 + Math.floor(distance / LEVEL_DISTANCE);

/**
 * Spawn gap range (ms) for a given 0..1 difficulty; gaps tighten as it rises.
 * @param {number} difficulty @returns {{min:number, max:number}}
 */
export const spawnGapRange = (difficulty) => ({
  min: lerp(SPAWN_GAP.minEasy, SPAWN_GAP.minHard, difficulty),
  max: lerp(SPAWN_GAP.maxEasy, SPAWN_GAP.maxHard, difficulty),
});
