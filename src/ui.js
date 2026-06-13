// ─── DOM UI layer ─────────────────────────────────────────────────────────────
// All game chrome lives here as HTML/CSS on a 400×700 surface scaled to match
// the canvas exactly (see ui.css #ui-root). The canvas keeps the world; the
// DOM gets crisp text, blur, gradients and CSS motion the Graphics API can't
// touch. Scenes call in through small imperative functions; user intent flows
// back through the callbacks they registered.
import {
  W, STORAGE_KEYS, saveString, loadString, loadNumber, loadVolume,
  hapticsEnabled, bestKeys, appVersionLabel,
} from './constants.js';
import { audio, unlockAudio, setAudioMuted, RHYTHM_TRACK_INFO } from './audio.js';
import {
  OUTFITS, getWallet, spendFromWallet, ownedOutfits, ownOutfit,
  equippedOutfit, equipOutfit,
} from './cosmetics.js';

let root = null, menuEl = null, hudEl = null, modalEl = null;
let menuApi = null;
let menuView = 'home';
const hudCache = {};

const css = (c) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const $ = (sel) => root.querySelector(sel);

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
// Emoji render differently on every platform (and as grey boxes on some); a
// dozen tiny vectors keep the chrome identical everywhere. Stroke icons use
// currentColor so CSS can tint them; the coin keeps its own gold.
const S = 'stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  coin: '<circle cx="12" cy="12" r="9.5" fill="#f6c700"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="#a87900" stroke-width="1.6"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#c79a00" stroke-width="1.8"/><path d="M12 8.6v6.8" stroke="#c79a00" stroke-width="1.8" stroke-linecap="round"/>',
  run: `<circle cx="14.2" cy="4.4" r="2.3" fill="currentColor"/><path d="M13.5 8.2l-3.8 3.6 3 3-2.4 5.4M9.7 11.8L6.6 10M13.2 9l3.6 2.6 2.6-.8M12.7 14.8l3.5 2.5" ${S}/>`,
  headphones: `<path d="M4.5 14.5v-2a7.5 7.5 0 0 1 15 0v2" ${S}/><rect x="3" y="13.5" width="4.4" height="7" rx="2" fill="currentColor"/><rect x="16.6" y="13.5" width="4.4" height="7" rx="2" fill="currentColor"/>`,
  trophy: `<path d="M8 4.5h8v4.7a4 4 0 0 1-8 0z" fill="currentColor"/><path d="M8 6H4.7a3.3 3.3 0 0 0 3.4 3.3M16 6h3.3a3.3 3.3 0 0 1-3.4 3.3M12 13.3v3" ${S}/><path d="M7.8 20.5h8.4l-1.1-3.2H8.9z" fill="currentColor"/>`,
  bank: `<path d="M4.2 9.5h15.6L18.4 19a2.2 2.2 0 0 1-2.2 1.9H7.8A2.2 2.2 0 0 1 5.6 19z" fill="currentColor"/><path d="M8.4 9.3a3.6 3.6 0 0 1 7.2 0" ${S}/>`,
  shield: '<path d="M12 2.8l7 2.6v4.8c0 4.6-2.9 8.6-7 10.2-4.1-1.6-7-5.6-7-10.2V5.4z" fill="currentColor"/>',
  magnet: '<path d="M7.2 3.8v7a4.8 4.8 0 0 0 9.6 0v-7" stroke="currentColor" stroke-width="4.2" fill="none"/><path d="M7.2 3.6v3.4M16.8 3.6v3.4" stroke="#ffffff" stroke-opacity=".85" stroke-width="4.2"/>',
  bag: `<path d="M5.8 8.2h12.4l-1 11.2a1.8 1.8 0 0 1-1.8 1.6H8.6a1.8 1.8 0 0 1-1.8-1.6z" fill="currentColor"/><path d="M9 8a3 3 0 0 1 6 0" ${S}/>`,
  book: '<path d="M4 5.2c2.6-1.3 5.2-1.3 7.4.2v13.4C9.2 17.3 6.6 17.3 4 18.6zM20 5.2c-2.6-1.3-5.2-1.3-7.4.2v13.4c2.2-1.5 4.8-1.5 7.4-.2z" fill="currentColor"/>',
  gear: `<circle cx="12" cy="12" r="3.4" ${S}/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1" ${S}/>`,
  note: `<path d="M9.2 18.3V6.2l9.2-2.1v11.8" ${S}/><circle cx="6.6" cy="18.4" r="2.7" fill="currentColor"/><circle cx="15.8" cy="16" r="2.7" fill="currentColor"/>`,
  bell: `<path d="M12 3.4a5.7 5.7 0 0 1 5.7 5.7c0 3.1.9 4.8 1.8 5.9H4.5c.9-1.1 1.8-2.8 1.8-5.9A5.7 5.7 0 0 1 12 3.4z" fill="currentColor"/><path d="M9.8 18.6a2.3 2.3 0 0 0 4.4 0" ${S}/>`,
  speaker: `<path d="M4 9.2v5.6h3.4L13 19V5L7.4 9.2z" fill="currentColor"/><path d="M16 9.4a4.3 4.3 0 0 1 0 5.2M18.6 6.8a8 8 0 0 1 0 10.4" ${S}/>`,
  buzz: `<rect x="8.2" y="3.4" width="7.6" height="17.2" rx="2.2" fill="currentColor"/><path d="M4.6 8.6a7 7 0 0 0 0 6.8M19.4 8.6a7 7 0 0 1 0 6.8" ${S}/>`,
  home: '<path d="M4 11.2L12 4l8 7.2v8.1a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.3z" fill="currentColor"/>',
  pause: '<rect x="6.4" y="4.8" width="3.8" height="14.4" rx="1.5" fill="currentColor"/><rect x="13.8" y="4.8" width="3.8" height="14.4" rx="1.5" fill="currentColor"/>',
  play: '<path d="M8.2 5.2v13.6L19 12z" fill="currentColor"/>',
  redo: `<path d="M18.8 12.2a6.8 6.8 0 1 1-2.2-5" ${S}/><path d="M19 3.6v4h-4" ${S}/>`,
};
const ic = (name, cls = '') => `<span class="ic${cls ? ' ' + cls : ''}"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS[name]}</svg></span>`;

