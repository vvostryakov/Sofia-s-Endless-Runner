import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadSlope, RoadCurve } from '../src/engine/road.js';

test('roadSlope is zero outside every segment', () => {
  const segs = [{ start: 100, end: 200, mag: 0.2 }];
  assert.equal(roadSlope(segs, 50), 0);
  assert.equal(roadSlope(segs, 250), 0);
  assert.equal(roadSlope([], 100), 0);
});

test('roadSlope peaks (= mag) at the segment midpoint and is signed', () => {
  const seg = [{ start: 0, end: 100, mag: 0.3 }];
  assert.ok(Math.abs(roadSlope(seg, 50) - 0.3) < 1e-9); // sin(pi/2) = 1
  assert.ok(roadSlope(seg, 25) > 0 && roadSlope(seg, 25) < 0.3);
  const neg = [{ start: 0, end: 100, mag: -0.3 }];
  assert.ok(roadSlope(neg, 50) < 0);
});

test('RoadCurve.update seeds a well-formed curve table', () => {
  const road = new RoadCurve(1600, 36);
  const table = road.update(0, () => 1); // stub projection (t = 1 everywhere)
  assert.equal(table.x.length, 36);
  assert.equal(table.y.length, 36);
  assert.equal(table.x[0], 0);   // anchored at the player plane
  assert.equal(table.y[0], 0);
  assert.equal(road.farX, table.x[35]);
  assert.equal(road.farY, table.y[35]);
  assert.ok(Number.isFinite(road.lean));
  assert.ok(road.segsX.length > 0); // scheduling populated turns ahead
});

test('RoadCurve drops segments fully behind the player', () => {
  const road = new RoadCurve(1600);
  road.segsX = [{ start: -5000, end: -4000, mag: 0.2 }]; // entirely behind
  road.scheduledX = 10_000; road.scheduledY = 10_000;    // skip new scheduling
  road.schedule(0);
  assert.equal(road.segsX.length, 0); // shifted out
});
