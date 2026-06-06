// ─── Constants ───────────────────────────────────────────────────────────────

const W = 800;
const H = 500;
const LANE_Y = [130, 250, 370];   // top / mid / bottom lane y-positions
const PLAYER_X = 160;
const BASE_SPEED = 320;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function overlap(a, b) {
  const ab = a.getBounds();
  const bb = b.getBounds();
  ab.x += 8; ab.width -= 16; ab.y += 8; ab.height -= 16;
  bb.x += 8; bb.width -= 16; bb.y += 8; bb.height -= 16;
  return Phaser.Geom.Intersects.RectangleToRectangle(ab, bb);
}

// ─── Boot / loading screen ────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const cx = W / 2, cy = H / 2;

    // gradient sky background
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    sky.fillRect(0, 0, W, H);

    this.add.text(cx, cy - 60, "Sofia's", {
      fontSize: '52px', fontFamily: 'Arial Black, Arial', fill: '#ffd700',
      stroke: '#b8860b', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(cx, cy + 10, 'Endless Runner', {
      fontSize: '34px', fontFamily: 'Arial', fill: '#ffffff',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(cx, cy + 80, '↑ ↓  or  W S  to switch lanes', {
      fontSize: '18px', fontFamily: 'Arial', fill: '#aaaaff'
    }).setOrigin(0.5);

    this.add.text(cx, cy + 110, 'Swipe on mobile', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#8888cc'
    }).setOrigin(0.5);

    const startBtn = this.add.rectangle(cx, cy + 170, 220, 56, 0xff6b6b)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 170, 'PLAY', {
      fontSize: '28px', fontFamily: 'Arial Black, Arial', fill: '#fff'
    }).setOrigin(0.5);

    const startGame = () => this.scene.start('Game');
    startBtn.on('pointerdown', startGame);
    this.input.keyboard.once('keydown-SPACE', startGame);
    this.input.keyboard.once('keydown-ENTER', startGame);
  }
}

