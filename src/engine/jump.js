// ─── Jump & vertical physics (pure) ─────────────────────────────────────────
// The decision math for jumping (ground jump → double jump → buffer) and the
// gravity integration step. Pure, Phaser-free, JSDoc-typed, unit-tested
// (docs/TDD.md §6). The surrounding state effects (riding, landing audio/squash,
// input buffering) stay in the scene; this owns only the numbers.

/** @typedef {{ jumpVel: number, jumpsUsed: number, flip: boolean }} JumpResult */

/**
 * Resolve a jump press. Returns the new vertical velocity, jump count, and
 * whether to flip (double jump), or `null` when the press should be buffered
 * (airborne with both jumps already spent).
 * @param {boolean} grounded @param {number} jumpsUsed
 * @param {number} jumpInit ground-jump impulse
 * @param {number} doubleJumpInit air-jump impulse
 * @returns {JumpResult | null}
 */
export const resolveJump = (grounded, jumpsUsed, jumpInit, doubleJumpInit) => {
  if (grounded) return { jumpVel: jumpInit, jumpsUsed: 1, flip: false };
  if (jumpsUsed < 2) return { jumpVel: doubleJumpInit, jumpsUsed: jumpsUsed + 1, flip: true };
  return null;
};

/**
 * One semi-implicit Euler step of vertical motion under gravity: apply gravity
 * to the velocity, then advance height by the new velocity.
 * @param {number} jumpH @param {number} jumpVel @param {number} dt seconds
 * @param {number} gravity @returns {{ jumpH: number, jumpVel: number }}
 */
export const integrateVertical = (jumpH, jumpVel, dt, gravity) => {
  const v = jumpVel - gravity * dt;
  return { jumpH: jumpH + v * dt, jumpVel: v };
};
