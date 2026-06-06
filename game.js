// ─── Constants ───────────────────────────────────────────────────────────────

const W = 400;
const H = 700;
const LANE_X = [100, 200, 300];   // left / center / right lane x-positions
const PLAYER_Y = 580;
const BASE_SPEED = 340;

// ─── Boot / title screen ─────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const cx = W / 2, cy = H / 2;

    const sky = this.add.graphics();
    sky.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x533483, 0x533483, 1);
    sky.fillRect(0, 0, W, H);

    this.add.text(cx, cy - 120, "Sofia's", {
      fontSize: '52px', fontFamily: 'Arial Black, Arial',
      fill: '#ffd700', stroke: '#b8860b', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(cx, cy - 55, 'Endless Runner', {
      fontSize: '28px', fontFamily: 'Arial',
      fill: '#ffffff', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(cx, cy + 20, '← → or A D to switch lanes', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#aaaaff'
    }).setOrigin(0.5);

    this.add.text(cx, cy + 48, 'Swipe left / right on mobile', {
      fontSize: '15px', fontFamily: 'Arial', fill: '#8888cc'
    }).setOrigin(0.5);

    const btn = this.add.rectangle(cx, cy + 130, 200, 54, 0xff6b6b)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 130, 'PLAY', {
      fontSize: '28px', fontFamily: 'Arial Black, Arial', fill: '#fff'
    }).setOrigin(0.5);

    // Start menu music on first interaction (browser requires user gesture)
    const startMusic = () => audio.playMenu();
    this.input.once('pointerdown', startMusic);
    this.input.keyboard.once('keydown', startMusic);

    const go = () => { audio.stop(); this.scene.start('Game'); };
    btn.on('pointerdown', go);
    this.input.keyboard.once('keydown-SPACE', go);
    this.input.keyboard.once('keydown-ENTER', go);
  }
}

