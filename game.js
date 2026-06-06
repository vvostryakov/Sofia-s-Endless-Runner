'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const W  = 400;
const H  = 700;

const GROUND_Y    = 570;   // y of ground surface (player feet land here)
const WAGON_TOP_Y = 415;   // y of wagon top surface (player feet land here)
const PLAYER_X    = 110;   // fixed player x position
const PLAYER_HH   = 28;    // half-height of player hitbox  (total 56 px)
const PLAYER_HW   = 14;    // half-width  of player hitbox  (total 28 px)
const JUMP_VEL    = -800;
const BASE_SPEED  = 295;

// ─── Boot scene ───────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const cx = W / 2, cy = H / 2;

    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0a1628, 0x0a1628, 0x1e3a5f, 0x1e3a5f, 1);
    sky.fillRect(0, 0, W, H);

    for (let i = 0; i < 55; i++) {
      this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, 300),
        Math.random() < 0.3 ? 2 : 1, 0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.2, 0.95));
    }

    this.add.text(cx, cy - 130, "Sofia's", {
      fontSize: '52px', fontFamily: 'Arial Black, Arial',
      fill: '#ffd700', stroke: '#b8860b', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 62, 'Endless Runner', {
      fontSize: '28px', fontFamily: 'Arial',
      fill: '#fff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy + 16, 'Tap  /  Space  /  ↑  to jump', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#aaaaff',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 44, 'Jump on wagons to collect coins!', {
      fontSize: '14px', fontFamily: 'Arial', fill: '#88aadd',
    }).setOrigin(0.5);

    const btn = this.add.rectangle(cx, cy + 130, 200, 54, 0xff6b6b)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 130, 'PLAY', {
      fontSize: '28px', fontFamily: 'Arial Black, Arial', fill: '#fff',
    }).setOrigin(0.5);

    // Music starts on first interaction (browser autoplay policy)
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
    this.onWagon   = null;   // wagon the player is currently riding, or null

    this.obstacles  = [];
    this.wagons     = [];
    this.coinPool   = [];
    this.lamps      = [];
    this.ties       = [];

    this.lastObs    = 0;
    this.lastWagon  = 800;   // small startup delay

    this._buildBg();
    this._buildGround();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();

    audio.playGame();

    this.time.addEvent({
      delay: 4000,
      callback: () => { this.speed = Math.min(this.speed + 18, 680); },
      loop: true,
    });
  }

  // ── Background ────────────────────────────────────────────────────────────

  _buildBg() {
    // Sky
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x080f1e, 0x080f1e, 0x152840, 0x152840, 1);
    sky.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 60; i++) {
      this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, 280),
        Math.random() < 0.25 ? 2 : 1, 0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.95));
    }

    // Moon
    this.add.circle(320, 58, 30, 0xfff9c4).setAlpha(0.9);
    this.add.circle(308, 50, 24, 0x152840).setAlpha(0.5);   // crescent shadow

    // Distant city skyline (static, very dark)
    const city = this.add.graphics();
    city.fillStyle(0x0b1a30, 1);
    [
      [0, 95, 40], [44, 130, 36], [84, 80, 44], [132, 118, 34],
      [170, 96, 28], [202, 128, 50], [256, 76, 40], [300, 104, 36],
      [340, 90, 40], [385, 110, 18],
    ].forEach(([x, bh, bw]) => {
      city.fillRect(x, 268 - bh, bw, bh);
      // A few lit windows
      for (let wy = 272 - bh; wy < 266; wy += 16) {
        for (let wx2 = x + 5; wx2 < x + bw - 5; wx2 += 11) {
          if (Math.random() > 0.55) city.fillStyle(0xffe082, 1).fillRect(wx2, wy, 4, 6);
        }
      }
    });
    city.setAlpha(0.8);

    // Mid ground fill
    this.add.rectangle(W / 2, 530, W, 300, 0x130e09).setDepth(1);

    // Ground surface stripe
    this.add.rectangle(W / 2, GROUND_Y - 1, W, 6, 0x8d6e63).setDepth(3);

    // Rails for wagons (two parallel horizontal bars)
    const r1y = WAGON_TOP_Y + 52;
    const r2y = WAGON_TOP_Y + 58;
    this.add.rectangle(W / 2, r1y, W, 5, 0x90a4ae).setDepth(2);
    this.add.rectangle(W / 2, r2y, W, 5, 0x90a4ae).setDepth(2);

    // Scrolling rail ties
    for (let i = 0; i < 11; i++) {
      this.ties.push(
        this.add.rectangle(i * 42 + 10, r1y + 4, 20, 14, 0x6d4c41).setDepth(2)
      );
    }

    // Scrolling lamp posts (parallax at 40 % speed)
    for (let i = 0; i < 6; i++) {
      const lx = i * 72 + 36;
      const post = this.add.rectangle(lx, 500, 4, 65, 0x78909c).setDepth(1);
      const bulb = this.add.circle(lx, 468, 8, 0xffee58).setAlpha(0.65).setDepth(1);
      this.lamps.push({ post, bulb, x: lx });
    }
  }

  // ── Ground ────────────────────────────────────────────────────────────────

  _buildGround() {
    this.add.rectangle(W / 2, GROUND_Y + 30, W, 60, 0x3e2723).setDepth(2);

    // Static physics body — player stands on this
    this.groundBody = this.add.rectangle(W / 2, GROUND_Y + 12, W, 24, 0x000000, 0).setDepth(2);
    this.physics.add.existing(this.groundBody, true);
  }

  // ── Player ────────────────────────────────────────────────────────────────

  _buildPlayer() {
    this.physics.world.gravity.y = 1900;

    // Invisible physics hitbox
    this.player = this.add.rectangle(
      PLAYER_X, GROUND_Y - PLAYER_HH,
      PLAYER_HW * 2, PLAYER_HH * 2,
      0x000000, 0
    ).setDepth(6);
    this.physics.add.existing(this.player, false);
    this.player.body.allowGravity = true;
    this.player.body.setMaxVelocityY(1000);

    this.physics.add.collider(this.player, this.groundBody);

    this._wasGrounded = true;

    // Visual parts (positions updated every frame in _syncPlayer)
    const d = 7;
    this.vis = {
      legL:  this.add.rectangle(0, 0, 12, 22, 0x1565c0).setDepth(d),
      legR:  this.add.rectangle(0, 0, 12, 22, 0x1565c0).setDepth(d),
      body:  this.add.rectangle(0, 0, 30, 32, 0xe91e8c).setDepth(d),
      head:  this.add.circle(0, 0, 14, 0xffcc99).setDepth(d),
      hair:  this.add.rectangle(0, 0, 32, 9, 0x5d4037).setDepth(d),
      eyeL:  this.add.circle(0, 0, 3, 0x1a1a2e).setDepth(d),
      eyeR:  this.add.circle(0, 0, 3, 0x1a1a2e).setDepth(d),
      cheek: this.add.circle(0, 0, 4, 0xffb3ba).setAlpha(0.7).setDepth(d),
    };
  }

  _syncPlayer(t) {
    const x  = PLAYER_X;
    const cy = this.player.y;   // center of hitbox
    const grounded = this.player.body.blocked.down || this.onWagon !== null;
    const swing = grounded ? Math.sin(t / 85) : 0;

    // Landing squish: briefly compress body on landing
    const vy = this.player.body.velocity.y;
    const justLanded = grounded && !this._wasGrounded;
    if (justLanded) {
      this.tweens.add({
        targets: [this.vis.body],
        scaleY: 0.70, scaleX: 1.25, duration: 60, yoyo: true, ease: 'Power1',
      });
      audio.land();
    }
    this._wasGrounded = grounded;

    // Air tilt: lean back slightly while rising, forward while falling
    const tilt = grounded ? 0 : Phaser.Math.Clamp(vy / 3000, -0.12, 0.12);

    this.vis.legL.setPosition(x - 8, cy + PLAYER_HH - 9).setScale(1, 1 + swing * 0.42);
    this.vis.legR.setPosition(x + 8, cy + PLAYER_HH - 9).setScale(1, 1 - swing * 0.42);
    this.vis.body.setPosition(x, cy - 2).setRotation(tilt);
    this.vis.head.setPosition(x, cy - 22).setRotation(tilt);
    this.vis.hair.setPosition(x, cy - 31).setRotation(tilt);
    this.vis.eyeL.setPosition(x - 5, cy - 25);
    this.vis.eyeR.setPosition(x + 5, cy - 25);
    this.vis.cheek.setPosition(x + 9, cy - 20);
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  _buildUI() {
    this.add.rectangle(W / 2, 28, W, 48, 0x000000, 0.55).setDepth(10);
    this.scoreTxt = this.add.text(W / 2, 28, 'Score: 0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#fff',
    }).setOrigin(0.5).setDepth(11);
    this.add.circle(24, 28, 11, 0xffd700).setDepth(10);
    this.coinTxt = this.add.text(42, 28, '0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#ffd700',
    }).setOrigin(0, 0.5).setDepth(11);
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  _buildControls() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Tap or swipe-up both jump
    this.input.on('pointerdown', (p) => { this._touchStartY = p.y; });
    this.input.on('pointerup',   (p) => {
      if (this._touchStartY - p.y > 20 || Math.abs(this._touchStartY - p.y) < 20) {
        this._jump();
      }
    });
  }

  _jump() {
    if (!this.alive) return;
    if (this.player.body.blocked.down || this.onWagon !== null) {
      this.onWagon = null;
      this.player.body.allowGravity = true;
      this.player.body.setVelocityY(JUMP_VEL);
      audio.jump();
    }
  }

  // ── Obstacle spawning ─────────────────────────────────────────────────────

  _spawnObstacle(time) {
    const type = Phaser.Math.Between(0, 2);
    let obs;

    if (type === 0) {
      // Barrel
      const r = Phaser.Math.Between(18, 28);
      obs = this.add.circle(W + 32, GROUND_Y - r, r, 0x795548);
      this.add.circle(W + 32, GROUND_Y - r, r - 7, 0x6d4c41).setAlpha(0.55).setDepth(4);
    } else if (type === 1) {
      // Crate
      const h = Phaser.Math.Between(36, 62);
      obs = this.add.rectangle(W + 32, GROUND_Y - h / 2, 36, h, 0xd84315);
    } else {
      // Spike / bollard
      const h = Phaser.Math.Between(44, 70);
      obs = this.add.rectangle(W + 32, GROUND_Y - h / 2, 14, h, 0xb71c1c);
    }

    obs.setDepth(4);
    this.physics.add.existing(obs, false);
    obs.body.setVelocityX(-this.speed);
    obs.body.allowGravity = false;
    this.obstacles.push(obs);
    this.lastObs = time;
  }

  // ── Wagon spawning ────────────────────────────────────────────────────────

  _spawnWagon(time) {
    const ww  = Phaser.Math.Between(130, 185);
    const wh  = 68;
    const wx  = W + ww / 2 + 20;
    const wCy = WAGON_TOP_Y + wh / 2;

    // Main body — carries physics
    const body = this.add.rectangle(wx, wCy, ww, wh, 0x4a2f20).setDepth(3);
    this.physics.add.existing(body, false);
    body.body.setVelocityX(-this.speed);
    body.body.allowGravity = false;

    // Decorative visual parts — synced to body.x each frame (ox = offset from body center)
    const vp = [];

    const stripe = this.add.rectangle(wx, WAGON_TOP_Y + 8, ww, 16, 0x6d4c41).setDepth(3);
    vp.push({ obj: stripe, ox: 0 });

    // Vertical ribs
    for (const ox of [-ww / 2 + 14, 0, ww / 2 - 14]) {
      const rib = this.add.rectangle(wx + ox, wCy, 6, wh - 18, 0x3e2723).setDepth(3);
      vp.push({ obj: rib, ox });
    }

    // Wheels
    const wheelY = WAGON_TOP_Y + wh + 10;
    for (const ox of [-ww / 2 + 18, ww / 2 - 18]) {
      const rim  = this.add.circle(wx + ox, wheelY, 14, 0x212121).setDepth(3);
      const hub  = this.add.circle(wx + ox, wheelY, 5,  0x616161).setDepth(3);
      const spH  = this.add.rectangle(wx + ox, wheelY, 22, 2, 0x757575).setDepth(3);
      const spV  = this.add.rectangle(wx + ox, wheelY, 2, 22, 0x757575).setDepth(3);
      [rim, hub, spH, spV].forEach(o => vp.push({ obj: o, ox }));
    }

    // Coins on top
    const numCoins = Phaser.Math.Between(4, 7);
    const coins = [];
    for (let i = 0; i < numCoins; i++) {
      const t  = numCoins > 1 ? i / (numCoins - 1) : 0.5;
      const cx = wx - ww / 2 + 18 + t * (ww - 36);
      const cy = WAGON_TOP_Y - 17;
      const coin = this.add.circle(cx, cy, 11, 0xffd700).setDepth(5);
      this.add.circle(cx - 2, cy - 2, 5, 0xffe082).setAlpha(0.65).setDepth(5);
      this.physics.add.existing(coin, false);
      coin.body.setVelocityX(-this.speed);
      coin.body.allowGravity = false;
      coins.push(coin);
      this.coinPool.push(coin);
    }

    this.wagons.push({ body, ww, wh, visualParts: vp, coins });
    this.lastWagon = time;
  }

  // ── Game over ─────────────────────────────────────────────────────────────

  _gameOver() {
    if (!this.alive) return;
    this.alive = false;
    this.physics.pause();
    audio.gameOver();

    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.3).setDepth(20);
    this.time.delayedCall(200, () => flash.destroy());

    this.add.rectangle(W / 2, H / 2, 340, 260, 0x000000, 0.88).setDepth(20);
    this.add.text(W / 2, H / 2 - 85, 'GAME OVER', {
      fontSize: '42px', fontFamily: 'Arial Black, Arial',
      fill: '#ff6b6b', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, H / 2 - 15, `Score: ${Math.floor(this.score)}`, {
      fontSize: '26px', fontFamily: 'Arial', fill: '#fff',
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, H / 2 + 25, `Coins: ${this.coinCount}`, {
      fontSize: '22px', fontFamily: 'Arial', fill: '#ffd700',
    }).setOrigin(0.5).setDepth(21);

    const btn = this.add.rectangle(W / 2, H / 2 + 90, 190, 50, 0xff6b6b)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(W / 2, H / 2 + 90, 'PLAY AGAIN', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', fill: '#fff',
    }).setOrigin(0.5).setDepth(22);

    const restart = () => { audio.playGame(); this.scene.restart(); };
    btn.on('pointerdown', restart);
    this.time.delayedCall(400, () => this.input.keyboard.once('keydown', restart));
  }

  _coinPop(x, y) {
    const t = this.add.text(x, y, '+1', {
      fontSize: '18px', fontFamily: 'Arial Black', fill: '#ffd700',
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 50, alpha: 0, duration: 520, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(time, delta) {
    if (!this.alive) return;
    const dt = delta / 1000;

    this.score += delta * 0.015;
    this.scoreTxt.setText('Score: ' + Math.floor(this.score));

    // Jump input
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.wKey) ||
      Phaser.Input.Keyboard.JustDown(this.spaceKey)
    ) {
      this._jump();
    }

    // Parallax: lamp posts at 40 % speed
    for (const lamp of this.lamps) {
      lamp.x -= this.speed * 0.4 * dt;
      if (lamp.x < -20) lamp.x += W + 45;
      lamp.post.x = lamp.x;
      lamp.bulb.x = lamp.x;
    }

    // Rail ties scroll at full speed
    for (const tie of this.ties) {
      tie.x -= this.speed * dt;
      if (tie.x < -15) tie.x += W + 50;
    }

    // ── Wagons ──────────────────────────────────────────────────────────────
    for (let i = this.wagons.length - 1; i >= 0; i--) {
      const w = this.wagons[i];
      if (!w.body.active) { this.wagons.splice(i, 1); continue; }

      w.body.body.setVelocityX(-this.speed);

      // Sync visual parts to body x
      const bx = w.body.x;
      for (const { obj, ox } of w.visualParts) obj.x = bx + ox;

      // Sync coin velocities
      for (const c of w.coins) {
        if (c.active && c.body) c.body.setVelocityX(-this.speed);
      }

      // ── Player ↔ wagon interaction ──────────────────────────────────────
      const wb = w.body.getBounds();

      if (this.onWagon === w) {
        // Carry the player: keep them pinned to wagon top
        if (PLAYER_X >= wb.left - 2 && PLAYER_X <= wb.right + 2) {
          this.player.body.setVelocityY(0);
          this.player.body.allowGravity = false;
          this.player.y = WAGON_TOP_Y - PLAYER_HH;
        } else {
          // Walked off the edge — fall
          this.onWagon = null;
          this.player.body.allowGravity = true;
        }
      } else if (this.onWagon === null && this.player.body.velocity.y >= 0) {
        // Check for landing on this wagon
        const pBottom = this.player.y + PLAYER_HH;
        if (
          pBottom >= wb.top - 5 && pBottom <= wb.top + 18 &&
          PLAYER_X >= wb.left  && PLAYER_X <= wb.right
        ) {
          this.onWagon = w;
          this.player.body.setVelocityY(0);
          this.player.body.allowGravity = false;
          this.player.y = WAGON_TOP_Y - PLAYER_HH;
        }
      }

      // Remove wagon once it scrolls off left edge
      if (w.body.x < -w.ww - 20) {
        for (const { obj } of w.visualParts) obj.destroy();
        w.body.destroy();
        for (const c of w.coins) { if (c.active) c.destroy(); }
        if (this.onWagon === w) {
          this.onWagon = null;
          this.player.body.allowGravity = true;
        }
        this.wagons.splice(i, 1);
      }
    }

    // ── Obstacles ────────────────────────────────────────────────────────────
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (!obs.active) { this.obstacles.splice(i, 1); continue; }
      if (obs.body) obs.body.setVelocityX(-this.speed);
      if (obs.x < -80) { obs.destroy(); this.obstacles.splice(i, 1); continue; }

      // Shrink bounds slightly for forgiveness
      const pb = this.player.getBounds();
      const ob = obs.getBounds();
      pb.x += 6;  pb.width  -= 12;  pb.y += 6;  pb.height -= 12;
      ob.x += 4;  ob.width  -= 8;   ob.y += 4;  ob.height -= 8;
      if (Phaser.Geom.Intersects.RectangleToRectangle(pb, ob)) {
        this._gameOver(); return;
      }
    }

    // ── Coins ────────────────────────────────────────────────────────────────
    for (let i = this.coinPool.length - 1; i >= 0; i--) {
      const coin = this.coinPool[i];
      if (!coin.active) { this.coinPool.splice(i, 1); continue; }
      if (coin.body) coin.body.setVelocityX(-this.speed);
      if (coin.x < -40) { coin.destroy(); this.coinPool.splice(i, 1); continue; }

      const dx = coin.x - PLAYER_X;
      const dy = coin.y - this.player.y;
      if (dx * dx + dy * dy < 30 * 30) {
        this.coinCount++;
        this.coinTxt.setText(this.coinCount);
        audio.coin();
        this._coinPop(coin.x, coin.y);
        coin.destroy();
        this.coinPool.splice(i, 1);
      }
    }

    // ── Spawning ─────────────────────────────────────────────────────────────
    const obsGap   = Math.max(900,  2000 - this.speed * 2.2);
    const wagonGap = Math.max(4500, 8000 - this.speed * 6);

    if (time - this.lastObs > obsGap) {
      this._spawnObstacle(time);
    }
    if (time - this.lastWagon > wagonGap) {
      this._spawnWagon(time);
      this.lastObs = time + 600;   // breathing room after a wagon
    }

    // ── Player visuals ───────────────────────────────────────────────────────
    this._syncPlayer(time);
  }
}

// ─── Phaser config ────────────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#080f1e',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
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
