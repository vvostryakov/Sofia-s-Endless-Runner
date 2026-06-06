'use strict';

// ─── Screen ───────────────────────────────────────────────────────────────────
const W = 400, H = 700;

// ─── Perspective ──────────────────────────────────────────────────────────────
const VP_X  = 200;   // vanishing-point x (centre)
const VP_Y  = 170;   // vanishing-point y (top of track)
const NEAR_Y = 590;  // ground y at player level (bottom)
const TRACK_HW = 150; // track half-width at NEAR_Y

// Lane centre x values at NEAR_Y (left / centre / right)
const LANE_NX = [
  VP_X - Math.round(TRACK_HW * 0.63),  // ≈ 106
  VP_X,                                  // 200
  VP_X + Math.round(TRACK_HW * 0.63),  // ≈ 294
];

// Perspective helpers
const pT  = y       => Math.max(0, (y - VP_Y) / (NEAR_Y - VP_Y));
const pSc = y       => 0.06 + pT(y) * 0.94;
const lX  = (l, y)  => VP_X + pT(y) * (LANE_NX[l] - VP_X);
const eY  = (y, h)  => y - h * pSc(y);  // screen-y when elevated by h world-units

// ─── Jump physics ─────────────────────────────────────────────────────────────
const JUMP_INIT = 460;    // initial upward velocity  (+up, −down)
const GRAVITY   = 900;    // deceleration per second
const WAGON_TOP = 72;     // wagon surface, world-units above ground (at near scale)

// ─── Game speed ───────────────────────────────────────────────────────────────
const BASE_SPEED = 195;   // worldY units / second

// ─── Boot scene ───────────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const cx = W / 2, cy = H / 2;

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

    this.add.text(cx, cy - 130, "Sofia's", {
      fontSize: '52px', fontFamily: 'Arial Black, Arial',
      fill: '#ffd700', stroke: '#b8860b', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(cx, cy - 62, 'Endless Runner', {
      fontSize: '28px', fontFamily: 'Arial',
      fill: '#fff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(cx, cy + 12, '← → / swipe  –  switch lane', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#aaaaff',
    }).setOrigin(0.5);
    this.add.text(cx, cy + 40, '↑ / swipe up  –  jump', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#aaaaff',
    }).setOrigin(0.5);
    this.add.text(cx, cy + 68, 'Jump on wagons to grab coins!', {
      fontSize: '14px', fontFamily: 'Arial', fill: '#88aadd',
    }).setOrigin(0.5);

    const btn = this.add.rectangle(cx, cy + 145, 200, 54, 0xff6b6b)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 145, 'PLAY', {
      fontSize: '28px', fontFamily: 'Arial Black, Arial', fill: '#fff',
    }).setOrigin(0.5);

    const startMusic = () => audio.playMenu();
    this.input.once('pointerdown', startMusic);
    this.input.keyboard.once('keydown', startMusic);

    const go = () => { audio.stop(); this.scene.start('Game'); };
    btn.on('pointerdown', go);
    this.input.keyboard.once('keydown-SPACE', go);
    this.input.keyboard.once('keydown-ENTER', go);
  }
}

