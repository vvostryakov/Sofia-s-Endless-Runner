'use strict';

// ─── Screen ───────────────────────────────────────────────────────────────────
const W = 400, H = 700;

// ─── Perspective ──────────────────────────────────────────────────────────────
const VP_X          = 200;
const HORIZON_Y     = 252;
const NEAR_Y        = 635;
const TRACK_FAR_HW  = 120;
const TRACK_NEAR_HW = 185;

const pT  = y      => Math.max(0, (y - HORIZON_Y) / (NEAR_Y - HORIZON_Y));
const pSc = y      => 0.12 + pT(y) * 0.88;
const eY  = (y, h) => y - h * pSc(y);

// ─── MVP tuning ───────────────────────────────────────────────────────────────
const JUMP_INIT = 465;
const GRAVITY   = 900;
const WAGON_TOP = 72;
const WAGON_LENGTH = 185;
const WAGON_LANDING_GRACE = 26;
const WAGON_RIDE_MIN_MS = 1150;
const WAGON_RIDE_MAX_MS = 2200;
const BASE_SPEED = 195;
const MAX_SPEED = 560;
const TOUCH_THRESHOLD = 22;
const SCORE_PER_SECOND = 15;
const COIN_SCORE = 20;
const SHIELD_SCORE = 50;
const MAGNET_SCORE = 40;
const SLIDE_DURATION = 620;
const MAGNET_DURATION = 7600;
const DOUBLE_JUMP_INIT = 370;
const SAFE_START_MS = 1300;
const TURN_MAX_OFFSET = 54;
const TURN_NEAR_FACTOR = 0.18;
const TURN_CHANGE_MIN_MS = 2400;
const TURN_CHANGE_MAX_MS = 4300;
const LANE_SIDE = [-1, 0, 1];
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
    this.panel.add(this.add.text(cx, cy - 12, 'Three lanes. Jump, double-jump, slide, chain combos, and grab power-ups.', {
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
      '↑ / W / Space: jump / double-jump\n' +
      '↓ / S: slide or fast-drop\n' +
      'P or Esc: pause\n\n' +
      'Touch\n' +
      'Swipe left/right to switch lanes.\n' +
      'Swipe up to jump, swipe down to slide. Tap pause when you need a break.\n\n' +
      'Goal\n' +
      'Survive as long as possible. Jump crates, slide under red gates, collect coin trails, and land on wagons to build combos. Blue shields block one crash; purple magnets pull nearby coins.', {
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
    this.shieldCharges = 0;
    this.magnetTimer = 0;
    this.slideTimer = 0;
    this.jumpsUsed = 0;
    this.level = 1;
    this.trackTurn = 0;
    this.targetTrackTurn = 0;
    this.nextTurnAt = TURN_CHANGE_MIN_MS;
    this.turnSway = 0;

    this.pLane = 1;
    this.pX = this._laneX(1, NEAR_Y);
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

  _trackHalfWidth(t) {
    return TRACK_FAR_HW + t * (TRACK_NEAR_HW - TRACK_FAR_HW);
  }

  _curveOffset(y) {
    const t = pT(y);
    const horizonWeight = 1 - t * (1 - TURN_NEAR_FACTOR);
    return this.trackTurn * horizonWeight + Math.sin((t + this.turnSway) * Math.PI) * this.trackTurn * 0.1 * (1 - t);
  }

  _curveCenterX(y) {
    return VP_X + this._curveOffset(y);
  }

  _laneX(lane, y) {
    const t = pT(y);
    return this._curveCenterX(y) + LANE_SIDE[lane] * this._trackHalfWidth(t) * 0.667;
  }

  _updateTrackCurve(delta) {
    if (this.runTime >= this.nextTurnAt) {
      const options = [-1, -0.55, 0, 0.55, 1].filter(v => Math.sign(v) !== Math.sign(this.targetTrackTurn));
      this.targetTrackTurn = Phaser.Utils.Array.GetRandom(options) * TURN_MAX_OFFSET;
      this.nextTurnAt = this.runTime + Phaser.Math.Between(TURN_CHANGE_MIN_MS, TURN_CHANGE_MAX_MS);
    }
    const dt = delta / 1000;
    this.trackTurn += (this.targetTrackTurn - this.trackTurn) * Math.min(1, dt * 0.9);
    this.turnSway = (this.turnSway + dt * 0.08) % 1;
  }

  _buildTrack() {
    this.horizonG = this.add.graphics().setDepth(1);
    this.trackG = this.add.graphics().setDepth(2);
    this._redrawTrack();
  }

  _redrawTrack() {
    const g = this.trackG;
    const hg = this.horizonG;
    g.clear();
    hg.clear();

    hg.fillGradientStyle(0x1a3a5c, 0x1a3a5c, 0x0d1f36, 0x0d1f36, 1);
    hg.fillRect(0, HORIZON_Y - 18, W, 36);

    const left = [];
    const right = [];
    const segments = 14;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = HORIZON_Y + t * (NEAR_Y - HORIZON_Y);
      const cx = this._curveCenterX(y);
      const hw = this._trackHalfWidth(t);
      left.push({ x: cx - hw, y });
      right.push({ x: cx + hw, y });
    }

    g.fillStyle(0x252b3a, 1);
    g.fillPoints([...left, ...right.slice().reverse()], true);

    const strokeLine = (points, width, color, alpha) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
      g.strokePath();
    };

    strokeLine(left, 3, 0x607d8b, 0.85);
    strokeLine(right, 3, 0x607d8b, 0.85);
    strokeLine(left.map((pt, i) => ({ x: pt.x + this._trackHalfWidth(i / segments) * 0.685, y: pt.y })), 2, 0x455a64, 0.55);
    strokeLine(right.map((pt, i) => ({ x: pt.x - this._trackHalfWidth(i / segments) * 0.685, y: pt.y })), 2, 0x455a64, 0.55);

    g.lineStyle(2, 0x90a4ae, 0.9);
    g.beginPath();
    g.moveTo(left[0].x, HORIZON_Y);
    g.lineTo(right[0].x, HORIZON_Y);
    g.strokePath();
    g.lineStyle(3, 0x607d8b, 0.75);
    g.beginPath();
    g.moveTo(left[left.length - 1].x, NEAR_Y);
    g.lineTo(right[right.length - 1].x, NEAR_Y);
    g.strokePath();
  }

  _buildTrackMarks() {
    for (let i = 0; i < 9; i++) this.marks.push({ baseT: (i + 0.5) / 9, gfx: this.add.graphics().setDepth(3) });
  }

  _updateTrackMarks(dt) {
    this.markOffset = (this.markOffset + this.speed * dt / (NEAR_Y - HORIZON_Y)) % 1;
    for (const m of this.marks) {
      const t = (m.baseT + this.markOffset) % 1;
      const y = HORIZON_Y + t * (NEAR_Y - HORIZON_Y);
      const hw = this._trackHalfWidth(t);
      const lh = Math.max(1, t * 2.5);
      m.gfx.clear();
      m.gfx.fillStyle(0x546e7a, t * 0.22);
      m.gfx.fillRect(this._curveCenterX(y) - hw, y - lh, hw * 2, lh);
    }
  }

  _buildSideScenery() {
    for (let i = 0; i < 6; i++) {
      const baseT = (i + 0.5) / 6;
      const worldY = HORIZON_Y + baseT * (NEAR_Y - HORIZON_Y);
      const sc = pSc(worldY);
      const mkPost = (side) => {
        const trackHW = this._trackHalfWidth(pT(worldY));
        const sx = this._curveCenterX(worldY) + side * (trackHW + 22 * sc);
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
      const trackHW = this._trackHalfWidth(t);
      const sx = this._curveCenterX(worldY) + s.side * (trackHW + 22 * sc);
      const postH = Math.round(65 * sc);
      s.post.setPosition(sx, worldY - postH / 2).setSize(Math.max(1, Math.round(5 * sc)), Math.max(1, postH)).setDepth(2 + t * 2);
      s.bulb.setPosition(sx, worldY - postH - Math.round(6 * sc)).setRadius(Math.max(1, Math.round(7 * sc))).setAlpha(t * 0.6).setDepth(2 + t * 2);
    }
  }

  _buildPlayer() {
    const d = 10;
    this.shadow = this.add.ellipse(this._laneX(1, NEAR_Y), NEAR_Y + 4, 48, 16, 0x000000).setAlpha(0.5).setDepth(d - 1);
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
      shield: this.add.ellipse(0, 0, 68, 88, 0x4fc3f7, 0.16).setStrokeStyle(3, 0x81d4fa, 0.92).setDepth(d + 1).setVisible(false),
      magnet: this.add.circle(0, 0, 42, 0xba68c8, 0.12).setStrokeStyle(3, 0xf3e5f5, 0.8).setDepth(d + 1).setVisible(false),
    };
  }

  _syncPlayer(t) {
    const x = this.pX;
    const sy = NEAR_Y - this.jumpH;
    const grounded = this.jumpH < 2;
    const sliding = this.slideTimer > 0 && grounded;
    const swing = grounded && !sliding ? Math.sin(t / 88) : 0;
    const tilt = grounded ? 0 : Phaser.Math.Clamp(-this.jumpVel / 3000, -0.18, 0.18);
    const sFrac = Math.max(0.35, 1 - this.jumpH / 130);
    const shieldScale = 1 + (this.shieldCharges > 0 ? Math.sin(t / 140) * 0.06 : 0);
    this.vis.shield.setPosition(x, sy + 2).setScale(shieldScale).setVisible(this.shieldCharges > 0);
    this.vis.magnet.setPosition(x, sy + 2).setScale(1 + Math.sin(t / 110) * 0.08).setVisible(this.magnetTimer > 0);
    this.shadow.setPosition(x, NEAR_Y + 4).setScale(sFrac, sFrac * 0.45).setAlpha(sFrac * 0.5);
    this.vis.legL.setPosition(x - (sliding ? 17 : 9), sy + (sliding ? 28 : 31)).setScale(sliding ? 1.55 : 1, sliding ? 0.52 : 1 + swing * 0.45).setRotation(sliding ? 0.35 : 0);
    this.vis.legR.setPosition(x + (sliding ? 15 : 9), sy + (sliding ? 31 : 31)).setScale(sliding ? 1.55 : 1, sliding ? 0.52 : 1 - swing * 0.45).setRotation(sliding ? 0.35 : 0);
    this.vis.body.setPosition(x, sy + (sliding ? 17 : 6)).setScale(1, sliding ? 0.62 : 1).setRotation(sliding ? Math.PI / 2 : tilt);
    this.vis.armL.setPosition(x - (sliding ? 18 : 24), sy + (sliding ? 19 : 4)).setRotation(sliding ? 1.15 : swing * 0.5);
    this.vis.armR.setPosition(x + (sliding ? 18 : 24), sy + (sliding ? 19 : 4)).setRotation(sliding ? 1.15 : -swing * 0.5);
    this.vis.head.setPosition(x + (sliding ? 31 : 0), sy + (sliding ? 11 : -22)).setRotation(sliding ? Math.PI / 2 : tilt);
    this.vis.hair.setPosition(x + (sliding ? 38 : 0), sy + (sliding ? 10 : -32)).setRotation(sliding ? Math.PI / 2 : tilt);
    this.vis.eyeL.setPosition(x + (sliding ? 31 : -6), sy + (sliding ? 5 : -26));
    this.vis.eyeR.setPosition(x + (sliding ? 31 : 6), sy + (sliding ? 17 : -26));
  }

  _buildUI() {
    this.add.rectangle(W / 2, 28, W, 56, 0x000000, 0.58).setDepth(20);
    this.scoreTxt = this.add.text(W / 2, 20, 'Score: 0', { fontSize: '18px', fontFamily: 'Arial', fill: '#fff' }).setOrigin(0.5).setDepth(21);
    this.goalTxt = this.add.text(W / 2, 44, 'Level 1 · slide gates · double jump', { fontSize: '12px', fontFamily: 'Arial', fill: '#9ecbff' }).setOrigin(0.5).setDepth(21);
    this.add.circle(24, 28, 11, 0xffd700).setDepth(20);
    this.coinTxt = this.add.text(42, 28, '0', { fontSize: '20px', fontFamily: 'Arial', fill: '#ffd700' }).setOrigin(0, 0.5).setDepth(21);
    this.shieldTxt = this.add.text(W - 72, 52, 'Shield: -', { fontSize: '12px', fontFamily: 'Arial Black, Arial', fill: '#81d4fa' }).setOrigin(0.5).setDepth(21);
    this.powerTxt = this.add.text(70, 52, 'Magnet: -', { fontSize: '12px', fontFamily: 'Arial Black, Arial', fill: '#ce93d8' }).setOrigin(0.5).setDepth(21);
    this.pauseBtn = this.add.rectangle(W - 30, 28, 42, 34, 0x263238, 0.95).setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(W - 30, 28, 'II', { fontSize: '18px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5).setDepth(22);
    this.pauseBtn.on('pointerdown', () => this._togglePause());
  }

  _buildControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.on('pointerdown', p => { this._touch = { x: p.x, y: p.y, t: this.time.now }; });
    this.input.on('pointerup', p => {
      if (!this._touch || this.pausedRun || !this.alive) return;
      const dx = p.x - this._touch.x;
      const dy = p.y - this._touch.y;
      if (Math.abs(dy) > Math.abs(dx) && dy < -TOUCH_THRESHOLD) this._jump();
      else if (Math.abs(dy) > Math.abs(dx) && dy > TOUCH_THRESHOLD) this._slide();
      else if (Math.abs(dx) > TOUCH_THRESHOLD) this._switchLane(dx > 0 ? 1 : -1);
      this._touch = null;
    });
  }

  _jump() {
    if (!this.alive || this.pausedRun || this.slideTimer > 0) return;
    const grounded = this.jumpH < 2 || this.rideTimer > 0;
    if (grounded || this.jumpsUsed < 2) {
      this.rideTimer = 0;
      this.jumpVel = grounded ? JUMP_INIT : DOUBLE_JUMP_INIT;
      this.jumpsUsed = grounded ? 1 : this.jumpsUsed + 1;
      this.combo = grounded ? 1 : Math.max(1, this.combo);
      this._toast(grounded ? 'Jump' : 'Double jump', this.pX, NEAR_Y - this.jumpH - 80);
      audio.jump();
    }
  }

  _slide() {
    if (!this.alive || this.pausedRun) return;
    if (this.jumpH > 8) {
      this.jumpVel = Math.min(this.jumpVel, -620);
      this._toast('Fast drop', this.pX, NEAR_Y - this.jumpH - 60);
      return;
    }
    this.slideTimer = SLIDE_DURATION;
    this.combo = Math.max(1, this.combo);
    audio.switchLane();
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
    if (roll < 0.07 + difficulty * 0.02) this._spawnShield();
    else if (roll < 0.13 + difficulty * 0.03) this._spawnMagnet();
    else if (roll < 0.31 + difficulty * 0.09) this._spawnWagon();
    else if (roll < 0.49 + difficulty * 0.08) this._spawnCoinTrail(difficulty);
    else this._spawnObstacle(this.time.now, difficulty);
    this._scheduleNextSpawn();
  }

  _spawnObstacle(time, difficulty = this._difficulty()) {
    const blockedCount = Math.random() < 0.38 + difficulty * 0.22 ? 2 : 1;
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, blockedCount);
    const spawnGate = this.runTime > 6500 && Math.random() < 0.28 + difficulty * 0.18;
    for (const lane of lanes) {
      if (spawnGate) {
        const beam = this.add.rectangle(0, 0, 1, 1, 0xc62828).setDepth(5);
        const glow = this.add.rectangle(0, 0, 1, 1, 0xff8a80, 0.55).setDepth(6);
        const postL = this.add.rectangle(0, 0, 1, 1, 0x5d4037).setDepth(5);
        const postR = this.add.rectangle(0, 0, 1, 1, 0x5d4037).setDepth(5);
        this.gameObjs.push({ type: 'gate', lane, worldY: HORIZON_Y + 6, worldH: 86, worldW: 74, parts: [beam, glow, postL, postR], beam, glow, postL, postR, checked: false });
      } else {
        const h = Phaser.Math.Between(42, 68);
        const w = Phaser.Math.Between(30, 48);
        const color = Phaser.Utils.Array.GetRandom([0xd32f2f, 0xe65100, 0x5d4037]);
        const face = this.add.rectangle(0, 0, 1, 1, color).setDepth(5);
        const top = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.IntegerToColor(color).lighten(25).color32).setDepth(5);
        const side = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.IntegerToColor(color).darken(20).color32).setDepth(5);
        this.gameObjs.push({ type: 'obstacle', lane, worldY: HORIZON_Y + 6, worldH: h, worldW: w, parts: [face, top, side], face, top, side, checked: false });
      }
    }
  }

  _spawnShield() {
    const lane = Phaser.Math.Between(0, 2);
    const ring = this.add.circle(0, 0, 1, 0x4fc3f7, 0.18).setStrokeStyle(2, 0xb3e5fc, 0.95).setDepth(6);
    const core = this.add.circle(0, 0, 1, 0x81d4fa, 0.9).setDepth(6);
    const glint = this.add.circle(0, 0, 1, 0xffffff, 0.75).setDepth(7);
    this.gameObjs.push({ type: 'shield', lane, worldY: HORIZON_Y + 6, worldW: 44, worldH: 44, parts: [ring, core, glint], ring, core, glint, checked: false });
  }


  _spawnMagnet() {
    const lane = Phaser.Math.Between(0, 2);
    const ring = this.add.circle(0, 0, 1, 0x8e24aa, 0.2).setStrokeStyle(2, 0xf3e5f5, 0.95).setDepth(6);
    const core = this.add.rectangle(0, 0, 1, 1, 0xba68c8).setDepth(7);
    const spark = this.add.circle(0, 0, 1, 0xffffff, 0.82).setDepth(8);
    this.gameObjs.push({ type: 'magnet', lane, worldY: HORIZON_Y + 6, worldW: 44, worldH: 44, parts: [ring, core, spark], ring, core, spark, checked: false });
  }

  _spawnCoinTrail(difficulty = this._difficulty()) {
    const lane = Phaser.Math.Between(0, 2);
    const laneDrift = Math.random() < 0.35 + difficulty * 0.25 ? Phaser.Utils.Array.GetRandom([-1, 1]) : 0;
    const count = Phaser.Math.Between(4, 7);
    for (let i = 0; i < count; i++) {
      const trailLane = Phaser.Math.Clamp(lane + (i > count / 2 ? laneDrift : 0), 0, 2);
      const coin = this.add.circle(0, 0, 1, 0xffd700).setDepth(6);
      const shine = this.add.circle(0, 0, 1, 0xfff59d, 0.72).setDepth(7);
      this.gameObjs.push({ type: 'coin', lane: trailLane, worldY: HORIZON_Y + 6 - i * 46, worldW: 28, worldH: 28, parts: [coin, shine], coin, shine, checked: false });
    }
  }

  _spawnWagon() {
    const lane = Phaser.Math.Between(0, 2);
    const ww = 96, wh = 54, wl = WAGON_LENGTH;
    const deck = this.add.graphics().setDepth(5);
    const body = this.add.rectangle(0, 0, 1, 1, 0x4e342e).setDepth(5);
    const roof = this.add.rectangle(0, 0, 1, 1, 0x6d4c41).setDepth(5);
    const wheelL = this.add.circle(0, 0, 1, 0x1a1a1a).setDepth(5);
    const wheelR = this.add.circle(0, 0, 1, 0x1a1a1a).setDepth(5);
    const numCoins = Phaser.Math.Between(6, 9);
    const coins = [];
    for (let i = 0; i < numCoins; i++) {
      const t = numCoins > 1 ? i / (numCoins - 1) : 0.5;
      coins.push({
        obj: this.add.circle(0, 0, 1, 0xffd700).setDepth(6),
        shine: this.add.circle(0, 0, 1, 0xffe082).setAlpha(0.7).setDepth(6),
        fracX: Phaser.Math.FloatBetween(-0.24, 0.24),
        lengthT: t,
        collected: false,
      });
    }
    this.gameObjs.push({ type: 'wagon', lane, worldY: HORIZON_Y + 6, worldW: ww, worldH: wh, worldL: wl, parts: [deck, body, roof, wheelL, wheelR, ...coins.flatMap(c => [c.obj, c.shine])], deck, body, roof, wl: wheelL, wr: wheelR, coins, checked: false });
  }

  _renderObj(obj) {
    const y = obj.worldY;
    const sc = pSc(y);
    const x = this._laneX(obj.lane, y);
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

    if (obj.type === 'gate') {
      const sw = obj.worldW * sc;
      const postH = obj.worldH * sc;
      const beamH = Math.max(4, 12 * sc);
      const topY = eY(y, 68);
      obj.beam.setPosition(x, topY).setSize(sw, beamH).setDepth(dp);
      obj.glow.setPosition(x, topY).setSize(sw * 1.14, beamH * 1.85).setDepth(dp + 1).setAlpha(0.32 + Math.sin(this.time.now / 90) * 0.12);
      obj.postL.setPosition(x - sw / 2, topY + postH / 2).setSize(Math.max(3, 8 * sc), postH).setDepth(dp);
      obj.postR.setPosition(x + sw / 2, topY + postH / 2).setSize(Math.max(3, 8 * sc), postH).setDepth(dp);
    }

    if (obj.type === 'shield' || obj.type === 'magnet') {
      const pulse = 1 + Math.sin(this.time.now / 130) * 0.08;
      const r = Math.max(3, 18 * sc * pulse);
      const cy = eY(y, 48);
      obj.ring.setPosition(x, cy).setRadius(r).setDepth(dp + 1);
      if (obj.type === 'shield') {
        obj.core.setPosition(x, cy).setRadius(Math.max(2, r * 0.58)).setDepth(dp + 2);
        obj.glint.setPosition(x - r * 0.26, cy - r * 0.32).setRadius(Math.max(1, r * 0.2)).setDepth(dp + 3);
      } else {
        obj.core.setPosition(x, cy).setSize(Math.max(4, r * 0.95), Math.max(5, r * 1.25)).setRotation(Math.sin(this.time.now / 180) * 0.25).setDepth(dp + 2);
        obj.spark.setPosition(x + r * 0.35, cy - r * 0.35).setRadius(Math.max(1, r * 0.22)).setDepth(dp + 3);
      }
    }

    if (obj.type === 'coin') {
      const pulse = 1 + Math.sin(this.time.now / 115 + obj.worldY) * 0.08;
      const r = Math.max(2, 10 * sc * pulse);
      const cy = eY(y, 42);
      obj.coin.setPosition(x, cy).setRadius(r).setDepth(dp + 1);
      obj.shine.setPosition(x - r * 0.3, cy - r * 0.35).setRadius(Math.max(1, r * 0.4)).setDepth(dp + 2);
    }

    if (obj.type === 'wagon') {
      const rearY = Math.max(HORIZON_Y + 4, y - obj.worldL);
      const rearSc = pSc(rearY);
      const rearX = lX(obj.lane, rearY);
      const sw = obj.worldW * sc;
      const sh = obj.worldH * sc;
      const rearW = obj.worldW * rearSc * 0.56;
      const suf = eY(y, WAGON_TOP);
      const rearTop = eY(rearY, WAGON_TOP);
      const dpRear = 4 + pT(rearY) * 5;

      obj.deck.clear();
      obj.deck.fillStyle(0x795548, 1);
      obj.deck.fillPoints([
        { x: rearX - rearW / 2, y: rearTop },
        { x: rearX + rearW / 2, y: rearTop },
        { x: x + sw * 0.52, y: suf },
        { x: x - sw * 0.52, y: suf },
      ], true);
      obj.deck.lineStyle(Math.max(1, 2 * sc), 0xa1887f, 0.8);
      obj.deck.strokePoints([
        { x: rearX - rearW / 2, y: rearTop },
        { x: rearX + rearW / 2, y: rearTop },
        { x: x + sw * 0.52, y: suf },
        { x: x - sw * 0.52, y: suf },
      ], true);
      obj.deck.setDepth(dpRear);

      const bcy = suf + sh / 2;
      obj.body.setPosition(x, bcy).setSize(sw, sh).setDepth(dp);
      const rh = sh * 0.22;
      obj.roof.setPosition(x, suf - rh / 2).setSize(sw * 1.08, rh).setDepth(dp + 0.1);
      const wr = Math.max(2, 10 * sc);
      const wy = suf + sh + wr;
      obj.wl.setPosition(x - sw * 0.33, wy).setRadius(wr).setDepth(dp);
      obj.wr.setPosition(x + sw * 0.33, wy).setRadius(wr).setDepth(dp);
      obj.coins.forEach(c => {
        if (c.collected) return;
        const coinWorldY = Phaser.Math.Linear(rearY + obj.worldL * 0.14, y - obj.worldL * 0.18, c.lengthT);
        const coinSc = pSc(coinWorldY);
        const coinX = lX(obj.lane, coinWorldY) + c.fracX * obj.worldW * coinSc;
        const coinTop = eY(coinWorldY, WAGON_TOP);
        const cr = Math.max(2, 9 * coinSc);
        const cy = coinTop - cr - 4 * coinSc;
        const coinDepth = 5 + pT(coinWorldY) * 5;
        c.obj.setPosition(coinX, cy).setRadius(cr).setDepth(coinDepth + 1);
        c.shine.setPosition(coinX - cr * 0.3, cy - cr * 0.35).setRadius(Math.max(1, cr * 0.42)).setDepth(coinDepth + 2);
      });
    }
  }

  _handleCollision(obj) {
    if (obj.checked) return;
    const laneDelta = Math.abs(obj.lane - this.pLane);
    const magnetGrab = this.magnetTimer > 0 && (obj.type === 'coin' || obj.type === 'magnet') && laneDelta <= 1;
    if (laneDelta > 0 && !magnetGrab) return;

    if (obj.type === 'shield') {
      obj.checked = true;
      obj.consumed = true;
      this.shieldCharges = 1;
      this._updateShieldUI();
      this._addScore(SHIELD_SCORE, 'Shield ready');
      audio.powerUp();
      return;
    }

    if (obj.type === 'magnet') {
      obj.checked = true;
      obj.consumed = true;
      this.magnetTimer = MAGNET_DURATION;
      this._updatePowerUI();
      this._addScore(MAGNET_SCORE, 'Magnet on');
      audio.powerUp();
      return;
    }

    if (obj.type === 'coin') {
      this._collectLooseCoin(obj, magnetGrab ? 'Magnet' : null);
      return;
    }

    if (obj.type === 'gate') {
      obj.checked = true;
      const cleared = this.slideTimer > 0 || this.jumpH > 76;
      if (cleared) this._addScore(12, this.slideTimer > 0 ? 'Slide!' : 'Vault!');
      else if (this._consumeShield('Shield blocked gate')) obj.consumed = true;
      else this._gameOver('Slide under red gates');
    }

    if (obj.type === 'obstacle') {
      obj.checked = true;
      if (this.jumpH < obj.worldH - 8) {
        if (this._consumeShield('Shield blocked it')) obj.consumed = true;
        else this._gameOver('Hit an obstacle');
      } else this._addScore(5, 'Clear');
    }

    if (obj.type === 'wagon') {
      if (this.jumpH >= WAGON_TOP - 28 && this.jumpVel <= 0) {
        obj.checked = true;
        this.jumpH = WAGON_TOP;
        this.jumpVel = 0;
        this.jumpsUsed = 0;
        const distancePastFront = Math.max(0, obj.worldY - NEAR_Y);
        const remainingLength = Math.max(0, obj.worldL - distancePastFront);
        this.rideTimer = Phaser.Math.Clamp(
          (remainingLength / Math.max(1, this.speed)) * 1000 + 420,
          WAGON_RIDE_MIN_MS,
          WAGON_RIDE_MAX_MS
        );
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
        if (this._consumeShield('Shield blocked it')) obj.consumed = true;
        else this._gameOver('Hit a wagon');
      }
    }
  }

  _collectLooseCoin(obj, label = null) {
    obj.checked = true;
    obj.consumed = true;
    this.coinCount++;
    this.combo = Math.min(this.combo + 0.25, 5);
    this._addScore(Math.round(COIN_SCORE * this.combo), label || (this.combo >= 2 ? `Streak x${this.combo.toFixed(1)}` : null));
    this.coinTxt.setText(this.coinCount);
    this._coinPop(obj.coin.x, obj.coin.y);
    audio.coin();
  }

  _updatePowerUI() {
    this.powerTxt.setText(this.magnetTimer > 0 ? `Magnet: ${Math.ceil(this.magnetTimer / 1000)}s` : 'Magnet: -');
  }

  _updateShieldUI() {
    this.shieldTxt.setText(this.shieldCharges > 0 ? 'Shield: ON' : 'Shield: -');
  }

  _consumeShield(label) {
    if (this.shieldCharges <= 0) return false;
    this.shieldCharges = 0;
    this._updateShieldUI();
    this.rideTimer = 0;
    this.jumpVel = Math.max(this.jumpVel, 120);
    this._toast(label, W / 2, 118);
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x4fc3f7, 0.24).setDepth(24);
    this.time.delayedCall(140, () => flash.destroy());
    audio.shieldBreak();
    return true;
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
    this.level = 1 + Math.floor(this.distance / 950);
    this.score += SCORE_PER_SECOND * dt * (1 + Math.min(0.5, (this.combo - 1) * 0.08));
    this.scoreTxt.setText('Score: ' + Math.floor(this.score));
    this.goalTxt.setText(`Level ${this.level} · ${Math.round(this.speed)} speed · Combo x${this.combo.toFixed(1)}`);
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - delta);
      this._updatePowerUI();
    }
    if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - delta);
    this._updateTrackCurve(delta);
    this._redrawTrack();

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this._jump();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.sKey)) this._slide();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.aKey)) this._switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.dKey)) this._switchLane(1);

    this.pX += (this._laneX(this.pLane, NEAR_Y) - this.pX) * 11 * dt;

    if (this.rideTimer > 0) {
      this.rideTimer -= delta;
      this.jumpH = WAGON_TOP;
      this.jumpVel = 0;
      if (this.rideTimer <= 0) this.jumpVel = 80;
    } else {
      this.jumpVel -= GRAVITY * dt;
      this.jumpH += this.jumpVel * dt;
      if (this.jumpH <= 0) { this.jumpH = 0; this.jumpVel = 0; this.jumpsUsed = 0; }
    }

    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const obj = this.gameObjs[i];
      obj.worldY += this.speed * dt;
      const cleanupY = NEAR_Y + 80 + (obj.worldL || 0);
      if (obj.consumed || obj.worldY > cleanupY) {
        obj.parts.forEach(p => p.destroy());
        this.gameObjs.splice(i, 1);
        continue;
      }
      this._renderObj(obj);
      const canCollide = obj.type === 'wagon'
        ? obj.worldY >= NEAR_Y - WAGON_LANDING_GRACE && obj.worldY <= NEAR_Y + obj.worldL
        : obj.worldY >= NEAR_Y - 18 && obj.worldY <= NEAR_Y + 18;
      if (canCollide) this._handleCollision(obj);
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
