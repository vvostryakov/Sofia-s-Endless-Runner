import { W, H, DPR } from './constants.js';

export const setupHiDPI = (scene) => {
  const cam = scene.cameras.main;
  cam.setZoom(DPR);
  cam.centerOn(W / 2, H / 2);
  return { x: cam.scrollX, y: cam.scrollY };
};

// ─── Perspective ──────────────────────────────────────────────────────────────
// True pseudo-3D camera (Subway Surfers style): every object lives at a world
// depth z — world units ahead of the player, where 1 wu ≈ 1 px at the player
// plane. Projection scale is FOCAL / (FOCAL + z), so things drift in slowly at
// the horizon and sweep past the camera with real perspective acceleration.
export const VP_X          = W / 2;
export const NEAR_Y        = 540;
export const HORIZON_Y     = 275;
export const SPAWN_Z       = 1600;
export const FOCAL         = 320;
// Wide near-field: the road overflows the screen so the player's lane plus a
// slice of each neighbour fills the view, instead of a narrow strip.
export const TRACK_NEAR_HW = 235;
export const COLLECTION_RADIUS = 78;
export const PLAYER_ANCHOR_Y = NEAR_Y;
export const PLAYER_DRAW_SCALE = 1.34;
export const TIE_SPACING   = 150;

// ─── Camera state ─────────────────────────────────────────────────────────────
//   x     — lateral strafe at the player plane (world units)
//   curve — per-frame table of screen offsets sampled along depth, built by
//           the scene from a road map anchored to WORLD DISTANCE. Because the
//           road's shape lives in world space, the drawn path never morphs:
//           turns and hills appear at the horizon, sweep toward the player,
//           and flatten out exactly as she reaches them.
//           { dz, x: Float32Array, y: Float32Array }
export const cam3 = { x: 0, curve: null };

export const zT = z => FOCAL / (FOCAL + Math.max(-FOCAL * 0.5, z)); // 1 at player → 0 far
const tToZ = t => {
  const tc = Math.min(Math.max(t, 0.05), 1.45);
  return FOCAL * (1 - tc) / tc; // negative beyond the player plane
};
const sample = (arr, dz, z) => {
  if (!arr || z <= 0) return 0;
  const i = Math.min(arr.length - 1.001, z / dz);
  const i0 = Math.floor(i);
  const f = i - i0;
  return arr[i0] * (1 - f) + arr[i0 + 1] * f;
};
export const curveXAt = z => cam3.curve ? sample(cam3.curve.x, cam3.curve.dz, z) : 0;
export const curveYAt = z => cam3.curve ? sample(cam3.curve.y, cam3.curve.dz, z) : 0;

// Screen-y for a perspective fraction t / a depth z, including road elevation
export const tY    = t => HORIZON_Y + (NEAR_Y - HORIZON_Y) * t + curveYAt(tToZ(t));
export const zY    = z => HORIZON_Y + (NEAR_Y - HORIZON_Y) * zT(z) + curveYAt(z);
export const zSc   = z => Math.max(0.06, zT(z));
export const zTopY = (z, h) => zY(z) - h * zSc(z);
// Track centre-line in screen space: the world-anchored curve pulls the far
// road sideways; the strafe slides near geometry while the horizon stays put.
export const centerX = t => VP_X + curveXAt(tToZ(t)) - cam3.x * Math.min(t, 1.5);

// ─── Distance fog ─────────────────────────────────────────────────────────────
// 0 near the player → 1 at spawn depth. Applied as object alpha so everything
// condenses out of the haze instead of popping in at SPAWN_Z.
export const FOG_START = 520;
export const FOG_END   = SPAWN_Z * 1.02;
export const fogAt = z => Math.min(1, Math.max(0, (z - FOG_START) / (FOG_END - FOG_START)));