// ─── Game scene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.speed     = BASE_SPEED;
    this.score     = 0;
    this.coinCount = 0;
    this.alive     = true;

    // Player state
    this.pLane   = 1;           // current lane index 0/1/2
    this.pX      = LANE_NX[1]; // animated x position
    this.jumpH   = 0;           // height above ground (px, at near scale)
    this.jumpVel = 0;           // upward velocity
    this.rideTimer = 0;         // > 0 while riding a wagon

    // Spawning
    this.gameObjs  = [];
    this.lastObs   = 0;
    this.lastWagon = 1000;

    // Track-mark scroll
    this.markOffset = 0;
    this.marks      = [];

    // Side-scenery scroll
    this.scenery    = [];

    this._buildBg();
    this._buildTrack();
    this._buildTrackMarks();
    this._buildSideScenery();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();

    audio.playGame();

    this.time.addEvent({
      delay: 4000,
      callback: () => { this.speed = Math.min(this.speed + 15, 540); },
      loop: true,
    });
  }

  // ── Static background ───────────────────────────────────────────────────────

  _buildBg() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x060c18, 0x060c18, 0x111d30, 0x111d30, 1);
    sky.fillRect(0, 0, W, H);

    for (let i = 0; i < 65; i++) {
      this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, VP_Y + 60),
        Math.random() < 0.22 ? 2 : 1, 0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.1, 0.9));
    }

    this.add.circle(310, 52, 27, 0xfff9c4).setAlpha(0.88);
    this.add.circle(300, 45, 21, 0x111d30).setAlpha(0.5);

    // City silhouette (static, depth 1)
    const city = this.add.graphics().setDepth(1);
    city.fillStyle(0x0b1726, 1);
    [[0,88,38],[42,122,34],[80,72,42],[124,110,32],[160,90,26],[190,120,48],[242,70,38],
     [286,96,34],[324,82,38],[366,102,32]].forEach(([x, bh, bw]) => {
      city.fillRect(x, VP_Y + 28 - bh, bw, bh);
      for (let wy = VP_Y + 32 - bh; wy < VP_Y + 22; wy += 14) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 10) {
          if (Math.random() > 0.52)
            city.fillStyle(0xffe082, 1).fillRect(wx, wy, 4, 6);
        }
      }
    });
    city.setAlpha(0.78);

    // Ground fill outside the track (dark dirt)
    this.add.rectangle(W / 2, (VP_Y + NEAR_Y) / 2 + 20, W, NEAR_Y - VP_Y + 40, 0x130e08)
      .setDepth(1);
  }

  // ── Track (drawn once) ──────────────────────────────────────────────────────

  _buildTrack() {
    const g = this.add.graphics().setDepth(2);

    // Road surface (trapezoid)
    g.fillStyle(0x252b3a, 1);
    g.fillPoints([
      { x: VP_X - 4, y: VP_Y },
      { x: VP_X + 4, y: VP_Y },
      { x: VP_X + TRACK_HW, y: NEAR_Y },
      { x: VP_X - TRACK_HW, y: NEAR_Y },
    ], true);

    // Track edges
    g.lineStyle(3, 0x607d8b, 0.8);
    g.beginPath(); g.moveTo(VP_X, VP_Y); g.lineTo(VP_X - TRACK_HW, NEAR_Y); g.strokePath();
    g.beginPath(); g.moveTo(VP_X, VP_Y); g.lineTo(VP_X + TRACK_HW, NEAR_Y); g.strokePath();

    // Lane dividers
    const divX = [VP_X - TRACK_HW * 0.315, VP_X + TRACK_HW * 0.315];
    g.lineStyle(2, 0x455a64, 0.5);
    divX.forEach(nx => {
      g.beginPath(); g.moveTo(VP_X, VP_Y); g.lineTo(nx, NEAR_Y); g.strokePath();
    });

    // Near edge line
    g.lineStyle(3, 0x607d8b, 0.7);
    g.beginPath();
    g.moveTo(VP_X - TRACK_HW, NEAR_Y);
    g.lineTo(VP_X + TRACK_HW, NEAR_Y);
    g.strokePath();
  }

  // ── Scrolling perspective marks ─────────────────────────────────────────────

  _buildTrackMarks() {
    for (let i = 0; i < 9; i++) {
      this.marks.push({
        baseT: (i + 0.5) / 9,
        gfx: this.add.graphics().setDepth(3),
      });
    }
  }

  _updateTrackMarks(dt) {
    this.markOffset = (this.markOffset + this.speed * dt / (NEAR_Y - VP_Y)) % 1;
    for (const m of this.marks) {
      const t = (m.baseT + this.markOffset) % 1;
      const y  = VP_Y + t * (NEAR_Y - VP_Y);
      const hw = TRACK_HW * t;
      m.gfx.clear();
      m.gfx.fillStyle(0x546e7a, t * 0.22);
      m.gfx.fillRect(VP_X - hw, y - Math.max(1, t * 2.5), hw * 2, Math.max(1, t * 2.5));
    }
  }

  // ── Side scenery (lamp posts parallax) ──────────────────────────────────────

  _buildSideScenery() {
    // 6 lamp posts on each side at different depth slots
    for (let i = 0; i < 6; i++) {
      const baseT = (i + 0.5) / 6;
      const worldY = VP_Y + baseT * (NEAR_Y - VP_Y);
      const sc     = pSc(worldY);
      const inset  = TRACK_HW * 1.12;

      const mkPost = (side) => {
        const sx = VP_X + side * (VP_X + pT(worldY) * (inset - 0));
        const postH  = Math.round(65 * sc);
        const post   = this.add.rectangle(sx, worldY - postH / 2, Math.round(5 * sc), postH, 0x607d8b)
          .setDepth(3);
        const bulb   = this.add.circle(sx, worldY - postH - Math.round(6 * sc), Math.round(7 * sc), 0xffee58)
          .setAlpha(0.6).setDepth(3);
        return { post, bulb, baseT, side };
      };

      this.scenery.push(mkPost(-1));
      this.scenery.push(mkPost(1));
    }
  }

  _updateSideScenery(dt) {
    const speed = this.speed;
    for (const s of this.scenery) {
      // Move the depth parameter
      s.baseT = (s.baseT + speed * dt / (NEAR_Y - VP_Y)) % 1;

      const t       = s.baseT;
      const worldY  = VP_Y + t * (NEAR_Y - VP_Y);
      const sc      = pSc(worldY);
      const inset   = TRACK_HW + 18;
      const sx      = VP_X + s.side * pT(worldY) * inset;
      const postH   = Math.round(65 * sc);

      s.post.setPosition(sx, worldY - postH / 2)
        .setSize(Math.max(1, Math.round(5 * sc)), Math.max(1, postH))
        .setDepth(2 + t * 2);
      s.bulb.setPosition(sx, worldY - postH - Math.round(6 * sc))
        .setRadius(Math.max(1, Math.round(7 * sc)))
        .setAlpha(t * 0.6)
        .setDepth(2 + t * 2);
    }
  }

  // ── Player ──────────────────────────────────────────────────────────────────

  _buildPlayer() {
    const d = 10;
    this.shadow = this.add.ellipse(LANE_NX[1], NEAR_Y + 4, 48, 16, 0x000000)
      .setAlpha(0.5).setDepth(d - 1);

    this.vis = {
      legL:  this.add.rectangle(0, 0, 13, 22, 0x1565c0).setDepth(d),
      legR:  this.add.rectangle(0, 0, 13, 22, 0x1565c0).setDepth(d),
      body:  this.add.rectangle(0, 0, 32, 34, 0xe91e8c).setDepth(d),
      armL:  this.add.rectangle(0, 0, 11, 24, 0xffb3ba).setDepth(d),
      armR:  this.add.rectangle(0, 0, 11, 24, 0xffb3ba).setDepth(d),
      head:  this.add.circle(0, 0, 15, 0xffcc99).setDepth(d),
      hair:  this.add.rectangle(0, 0, 33, 10, 0x5d4037).setDepth(d),
      eyeL:  this.add.circle(0, 0, 3, 0x1a1a2e).setDepth(d),
      eyeR:  this.add.circle(0, 0, 3, 0x1a1a2e).setDepth(d),
    };
  }

  _syncPlayer(t) {
    const x  = this.pX;
    const sy = NEAR_Y - this.jumpH;   // screen y of player feet
    const grounded = this.jumpH < 2;
    const swing    = grounded ? Math.sin(t / 88) : 0;
    const tilt     = grounded ? 0 : Phaser.Math.Clamp(-this.jumpVel / 3000, -0.18, 0.18);

    // Shadow shrinks and fades as player rises
    const sFrac = Math.max(0.35, 1 - this.jumpH / 130);
    this.shadow.setPosition(x, NEAR_Y + 4).setScale(sFrac, sFrac * 0.45).setAlpha(sFrac * 0.5);

    this.vis.legL.setPosition(x - 9,  sy + 31).setScale(1, 1 + swing * 0.45);
    this.vis.legR.setPosition(x + 9,  sy + 31).setScale(1, 1 - swing * 0.45);
    this.vis.body.setPosition(x,      sy + 6).setRotation(tilt);
    this.vis.armL.setPosition(x - 24, sy + 4).setRotation( swing * 0.5);
    this.vis.armR.setPosition(x + 24, sy + 4).setRotation(-swing * 0.5);
    this.vis.head.setPosition(x,      sy - 22).setRotation(tilt);
    this.vis.hair.setPosition(x,      sy - 32).setRotation(tilt);
    this.vis.eyeL.setPosition(x - 6,  sy - 26);
    this.vis.eyeR.setPosition(x + 6,  sy - 26);
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  _buildUI() {
    this.add.rectangle(W / 2, 28, W, 48, 0x000000, 0.55).setDepth(20);
    this.scoreTxt = this.add.text(W / 2, 28, 'Score: 0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#fff',
    }).setOrigin(0.5).setDepth(21);
    this.add.circle(24, 28, 11, 0xffd700).setDepth(20);
    this.coinTxt = this.add.text(42, 28, '0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#ffd700',
    }).setOrigin(0, 0.5).setDepth(21);
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  _buildControls() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointerdown', p => { this._touch = { x: p.x, y: p.y }; });
    this.input.on('pointerup',   p => {
      if (!this._touch) return;
      const dx = p.x - this._touch.x;
      const dy = p.y - this._touch.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -25) this._jump();
      } else if (Math.abs(dx) > 25) {
        this._switchLane(dx > 0 ? 1 : -1);
      }
      this._touch = null;
    });
  }

  _jump() {
    if (!this.alive) return;
    if (this.jumpH < 2 || this.rideTimer > 0) {
      this.rideTimer = 0;
      this.jumpVel   = JUMP_INIT;
      audio.jump();
    }
  }

  _switchLane(dir) {
    if (!this.alive) return;
    const next = Phaser.Math.Clamp(this.pLane + dir, 0, 2);
    if (next === this.pLane) return;
    this.pLane = next;
    audio.switchLane();
  }

  // ── Spawn helpers ────────────────────────────────────────────────────────────

  _spawnObstacle(time) {
    // Optionally block 1 or 2 lanes (always leave at least one clear)
    const blockedCount = Math.random() < 0.3 ? 2 : 1;
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, blockedCount);

    for (const lane of lanes) {
      const h     = Phaser.Math.Between(42, 65);   // height in near-scale world-units
      const w     = Phaser.Math.Between(30, 48);
      const color = Phaser.Utils.Array.GetRandom([0xd32f2f, 0xe65100, 0x5d4037]);

      const face = this.add.rectangle(0, 0, 1, 1, color).setDepth(5);
      const top  = this.add.rectangle(0, 0, 1, 1,
        Phaser.Display.Color.IntegerToColor(color).lighten(25).color32).setDepth(5);
      const side = this.add.rectangle(0, 0, 1, 1,
        Phaser.Display.Color.IntegerToColor(color).darken(20).color32).setDepth(5);

      this.gameObjs.push({
        type: 'obstacle', lane,
        worldY: VP_Y + 6,
        worldH: h, worldW: w,
        parts: [face, top, side], face, top, side,
        checked: false,
      });
    }
    this.lastObs = time;
  }

  _spawnWagon(time) {
    const lane = Phaser.Math.Between(0, 2);
    const ww   = 86;   // near-scale width
    const wh   = 52;   // near-scale body height

    const body = this.add.rectangle(0, 0, 1, 1, 0x4e342e).setDepth(5);
    const roof = this.add.rectangle(0, 0, 1, 1, 0x6d4c41).setDepth(5);
    const wl   = this.add.circle(0, 0, 1, 0x1a1a1a).setDepth(5);
    const wr   = this.add.circle(0, 0, 1, 0x1a1a1a).setDepth(5);

    const numCoins = Phaser.Math.Between(3, 6);
    const coins = [];
    for (let i = 0; i < numCoins; i++) {
      const t = numCoins > 1 ? i / (numCoins - 1) : 0.5;
      coins.push({
        obj:      this.add.circle(0, 0, 1, 0xffd700).setDepth(6),
        shine:    this.add.circle(0, 0, 1, 0xffe082).setAlpha(0.7).setDepth(6),
        fracT:    t - 0.5,   // position fraction across wagon width  (−0.5 … +0.5)
        collected: false,
      });
    }

    this.gameObjs.push({
      type: 'wagon', lane,
      worldY: VP_Y + 6,
      worldW: ww, worldH: wh,
      parts:  [body, roof, wl, wr, ...coins.flatMap(c => [c.obj, c.shine])],
      body, roof, wl, wr, coins,
      checked: false,
    });
    this.lastWagon = time;
  }

  // ── Per-frame object rendering ───────────────────────────────────────────────

  _renderObj(obj) {
    const y  = obj.worldY;
    const sc = pSc(y);
    const x  = lX(obj.lane, y);
    const dp = 4 + pT(y) * 5;   // depth: far objects rendered behind near ones

    if (obj.type === 'obstacle') {
      const sw = obj.worldW * sc;
      const sh = obj.worldH * sc;
      const fy = y - sh / 2;

      obj.face.setPosition(x, fy).setSize(sw, sh).setDepth(dp);
      // top face (pseudo-3D)
      const th = sh * 0.18;
      obj.top.setPosition(x, fy - sh / 2 - th / 2).setSize(sw * 1.06, th).setDepth(dp);
      // right-side face
      const sdw = sw * 0.12;
      obj.side.setPosition(x + sw / 2 + sdw / 2, fy).setSize(sdw, sh).setDepth(dp);
    }

    if (obj.type === 'wagon') {
      const sw  = obj.worldW * sc;
      const sh  = obj.worldH * sc;
      const suf = eY(y, WAGON_TOP);   // screen-y of wagon top surface
      const bcy = suf + sh / 2;

      obj.body.setPosition(x, bcy).setSize(sw, sh).setDepth(dp);
      // Roof stripe
      const rh = sh * 0.22;
      obj.roof.setPosition(x, suf - rh / 2).setSize(sw * 1.06, rh).setDepth(dp);
      // Wheels
      const wr = Math.max(2, 10 * sc);
      const wy = suf + sh + wr;
      obj.wl.setPosition(x - sw * 0.33, wy).setRadius(wr).setDepth(dp);
      obj.wr.setPosition(x + sw * 0.33, wy).setRadius(wr).setDepth(dp);
      // Coins on roof
      obj.coins.forEach(c => {
        if (c.collected) return;
        const cr = Math.max(2, 9 * sc);
        const cx = x + c.fracT * sw;
        const cy = suf - cr - 4 * sc;
        c.obj.setPosition(cx, cy).setRadius(cr).setDepth(dp + 1);
        c.shine.setPosition(cx - cr * 0.3, cy - cr * 0.35)
          .setRadius(Math.max(1, cr * 0.42)).setDepth(dp + 1);
      });
    }
  }

  // ── Collision / interaction ──────────────────────────────────────────────────

  _handleCollision(obj) {
    if (obj.checked) return;
    if (obj.lane !== this.pLane) return;   // different lane — safe

    if (obj.type === 'obstacle') {
      obj.checked = true;
      if (this.jumpH < obj.worldH - 8) {
        this._gameOver();
      }
    }

    if (obj.type === 'wagon') {
      // Player is in the right lane. Decide outcome:
      if (this.jumpH >= WAGON_TOP - 28 && this.jumpVel <= 0) {
        // ── Land on wagon ──
        obj.checked = true;
        this.jumpH   = WAGON_TOP;
        this.jumpVel = 0;
        this.rideTimer = 1100;   // ride for 1.1 s then release

        // Collect all coins immediately
        obj.coins.forEach(c => {
          if (!c.collected) {
            c.collected = true;
            this.coinCount++;
            this._coinPop(c.obj.x, c.obj.y);
            c.obj.setVisible(false);
            c.shine.setVisible(false);
            audio.coin();
          }
        });
        this.coinTxt.setText(this.coinCount);
        audio.land();
      } else if (this.jumpH < WAGON_TOP - 8) {
        // ── Hit the side of the wagon ──
        obj.checked = true;
        this._gameOver();
      }
    }
  }

  // ── Game over ───────────────────────────────────────────────────────────────

  _gameOver() {
    if (!this.alive) return;
    this.alive = false;
    audio.gameOver();

    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.3).setDepth(25);
    this.time.delayedCall(200, () => flash.destroy());

    this.add.rectangle(W / 2, H / 2, 340, 265, 0x000000, 0.9).setDepth(25);
    this.add.text(W / 2, H / 2 - 88, 'GAME OVER', {
      fontSize: '42px', fontFamily: 'Arial Black, Arial',
      fill: '#ff6b6b', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(26);
    this.add.text(W / 2, H / 2 - 18, `Score: ${Math.floor(this.score)}`, {
      fontSize: '26px', fontFamily: 'Arial', fill: '#fff',
    }).setOrigin(0.5).setDepth(26);
    this.add.text(W / 2, H / 2 + 22, `Coins: ${this.coinCount}`, {
      fontSize: '22px', fontFamily: 'Arial', fill: '#ffd700',
    }).setOrigin(0.5).setDepth(26);

    const btn = this.add.rectangle(W / 2, H / 2 + 92, 190, 50, 0xff6b6b)
      .setInteractive({ useHandCursor: true }).setDepth(26);
    this.add.text(W / 2, H / 2 + 92, 'PLAY AGAIN', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', fill: '#fff',
    }).setOrigin(0.5).setDepth(27);

    const restart = () => { audio.playGame(); this.scene.restart(); };
    btn.on('pointerdown', restart);
    this.time.delayedCall(400, () => this.input.keyboard.once('keydown', restart));
  }

  _coinPop(x, y) {
    const t = this.add.text(x, y, '+1', {
      fontSize: '18px', fontFamily: 'Arial Black', fill: '#ffd700',
    }).setOrigin(0.5).setDepth(22);
    this.tweens.add({
      targets: t, y: y - 50, alpha: 0, duration: 520, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ── Main update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    this.score += delta * 0.015;
    this.scoreTxt.setText('Score: ' + Math.floor(this.score));

    // ── Input ──
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)   ||
        Phaser.Input.Keyboard.JustDown(this.wKey)          ||
        Phaser.Input.Keyboard.JustDown(this.spaceKey))      this._jump();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) ||
        Phaser.Input.Keyboard.JustDown(this.aKey))          this._switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)||
        Phaser.Input.Keyboard.JustDown(this.dKey))          this._switchLane(1);

    // ── Lane transition ──
    this.pX += (LANE_NX[this.pLane] - this.pX) * 11 * dt;

    // ── Jump / ride physics ──
    if (this.rideTimer > 0) {
      this.rideTimer -= delta;
      this.jumpH   = WAGON_TOP;
      this.jumpVel = 0;
      if (this.rideTimer <= 0) {
        // Dismount: small upward nudge so player floats off naturally
        this.jumpVel = 80;
      }
    } else {
      this.jumpVel -= GRAVITY * dt;
      this.jumpH   += this.jumpVel * dt;
      if (this.jumpH <= 0) { this.jumpH = 0; this.jumpVel = 0; }
    }

    // ── Objects ──
    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const obj = this.gameObjs[i];
      obj.worldY += this.speed * dt;

      if (obj.worldY > NEAR_Y + 80) {
        obj.parts.forEach(p => p.destroy());
        this.gameObjs.splice(i, 1);
        continue;
      }

      this._renderObj(obj);

      // Collision window: object is at player depth
      if (obj.worldY >= NEAR_Y - 18 && obj.worldY <= NEAR_Y + 18) {
        this._handleCollision(obj);
      }
    }

    // ── Scrolling track marks & scenery ──
    this._updateTrackMarks(dt);
    this._updateSideScenery(dt);

    // ── Spawning ──
    const obsGap   = Math.max(900,  2200 - this.speed * 4.5);
    const wagonGap = Math.max(4500, 9000 - this.speed * 15);

    if (time - this.lastObs > obsGap) {
      this._spawnObstacle(time);
    }
    if (time - this.lastWagon > wagonGap) {
      this._spawnWagon(time);
      this.lastObs = time + 500;   // gap after wagon
    }

    // ── Player visuals ──
    this._syncPlayer(time);
  }
}

// ─── Phaser config ────────────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#060c18',
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
