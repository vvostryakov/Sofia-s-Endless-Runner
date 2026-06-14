import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockedLanes, freeLanes, totalWeight, pickWeighted,
} from '../src/engine/spawn.js';

const obj = (type, lane, z, worldL = 0) => ({ type, lane, z, worldL });

test('blockedLanes counts only blocking types within range', () => {
  const objs = [
    obj('obstacle', 0, 1600),
    obj('coin', 1, 1600),   // coins never block
    obj('gate', 2, 1600),
    obj('magnet', 1, 1600), // pickups never block
  ];
  assert.deepEqual([...blockedLanes(objs, 1600, 650)].sort(), [0, 2]);
});

test('blockedLanes respects the depth window and object length', () => {
  // far away in z → not blocking
  assert.equal(blockedLanes([obj('obstacle', 1, 4000)], 1600, 650).has(1), false);
  // a long wagon whose body reaches into the window blocks even if its front is behind
  const wagon = obj('wagon', 1, 900, 360); // front z=900, back reaches 1260
  assert.equal(blockedLanes([wagon], 1600, 650).has(1), true); // window starts at 950
});

test('freeLanes is the complement and always leaves a path in fair setups', () => {
  const objs = [obj('obstacle', 0, 1600), obj('crate-like-gate', 1, 1600, 0)];
  // only lane 0 is a real blocker here (unknown type does not block)
  assert.deepEqual(freeLanes(objs, 1600, 650), [1, 2]);
  // two blockers still leave one lane
  const two = [obj('obstacle', 0, 1600), obj('gate', 1, 1600)];
  assert.deepEqual(freeLanes(two, 1600, 650), [2]);
});

test('totalWeight sums weights', () => {
  assert.equal(totalWeight([{ w: 14 }, { w: 5 }, { w: 8 }]), 27);
});

test('pickWeighted selects by roll and falls back to first', () => {
  const items = [{ w: 2, id: 'a' }, { w: 3, id: 'b' }, { w: 5, id: 'c' }];
  assert.equal(pickWeighted(items, 0).id, 'a');   // 0 → first bucket
  assert.equal(pickWeighted(items, 1.9).id, 'a'); // still in a (0..2)
  assert.equal(pickWeighted(items, 2).id, 'a');   // boundary: 2-2=0 <= 0 → a
  assert.equal(pickWeighted(items, 2.1).id, 'b'); // into b (2..5)
  assert.equal(pickWeighted(items, 6).id, 'c');   // into c (5..10)
  assert.equal(pickWeighted(items, 999).id, 'a'); // overflow → fallback first
});
