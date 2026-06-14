import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCoins, addCoins, canAfford, spend, owns, grant,
} from '../src/engine/economy.js';

test('clampCoins floors and never goes negative', () => {
  assert.equal(clampCoins(10.9), 10);
  assert.equal(clampCoins(-5), 0);
  assert.equal(clampCoins(0), 0);
});

test('addCoins earns and clamps', () => {
  assert.equal(addCoins(100, 50), 150);
  assert.equal(addCoins(100, -30), 70);
  assert.equal(addCoins(20, -100), 0); // cannot go below zero
  assert.equal(addCoins(0, 7.6), 7);   // floored
});

test('canAfford uses >= (exact balance can buy)', () => {
  assert.equal(canAfford(150, 150), true);
  assert.equal(canAfford(149, 150), false);
  assert.equal(canAfford(0, 0), true);
});

test('spend deducts on success, leaves wallet untouched on failure', () => {
  assert.deepEqual(spend(200, 150), { ok: true, wallet: 50 });
  assert.deepEqual(spend(150, 150), { ok: true, wallet: 0 });
  assert.deepEqual(spend(100, 150), { ok: false, wallet: 100 });
});

test('owns / grant manage the owned set immutably', () => {
  assert.equal(owns(['classic'], 'classic'), true);
  assert.equal(owns(['classic'], 'gold'), false);

  const owned = ['classic'];
  const next = grant(owned, 'gold');
  assert.deepEqual(next, ['classic', 'gold']);
  assert.notEqual(next, owned);                  // new array

  assert.equal(grant(owned, 'classic'), owned);  // same ref when already owned
});
