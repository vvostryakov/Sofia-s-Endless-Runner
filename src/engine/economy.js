// ─── Economy rules (pure) ───────────────────────────────────────────────────
// Pure wallet + ownership rules — no storage, no Phaser, no globals. Persistence
// stays in cosmetics.js; this module only computes the *result* of economic
// actions, which makes it Node-importable and unit-tested (docs/TDD.md §4, D4/D5).
//
// Single soft currency today, but "wallet-as-number" is the only assumption a
// premium currency would need to revisit (docs/GDD.md §9.1) — kept deliberately
// small so that change is cheap.

/** @typedef {{ ok: boolean, wallet: number }} SpendResult */

/**
 * Coins are always a non-negative integer (mirrors the storage clamp).
 * @param {number} n @returns {number}
 */
export const clampCoins = (n) => Math.max(0, Math.floor(n));

/**
 * Wallet after earning (or losing) `coins`, clamped to a valid balance.
 * @param {number} wallet @param {number} coins @returns {number}
 */
export const addCoins = (wallet, coins) => clampCoins(wallet + coins);

/**
 * Whether `wallet` can cover `price`.
 * @param {number} wallet @param {number} price @returns {boolean}
 */
export const canAfford = (wallet, price) => wallet >= price;

/**
 * Result of spending `price`. On success the new balance is returned; on
 * insufficient funds the wallet is left unchanged and `ok` is false.
 * @param {number} wallet @param {number} price @returns {SpendResult}
 */
export const spend = (wallet, price) =>
  canAfford(wallet, price)
    ? { ok: true, wallet: clampCoins(wallet - price) }
    : { ok: false, wallet };

/**
 * Whether `id` is in the owned list.
 * @param {readonly string[]} owned @param {string} id @returns {boolean}
 */
export const owns = (owned, id) => owned.includes(id);

/**
 * Owned list with `id` granted. Returns the SAME array reference if already
 * owned (lets callers skip a write), a new array otherwise.
 * @param {string[]} owned @param {string} id @returns {string[]}
 */
export const grant = (owned, id) => (owned.includes(id) ? owned : [...owned, id]);
