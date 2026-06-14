import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJump, integrateVertical } from '../src/engine/jump.js';

const JUMP = 465, DOUBLE = 370, G = 900;

test('resolveJump: a grounded press is a full jump, count resets to 1, no flip', () => {
  assert.deepEqual(resolveJump(true, 0, JUMP, DOUBLE), { jumpVel: JUMP, jumpsUsed: 1, flip: false });
  // grounded always gives a ground jump even if jumpsUsed is stale
  assert.deepEqual(resolveJump(true, 5, JUMP, DOUBLE), { jumpVel: JUMP, jumpsUsed: 1, flip: false });
});

test('resolveJump: airborne with one jump used is a flipping double jump', () => {
  assert.deepEqual(resolveJump(false, 1, JUMP, DOUBLE), { jumpVel: DOUBLE, jumpsUsed: 2, flip: true });
});

test('resolveJump: airborne with both jumps spent returns null (buffer it)', () => {
  assert.equal(resolveJump(false, 2, JUMP, DOUBLE), null);
  assert.equal(resolveJump(false, 3, JUMP, DOUBLE), null);
});

test('integrateVertical applies gravity then advances height (semi-implicit Euler)', () => {
  // one 0.1s step from rest at the apex
  const a = integrateVertical(100, 0, 0.1, G);
  assert.equal(a.jumpVel, -90);          // 0 - 900*0.1
  assert.ok(Math.abs(a.jumpH - 91) < 1e-9); // 100 + (-90)*0.1

  // rising velocity still decays by gravity
  const b = integrateVertical(0, 465, 0.1, G);
  assert.equal(b.jumpVel, 375);          // 465 - 90
  assert.ok(Math.abs(b.jumpH - 37.5) < 1e-9);
});