// ─── Main game scene ──────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.score = 0;
    this.coins = 0;
    this.speed = BASE_SPEED;
    this.lane = 1;           // 0=left 1=center 2=right
    this.alive = true;
    this.canSwitch = true;
    this.touchStartX = 0;
    this.lastObstacle = 0;
    this.lastCoin = 0;
    this.lastBg = 0;
    this.bgTiles = [];
    this.obstacles = [];
    this.coinPool = [];

    this._buildBackground();
    this._buildLanes();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();

    audio.playGame();

    this.time.addEvent({
      delay: 4000,
      callback: () => { this.speed = Math.min(this.speed + 20, 680); },
      loop: true
    });
  }

  // ── Background ──

  _buildBackground() {
    // Sky gradient
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0f3460, 0x0f3460, 0x533483, 0x533483, 1);
    sky.fillRect(0, 0, W, H);

    // Scrolling road tiles
    for (let y = 0; y < H + 100; y += 100) {
      const tile = this.add.rectangle(W / 2, y, W, 100, 0x1a1a2e).setAlpha(0);
      this.bgTiles.push({ obj: tile, y });
    }

    // Road surface
    this.add.rectangle(W / 2, H / 2, W, H, 0x2c2c3e).setAlpha(0.6);
  }

  _buildLanes() {
    // Lane dividers (dashed lines scrolling down)
    this.dividers = [];
    [150, 250].forEach(x => {
      for (let y = 0; y < H + 40; y += 60) {
        const dash = this.add.rectangle(x, y, 4, 28, 0xffffff).setAlpha(0.18);
        this.dividers.push(dash);
      }
    });

    // Side borders
    this.add.rectangle(50, H / 2, 4, H, 0x666699).setAlpha(0.5);
    this.add.rectangle(350, H / 2, 4, H, 0x666699).setAlpha(0.5);
  }

  _buildPlayer() {
    const x = LANE_X[1], y = PLAYER_Y;

    this.pBody  = this.add.rectangle(x, y,      34, 52, 0xff6b9d).setDepth(5);
    this.pHead  = this.add.circle(x, y - 38,    17, 0xffcc99).setDepth(5);
    this.pHair  = this.add.rectangle(x, y - 50, 38, 12, 0x8b4513).setDepth(5);
    this.pEyeL  = this.add.circle(x - 6, y - 41, 4, 0x333333).setDepth(5);
    this.pEyeR  = this.add.circle(x + 6, y - 41, 4, 0x333333).setDepth(5);

    this.pParts   = [this.pBody, this.pHead, this.pHair, this.pEyeL, this.pEyeR];
    this.pOffsets = [[0,0],[0,-38],[0,-50],[-6,-41],[6,-41]];

    // Physics hitbox
    this.hitbox = this.add.rectangle(x, y, 34, 52, 0xff0000, 0).setDepth(5);
    this.physics.add.existing(this.hitbox, false);
    this.hitbox.body.setImmovable(true);
    this.hitbox.body.allowGravity = false;
  }

  _buildUI() {
    // Top bar background
    this.add.rectangle(W / 2, 28, W, 48, 0x000000, 0.55).setDepth(10);

    this.scoreTxt = this.add.text(W / 2, 28, 'Score: 0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#fff'
    }).setOrigin(0.5).setDepth(11);

    this.add.circle(24, 28, 12, 0xffd700).setDepth(10);
    this.coinTxt = this.add.text(42, 28, '0', {
      fontSize: '20px', fontFamily: 'Arial', fill: '#ffd700'
    }).setOrigin(0, 0.5).setDepth(11);
  }

  _buildControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.input.on('pointerdown', p => { this.touchStartX = p.x; });
    this.input.on('pointerup', p => {
      const dx = p.x - this.touchStartX;
      if (Math.abs(dx) > 30) this._switchLane(dx > 0 ? 1 : -1);
    });
  }

  // ── Lane switch ──

  _switchLane(dir) {
    if (!this.alive || !this.canSwitch) return;
    const next = Phaser.Math.Clamp(this.lane + dir, 0, 2);
    if (next === this.lane) return;
    this.lane = next;
    this.canSwitch = false;

    audio.switchLane();

    const tx = LANE_X[this.lane];
    this.tweens.add({
      targets: this.hitbox, x: tx, duration: 130, ease: 'Power2',
      onComplete: () => { this.canSwitch = true; }
    });
    this.pOffsets.forEach(([ox, oy], i) => {
      this.tweens.add({ targets: this.pParts[i], x: tx + ox, duration: 130, ease: 'Power2' });
    });
    this.tweens.add({
      targets: this.pBody, scaleY: 0.78, scaleX: 1.18,
      duration: 65, yoyo: true, ease: 'Power1'
    });
  }

  // ── Spawning ──

  _spawnObstacle(time) {
    const laneIndex = Phaser.Math.Between(0, 2);
    const x = LANE_X[laneIndex];
    const isTall = Math.random() > 0.5;
    const ow = isTall ? 40 : 72, oh = isTall ? 64 : 32;
    const color = isTall ? 0xe63946 : 0xf4a261;

    const obs = this.add.rectangle(x, -60, ow, oh, color).setDepth(4);
    this.add.rectangle(x - ow / 2 + 8, -60 - oh / 4, 5, oh / 2, 0xffffff)
      .setAlpha(0.22).setDepth(4);

    this.physics.add.existing(obs, false);
    obs.body.setVelocityY(this.speed);
    obs.body.allowGravity = false;
    this.obstacles.push(obs);
    this.lastObstacle = time;
  }

  _spawnCoin(time) {
    const laneIndex = Phaser.Math.Between(0, 2);
    const coin = this.add.circle(LANE_X[laneIndex], -30, 14, 0xffd700).setDepth(4);
    this.physics.add.existing(coin, false);
    coin.body.setVelocityY(this.speed);
    coin.body.allowGravity = false;
    this.coinPool.push(coin);
    this.lastCoin = time;
  }

  // ── Game over ──

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
      fill: '#ff6b6b', stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, H / 2 - 15, `Score: ${Math.floor(this.score)}`, {
      fontSize: '26px', fontFamily: 'Arial', fill: '#fff'
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W / 2, H / 2 + 25, `Coins: ${this.coins}`, {
      fontSize: '22px', fontFamily: 'Arial', fill: '#ffd700'
    }).setOrigin(0.5).setDepth(21);

    const btn = this.add.rectangle(W / 2, H / 2 + 90, 190, 50, 0xff6b6b)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(W / 2, H / 2 + 90, 'PLAY AGAIN', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', fill: '#fff'
    }).setOrigin(0.5).setDepth(22);

    const restart = () => { audio.playGame(); this.scene.restart(); };
    btn.on('pointerdown', restart);
    this.time.delayedCall(400, () => this.input.keyboard.once('keydown', restart));
  }

  // ── Update ──

  update(time, delta) {
    if (!this.alive) return;

    this.score += delta * 0.015;
    this.scoreTxt.setText('Score: ' + Math.floor(this.score));

    // Input
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.aKey)) {
      this._switchLane(-1);
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.dKey)) {
      this._switchLane(1);
    }

    // Scroll lane dividers downward for motion feel
    this.dividers.forEach(d => {
      d.y += this.speed * (delta / 1000);
      if (d.y > H + 20) d.y -= H + 60;
    });

    // Spawn
    const obsGap = Math.max(650, 1300 - this.speed);
    const coinGap = Math.max(450, 800 - this.speed * 0.3);
    if (time - this.lastObstacle > obsGap) this._spawnObstacle(time);
    if (time - this.lastCoin > coinGap) this._spawnCoin(time);

    // Update obstacle speeds + check collision/cleanup
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (!obs.active) { this.obstacles.splice(i, 1); continue; }
      if (obs.body) obs.body.setVelocityY(this.speed);
      if (obs.y > H + 80) { obs.destroy(); this.obstacles.splice(i, 1); continue; }

      const ab = this.hitbox.getBounds(), bb = obs.getBounds();
      ab.x += 8; ab.width -= 16; ab.y += 8; ab.height -= 16;
      bb.x += 6; bb.width -= 12; bb.y += 6; bb.height -= 12;
      if (Phaser.Geom.Intersects.RectangleToRectangle(ab, bb)) {
        this._gameOver(); return;
      }
    }

    // Coins
    for (let i = this.coinPool.length - 1; i >= 0; i--) {
      const coin = this.coinPool[i];
      if (!coin.active) { this.coinPool.splice(i, 1); continue; }
      if (coin.body) coin.body.setVelocityY(this.speed);
      if (coin.y > H + 40) { coin.destroy(); this.coinPool.splice(i, 1); continue; }

      const dx = coin.x - this.hitbox.x, dy = coin.y - this.hitbox.y;
      if (Math.sqrt(dx * dx + dy * dy) < 36) {
        this.coins++;
        this.coinTxt.setText(this.coins);
        audio.coin();
        this._coinPop(coin.x, coin.y);
        coin.destroy(); this.coinPool.splice(i, 1);
      }
    }
  }

  _coinPop(x, y) {
    const t = this.add.text(x, y, '+1', {
      fontSize: '20px', fontFamily: 'Arial Black', fill: '#ffd700'
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 55, alpha: 0, duration: 600, ease: 'Power2',
      onComplete: () => t.destroy()
    });
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#0f3460',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [BootScene, GameScene],
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  }
};

new Phaser.Game(config);