export function initUI(game) {
  if (root) return;
  root = document.createElement('div');
  root.id = 'ui-root';
  root.innerHTML = '<div id="ui-menu"></div><div id="ui-hud"></div><div id="ui-modal"></div>';
  document.body.appendChild(root);
  menuEl = $('#ui-menu');
  hudEl = $('#ui-hud');
  modalEl = $('#ui-modal');

  const sync = () => {
    const c = game.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    root.style.transform = `translate(${r.left}px, ${r.top}px) scale(${r.width / W})`;
  };
  sync();
  window.addEventListener('resize', () => requestAnimationFrame(sync));
  window.addEventListener('orientationchange', () => setTimeout(sync, 80));
  if (window.ResizeObserver && game.canvas) new ResizeObserver(sync).observe(game.canvas);
}

export function setAccent(color) {
  document.documentElement.style.setProperty('--acc', color);
}

const wireActs = (scope, handlers) => {
  scope.querySelectorAll('[data-a]').forEach((b) =>
    b.addEventListener('click', () => {
      unlockAudio();
      // Drop focus so the button doesn't swallow arrow/space keys mid-run.
      b.blur();
      handlers[b.dataset.a]?.();
    }));
};

// ─── Menu ─────────────────────────────────────────────────────────────────────

export function showMenu(api) {
  menuApi = api;
  hideHUD();
  modalEl.innerHTML = '';
  setAccent('#00e5ff');
  menuEl.classList.add('on');
  renderHome();
}

