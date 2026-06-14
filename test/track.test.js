import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  halfWidth, laneOffset, laneFromX, LANE_OFFSET_FACTOR,
} from '../src/engine/track.js';

const NEAR = 145; // TRACK_NEAR_HW

test('halfWidth is 0 at the horizon and ~nearHW at the player plane', () => {
  assert.equal(halfWidth(0, 0, NEAR), 0);
  assert.equal(halfWidth(1, 0, NEAR), NEAR);            // no speed boost
  assert.equal(halfWidth(1, 1, NEAR), NEAR * 1.08);     // full speed widening
});

test('halfWidth clamps the perspective fraction to 1.5', () => {
  assert.equal(halfWidth(5, 0, NEAR), NEAR * 1.5);      // t clamped
  assert.equal(halfWidth(-3, 0, NEAR), 0);              // t clamped at 0
});

test('laneOffset places lanes symmetrically around centre', () => {
  const hw = 145;
  assert.equal(laneOffset(1, hw), 0);                   // middle lane = centre
  assert.equal(laneOffset(0, hw), -hw * LANE_OFFSET_FACTOR);
  assert.equal(laneOffset(2, hw), hw * LANE_OFFSET_FACTOR);
});

test('laneFromX is the inverse of laneOffset', () => {
  const center = 200, hw = 145;
  for (const lane of [0, 0.5, 1, 1.5, 2]) {
    const x = center + laneOffset(lane, hw);
    assert.ok(Math.abs(laneFromX(x, center, hw) - lane) < 1e-9);
  }
});
