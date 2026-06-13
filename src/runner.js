// ─── Runner character ─────────────────────────────────────────────────────────
// Sofia drawn as a single Graphics pass per frame: capsule limbs with shoes and
// hands, a hooded jacket with a backpack, headphones, and the ponytail + bow.
// The scene feeds in a pose (run swing, tuck, tilt, slide, squash) and the same
// outfit palette the shop sells, so cosmetics keep working unchanged.
//
// Local space: origin at the body centre, +y down, feet at y=+42. The caller's
// scale/rotation/squash are applied with the canvas matrix so every pose keeps
// the same proportions.

const SKIN = 0xffcc99;

// Lighten (amt > 0) or darken (amt < 0) a 0xRRGGBB colour by roughly amt %.
const shade = (c, amt) => {
  const d = Math.round(amt * 2.55);
  const r = Math.min(255, Math.max(0, ((c >> 16) & 0xff) + d));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 0xff) + d));
  const b = Math.min(255, Math.max(0, (c & 0xff) + d));
  return (r << 16) | (g << 8) | b;
};

// Rounded limb hanging from (x, y), rotated around its anchor. rot 0 points
// straight down; positive rot swings the tip toward -x (canvas clockwise).
// tip: { kind: 'shoe'|'hand', color } caps the end.
const limb = (g, x, y, rot, w, len, color, tip = null) => {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(rot);
  g.fillStyle(color, 1);
  g.fillRoundedRect(-w / 2, -w * 0.3, w, len + w * 0.3, w / 2);
  if (tip && tip.kind === 'shoe') {
    g.fillStyle(tip.color, 1);
    g.fillRoundedRect(-w / 2 - 1.5, len - 4.5, w + 3, 8, 4);
    g.fillStyle(0xf3f6fa, 1);
    g.fillRoundedRect(-w / 2 - 1.5, len + 1, w + 3, 3, 1.5);
  } else if (tip && tip.kind === 'hand') {
    g.fillStyle(tip.color, 1);
    g.fillCircle(0, len + 1, w * 0.52);
  }
  g.restore();
};

const headphones = (g, cy) => {
  g.fillStyle(0x1d2730, 1);
  g.fillRoundedRect(-15, cy - 17, 30, 5, 2.5);
  g.fillRoundedRect(-19, cy - 5, 6, 12, 3);
  g.fillRoundedRect(13, cy - 5, 6, 12, 3);
  g.fillStyle(0x39505e, 1);
  g.fillRoundedRect(-17.8, cy - 2, 3.6, 6, 1.8);
  g.fillRoundedRect(14.2, cy - 2, 3.6, 6, 1.8);
};

const ponytail = (g, pal, x, y, rot) => {
  limb(g, x, y, rot, 8, 26, pal.ponytail);
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(rot);
  g.fillStyle(pal.hairShine, 0.5);
  g.fillRoundedRect(-1.2, 5, 2.4, 15, 1.2);
  g.restore();
  g.fillStyle(pal.bow, 1);
  g.fillTriangle(x, y, x + 8, y - 5, x + 8, y + 4);
  g.fillTriangle(x, y, x - 7, y - 5, x - 7, y + 3);
  g.fillStyle(shade(pal.bow, -22), 1);
  g.fillCircle(x, y, 2.4);
};

// Two-segment leg: thigh from the hip, calf folding at the knee. The
// back-swinging leg kicks its heel up behind her (sole toward the camera) —
// the signature read of a run cycle seen from the back. The fold eases in
// with kick² so mid-swing the foot stays under her instead of flying sideways.
const drawLeg = (g, hipX, side, s, tuck, pal, shoeC) => {
  const kick = Math.max(0, -s);
  const fold = Math.min(1, kick * kick + tuck * 0.55);
  const thighLen = 16 * (1 - tuck * 0.3);
  const calfLen = 15 * (1 - kick * 0.18 - tuck * 0.25);
  g.save();
  g.translateCanvas(hipX, 6);
  g.rotateCanvas(side * (0.05 + tuck * 0.3) + s * 0.06);
  g.fillStyle(pal.legs, 1);
  g.fillRoundedRect(-5.5, -3.3, 11, thighLen + 3.3, 5.5);
  g.translateCanvas(0, thighLen);
  g.rotateCanvas(-side * fold * 2.35);
  g.fillStyle(shade(pal.legs, -8), 1);
  g.fillRoundedRect(-4.75, -2.8, 9.5, calfLen + 2.8, 4.75);
  g.fillStyle(shoeC, 1);
  g.fillRoundedRect(-6.25, calfLen - 4, 12.5, 8, 4);
  g.fillStyle(0xf3f6fa, 1);
  g.fillRoundedRect(-6.25, calfLen + 2, 12.5, 3.2, 1.6);
  g.restore();
};