export function hideMenu() {
  menuEl.classList.remove('on');
  menuEl.innerHTML = '';
}

// Space/Enter on the menu: start a run from home, otherwise back out to home.
export function menuPrimary() {
  if (!menuApi) return;
  if (menuView !== 'home') renderHome();
  else menuApi.onStart(false);
}

const aurora = '<div class="menu-aurora"><i></i><i></i><i></i></div>';

const panel = (title, body) => `
  ${aurora}
  <div class="panel">
    <div class="panel-head"><button class="btn-back" data-a="back">‹</button><h2>${title}</h2></div>
    <div class="panel-body">${body}</div>
  </div>`;

function renderHome() {
  menuView = 'home';
  const run = bestKeys(false);
  const ry = bestKeys(true);
  menuEl.innerHTML = `
    ${aurora}
    <div class="menu-wrap">
      <header class="title">
        <span class="title-eyebrow">SOFIA'S</span>
        <h1>ENDLESS<br>RUNNER</h1>
        <span class="title-sub">SWIPE · JUMP · VIBE</span>
      </header>
      <div class="best-row">
        <div class="chip"><span>${ic('run')} BEST</span><b>${fmt(loadNumber(run.score))}</b></div>
        <div class="chip"><span>${ic('headphones')} RHYTHM</span><b>${fmt(loadNumber(ry.score))}</b></div>
        <div class="chip gold"><span>${ic('coin')}</span><b>${fmt(getWallet())}</b></div>
      </div>
      <button class="btn-play" data-a="play">${ic('play')} PLAY</button>
      <div class="menu-grid">
        <button class="btn-tile" data-a="rhythm">${ic('headphones')}Rhythm Run</button>
        <button class="btn-tile" data-a="shop">${ic('bag')}Shop</button>
        <button class="btn-tile" data-a="help">${ic('book')}How to play</button>
        <button class="btn-tile" data-a="settings">${ic('gear')}Settings</button>
      </div>
      <footer class="menu-foot">${appVersionLabel()}</footer>
    </div>`;
  wireActs(menuEl, {
    play: () => menuApi.onStart(false),
    rhythm: renderTracks,
    shop: renderShop,
    help: renderHelp,
    settings: renderSettings,
  });
}

function renderTracks() {
  menuView = 'tracks';
  const rows = Object.entries(RHYTHM_TRACK_INFO).map(([id, info]) => `
    <button class="track-card" data-track="${id}" style="--tc:${css(info.color)}">
      <span class="track-name">${info.label}</span>
      <span class="track-bpm">${info.bpm} BPM</span>
      <span class="track-best">best ${fmt(loadNumber(bestKeys(true, id).score))}</span>
    </button>`).join('');
  menuEl.innerHTML = panel('RHYTHM RUN', `
    <p class="panel-sub">Beat coins arrive on the downbeat — grab them on the pulse for Perfect bonuses.</p>
    <div class="track-list">${rows}</div>`);
  wireActs(menuEl, { back: renderHome });
  menuEl.querySelectorAll('[data-track]').forEach((b) =>
    b.addEventListener('click', () => { unlockAudio(); menuApi.onStart(true, b.dataset.track); }));
}

