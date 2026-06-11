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

export const zT    = z => FOCAL / (FOCAL + Math.max(-FOCAL * 0.5, z)); // 1 at player → 0 far
export const zY    = z => HORIZON_Y + (NEAR_Y - HORIZON_Y) * zT(z);
export const zSc   = z => Math.max(0.06, zT(z));
export const zTopY = (z, h) => zY(z) - h * zSc(z);
