'use strict';

// ─── Screen ───────────────────────────────────────────────────────────────────
const W = 400, H = 700;

// ─── Perspective ──────────────────────────────────────────────────────────────
const VP_X          = 200;
const HORIZON_Y     = 252;
const NEAR_Y        = 635;
const TRACK_FAR_HW  = 120;
const TRACK_NEAR_HW = 185;

const LANE_FAR_X  = [-1, 0, 1].map(s => Math.round(VP_X + s * TRACK_FAR_HW  * 0.667));
const LANE_NEAR_X = [-1, 0, 1].map(s => Math.round(VP_X + s * TRACK_NEAR_HW * 0.667));
const LANE_NX     = LANE_NEAR_X;

const pT  = y      => Math.max(0, (y - HORIZON_Y) / (NEAR_Y - HORIZON_Y));
const pSc = y      => 0.12 + pT(y) * 0.88;
const lX  = (l, y) => LANE_FAR_X[l] + pT(y) * (LANE_NEAR_X[l] - LANE_FAR_X[l]);
const eY  = (y, h) => y - h * pSc(y);

// ─── MVP tuning ───────────────────────────────────────────────────────────────
const JUMP_INIT = 465;
const GRAVITY   = 900;
const WAGON_TOP = 72;
const BASE_SPEED = 195;
const MAX_SPEED = 560;
const TOUCH_THRESHOLD = 22;
const SCORE_PER_SECOND = 15;
const COIN_SCORE = 20;
const SAFE_START_MS = 1300;
const STORAGE_KEYS = {
  bestScore: 'ser_best_score_v1',
  bestCoins: 'ser_best_coins_v1',
  muted: 'ser_muted_v1',
  seenHelp: 'ser_seen_help_v1',
};

const saveNumber = (key, value) => localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
const loadNumber = (key) => Number(localStorage.getItem(key) || 0);
const setAudioMuted = (muted) => {
  if (window.audio && typeof audio.setMuted === 'function') audio.setMuted(muted);
};
const bestSummary = () => `Best: ${loadNumber(STORAGE_KEYS.bestScore)} · Coins: ${loadNumber(STORAGE_KEYS.bestCoins)}`;

