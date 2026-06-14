// ─── Track geometry (pure) ──────────────────────────────────────────────────
// The math that maps lanes ↔ screen-x across the perspective track: how wide the
// track is at a given depth (widening slightly with speed to sell acceleration),
// where a lane sits, and the inverse (which fractional lane a screen-x is in).
// Pure, Phaser-free, JSDoc-typed, unit-tested (docs/TDD.md §6 step 6b). The
// projection (centre-x, z→t) stays in the scene and is composed with these.

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Lanes sit at ±this fraction of the half-width from centre. */
export const LANE_OFFSET_FACTOR = 0.667;
/** Max extra track width at full speed (FOV widening). */
export const SPEED_WIDEN = 0.08;

/**
 * Half-width of the track at perspective fraction `t`, widened a little by speed.
 * @param {number} t perspective fraction (0 far → ~1 at player, clamped to 1.5)
 * @param {number} speedFrac 0..1 speed between base and max
 * @param {number} nearHW half-width at the player plane
 * @returns {number}
 */
export const halfWidth = (t, speedFrac, nearHW) => {
  const tc = clamp(t, 0, 1.5);
  const boost = 1 + speedFrac * SPEED_WIDEN * Math.min(tc, 1);
  return nearHW * tc * boost;
};

/**
 * Screen-x offset from the track centre for a (possibly fractional) lane, given
 * the half-width `hw` at that depth.
 * @param {number} lane @param {number} hw @returns {number}
 */
export const laneOffset = (lane, hw) => (lane - 1) * hw * LANE_OFFSET_FACTOR;

/**
 * Inverse of laneOffset: the fractional lane a screen-x falls in, given the
 * track centre and half-width at the player plane.
 * @param {number} px @param {number} center @param {number} hw @returns {number}
 */
export const laneFromX = (px, center, hw) => 1 + (px - center) / (hw * LANE_OFFSET_FACTOR);