// ─── Main game scene ──────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.score = 0;
    this.coins = 0;
    this.speed = BASE_SPEED;
    this.lane = 1;
    this.alive = true;
    this.canSwitch = true;
    this.touchStartY = 0;
    this.lastObstacle = 0;
    this.lastCoin = 0;
    this.lastBg = 0;
    this.bgObjects = [];
    this.obstaclePool = [];
    this.coinPool = [];

    this._buildBackground();
    this._buildLanes();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();

    // Gradually increase speed
    this.time.addEvent({
      delay: 4000,
      callback: () => { this.speed = Math.min(this.speed + 25, 700); },
      loop: true
    });
  }

  // ── Scene construction ──

  _buildBackground() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0f3460, 0x0f3460, 0x533483, 0x533483, 1);
    sky.fillRect(0, 0, W, H);

    // Distant horizon strip
    this.add.rectangle(W / 2, H - 30, W, 60, 0x1a1a2e);
  }

  _buildLanes() {
    // Three lane tracks
    const colors = [0x2d6a4f, 0x40916c, 0x2d6a4f];
    LANE_Y.forEach((y, i) => {
      // Track band
      this.add.rectangle(W / 2, y, W, 90, colors[i]).setAlpha(0.55);
      // Lane dividers (dashed feel via small rects — drawn as static decor)
      for (let x = 0; x < W; x += 80) {
        this.add.rectangle(x, y + 47, 40, 4, 0xffffff).setAlpha(0.08);
      }
    });
  }

  _buildPlayer() {
    // Body
    this.playerBody = this.add.rectangle(PLAYER_X, LANE_Y[1], 38, 58, 0xff6b9d);
    // Head
    this.playerHead = this.add.circle(PLAYER_X, LANE_Y[1] - 40, 18, 0xffcc99);
    // Eyes
    this.playerEyeL = this.add.circle(PLAYER_X - 7, LANE_Y[1] - 44, 4, 0x333333);
    this.playerEyeR = this.add.circle(PLAYER_X + 7, LANE_Y[1] - 44, 4, 0x333333);
    // Hair
    this.playerHair = this.add.rectangle(PLAYER_X, LANE_Y[1] - 54, 40, 12, 0x8b4513);

    // Group them for easy moving
    this.playerParts = [
      this.playerBody, this.playerHead,
      this.playerEyeL, this.playerEyeR, this.playerHair
    ];
    this.playerOffsets = [
      [0, 0], [0, -40], [-7, -44], [7, -44], [0, -54]
    ];

    // Physics hitbox (invisible, tracks player center)
    this.playerHitbox = this.add.rectangle(PLAYER_X, LANE_Y[1], 38, 58, 0xff0000, 0);
    this.physics.add.existing(this.playerHitbox, false);
    this.playerHitbox.body.setImmovable(true);
    this.playerHitbox.body.allowGravity = false;
  }

  _buildUI() {
    // Score panel
    this.add.rectangle(W - 90, 28, 160, 40, 0x000000, 0.5).setDepth(10);
    this.scoreTxt = this.add.text(W - 90, 28, 'Score: 0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#ffffff'
    }).setOrigin(0.5).setDepth(11);

    // Coin counter
    this.add.circle(W - 168, 28, 12, 0xffd700).setDepth(10);
    this.coinTxt = this.add.text(W - 152, 28, '0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#ffd700'
    }).setOrigin(0, 0.5).setDepth(11);
  }

  _buildControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);

    this.input.on('pointerdown', p => { this.touchStartY = p.y; });
    this.input.on('pointerup', p => {
      const dy = this.touchStartY - p.y;
      if (Math.abs(dy) > 35) this._switchLane(dy > 0 ? -1 : 1);
    });
  }

  // ── Lane switching ──

  _switchLane(dir) {
    if (!this.alive || !this.canSwitch) return;
    const next = Phaser.Math.Clamp(this.lane + dir, 0, 2);
    if (next === this.lane) return;

    this.lane = next;
    this.canSwitch = false;

    const targetY = LANE_Y[this.lane];
    this.tweens.add({
      targets: this.playerHitbox,
      y: targetY,
      duration: 130,
      ease: 'Power2',
      onComplete: () => { this.canSwitch = true; }
    });

    this.playerOffsets.forEach(([ox, oy], i) => {
      this.tweens.add({
        targets: this.playerParts[i],
        y: targetY + oy,
        duration: 130,
        ease: 'Power2'
      });
    });

    // Squish animation
    this.tweens.add({
      targets: this.playerBody,
      scaleX: 0.75, scaleY: 1.15,
      duration: 65, yoyo: true, ease: 'Power1'
    });
  }

  // ── Spawning ──

  _spawnObstacle(time) {
    const laneIndex = Phaser.Math.Between(0, 2);
    const y = LANE_Y[laneIndex];

    // Alternate obstacle shapes: tall crate vs wide barrier
    const isTall = Math.random() > 0.5;
    const w = isTall ? 44 : 80;
    const h = isTall ? 70 : 36;
    const color = isTall ? 0xe63946 : 0xf4a261;

    const obs = this.add.rectangle(W + 60, y, w, h, color);
    // add shine stripe
    this.add.rectangle(W + 60 - w / 2 + 10, y - h / 4, 6, h / 2, 0xffffff).setAlpha(0.25);

    this.physics.add.existing(obs, false);
    obs.body.setVelocityX(-this.speed);
    obs.body.allowGravity = false;
    obs.laneIndex = laneIndex;
    this.obstaclePool.push(obs);

    this.lastObstacle = time;
  }

  _spawnCoin(time) {
    const laneIndex = Phaser.Math.Between(0, 2);
    const y = LANE_Y[laneIndex];

    const coin = this.add.circle(W + 40, y, 14, 0xffd700);
    this.add.circle(W + 40 - 3, y - 3, 6, 0xffe066).setDepth(1);

    this.physics.add.existing(coin, false);
    coin.body.setVelocityX(-this.speed);
    coin.body.allowGravity = false;
    coin.laneIndex = laneIndex;
    this.coinPool.push(coin);

    this.lastCoin = time;
  }

  _spawnBgObject(time) {
    const y = Phaser.Utils.Array.GetRandom([60, 440]);
    const isBush = Math.random() > 0.4;
    let obj;
    if (isBush) {
      obj = this.add.circle(W + 30, y, Phaser.Math.Between(12, 24), 0x2d6a4f);
    } else {
      // Simple tree: trunk + canopy
      const trunk = this.add.rectangle(W + 30, y + 20, 12, 30, 0x6b4226);
      const canopy = this.add.circle(W + 30, y - 10, 22, 0x1b4332);
      obj = { x: W + 30, parts: [trunk, canopy] };
      obj.destroy = () => { trunk.destroy(); canopy.destroy(); };
    }
    obj._speed = this.speed * 0.45;
    this.bgObjects.push(obj);
    this.lastBg = time;
  }

  // ── Game Over ──

  _gameOver() {
    if (!this.alive) return;
    this.alive = false;
    this.physics.pause();

    // Flash red
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.35).setDepth(20);
    this.time.delayedCall(200, () => flash.destroy());

    // Panel
    this.add.rectangle(W / 2, H / 2, 420, 230, 0x000000, 0.85).setDepth(20);
    this.add.text(W / 2, H / 2 - 70, 'GAME OVER', {
      fontSize: '48px', fontFamily: 'Arial Black, Arial',
      fill: '#ff6b6b', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(21);

    this.add.text(W / 2, H / 2 - 5, `Score: ${Math.floor(this.score)}`, {
      fontSize: '28px', fontFamily: 'Arial', fill: '#ffffff'
    }).setOrigin(0.5).setDepth(21);

    this.add.text(W / 2, H / 2 + 35, `Coins: ${this.coins}`, {
      fontSize: '22px', fontFamily: 'Arial', fill: '#ffd700'
    }).setOrigin(0.5).setDepth(21);

    const restartBtn = this.add.rectangle(W / 2, H / 2 + 85, 200, 48, 0xff6b6b)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(W / 2, H / 2 + 85, 'PLAY AGAIN', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', fill: '#fff'
    }).setOrigin(0.5).setDepth(22);

    const restart = () => this.scene.restart();
    restartBtn.on('pointerdown', restart);
    this.time.delayedCall(400, () => {
      this.input.keyboard.once('keydown', restart);
    });
  }

  // ── Update loop ──

  update(time, delta) {
    if (!this.alive) return;

    // Score
    this.score += delta * 0.015;
    this.scoreTxt.setText('Score: ' + Math.floor(this.score));

    // Keyboard input
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wKey)) {
      this._switchLane(-1);
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.sKey)) {
      this._switchLane(1);
    }

    // Spawn timing — gap shrinks as speed grows
    const obstacleGap = Math.max(700, 1400 - this.speed);
    const coinGap = Math.max(500, 900 - this.speed * 0.3);

    if (time - this.lastObstacle > obstacleGap) this._spawnObstacle(time);
    if (time - this.lastCoin > coinGap) this._spawnCoin(time);
    if (time - this.lastBg > 600) this._spawnBgObject(time);

    // Update bg object positions manually (no physics)
    for (let i = this.bgObjects.length - 1; i >= 0; i--) {
      const obj = this.bgObjects[i];
      if (obj.parts) {
        obj.parts.forEach(p => { p.x -= obj._speed * (delta / 1000); });
        if (obj.parts[0].x < -60) { obj.destroy(); this.bgObjects.splice(i, 1); }
      } else {
        obj.x -= obj._speed * (delta / 1000);
        if (obj.x < -60) { obj.destroy(); this.bgObjects.splice(i, 1); }
      }
    }

    // Check obstacles
    for (let i = this.obstaclePool.length - 1; i >= 0; i--) {
      const obs = this.obstaclePool[i];
      if (!obs.active) { this.obstaclePool.splice(i, 1); continue; }

      // Update velocity in case speed changed
      if (obs.body) obs.body.setVelocityX(-this.speed);

      if (obs.x < -80) {
        obs.destroy(); this.obstaclePool.splice(i, 1); continue;
      }

      if (overlap(this.playerHitbox, obs)) {
        this._gameOver(); return;
      }
    }

    // Check coins
    for (let i = this.coinPool.length - 1; i >= 0; i--) {
      const coin = this.coinPool[i];
      if (!coin.active) { this.coinPool.splice(i, 1); continue; }

      if (coin.body) coin.body.setVelocityX(-this.speed);

      if (coin.x < -60) {
        coin.destroy(); this.coinPool.splice(i, 1); continue;
      }

      // Coin collect — simple distance check
      const dx = coin.x - this.playerHitbox.x;
      const dy = coin.y - this.playerHitbox.y;
      if (Math.sqrt(dx * dx + dy * dy) < 36) {
        this.coins++;
        this.coinTxt.setText(this.coins);
        this._coinPop(coin.x, coin.y);
        coin.destroy(); this.coinPool.splice(i, 1);
      }
    }
  }

  _coinPop(x, y) {
    const txt = this.add.text(x, y, '+1', {
      fontSize: '20px', fontFamily: 'Arial Black', fill: '#ffd700'
    }).setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: txt,
      y: y - 50, alpha: 0, duration: 600, ease: 'Power2',
      onComplete: () => txt.destroy()
    });
  }
}

// ─── Game config ─────────────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#0f3460',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