function uprightPose(g, p, pal) {
  const swing = p.swing || 0;
  const tuck = p.tuck || 0;
  const shoeC = shade(pal.legs, -26);

  drawLeg(g, -7, -1, swing, tuck, pal, shoeC);
  drawLeg(g, 7, 1, -swing, tuck, pal, shoeC);

  // The torso group sways gently against the stride
  g.save();
  g.translateCanvas(swing * 1.6, 0);
  g.rotateCanvas(swing * 0.035);

  // Jacket with hem band and soft lower shading
  g.fillStyle(pal.body, 1);
  g.fillRoundedRect(-16, -20, 32, 33, 11);
  g.fillStyle(shade(pal.body, -20), 0.4);
  g.fillRoundedRect(-16, 1, 32, 12, { tl: 0, tr: 0, bl: 11, br: 11 });
  g.fillStyle(pal.stripe, 1);
  g.fillRoundedRect(-14, 7, 28, 5, 2.5);

  // Backpack on the back (we see her from behind), straps over the shoulders
  const packC = shade(pal.bow, -8);
  g.fillStyle(shade(packC, -20), 1);
  g.fillRoundedRect(-9.5, -20, 4.5, 8, 2);
  g.fillRoundedRect(5, -20, 4.5, 8, 2);
  g.fillStyle(packC, 1);
  g.fillRoundedRect(-11, -15, 22, 23, 8);
  g.fillStyle(shade(packC, 13), 1);
  g.fillRoundedRect(-11, -15, 22, 9, { tl: 8, tr: 8, bl: 0, br: 0 });
  g.fillStyle(shade(packC, -24), 1);
  g.fillRoundedRect(-3.5, -4, 7, 5, 2);

  // Arms hang at her sides (anchored outside the jacket) and pump forward/
  // back: from behind that reads as foreshortening — the forward arm looks
  // shorter and its hand rises — not a sideways sweep across the back.
  const reachL = Math.max(0, swing);
  const reachR = Math.max(0, -swing);
  const armLenL = 23 * (1 - 0.42 * reachL + 0.1 * reachR) * (1 - tuck * 0.15);
  const armLenR = 23 * (1 - 0.42 * reachR + 0.1 * reachL) * (1 - tuck * 0.15);
  limb(g, -16.5, -13, 0.12 + swing * 0.07 + tuck * 0.8, 9, armLenL, pal.arms, { kind: 'hand', color: SKIN });
  limb(g, 16.5, -13, -0.12 + swing * 0.07 - tuck * 0.8, 9, armLenR, pal.arms, { kind: 'hand', color: SKIN });

  // Head: neck hint, hair dome, shine
  g.fillStyle(SKIN, 1);
  g.fillCircle(0, -20.5, 6);
  g.fillStyle(pal.hair, 1);
  g.fillCircle(0, -34, 15);
  g.fillStyle(pal.hairShine, 0.85);
  g.fillEllipse(-5, -41, 12, 6.5);

  headphones(g, -34);
  // Anchored high on the right so it swings clear of the hair dome
  ponytail(g, pal, 8, -42, 0.85 + (p.tailSway || 0) * 0.16 + (p.lean || 0) * -1.8);

  g.restore();
}

function slidePose(g, p, pal) {
  const shoeC = shade(pal.legs, -26);

  // Feet thrown forward — shoes peek over the top of the ducked body
  g.fillStyle(shoeC, 1);
  g.fillRoundedRect(-17, -1, 10, 7, 3.5);
  g.fillRoundedRect(7, 1, 10, 7, 3.5);
  g.fillStyle(0xf3f6fa, 1);
  g.fillRoundedRect(-17, -1, 10, 2.5, 1.2);
  g.fillRoundedRect(7, 1, 10, 2.5, 1.2);

  // Low wide body
  g.fillStyle(pal.body, 1);
  g.fillRoundedRect(-23, 8, 46, 26, 12);
  g.fillStyle(shade(pal.body, -20), 0.4);
  g.fillRoundedRect(-23, 22, 46, 12, { tl: 0, tr: 0, bl: 12, br: 12 });
  g.fillStyle(pal.stripe, 1);
  g.fillRoundedRect(-20, 27, 40, 5, 2.5);

  // Arms trailing out to the sides for balance
  limb(g, -21, 14, 1.9, 9, 18, pal.arms, { kind: 'hand', color: SKIN });
  limb(g, 21, 14, -1.9, 9, 18, pal.arms, { kind: 'hand', color: SKIN });

  // Head ducked low against the body
  g.fillStyle(pal.hair, 1);
  g.fillCircle(0, 2, 13);
  g.fillStyle(pal.hairShine, 0.85);
  g.fillEllipse(-4, -4, 10, 5.5);
  headphones(g, 4);

  // Ponytail whipping up in the slipstream
  ponytail(g, pal, 4, -8, -2.6 + (p.tailSway || 0) * 0.08);
}

// pose: { x, feetY, s, rot, sqX, sqY, sliding, swing, tuck, lean, tailSway }
export function drawRunner(g, p, pal) {
  g.clear();
  const sqX = p.sqX || 1;
  const sqY = p.sqY || 1;
  g.save();
  // Anchor at the body centre so tilt and flips pivot naturally
  g.translateCanvas(p.x, p.feetY - 42 * p.s * sqY);
  g.rotateCanvas(p.rot || 0);
  g.scaleCanvas(p.s * sqX, p.s * sqY);
  if (p.sliding) slidePose(g, p, pal);
  else uprightPose(g, p, pal);
  g.restore();
}