// ─── Boot / menu scene ────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.muted = localStorage.getItem(STORAGE_KEYS.muted) === '1';
    setAudioMuted(this.muted);
    this._buildBackground();
    this._showMenu();

    const startMusic = () => audio.playMenu();
    this.input.once('pointerdown', startMusic);
    this.input.keyboard.once('keydown', startMusic);
    this.input.keyboard.on('keydown-SPACE', () => this._activatePrimary());
    this.input.keyboard.on('keydown-ENTER', () => this._activatePrimary());
  }

  _buildBackground() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x070d1a, 0x070d1a, 0x132038, 0x132038, 1);
    sky.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, 320),
        Math.random() < 0.25 ? 2 : 1, 0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.9));
    }
    this.add.circle(315, 55, 28, 0xfff9c4).setAlpha(0.9);
    this.add.circle(304, 47, 22, 0x132038).setAlpha(0.5);
  }

  _clearPanel() {
    if (this.panel) this.panel.destroy(true);
    this.panel = this.add.container(0, 0).setDepth(10);
  }

  _button(x, y, w, h, label, onPress, color = 0xff6b6b) {
    const r = this.add.rectangle(x, y, w, h, color).setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, label, {
      fontSize: h > 48 ? '24px' : '18px',
      fontFamily: 'Arial Black, Arial',
      fill: '#fff',
    }).setOrigin(0.5);
    r.on('pointerdown', onPress);
    this.panel.add([r, t]);
    return r;
  }

  _showMenu() {
    this.mode = 'menu';
    this._clearPanel();
    const cx = W / 2, cy = H / 2;

    this.panel.add(this.add.text(cx, cy - 178, "Sofia's", {
      fontSize: '52px', fontFamily: 'Arial Black, Arial',
      fill: '#ffd700', stroke: '#b8860b', strokeThickness: 6,
    }).setOrigin(0.5));
    this.panel.add(this.add.text(cx, cy - 112, 'Endless Runner', {
      fontSize: '28px', fontFamily: 'Arial', fill: '#fff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5));
    this.panel.add(this.add.text(cx, cy - 58, bestSummary(), {
      fontSize: '18px', fontFamily: 'Arial', fill: '#b7e4ff',
    }).setOrigin(0.5));
    this.panel.add(this.add.text(cx, cy - 12, 'Three lanes. Dodge obstacles. Jump onto wagons for coins.', {
      fontSize: '15px', fontFamily: 'Arial', fill: '#d4e3ff', align: 'center', wordWrap: { width: 330 },
    }).setOrigin(0.5));

    this._button(cx, cy + 62, 220, 56, 'PLAY', () => this._startRun());
    this._button(cx, cy + 128, 220, 44, 'HOW TO PLAY', () => this._showHowTo(), 0x3949ab);
    this._button(cx, cy + 184, 220, 38, this.muted ? 'SOUND: OFF' : 'SOUND: ON', () => this._toggleSound(), 0x455a64);

  }

  _showHowTo() {
    this.mode = 'help';
    this._clearPanel();
    const cx = W / 2;
    this.panel.add(this.add.rectangle(cx, H / 2, 350, 420, 0x000000, 0.78));
    this.panel.add(this.add.text(cx, 164, 'HOW TO PLAY', {
      fontSize: '30px', fontFamily: 'Arial Black, Arial', fill: '#ffd700',
    }).setOrigin(0.5));
    this.panel.add(this.add.text(cx, 270,
      'Keyboard\n' +
      '← / A and → / D: switch lanes\n' +
      '↑ / W / Space: jump\n' +
      'P or Esc: pause\n\n' +
      'Touch\n' +
      'Swipe left/right to switch lanes.\n' +
      'Swipe up to jump. Tap the pause button when you need a break.\n\n' +
      'Goal\n' +
      'Survive as long as possible. Obstacles end the run unless you clear them. Wagons are safe only if you land on top.', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#ffffff', align: 'center',
      lineSpacing: 8, wordWrap: { width: 310 },
    }).setOrigin(0.5));
    this._button(cx, 510, 180, 48, 'GOT IT', () => {
      localStorage.setItem(STORAGE_KEYS.seenHelp, '1');
      this._showMenu();
    }, 0xff6b6b);
  }

  _activatePrimary() {
    if (this.mode === 'help') {
      localStorage.setItem(STORAGE_KEYS.seenHelp, '1');
      this._showMenu();
      return;
    }
    if (this.mode === 'menu') this._startRun();
  }

  _toggleSound() {
    this.muted = !this.muted;
    localStorage.setItem(STORAGE_KEYS.muted, this.muted ? '1' : '0');
    setAudioMuted(this.muted);
    if (!this.muted) audio.playMenu();
    this._showMenu();
  }

  _startRun() {
    if (localStorage.getItem(STORAGE_KEYS.seenHelp) !== '1') {
      localStorage.setItem(STORAGE_KEYS.seenHelp, '1');
    }
    audio.stop();
    this.scene.start('Game');
  }
}

// ─── Game scene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this.coinCount = 0;
    this.alive = true;
    this.pausedRun = false;
    this.runTime = 0;
    this.spawnCursor = 0;
    this.combo = 1;

    this.pLane = 1;
    this.pX = LANE_NX[1];
    this.jumpH = 0;
    this.jumpVel = 0;
    this.rideTimer = 0;

    this.gameObjs = [];
    this.markOffset = 0;
    this.marks = [];
    this.scenery = [];

    this._buildBg();
    this._buildTrack();
    this._buildTrackMarks();
    this._buildSideScenery();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();
    this._scheduleNextSpawn(900);

    audio.playGame();
    this._showCountdown();
  }

  // ── Static background ───────────────────────────────────────────────────────
  _buildBg() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x060c18, 0x060c18, 0x111d30, 0x111d30, 1);
    sky.fillRect(0, 0, W, H);

    for (let i = 0; i < 65; i++) {
      this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, HORIZON_Y + 60),
        Math.random() < 0.22 ? 2 : 1, 0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.1, 0.9));
    }

    this.add.circle(310, 52, 27, 0xfff9c4).setAlpha(0.88);
    this.add.circle(300, 45, 21, 0x111d30).setAlpha(0.5);

    const city = this.add.graphics().setDepth(1);
    city.fillStyle(0x0b1726, 1);
    [[0,88,38],[42,122,34],[80,72,42],[124,110,32],[160,90,26],[190,120,48],[242,70,38],
     [286,96,34],[324,82,38],[366,102,32]].forEach(([x, bh, bw]) => {
      city.fillRect(x, HORIZON_Y + 28 - bh, bw, bh);
      for (let wy = HORIZON_Y + 32 - bh; wy < HORIZON_Y + 22; wy += 14) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 10) {
          if (Math.random() > 0.52) city.fillStyle(0xffe082, 1).fillRect(wx, wy, 4, 6);
        }
      }
    });
    city.setAlpha(0.78);

    this.add.rectangle(W / 2, (HORIZON_Y + NEAR_Y) / 2 + 20, W, NEAR_Y - HORIZON_Y + 40, 0x130e08)
      .setDepth(1);
  }

  _buildTrack() {
    const g = this.add.graphics().setDepth(2);
    const lx = VP_X - TRACK_FAR_HW,  rx = VP_X + TRACK_FAR_HW;
    const ln = VP_X - TRACK_NEAR_HW, rn = VP_X + TRACK_NEAR_HW;

    const hg = this.add.graphics().setDepth(1);
    hg.fillGradientStyle(0x1a3a5c, 0x1a3a5c, 0x0d1f36, 0x0d1f36, 1);
    hg.fillRect(0, HORIZON_Y - 18, W, 36);

    g.fillStyle(0x252b3a, 1);
    g.fillPoints([{ x: lx, y: HORIZON_Y }, { x: rx, y: HORIZON_Y }, { x: rn, y: NEAR_Y }, { x: ln, y: NEAR_Y }], true);
    g.lineStyle(3, 0x607d8b, 0.85);
    g.beginPath(); g.moveTo(lx, HORIZON_Y); g.lineTo(ln, NEAR_Y); g.strokePath();
    g.beginPath(); g.moveTo(rx, HORIZON_Y); g.lineTo(rn, NEAR_Y); g.strokePath();
    g.lineStyle(2, 0x90a4ae, 0.9);
    g.beginPath(); g.moveTo(lx, HORIZON_Y); g.lineTo(rx, HORIZON_Y); g.strokePath();

    const dfl = VP_X - TRACK_FAR_HW * 0.315, dfr = VP_X + TRACK_FAR_HW * 0.315;
    const dnl = VP_X - TRACK_NEAR_HW * 0.315, dnr = VP_X + TRACK_NEAR_HW * 0.315;
    g.lineStyle(2, 0x455a64, 0.55);
    g.beginPath(); g.moveTo(dfl, HORIZON_Y); g.lineTo(dnl, NEAR_Y); g.strokePath();
    g.beginPath(); g.moveTo(dfr, HORIZON_Y); g.lineTo(dnr, NEAR_Y); g.strokePath();
    g.lineStyle(3, 0x607d8b, 0.75);
    g.beginPath(); g.moveTo(ln, NEAR_Y); g.lineTo(rn, NEAR_Y); g.strokePath();
  }

  _buildTrackMarks() {
    for (let i = 0; i < 9; i++) this.marks.push({ baseT: (i + 0.5) / 9, gfx: this.add.graphics().setDepth(3) });
  }

  _updateTrackMarks(dt) {
    this.markOffset = (this.markOffset + this.speed * dt / (NEAR_Y - HORIZON_Y)) % 1;
    for (const m of this.marks) {
      const t = (m.baseT + this.markOffset) % 1;
      const y = HORIZON_Y + t * (NEAR_Y - HORIZON_Y);
      const hw = TRACK_FAR_HW + t * (TRACK_NEAR_HW - TRACK_FAR_HW);
      const lh = Math.max(1, t * 2.5);
      m.gfx.clear();
      m.gfx.fillStyle(0x546e7a, t * 0.22);
      m.gfx.fillRect(VP_X - hw, y - lh, hw * 2, lh);
    }
  }

  _buildSideScenery() {
    for (let i = 0; i < 6; i++) {
      const baseT = (i + 0.5) / 6;
      const worldY = HORIZON_Y + baseT * (NEAR_Y - HORIZON_Y);
      const sc = pSc(worldY);
      const mkPost = (side) => {
        const trackHW = TRACK_FAR_HW + pT(worldY) * (TRACK_NEAR_HW - TRACK_FAR_HW);
        const sx = VP_X + side * (trackHW + 22 * sc);
        const postH = Math.round(65 * sc);
        const post = this.add.rectangle(sx, worldY - postH / 2, Math.round(5 * sc), postH, 0x607d8b).setDepth(3);
        const bulb = this.add.circle(sx, worldY - postH - Math.round(6 * sc), Math.round(7 * sc), 0xffee58).setAlpha(0.6).setDepth(3);
        return { post, bulb, baseT, side };
      };
      this.scenery.push(mkPost(-1));
      this.scenery.push(mkPost(1));
    }
  }

  _updateSideScenery(dt) {
    for (const s of this.scenery) {
      s.baseT = (s.baseT + this.speed * dt / (NEAR_Y - HORIZON_Y)) % 1;
      const t = s.baseT;
      const worldY = HORIZON_Y + t * (NEAR_Y - HORIZON_Y);
      const sc = pSc(worldY);
      const trackHW = TRACK_FAR_HW + t * (TRACK_NEAR_HW - TRACK_FAR_HW);
      const sx = VP_X + s.side * (trackHW + 22 * sc);
      const postH = Math.round(65 * sc);
      s.post.setPosition(sx, worldY - postH / 2).setSize(Math.max(1, Math.round(5 * sc)), Math.max(1, postH)).setDepth(2 + t * 2);
      s.bulb.setPosition(sx, worldY - postH - Math.round(6 * sc)).setRadius(Math.max(1, Math.round(7 * sc))).setAlpha(t * 0.6).setDepth(2 + t * 2);
    }
  }

  _buildPlayer() {
    const d = 10;
    this.shadow = this.add.ellipse(LANE_NX[1], NEAR_Y + 4, 48, 16, 0x000000).setAlpha(0.5).setDepth(d - 1);
    this.vis = {
      legL: this.add.rectangle(0, 0, 13, 22, 0x1565c0).setDepth(d),
      legR: this.add.rectangle(0, 0, 13, 22, 0x1565c0).setDepth(d),
      body: this.add.rectangle(0, 0, 32, 34, 0xe91e8c).setDepth(d),
      armL: this.add.rectangle(0, 0, 11, 24, 0xffb3ba).setDepth(d),
      armR: this.add.rectangle(0, 0, 11, 24, 0xffb3ba).setDepth(d),
      head: this.add.circle(0, 0, 15, 0xffcc99).setDepth(d),
      hair: this.add.rectangle(0, 0, 33, 10, 0x5d4037).setDepth(d),
      eyeL: this.add.circle(0, 0, 3, 0x1a1a2e).setDepth(d),
      eyeR: this.add.circle(0, 0, 3, 0x1a1a2e).setDepth(d),
    };
  }

  _syncPlayer(t) {
    const x = this.pX;
    const sy = NEAR_Y - this.jumpH;
    const grounded = this.jumpH < 2;
    const swing = grounded ? Math.sin(t / 88) : 0;
    const tilt = grounded ? 0 : Phaser.Math.Clamp(-this.jumpVel / 3000, -0.18, 0.18);
    const sFrac = Math.max(0.35, 1 - this.jumpH / 130);
    this.shadow.setPosition(x, NEAR_Y + 4).setScale(sFrac, sFrac * 0.45).setAlpha(sFrac * 0.5);
    this.vis.legL.setPosition(x - 9, sy + 31).setScale(1, 1 + swing * 0.45);
    this.vis.legR.setPosition(x + 9, sy + 31).setScale(1, 1 - swing * 0.45);
    this.vis.body.setPosition(x, sy + 6).setRotation(tilt);
    this.vis.armL.setPosition(x - 24, sy + 4).setRotation(swing * 0.5);
    this.vis.armR.setPosition(x + 24, sy + 4).setRotation(-swing * 0.5);
    this.vis.head.setPosition(x, sy - 22).setRotation(tilt);
    this.vis.hair.setPosition(x, sy - 32).setRotation(tilt);
    this.vis.eyeL.setPosition(x - 6, sy - 26);
    this.vis.eyeR.setPosition(x + 6, sy - 26);
  }

  _buildUI() {
    this.add.rectangle(W / 2, 28, W, 56, 0x000000, 0.58).setDepth(20);
    this.scoreTxt = this.add.text(W / 2, 20, 'Score: 0', { fontSize: '18px', fontFamily: 'Arial', fill: '#fff' }).setOrigin(0.5).setDepth(21);
    this.goalTxt = this.add.text(W / 2, 44, 'Survive · collect wagon coins', { fontSize: '12px', fontFamily: 'Arial', fill: '#9ecbff' }).setOrigin(0.5).setDepth(21);
    this.add.circle(24, 28, 11, 0xffd700).setDepth(20);
    this.coinTxt = this.add.text(42, 28, '0', { fontSize: '20px', fontFamily: 'Arial', fill: '#ffd700' }).setOrigin(0, 0.5).setDepth(21);
    this.pauseBtn = this.add.rectangle(W - 30, 28, 42, 34, 0x263238, 0.95).setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(W - 30, 28, 'II', { fontSize: '18px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5).setDepth(22);
    this.pauseBtn.on('pointerdown', () => this._togglePause());
  }

  _buildControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.on('pointerdown', p => { this._touch = { x: p.x, y: p.y, t: this.time.now }; });
    this.input.on('pointerup', p => {
      if (!this._touch || this.pausedRun || !this.alive) return;
      const dx = p.x - this._touch.x;
      const dy = p.y - this._touch.y;
      if (Math.abs(dy) > Math.abs(dx) && dy < -TOUCH_THRESHOLD) this._jump();
      else if (Math.abs(dx) > TOUCH_THRESHOLD) this._switchLane(dx > 0 ? 1 : -1);
      this._touch = null;
    });
  }

  _jump() {
    if (!this.alive || this.pausedRun) return;
    if (this.jumpH < 2 || this.rideTimer > 0) {
      this.rideTimer = 0;
      this.jumpVel = JUMP_INIT;
      this.combo = 1;
      audio.jump();
    }
  }

  _switchLane(dir) {
    if (!this.alive || this.pausedRun) return;
    const next = Phaser.Math.Clamp(this.pLane + dir, 0, 2);
    if (next === this.pLane) return;
    this.pLane = next;
    audio.switchLane();
  }

  _togglePause() {
    if (!this.alive) return;
    this.pausedRun = !this.pausedRun;
    if (this.pausedRun) {
      audio.stop();
      this._showPauseOverlay();
    } else {
      audio.playGame();
      this._hidePauseOverlay();
      this._showCountdown('GO');
    }
  }

  _showPauseOverlay() {
    this.pauseOverlay = this.add.container(0, 0).setDepth(40);
    this.pauseOverlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.62));
    this.pauseOverlay.add(this.add.text(W / 2, H / 2 - 78, 'PAUSED', {
      fontSize: '40px', fontFamily: 'Arial Black, Arial', fill: '#ffffff',
    }).setOrigin(0.5));
    const resume = this.add.rectangle(W / 2, H / 2 + 5, 210, 54, 0xff6b6b).setInteractive({ useHandCursor: true });
    const menu = this.add.rectangle(W / 2, H / 2 + 76, 210, 44, 0x455a64).setInteractive({ useHandCursor: true });
    this.pauseOverlay.add([resume, menu]);
    this.pauseOverlay.add(this.add.text(W / 2, H / 2 + 5, 'RESUME', { fontSize: '22px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5));
    this.pauseOverlay.add(this.add.text(W / 2, H / 2 + 76, 'MAIN MENU', { fontSize: '18px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5));
    resume.on('pointerdown', () => this._togglePause());
    menu.on('pointerdown', () => { audio.stop(); this.scene.start('Boot'); });
  }

  _hidePauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = null;
    }
  }

  _showCountdown(text = 'READY') {
    const msg = this.add.text(W / 2, H / 2 - 70, text, {
      fontSize: '34px', fontFamily: 'Arial Black, Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(35);
    this.tweens.add({ targets: msg, y: msg.y - 28, alpha: 0, duration: 850, ease: 'Power2', onComplete: () => msg.destroy() });
  }

  // ── Spawn helpers ───────────────────────────────────────────────────────────
  _difficulty() {
    return Phaser.Math.Clamp(this.runTime / 90000, 0, 1);
  }

  _scheduleNextSpawn(extra = 0) {
    const difficulty = this._difficulty();
    const minGap = Phaser.Math.Linear(1480, 860, difficulty);
    const maxGap = Phaser.Math.Linear(2400, 1450, difficulty);
    this.spawnCursor = this.runTime + Phaser.Math.Between(Math.round(minGap), Math.round(maxGap)) + extra;
  }

  _spawnPattern() {
    const difficulty = this._difficulty();
    if (this.runTime < SAFE_START_MS) return;

    const roll = Math.random();
    if (roll < 0.18 + difficulty * 0.13) this._spawnWagon(this.time.now);
    else this._spawnObstacle(this.time.now, difficulty);
    this._scheduleNextSpawn();
  }

  _spawnObstacle(time, difficulty = this._difficulty()) {
    const blockedCount = Math.random() < 0.38 + difficulty * 0.22 ? 2 : 1;
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, blockedCount);
    for (const lane of lanes) {
      const h = Phaser.Math.Between(42, 68);
      const w = Phaser.Math.Between(30, 48);
      const color = Phaser.Utils.Array.GetRandom([0xd32f2f, 0xe65100, 0x5d4037]);
      const face = this.add.rectangle(0, 0, 1, 1, color).setDepth(5);
      const top = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.IntegerToColor(color).lighten(25).color32).setDepth(5);
      const side = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.IntegerToColor(color).darken(20).color32).setDepth(5);
      this.gameObjs.push({ type: 'obstacle', lane, worldY: HORIZON_Y + 6, worldH: h, worldW: w, parts: [face, top, side], face, top, side, checked: false });
    }
  }

  _spawnWagon() {
    const lane = Phaser.Math.Between(0, 2);
    const ww = 86, wh = 52;
    const body = this.add.rectangle(0, 0, 1, 1, 0x4e342e).setDepth(5);
    const roof = this.add.rectangle(0, 0, 1, 1, 0x6d4c41).setDepth(5);
    const wl = this.add.circle(0, 0, 1, 0x1a1a1a).setDepth(5);
    const wr = this.add.circle(0, 0, 1, 0x1a1a1a).setDepth(5);
    const numCoins = Phaser.Math.Between(3, 6);
    const coins = [];
    for (let i = 0; i < numCoins; i++) {
      const t = numCoins > 1 ? i / (numCoins - 1) : 0.5;
      coins.push({
        obj: this.add.circle(0, 0, 1, 0xffd700).setDepth(6),
        shine: this.add.circle(0, 0, 1, 0xffe082).setAlpha(0.7).setDepth(6),
        fracT: t - 0.5,
        collected: false,
      });
    }
    this.gameObjs.push({ type: 'wagon', lane, worldY: HORIZON_Y + 6, worldW: ww, worldH: wh, parts: [body, roof, wl, wr, ...coins.flatMap(c => [c.obj, c.shine])], body, roof, wl, wr, coins, checked: false });
  }

  _renderObj(obj) {
    const y = obj.worldY;
    const sc = pSc(y);
    const x = lX(obj.lane, y);
    const dp = 4 + pT(y) * 5;

    if (obj.type === 'obstacle') {
      const sw = obj.worldW * sc;
      const sh = obj.worldH * sc;
      const fy = y - sh / 2;
      obj.face.setPosition(x, fy).setSize(sw, sh).setDepth(dp);
      const th = sh * 0.18;
      obj.top.setPosition(x, fy - sh / 2 - th / 2).setSize(sw * 1.06, th).setDepth(dp);
      const sdw = sw * 0.12;
      obj.side.setPosition(x + sw / 2 + sdw / 2, fy).setSize(sdw, sh).setDepth(dp);
    }

    if (obj.type === 'wagon') {
      const sw = obj.worldW * sc;
      const sh = obj.worldH * sc;
      const suf = eY(y, WAGON_TOP);
      const bcy = suf + sh / 2;
      obj.body.setPosition(x, bcy).setSize(sw, sh).setDepth(dp);
      const rh = sh * 0.22;
      obj.roof.setPosition(x, suf - rh / 2).setSize(sw * 1.06, rh).setDepth(dp);
      const wr = Math.max(2, 10 * sc);
      const wy = suf + sh + wr;
      obj.wl.setPosition(x - sw * 0.33, wy).setRadius(wr).setDepth(dp);
      obj.wr.setPosition(x + sw * 0.33, wy).setRadius(wr).setDepth(dp);
      obj.coins.forEach(c => {
        if (c.collected) return;
        const cr = Math.max(2, 9 * sc);
        const cx = x + c.fracT * sw;
        const cy = suf - cr - 4 * sc;
        c.obj.setPosition(cx, cy).setRadius(cr).setDepth(dp + 1);
        c.shine.setPosition(cx - cr * 0.3, cy - cr * 0.35).setRadius(Math.max(1, cr * 0.42)).setDepth(dp + 1);
      });
    }
  }

  _handleCollision(obj) {
    if (obj.checked || obj.lane !== this.pLane) return;
    if (obj.type === 'obstacle') {
      obj.checked = true;
      if (this.jumpH < obj.worldH - 8) this._gameOver('Hit an obstacle');
      else this._addScore(5, 'Clear');
    }

    if (obj.type === 'wagon') {
      if (this.jumpH >= WAGON_TOP - 28 && this.jumpVel <= 0) {
        obj.checked = true;
        this.jumpH = WAGON_TOP;
        this.jumpVel = 0;
        this.rideTimer = 1100;
        const collected = obj.coins.filter(c => !c.collected).length;
        obj.coins.forEach(c => {
          if (!c.collected) {
            c.collected = true;
            this.coinCount++;
            this._coinPop(c.obj.x, c.obj.y);
            c.obj.setVisible(false);
            c.shine.setVisible(false);
          }
        });
        this.combo = Math.min(this.combo + 1, 5);
        this._addScore(collected * COIN_SCORE * this.combo, `Combo x${this.combo}`);
        this.coinTxt.setText(this.coinCount);
        audio.coin();
        audio.land();
      } else if (this.jumpH < WAGON_TOP - 8) {
        obj.checked = true;
        this._gameOver('Hit a wagon');
      }
    }
  }

  _addScore(points, label) {
    this.score += points;
    if (label) this._toast(label, W / 2, 92);
  }

  _toast(label, x, y) {
    const t = this.add.text(x, y, label, { fontSize: '15px', fontFamily: 'Arial Black, Arial', fill: '#b7ffb7', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 520, ease: 'Power2', onComplete: () => t.destroy() });
  }

  _coinPop(x, y) {
    const t = this.add.text(x, y, '+1', { fontSize: '18px', fontFamily: 'Arial Black', fill: '#ffd700' }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 520, ease: 'Power2', onComplete: () => t.destroy() });
  }

  _gameOver(reason = 'Run ended') {
    if (!this.alive) return;
    this.alive = false;
    audio.gameOver();

    const finalScore = Math.floor(this.score);
    const oldBest = loadNumber(STORAGE_KEYS.bestScore);
    const oldCoins = loadNumber(STORAGE_KEYS.bestCoins);
    const newBest = finalScore > oldBest;
    if (newBest) saveNumber(STORAGE_KEYS.bestScore, finalScore);
    if (this.coinCount > oldCoins) saveNumber(STORAGE_KEYS.bestCoins, this.coinCount);

    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.3).setDepth(25);
    this.time.delayedCall(200, () => flash.destroy());
    this.add.rectangle(W / 2, H / 2, 348, 326, 0x000000, 0.9).setDepth(25);
    this.add.text(W / 2, H / 2 - 122, 'GAME OVER', { fontSize: '40px', fontFamily: 'Arial Black, Arial', fill: '#ff6b6b', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(26);
    this.add.text(W / 2, H / 2 - 76, reason, { fontSize: '16px', fontFamily: 'Arial', fill: '#cfd8dc' }).setOrigin(0.5).setDepth(26);
    this.add.text(W / 2, H / 2 - 30, `Score: ${finalScore}${newBest ? '  NEW BEST!' : ''}`, { fontSize: '24px', fontFamily: 'Arial', fill: newBest ? '#b7ffb7' : '#fff' }).setOrigin(0.5).setDepth(26);
    this.add.text(W / 2, H / 2 + 5, `Coins: ${this.coinCount}`, { fontSize: '21px', fontFamily: 'Arial', fill: '#ffd700' }).setOrigin(0.5).setDepth(26);
    this.add.text(W / 2, H / 2 + 34, bestSummary(), { fontSize: '15px', fontFamily: 'Arial', fill: '#9ecbff' }).setOrigin(0.5).setDepth(26);

    const restartBtn = this.add.rectangle(W / 2, H / 2 + 96, 200, 50, 0xff6b6b).setInteractive({ useHandCursor: true }).setDepth(26);
    const menuBtn = this.add.rectangle(W / 2, H / 2 + 154, 200, 38, 0x455a64).setInteractive({ useHandCursor: true }).setDepth(26);
    this.add.text(W / 2, H / 2 + 96, 'PLAY AGAIN', { fontSize: '21px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5).setDepth(27);
    this.add.text(W / 2, H / 2 + 154, 'MAIN MENU', { fontSize: '16px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5).setDepth(27);

    const restart = () => { audio.playGame(); this.scene.restart(); };
    restartBtn.on('pointerdown', restart);
    menuBtn.on('pointerdown', () => { audio.stop(); this.scene.start('Boot'); });
    this.time.delayedCall(350, () => {
      this.input.keyboard.once('keydown-SPACE', restart);
      this.input.keyboard.once('keydown-ENTER', restart);
    });
  }

  update(time, delta) {
    if (!this.alive) return;
    if (Phaser.Input.Keyboard.JustDown(this.pKey) || Phaser.Input.Keyboard.JustDown(this.escKey)) this._togglePause();
    if (this.pausedRun) return;

    const dt = delta / 1000;
    this.runTime += delta;
    this.distance += this.speed * dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.runTime * 0.0027 + this.distance * 0.015);
    this.score += SCORE_PER_SECOND * dt;
    this.scoreTxt.setText('Score: ' + Math.floor(this.score));

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this._jump();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.aKey)) this._switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.dKey)) this._switchLane(1);

    this.pX += (LANE_NX[this.pLane] - this.pX) * 11 * dt;

    if (this.rideTimer > 0) {
      this.rideTimer -= delta;
      this.jumpH = WAGON_TOP;
      this.jumpVel = 0;
      if (this.rideTimer <= 0) this.jumpVel = 80;
    } else {
      this.jumpVel -= GRAVITY * dt;
      this.jumpH += this.jumpVel * dt;
      if (this.jumpH <= 0) { this.jumpH = 0; this.jumpVel = 0; }
    }

    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const obj = this.gameObjs[i];
      obj.worldY += this.speed * dt;
      if (obj.worldY > NEAR_Y + 80) {
        obj.parts.forEach(p => p.destroy());
        this.gameObjs.splice(i, 1);
        continue;
      }
      this._renderObj(obj);
      if (obj.worldY >= NEAR_Y - 18 && obj.worldY <= NEAR_Y + 18) this._handleCollision(obj);
    }

    this._updateTrackMarks(dt);
    this._updateSideScenery(dt);
    if (this.runTime >= this.spawnCursor) this._spawnPattern();
    this._syncPlayer(time);
  }
}

// ─── Phaser config ────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#060c18',
  input: { activePointers: 3 },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [BootScene, GameScene],
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
};

new Phaser.Game(config);