function renderShop() {
  menuView = 'shop';
  const owned = ownedOutfits();
  const eq = equippedOutfit().id;
  const wallet = getWallet();
  const cards = OUTFITS.map((o) => {
    const p = o.palette;
    const isEq = o.id === eq;
    const isOwned = owned.includes(o.id);
    const state = isEq ? 'wearing' : isOwned ? 'equip' : wallet >= o.price ? 'buy' : 'locked';
    const label = isEq ? 'WEARING' : isOwned ? 'EQUIP' : o.price === 0 ? 'FREE' : `${o.price} ${ic('coin')}`;
    return `
      <div class="fit-card ${isEq ? 'eq' : ''}">
        <div class="fit-fig">
          <i class="hair" style="background:${css(p.hair)}"></i>
          <i class="bow" style="background:${css(p.bow)}"></i>
          <i class="body" style="background:${css(p.body)}"></i>
          <i class="legs" style="background:${css(p.legs)}"></i>
        </div>
        <span class="fit-name">${o.name}</span>
        <button class="fit-btn ${state}" data-fit="${o.id}">${label}</button>
      </div>`;
  }).join('');
  menuEl.innerHTML = panel('OUTFITS', `<div class="shop-wallet">${ic('coin')} ${fmt(wallet)} in the bank</div><div class="fit-grid">${cards}</div>`);
  wireActs(menuEl, { back: renderHome });
  menuEl.querySelectorAll('[data-fit]').forEach((b) =>
    b.addEventListener('click', () => {
      unlockAudio();
      const o = OUTFITS.find((x) => x.id === b.dataset.fit);
      if (o.id === equippedOutfit().id) return;
      if (ownedOutfits().includes(o.id)) {
        equipOutfit(o.id);
        audio.powerUp();
      } else if (spendFromWallet(o.price)) {
        ownOutfit(o.id);
        equipOutfit(o.id);
        audio.powerUp();
      } else {
        audio.shieldBreak();
        b.classList.add('shake');
        setTimeout(() => b.classList.remove('shake'), 380);
        return;
      }
      renderShop();
    }));
}

function renderSettings() {
  menuView = 'settings';
  const mv = loadVolume(STORAGE_KEYS.musicVol);
  const sv = loadVolume(STORAGE_KEYS.sfxVol);
  const muted = loadString(STORAGE_KEYS.muted) === '1';
  menuEl.innerHTML = panel('SETTINGS', `
    <label class="set-row"><span>${ic('note')} Music</span><input type="range" id="set-music" min="0" max="100" step="5" value="${mv}"><b id="set-music-v">${mv}%</b></label>
    <label class="set-row"><span>${ic('bell')} SFX</span><input type="range" id="set-sfx" min="0" max="100" step="5" value="${sv}"><b id="set-sfx-v">${sv}%</b></label>
    <div class="set-row"><span>${ic('speaker')} Sound</span><button class="switch ${muted ? '' : 'on'}" id="set-mute"></button></div>
    <div class="set-row"><span>${ic('buzz')} Haptics</span><button class="switch ${hapticsEnabled() ? 'on' : ''}" id="set-haptics"></button></div>`);
  wireActs(menuEl, { back: renderHome });

  const music = $('#set-music');
  music.addEventListener('input', () => {
    saveString(STORAGE_KEYS.musicVol, music.value);
    audio.setMusicVolume(music.value / 100);
    $('#set-music-v').textContent = `${music.value}%`;
  });
  const sfx = $('#set-sfx');
  sfx.addEventListener('input', () => {
    saveString(STORAGE_KEYS.sfxVol, sfx.value);
    audio.setSfxVolume(sfx.value / 100);
    $('#set-sfx-v').textContent = `${sfx.value}%`;
  });
  sfx.addEventListener('change', () => { unlockAudio(); audio.coin(); });
  $('#set-mute').addEventListener('click', () => {
    unlockAudio();
    const nowMuted = loadString(STORAGE_KEYS.muted) !== '1';
    saveString(STORAGE_KEYS.muted, nowMuted ? '1' : '0');
    setAudioMuted(nowMuted);
    if (!nowMuted) audio.playMenu();
    $('#set-mute').classList.toggle('on', !nowMuted);
  });
  $('#set-haptics').addEventListener('click', () => {
    const next = !hapticsEnabled();
    saveString(STORAGE_KEYS.haptics, next ? '1' : '0');
    $('#set-haptics').classList.toggle('on', next);
    if (next && navigator.vibrate) navigator.vibrate(30);
  });
}

