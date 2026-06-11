// ─── Screen ───────────────────────────────────────────────────────────────────
export const W = 400, H = 700;
// Render the framebuffer at device resolution (capped at 2x); the camera zooms
// so all logic keeps using the 400×700 logical space — sharp on retina.
export const DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

// ─── MVP tuning ───────────────────────────────────────────────────────────────
export const JUMP_INIT = 465;
export const GRAVITY   = 900;
export const WAGON_TOP = 72;
export const WAGON_LENGTH = 330;
export const WAGON_LANDING_GRACE = 50;
export const WAGON_RIDE_MIN_MS = 1150;
export const WAGON_RIDE_MAX_MS = 2200;
export const BASE_SPEED = 480;   // world units / s
export const MAX_SPEED = 1080;
export const TOUCH_THRESHOLD = 22;
export const SCORE_PER_SECOND = 15;
export const COIN_SCORE = 20;
export const SHIELD_SCORE = 50;
export const MAGNET_SCORE = 40;
export const SLIDE_DURATION = 620;
export const MAGNET_DURATION = 7600;
export const DOUBLE_JUMP_INIT = 370;
export const SAFE_START_MS = 1300;
export const RHYTHM_BPM = 128;
export const RHYTHM_BEAT_MS = 60000 / RHYTHM_BPM;
export const RHYTHM_APPROACH_BEATS = 6;
export const RHYTHM_APPROACH_MS = RHYTHM_BEAT_MS * RHYTHM_APPROACH_BEATS;
export const RHYTHM_BEAT_WINDOW_MS = 160;
export const RHYTHM_LANES = [1, 1, 2, 1, 0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0, 1];
export const TURN_MAX_OFFSET = 34;
export const TURN_NEAR_FACTOR = 0.05;
export const TURN_CHANGE_MIN_MS = 2400;
export const TURN_CHANGE_MAX_MS = 4300;
export const LANE_SIDE = [-1, 0, 1];
export const STORAGE_KEYS = {
  bestScore: 'ser_best_score_v1',
  bestCoins: 'ser_best_coins_v1',
  bestScoreRhythm: 'ser_best_score_rhythm_v1',
  bestCoinsRhythm: 'ser_best_coins_rhythm_v1',
  muted: 'ser_muted_v1',
  seenHelp: 'ser_seen_help_v1',
  musicVol: 'ser_music_vol_v1',
  sfxVol: 'ser_sfx_vol_v1',
  haptics: 'ser_haptics_v1',
  totalCoins: 'ser_total_coins_v1',
  outfitsOwned: 'ser_outfits_owned_v1',
  outfitEquipped: 'ser_outfit_equipped_v1',
};

// ─── Persistent storage (guarded: private browsing may block localStorage) ────
const storage = (() => {
  try {
    const probe = '__ser_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const mem = new Map();
    return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  }
})();

export const saveNumber = (key, value) => storage.setItem(key, String(Math.max(0, Math.floor(value))));
export const loadNumber = (key) => Number(storage.getItem(key) || 0);
export const saveString = (key, value) => storage.setItem(key, value);
export const loadString = (key) => storage.getItem(key);

// Rhythm bests are tracked per track; 'classic' keeps the original keys.
export const bestKeys = (rhythm, track = 'classic') => rhythm
  ? {
      score: STORAGE_KEYS.bestScoreRhythm + (track === 'classic' ? '' : `_${track}`),
      coins: STORAGE_KEYS.bestCoinsRhythm + (track === 'classic' ? '' : `_${track}`),
    }
  : { score: STORAGE_KEYS.bestScore, coins: STORAGE_KEYS.bestCoins };
export const bestSummary = (rhythm = false) => {
  const k = bestKeys(rhythm);
  return `Best: ${loadNumber(k.score)} · Coins: ${loadNumber(k.coins)}`;
};
// 0–100 stored percentage with a default of 100
export const loadVolume = (key) => {
  const raw = loadString(key);
  return raw === null ? 100 : Math.max(0, Math.min(100, Number(raw) || 0));
};

export const hapticsEnabled = () => loadString(STORAGE_KEYS.haptics) !== '0';
export const vibrate = (ms) => {
  if (hapticsEnabled() && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
};

export const appVersionLabel = () => {
  const version = window.APP_VERSION || {};
  return `Version: ${version.label || version.commit || 'local-dev'}`;
};
