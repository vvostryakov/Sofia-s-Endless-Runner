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
export const TRACK_NEAR_HW = 145;
export const COLLECTION_RADIUS = 64;
export const PLAYER_ANCHOR_Y = NEAR_Y;
export const PLAYER_DRAW_SCALE = 1.18;
export const PLAYER_VISUAL_LIFT = 46;   // feet sit on the ground plane at NEAR_Y
export const TIE_SPACING   = 150;

// ─── Camera state ─────────────────────────────────────────────────────────────
// Shared mutable camera the scene drives each frame. Because every projection
// helper reads it, track, scenery, obstacles and coins all follow the same
// bend/hill/strafe without any call-site changes.
//   x    — lateral strafe at the player plane (world units)
//   bend — lateral curvature: screen-x offset at the horizon. Falls off with
//          (1-t)² so the road hugs straight underfoot and swings away far out,
//          which reads as a genuine curve instead of a sheared plane.
//   hill — vertical curvature: screen-y offset at the horizon. Positive drops
//          the far road (descent), negative lifts it into a crest.
export const cam3 = { x: 0, bend: 0, hill: 0 };

export const zT    = z => FOCAL / (FOCAL + Math.max(-FOCAL * 0.5, z)); // 1 at player → 0 far
const farness      = t => { const c = Math.min(Math.max(t, 0), 1); return (1 - c) * (1 - c); };
// Screen-y for a perspective fraction t, including the hill bend
export const tY    = t => HORIZON_Y + (NEAR_Y - HORIZON_Y) * t + cam3.hill * farness(t);
export const zY    = z => tY(zT(z));
export const zSc   = z => Math.max(0.06, zT(z));
export const zTopY = (z, h) => zY(z) - h * zSc(z);
// Track centre-line in screen space: the bend pulls the far road sideways,
// the strafe slides near geometry while the vanishing point stays put.
export const centerX = t => VP_X + cam3.bend * farness(t) - cam3.x * Math.min(t, 1.5);

// ─── Distance fog ─────────────────────────────────────────────────────────────
// 0 near the player → 1 at spawn depth. Applied as object alpha so everything
// condenses out of the haze instead of popping in at SPAWN_Z.
export const FOG_START = 520;
export const FOG_END   = SPAWN_Z * 1.02;
export const fogAt = z => Math.min(1, Math.max(0, (z - FOG_START) / (FOG_END - FOG_START)));