function renderHelp() {
  menuView = 'help';
  menuEl.innerHTML = panel('HOW TO PLAY', `
    <div class="help-block"><h3>TOUCH</h3>
      <p>Swipe left / right to switch lanes. Swipe up to jump — again mid-air for a flip. Swipe down to slide (hold to keep sliding) or fast-drop from the air.</p></div>
    <div class="help-block"><h3>KEYBOARD</h3>
      <p><span class="key">←</span> <span class="key">→</span> lanes · <span class="key">↑</span>/<span class="key">Space</span> jump · <span class="key">↓</span> slide · <span class="key">P</span>/<span class="key">Esc</span> pause</p></div>
    <div class="help-block"><h3>SURVIVE</h3>
      <p>Jump crates, slide under red gates, land on train roofs to hoover their coins. Blue shields block one crash — but the shadow beast will chase you until you rebuild your combo.</p></div>
    <div class="help-block"><h3>RHYTHM RUN</h3>
      <p>Glowing coins land exactly on the downbeat. Collect them inside the pulse ring for Perfect and Good bonuses, and keep the combo hot to unlock extra music layers.</p></div>`);
  wireActs(menuEl, { back: renderHome });
  saveString(STORAGE_KEYS.seenHelp, '1');
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

export function showHUD({ rhythm = false, bpm = 0, onPause }) {
  hideMenu();
  modalEl.innerHTML = '';
  Object.keys(hudCache).forEach((k) => delete hudCache[k]);
  hudEl.classList.add('on');
  hudEl.innerHTML = `
    <div class="hud-scrim"></div>
    <div class="hud-top">
      <div class="hud-score"><label>SCORE</label><span id="h-score">0</span></div>
      <div class="hud-side">
        <div class="hud-coins">${ic('coin')} <b id="h-coins">0</b></div>
        <button id="h-pause" aria-label="Pause">${ic('pause')}</button>
      </div>
    </div>
    <div class="hud-sub">
      <div class="hud-combo"><b id="h-combo">x1.0</b><div class="combo-track"><i id="h-combo-fill"></i></div></div>
      <div class="hud-mode" id="h-mode">${rhythm ? `${bpm} BPM` : 'LEVEL 1'}</div>
    </div>
    <div class="hud-pows">
      <div class="pow off" id="h-magnet"><i id="h-magnet-ring"></i>${ic('magnet', 'i-mag')}</div>
      <div class="pow off" id="h-shield">${ic('shield', 'i-shield')}</div>
    </div>
    <div class="hud-world" id="h-world"></div>`;
  $('#h-pause').addEventListener('click', (e) => { unlockAudio(); e.currentTarget.blur(); onPause(); });
}

export function hideHUD() {
  if (!hudEl) return;
  hudEl.classList.remove('on');
  hudEl.innerHTML = '';
}

const setText = (id, v) => {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  const n = hudEl.querySelector(`#${id}`);
  if (n) n.textContent = v;
};

export const setScore = (s) => setText('h-score', fmt(s));
export const setCoins = (c) => setText('h-coins', fmt(c));
export const setMode = (t) => setText('h-mode', t);

export function setCombo(c) {
  setText('h-combo', `x${c.toFixed(1)}`);
  const f = Math.round(Math.max(0, Math.min(1, (c - 1) / 4)) * 100);
  if (hudCache.comboF === f) return;
  hudCache.comboF = f;
  const fill = hudEl.querySelector('#h-combo-fill');
  if (fill) fill.style.width = `${f}%`;
  hudEl.querySelector('.hud-combo')?.classList.toggle('hot', c >= 3);
}

export function setMagnet(frac) {
  const node = hudEl.querySelector('#h-magnet');
  if (!node) return;
  node.classList.toggle('off', frac <= 0);
  if (frac > 0) {
    const ring = hudEl.querySelector('#h-magnet-ring');
    ring.style.background = `conic-gradient(var(--acc) ${Math.round(frac * 360)}deg, rgba(255,255,255,.08) 0)`;
  }
}

export function setShield(on) {
  hudEl.querySelector('#h-shield')?.classList.toggle('off', !on);
}

export function setWorld(w) {
  setAccent(w.accentStr);
  const n = hudEl.querySelector('#h-world');
  if (n) n.innerHTML = `<i></i>WORLD ${w.no} · ${w.name}`;
}

// ─── Transient overlays ───────────────────────────────────────────────────────

export function countdown(text) {
  const d = document.createElement('div');
  d.className = 'ui-count';
  d.textContent = text;
  modalEl.appendChild(d);
  setTimeout(() => d.remove(), 900);
}

export function worldBanner(w) {
  const d = document.createElement('div');
  d.className = 'ui-banner';
  d.style.setProperty('--acc-b', w.accentStr);
  d.innerHTML = `<span>WORLD ${w.no}</span><b>${w.name}</b>`;
  modalEl.appendChild(d);
  setTimeout(() => d.remove(), 2150);
}

export function showPause({ onResume, onRestart, onMenu }) {
  modalEl.innerHTML = `
    <div class="dim"></div>
    <div class="modal-card">
      <h2>PAUSED</h2>
      <button class="btn-play sm" data-a="resume">${ic('play')} RESUME</button>
      <button class="btn-ghost" data-a="restart">${ic('redo')} RESTART</button>
      <button class="btn-ghost" data-a="menu">${ic('home')} MAIN MENU</button>
    </div>`;
  wireActs(modalEl, { resume: onResume, restart: onRestart, menu: onMenu });
}

export function hidePause() {
  modalEl.innerHTML = '';
}

export function showGameOver(o) {
  const rhythm = o.rhythm
    ? `<div class="go-grade">PERFECT ${o.rhythm.perfect} · GOOD ${o.rhythm.good} · MISS ${o.rhythm.miss}<b class="grade">${o.rhythm.grade}</b></div>`
    : '';
  modalEl.innerHTML = `
    <div class="dim soft"></div>
    ${o.newBest ? '<div class="confetti"></div>' : ''}
    <div class="sheet">
      <h2 class="${o.newBest ? 'nb' : ''}">${o.newBest ? 'NEW BEST!' : 'RUN OVER'}</h2>
      <p class="go-reason">${o.reason}</p>
      <div class="go-score">${fmt(o.score)}</div>
      <div class="go-row">
        <div class="chip"><span>${ic('coin')} RUN</span><b>${fmt(o.coins)}</b></div>
        <div class="chip"><span>${ic('trophy')} BEST</span><b>${fmt(o.bestScore)}</b></div>
        <div class="chip gold"><span>${ic('bank')} BANK</span><b>${fmt(o.wallet)}</b></div>
      </div>
      ${rhythm}
      <button class="btn-play" data-a="again">${ic('play')} RUN AGAIN</button>
      <button class="btn-ghost" data-a="menu">${ic('home')} MAIN MENU</button>
    </div>`;
  wireActs(modalEl, { again: o.onRestart, menu: o.onMenu });
  if (o.newBest) {
    const holder = modalEl.querySelector('.confetti');
    const colors = ['#ffd700', '#00e5ff', '#ff4081', '#76ff03', '#fff176'];
    for (let i = 0; i < 38; i++) {
      const c = document.createElement('i');
      c.style.setProperty('--cx', `${Math.random() * 100}%`);
      c.style.setProperty('--cc', colors[i % colors.length]);
      c.style.setProperty('--cd', `${1.4 + Math.random() * 1.3}s`);
      c.style.setProperty('--cw', `${Math.random() * 0.7}s`);
      holder.appendChild(c);
    }
    setTimeout(() => holder.remove(), 3400);
  }
}

export function hideGameOver() {
  modalEl.innerHTML = '';
}
