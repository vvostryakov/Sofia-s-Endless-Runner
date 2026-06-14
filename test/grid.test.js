import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANES, LANE, LEVEL, clampLane, playerLevel, isAirborne, lanesOverlap, withinReach,
} from '../src/engine/grid.js';

test('lane model is a hard 3', () => {
  assert.equal(LANES, 3);
  assert.deepEqual([LANE.LEFT, LANE.MID, LANE.RIGHT], [0, 1, 2]);
});

test('clampLane keeps lanes in range', () => {
  assert.equal(clampLane(-1), 0);
  assert.equal(clampLane(0), 0);
  assert.equal(clampLane(2), 2);
  assert.equal(clampLane(3), 2);
});

test('playerLevel matches the legacy grounded test (jumpH < 2 || riding)', () => {
  assert.equal(playerLevel(0, false), LEVEL.GROUND);
  assert.equal(playerLevel(1.9, false), LEVEL.GROUND);
  assert.equal(playerLevel(2, false), LEVEL.AIR);   // boundary: 2 is airborne
  assert.equal(playerLevel(200, false), LEVEL.AIR);
  assert.equal(playerLevel(200, true), LEVEL.TOP);  // riding a roof, any height
  assert.equal(playerLevel(0, true), LEVEL.TOP);

  // isAirborne is the inverse of the old grounded flag
  assert.equal(isAirborne(50, false), true);
  assert.equal(isAirborne(0, false), false);
  assert.equal(isAirborne(50, true), false);
});

test('lanesOverlap: solid hit within half a lane', () => {
  assert.equal(lanesOverlap(1, 1), true);
  assert.equal(lanesOverlap(1, 1.5), true);   // exactly half
  assert.equal(lanesOverlap(1, 1.6), false);
  assert.equal(lanesOverlap(2, 1), false);
});

test('withinReach: magnet vacuums ~one lane', () => {
  assert.equal(withinReach(2, 1), true);      // one lane away
  assert.equal(withinReach(2, 1, 1.1), true);
  assert.equal(withinReach(2, 0.8), false);   // 1.2 > 1.1
});
