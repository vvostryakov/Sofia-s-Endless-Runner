// ─── The 3×3 play space (pure) ──────────────────────────────────────────────
// The runner's fundamental space is a 3×3 grid: 3 lanes (horizontal — a hard cap
// for controllability) × 3 levels (ground / on-top / air). See docs/GDD.md §6.7.
// This module is the single source of truth for that model: pure, Phaser-free,
// JSDoc-typed, Node-importable and unit-tested (docs/TDD.md §4.2, D4).
//
// Today's player vertical state is continuous (`jumpH`), so `playerLevel` derives
// the discrete level from it; the mapping is exactly today's grounded test
// (`jumpH < GROUND_EPS || riding`), so routing collision/render through this is
// behavior-preserving. Discrete cell-vs-cell collision is a later refinement.

/** Number of lanes. Hard cap — more hurts control on a phone (docs/GDD.md §6.7). */
export const LANES = 3;

/** Lane indices, left→right. */
export const LANE = { LEFT: 0, MID: 1, RIGHT: 2 };

/** Vertical levels, low→high. */
export const LEVEL = { GROUND: 0, TOP: 1, AIR: 2 };

/** jumpH below this counts as grounded (matches the legacy `jumpH < 2` test). */
export const GROUND_EPS = 2;

/**
 * Clamp a (possibly out-of-range) lane index into [0, LANES-1].
 * @param {number} lane @param {number} [lanes] @returns {number}
 */
export const clampLane = (lane, lanes = LANES) => Math.max(0, Math.min(lanes - 1, lane));

/**
 * The player's discrete vertical level from her continuous state. Riding a roof
 * is TOP regardless of height; otherwise GROUND when settled, else AIR.
 * @param {number} jumpH @param {boolean} riding @param {number} [groundEps]
 * @returns {number}
 */
export const playerLevel = (jumpH, riding, groundEps = GROUND_EPS) =>
  riding ? LEVEL.TOP : (jumpH < groundEps ? LEVEL.GROUND : LEVEL.AIR);

/** True when the player is airborne (neither grounded nor riding). */
export const isAirborne = (jumpH, riding, groundEps = GROUND_EPS) =>
  playerLevel(jumpH, riding, groundEps) === LEVEL.AIR;

/**
 * Whether an object's lane overlaps the player's (fractional, visual) lane enough
 * to count as a solid collision. Uses the visual lane so she hits what she's
 * drawn over, not the lane she's snapping toward.
 * @param {number} objLane @param {number} playerLaneF @param {number} [tol]
 * @returns {boolean}
 */
export const lanesOverlap = (objLane, playerLaneF, tol = 0.5) =>
  Math.abs(objLane - playerLaneF) <= tol;

/**
 * Whether an object is within magnet reach (~one lane) of the player.
 * @param {number} objLane @param {number} playerLaneF @param {number} [reach]
 * @returns {boolean}
 */
export const withinReach = (objLane, playerLaneF, reach = 1.1) =>
  Math.abs(objLane - playerLaneF) <= reach;
