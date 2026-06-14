import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  difficultyAt, speedAt, levelAt, spawnGapRange,
} from '../src/engine/difficulty.js';

test('difficultyAt ramps 0→1 over the ramp window and clamps', () => {
  assert.equal(difficultyAt(0), 0);
  assert.equal(difficultyAt(75000), 0.5);
  assert.equal(difficultyAt(150000), 1);
  assert.equal(difficultyAt(1_000_000), 1); // clamped
  assert.equal(difficultyAt(-50), 0);       // clamped
});

test('levelAt is 1-based and steps every 4500 units', () => {
  assert.equal(levelAt(0), 1);
  assert.equal(levelAt(4499), 1);
  assert.equal(levelAt(4500), 2);
  assert.equal(levelAt(9000), 3);
});

test('speedAt starts at base and is capped by max + world bonus', () => {
  assert.equal(speedAt(0, 0, 480, 1080), 480);
  assert.equal(speedAt(100000, 0, 480, 1080), 480 + 100000 * 0.0035); // 830, below cap
  assert.equal(speedAt(10_000_000, 0, 480, 1080), 1080);              // capped at max
  assert.equal(speedAt(10_000_000, 2, 480, 1080), 1080 + 2 * 60);     // cap raised per world
});

test('spawnGapRange tightens as difficulty rises', () => {
  assert.deepEqual(spawnGapRange(0), { min: 1300, max: 2100 });
  assert.deepEqual(spawnGapRange(1), { min: 850, max: 1350 });
  const mid = spawnGapRange(0.5);
  assert.equal(mid.min, 1075);
  assert.equal(mid.max, 1725);
});
