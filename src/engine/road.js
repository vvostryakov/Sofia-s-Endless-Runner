// ─── Road curve system ──────────────────────────────────────────────────────
// Owns the road's shape: turn/hill segments scheduled ahead in world space and
// sampled into a screen-offset table each frame. Because the shape lives in the
// world, already-drawn road never morphs — turns appear at the horizon, sweep in,
// and flatten exactly as the player reaches them.
//
// Phaser-free engine system (docs/TDD.md §6 step 6). It must NOT import
// projection.js/constants.js (they touch `window` at load), so the projection
// fn `zT` and `spawnZ` are injected. `roadSlope` is pure and unit-tested.

/** @typedef {{ start: number, end: number, mag: number }} Seg */
/** @typedef {{ dz: number, x: Float32Array, y: Float32Array }} CurveTable */

// Phaser-free RNG helpers (distribution matches Phaser.Math.Between/FloatBetween).
/** @param {number} a @param {number} b @returns {number} */
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
/** @param {number} a @param {number} b @returns {number} */
const randFloat = (a, b) => a + Math.random() * (b - a);

/**
 * Lateral/vertical slope contribution at world distance `d`: a half-sine bump
 * across each active segment, 0 outside all of them.
 * @param {ReadonlyArray<Seg>} segs @param {number} d @returns {number}
 */
export const roadSlope = (segs, d) => {
  for (const s of segs) {
    if (d >= s.start && d <= s.end) {
      return s.mag * Math.sin(((d - s.start) / (s.end - s.start)) * Math.PI);
    }
  }
  return 0;
};

export class RoadCurve {
  /**
   * @param {number} spawnZ furthest spawn depth (sets the scheduling horizon)
   * @param {number} [samples] curve-table resolution
   */
  constructor(spawnZ, samples = 36) {
    this.spawnZ = spawnZ;
    this.N = samples;
    /** @type {Seg[]} */ this.segsX = [];
    /** @type {Seg[]} */ this.segsY = [];
    this.scheduledX = 0;
    this.scheduledY = 0;
    this.lastTurnDir = 0;
    this.lean = 0;
    this.farX = 0;
    this.farY = 0;
    this.tableX = new Float32Array(samples);
    this.tableY = new Float32Array(samples);
  }

  /**
   * Extend the scheduled turns/hills past the horizon and drop ones fully behind.
   * @param {number} distance current world distance
   */
  schedule(distance) {
    const horizon = distance + this.spawnZ * 2.2;
    while (this.scheduledX < horizon) {
      const start = this.scheduledX + randInt(420, 1700);
      const len = randInt(950, 1750);
      const dir = this.lastTurnDir === 0
        ? (Math.random() < 0.5 ? -1 : 1)
        : (Math.random() < 0.74 ? -this.lastTurnDir : this.lastTurnDir);
      this.lastTurnDir = dir;
      this.segsX.push({ start, end: start + len, mag: randFloat(0.16, 0.3) * dir });
      this.scheduledX = start + len;
    }
    while (this.scheduledY < horizon) {
      const start = this.scheduledY + randInt(900, 2600);
      const len = randInt(1100, 2000);
      this.segsY.push({ start, end: start + len, mag: randFloat(-0.11, 0.15) });
      this.scheduledY = start + len;
    }
    while (this.segsX.length && this.segsX[0].end < distance - 50) this.segsX.shift();
    while (this.segsY.length && this.segsY[0].end < distance - 50) this.segsY.shift();
  }

  /**
   * Advance the road and rebuild the screen-offset table. Updates farX/farY/lean
   * and returns the table for `cam3.curve`.
   * @param {number} distance @param {(z: number) => number} zT projection z→t
   * @returns {CurveTable}
   */
  update(distance, zT) {
    this.schedule(distance);
    const N = this.N;
    const dz = (this.spawnZ * 1.2) / (N - 1);
    let accX = 0;
    let accY = 0;
    this.tableX[0] = 0;
    this.tableY[0] = 0;
    for (let i = 1; i < N; i++) {
      const mid = distance + (i - 0.5) * dz;
      accX += roadSlope(this.segsX, mid) * dz;
      accY += roadSlope(this.segsY, mid) * dz;
      const p = zT(i * dz);
      this.tableX[i] = accX * p;
      this.tableY[i] = -accY * p; // elevation up → screen up
    }
    this.farX = this.tableX[N - 1];
    this.farY = this.tableY[N - 1];
    this.lean = roadSlope(this.segsX, distance + 300); // lean into the curve just ahead
    return { dz, x: this.tableX, y: this.tableY };
  }
}
