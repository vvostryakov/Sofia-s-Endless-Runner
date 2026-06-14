import {
  W, H, DPR,
  JUMP_INIT, GRAVITY, WAGON_TOP, WAGON_LENGTH, WAGON_LANDING_GRACE,
  BASE_SPEED, MAX_SPEED, TOUCH_THRESHOLD,
  SCORE_PER_SECOND, COIN_SCORE, SHIELD_SCORE, MAGNET_SCORE, SLIDE_DURATION,
  MAGNET_DURATION, DOUBLE_JUMP_INIT, SAFE_START_MS,
  RHYTHM_APPROACH_BEATS, RHYTHM_BEAT_WINDOW_MS, RHYTHM_LANES,
  LANE_SIDE, saveNumber, loadNumber, bestKeys, vibrate,
} from '../constants.js';
import {
  setupHiDPI, NEAR_Y, HORIZON_Y, SPAWN_Z, TRACK_NEAR_HW,
  COLLECTION_RADIUS, PLAYER_ANCHOR_Y, PLAYER_DRAW_SCALE,
  TIE_SPACING, zT, zY, zSc, zTopY, tY, centerX, fogAt, cam3,
} from '../projection.js';
import {
  WORLDS, WORLD_SCORE, bdJungle, bdSavanna, bdReef, bdDeep,
  drawWorldWall, drawWorldScenery,
} from '../worlds.js';
import { audio, unlockAudio, RHYTHM_TRACK_INFO } from '../audio.js';
import { equippedOutfit, addToWallet, getWallet } from '../cosmetics.js';
import { drawRunner } from '../runner.js';
import { difficultyAt, speedAt, levelAt, spawnGapRange } from '../engine/difficulty.js';
import { clampLane, isAirborne, lanesOverlap, withinReach } from '../engine/grid.js';
import * as UI from '../ui.js';

// Blend two 0xRRGGBB colours; t=0 → a, t=1 → b
const mixColor = (a, b, t) => {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

// ─── Game scene ───────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    this.rhythmMode = data.rhythmMode === true;
    this.rhythmTrack = RHYTHM_TRACK_INFO[data.rhythmTrack] ? data.rhythmTrack : 'classic';
    this.rhythmBpm = RHYTHM_TRACK_INFO[this.rhythmTrack].bpm;
    this.beatMs = 60000 / this.rhythmBpm;
    this.approachMs = this.beatMs * RHYTHM_APPROACH_BEATS;
  }

  create() {
    // Clear references to display objects from a previous run of this scene —
    // after scene.restart they point at destroyed objects and must not be used.
    this.hitLineG = null;
    this.hitLineGlow = null;
    this.beatHalo = null;
    this.camBase = setupHiDPI(this);
    this.cameras.main.setRotation(0);
    this.cam = { x: 0, vel: 0, lean: 0, dip: 0, dipVel: 0 };
    this.roadSegsX = [];
    this.roadSegsY = [];
    this.roadScheduledX = 0;
    this.roadScheduledY = 0;
    this.lastTurnDir = 0;
    this.roadLean = 0;
    this.farX = 0;
    this.farY = 0;
    cam3.x = 0;
    cam3.curve = null;
    this.landSquash = 0;
    this.flipT = 0;
    this.lastNearMiss = 0;
    this.nextArchDist = 1600;
    this.speed = BASE_SPEED;
    this.worldIdx   = 0;
    this.worldNext  = WORLD_SCORE;
    this._worldGfx  = [];
    this.worldScenery = [];
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
    this.slideHoldMs = 0;
    this._slideTouchHold = false;
    this._touchHeld = false;
    this.inputBuffer = null;
    this.jumpsUsed = 0;
    this.level = 1;
    this.nextRhythmBeat = RHYTHM_APPROACH_BEATS;
    this.lastBeatPulse = -1;
    this.musicTime = 0;
    this.rhythmStats = { perfect: 0, good: 0, off: 0, miss: 0 };
    this.chaseT = 0;
    this._lastHeartbeat = 0;
    this.beatPulse = 0;
    this.collectPulse = 0;
    this.playerBounce = 0;
    this.footstepPulse = 0;

    this.pLane = 1;
    this.pX = this._laneXZ(1, 0);
    this.jumpH = 0;
    this.jumpVel = 0;
    this.riding = false;

    this.gameObjs = [];
    this._pools = { gfx: [], circle: [], ellipse: [], rect: [] };

    this._updateCurveMap(); // seed the road tables before anything draws
    this._buildBg();
    this._buildWorldLayer();
    this._buildTrack();
    this._buildHitLine();
    this._buildSpeedLines();
    this._buildPlayer();
    UI.showHUD({
      rhythm: this.rhythmMode,
      bpm: this.rhythmBpm,
      onPause: () => this._togglePause(),
    });
    UI.setWorld(WORLDS[this.worldIdx]);
    this._buildControls();
    if (!this.rhythmMode) this._scheduleNextSpawn(900);

    this.chaserG = this.add.graphics().setDepth(6.4);
    if (this.rhythmMode) {
      // Music layers follow the combo: hats join warm, the arp joins hot
      audio.setIntensityCallback(() => (this.combo >= 4 ? 2 : this.combo >= 2 ? 1 : 0));
      audio.playRhythm(this.rhythmTrack);
    } else {
      audio.playGame();
    }
    this._showCountdown();

    // Auto-pause when the tab is hidden or the window loses focus
    this._onVisibility = () => {
      if (document.hidden && this.alive && !this.pausedRun) this._togglePause();
    };
    this._onBlur = () => { if (this.alive && !this.pausedRun) this._togglePause(); };
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('blur', this._onBlur);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this._onVisibility);
      window.removeEventListener('blur', this._onBlur);
      audio.setIntensityCallback(null);
    });
  }

  // ── World visual layer (backdrop + scenery, rebuilt on world change) ─────────

  _buildWorldLayer() {
    this._worldGfx.forEach(g => g.destroy()); this._worldGfx = [];
    this.worldScenery.forEach(s => s.gfx.destroy()); this.worldScenery = [];
    const w = WORLDS[this.worldIdx];
    this._buildWorldBackdrop(w);
    this._buildWorldScenery(w);
    this._refreshWorldBanner();
  }

  _regW(gfx) { this._worldGfx.push(gfx); return gfx; }

  _buildWorldBackdrop(w) {
    const g = this._regW(this.add.graphics().setDepth(0));
    this.bdG = g; // drifts sideways with track turns for horizon parallax
    const mid = HORIZON_Y * 0.55;
    // Overscan top/bottom: the whole backdrop shifts with the hill bend
    g.fillGradientStyle(w.sky[0],w.sky[0],w.sky[1],w.sky[1],1);
    g.fillRect(-60,-44,W+120,mid+44);
    g.fillGradientStyle(w.sky[1],w.sky[1],w.sky[2],w.sky[2],1);
    g.fillRect(-60,mid,W+120,H-mid+44);

    if      (w.id==='jungle')  bdJungle(g, w);
    else if (w.id==='savanna') bdSavanna(g, w);
    else if (w.id==='reef')    bdReef(g, w);
    else                       bdDeep(g, w);
  }

  _buildWorldScenery(w) {
    const spacing = SPAWN_Z / 7;
    for(let i=0;i<7;i++){
      [-1,1].forEach((side,k)=>{
        this.worldScenery.push({
          kind:'tree',
          gfx:this._regW(this.add.graphics().setDepth(3.8)),
          z: i*spacing + (((i*53+k*29)%37)/37 - 0.5)*spacing*0.7,
          side,
          jitter: ((i*31+k*17)%23)/23,
        });
      });
    }
    // Low filler wall hugging the track edge so the sides never look empty
    const wallSpacing = SPAWN_Z / 13;
    for(let i=0;i<13;i++){
      [-1,1].forEach((side,k)=>{
        this.worldScenery.push({
          kind:'wall',
          gfx:this._regW(this.add.graphics().setDepth(3.6)),
          z: i*wallSpacing + (((i*41+k*19)%29)/29 - 0.5)*wallSpacing*0.5,
          side,
          jitter: ((i*37+k*13)%19)/19,
        });
      });
    }
  }

  _updateWorldScenery(dt) {
    const w = WORLDS[this.worldIdx];
    for(const s of this.worldScenery){
      s.z -= this.speed*dt;
      if(s.z < -60){ s.z += SPAWN_Z; s.jitter = Math.random(); }
      const t = zT(s.z);
      const sc = zSc(s.z) * (0.85 + s.jitter*0.4);
      if(sc<0.09){ s.gfx.clear(); continue; }
      const y = zY(s.z);
      const hw = this._trackHalfWidth(t);
      s.gfx.clear();
      s.gfx.setAlpha(1 - fogAt(s.z) * 0.88);
      if(s.kind==='wall'){
        const sideX = this._curveCenterX(t) + s.side * (hw + (7 + s.jitter*8) * sc);
        drawWorldWall(s.gfx,w,sideX,y,sc,s.side,s.jitter);
        s.gfx.setDepth(3.6+t*0.1);
      } else {
        const sideX = this._curveCenterX(t) + s.side * (hw + (24 + s.jitter*36) * sc);
        drawWorldScenery(s.gfx,w,sideX,y,sc,s.side,t);
        s.gfx.setDepth(3.8+t*0.1);
      }
    }
  }

  _tryAdvanceWorld() {
    if(this.worldIdx>=WORLDS.length-1||this.score<this.worldNext) return;
    this.worldIdx++; this.worldNext+=WORLD_SCORE;
    this._buildWorldLayer();
    UI.worldBanner(WORLDS[this.worldIdx]);
    audio.powerUp();
  }

  _refreshWorldBanner() {
    UI.setWorld(WORLDS[this.worldIdx]);
  }

  // ── Static background ───────────────────────────────────────────────────────
  _buildBg() {
    // World backdrop (depth 0) provides sky + ground; only keep the combo flash overlay
    this.lightPulse = this.add.rectangle(W / 2, H / 2, W, H, 0x00e5ff, 0).setDepth(0.8);
    // Mid-ground parallax silhouettes between backdrop and track
    this.parallaxG = this.add.graphics().setDepth(0.9);
    // Horizon fog band over the far track, under nearer scenery
    this.atmosG = this.add.graphics().setDepth(3.0);
  }

  // Stitches backdrop and field into one continuous scene. Two layers of
  // rolling hills sit ON the horizon and are tinted toward the haze colour;
  // a soft haze band then straddles the horizon so the far field, the hills
  // and the lower sky all melt together with no hard seam anywhere.
  _updateAtmosphere() {
    const w = WORLDS[this.worldIdx];
    const hy = HORIZON_Y + this.farY;
    const haze = w.sky[2];
    const g = this.parallaxG;
    g.clear();
    const layers = [
      { speed: 0.016, color: mixColor(w.sky[1], haze, 0.55), alpha: 0.5, h: 36, spacing: 152, seedK: 47, drift: 0.5 },
      { speed: 0.038, color: mixColor(w.sky[0], haze, 0.32), alpha: 0.7, h: 22, spacing: 104, seedK: 31, drift: 0.92 },
    ];
    for (const L of layers) {
      g.fillStyle(L.color, L.alpha);
      const scroll = this.distance * L.speed - this.farX * L.drift;
      const first = Math.floor(scroll / L.spacing);
      for (let k = first - 1; k < first + Math.ceil(W / L.spacing) + 2; k++) {
        const x = k * L.spacing - scroll;
        const jit = Math.abs((k * L.seedK) % 7);
        g.fillEllipse(x, hy + 12, L.spacing * 1.5, (L.h + jit * 5) * 2);
      }
    }
    // Haze band centred on the horizon: rises into the sky and spills well
    // onto the field, peaking right at the seam so the field's leading edge
    // dissolves rather than reading as a bright green line.
    const a = this.atmosG;
    a.clear();
    // sky side: transparent up → haze at horizon
    a.fillGradientStyle(haze, haze, haze, haze, 0, 0, 0.72, 0.72);
    a.fillRect(-10, hy - 74, W + 20, 74);
    // intense core right on the seam hides the field's leading edge entirely
    a.fillGradientStyle(haze, haze, haze, haze, 0.92, 0.92, 0.42, 0.42);
    a.fillRect(-10, hy, W + 20, 46);
    // long soft tail spilling down the field
    a.fillGradientStyle(haze, haze, haze, haze, 0.42, 0.42, 0, 0);
    a.fillRect(-10, hy + 46, W + 20, 96);
  }

  _trackHalfWidth(t) {
    // Slight FOV widening with speed sells acceleration without moving the camera
    const speedFrac = this.speed ? (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) : 0;
    const boost = 1 + speedFrac * 0.08 * Math.min(Phaser.Math.Clamp(t, 0, 1.5), 1);
    return TRACK_NEAR_HW * Phaser.Math.Clamp(t, 0, 1.5) * boost;
  }

  _curveCenterX(t) {
    return centerX(t);
  }

  // The player's current fractional lane derived from her on-screen position,
  // not the instantly-snapped target pLane. Collisions, roof-riding and coin
  // pickup all key off this so the hitbox matches where she is actually drawn.
  _playerLaneF() {
    const center = this._curveCenterX(1); // player plane, z=0 → t=1
    const hw = this._trackHalfWidth(1);
    return 1 + (this.pX - center) / (hw * 0.667);
  }

  _laneXZ(lane, z) {
    // (lane - 1) === LANE_SIDE[lane] for whole lanes, and supports fractional
    // lanes for drifting obstacles.
    const t = zT(z);
    return this._curveCenterX(t) + (lane - 1) * this._trackHalfWidth(t) * 0.667;
  }

  // ── Road map: turns and hills anchored to world distance ───────────────────
  // Curve segments are scheduled ahead in world space and sampled into a
  // screen-offset table each frame. Because the road's shape lives in the
  // world, the already-drawn path never morphs: turns appear at the horizon,
  // sweep toward the player, and flatten out exactly as she reaches them.
  _scheduleRoad() {
    const horizon = this.distance + SPAWN_Z * 2.2;
    while (this.roadScheduledX < horizon) {
      const start = this.roadScheduledX + Phaser.Math.Between(420, 1700);
      const len = Phaser.Math.Between(950, 1750);
      const dir = this.lastTurnDir === 0
        ? (Math.random() < 0.5 ? -1 : 1)
        : (Math.random() < 0.74 ? -this.lastTurnDir : this.lastTurnDir);
      this.lastTurnDir = dir;
      this.roadSegsX.push({ start, end: start + len, mag: Phaser.Math.FloatBetween(0.16, 0.3) * dir });
      this.roadScheduledX = start + len;
    }
    while (this.roadScheduledY < horizon) {
      const start = this.roadScheduledY + Phaser.Math.Between(900, 2600);
      const len = Phaser.Math.Between(1100, 2000);
      this.roadSegsY.push({ start, end: start + len, mag: Phaser.Math.FloatBetween(-0.11, 0.15) });
      this.roadScheduledY = start + len;
    }
    while (this.roadSegsX.length && this.roadSegsX[0].end < this.distance - 50) this.roadSegsX.shift();
    while (this.roadSegsY.length && this.roadSegsY[0].end < this.distance - 50) this.roadSegsY.shift();
  }

  _roadSlope(segs, d) {
    for (const s of segs) {
      if (d >= s.start && d <= s.end) {
        return s.mag * Math.sin(((d - s.start) / (s.end - s.start)) * Math.PI);
      }
    }
    return 0;
  }

  _updateCurveMap() {
    this._scheduleRoad();
    const N = 36;
    const dz = (SPAWN_Z * 1.2) / (N - 1);
    if (!this._tableX) {
      this._tableX = new Float32Array(N);
      this._tableY = new Float32Array(N);
    }
    let accX = 0;
    let accY = 0;
    this._tableX[0] = 0;
    this._tableY[0] = 0;
    for (let i = 1; i < N; i++) {
      const mid = this.distance + (i - 0.5) * dz;
      accX += this._roadSlope(this.roadSegsX, mid) * dz;
      accY += this._roadSlope(this.roadSegsY, mid) * dz;
      const p = zT(i * dz);
      this._tableX[i] = accX * p;
      this._tableY[i] = -accY * p; // elevation up → screen up
    }
    cam3.curve = { dz, x: this._tableX, y: this._tableY };
    this.farX = this._tableX[N - 1];
    this.farY = this._tableY[N - 1];
    // Lean into the curvature just ahead of her
    this.roadLean = this._roadSlope(this.roadSegsX, this.distance + 300);
  }

  _updateCamera(dt) {
    // Critically-damped spring chasing 80% of the player's lane offset, so the
    // runner rests slightly off-center and the world slides on lane changes.
    const target = LANE_SIDE[this.pLane] * TRACK_NEAR_HW * 0.667 * 0.8;
    this.cam.vel += ((target - this.cam.x) * 70 - this.cam.vel * 16) * dt;
    this.cam.x += this.cam.vel * dt;
    cam3.x = this.cam.x;

    // Roll into the strafe and into the road's curvature just ahead
    const leanTarget = Phaser.Math.Clamp(this.cam.vel * 0.00035 + this.roadLean * 0.32, -0.055, 0.055);
    this.cam.lean += (leanTarget - this.cam.lean) * Math.min(1, dt * 9);

    // Landing dip spring (kicked by _onLand)
    this.cam.dipVel += (-this.cam.dip * 90 - this.cam.dipVel * 11) * dt;
    this.cam.dip += this.cam.dipVel * dt;

    const cm = this.cameras.main;
    cm.setRotation(this.cam.lean);
    cm.setScroll(this.camBase.x, this.camBase.y - this.cam.dip - this.jumpH * 0.05);
  }

  _onLand() {
    this.cam.dipVel = -170;
    this.landSquash = 1;
    this._dustPuff(this.pX, PLAYER_ANCHOR_Y + 2);
    audio.land();
    this._consumeBufferedInput();
  }

  _dustPuff(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const puff = this._pCircle(0xcfd8dc, 0.4, 6.5)
        .setPosition(x + Phaser.Math.FloatBetween(-14, 14), y)
        .setRadius(Phaser.Math.FloatBetween(2.5, 5));
      this.tweens.add({
        targets: puff,
        x: puff.x + Phaser.Math.FloatBetween(-26, 26),
        y: y - Phaser.Math.FloatBetween(4, 16),
        scale: 0.2,
        alpha: 0,
        duration: Phaser.Math.Between(240, 420),
        ease: 'Quad.easeOut',
        onComplete: () => this._releaseObj(puff),
      });
    }
  }

  _buildTrack() {
    this.horizonG = this.add.graphics().setDepth(1);
    this.trackG = this.add.graphics().setDepth(2);
    this._redrawTrack();
  }

  _buildHitLine() {
    // The collection-field rings are a rhythm-mode timing aid; in the normal
    // endless run they were just visual clutter around the player.
    if (!this.rhythmMode) return;
    this.beatHalo = this.add.circle(W / 2, PLAYER_ANCHOR_Y - 40, COLLECTION_RADIUS, 0xfff176, 0.08).setStrokeStyle(3, 0xfff176, 0.45).setDepth(16);
    this.hitLineG = this.add.graphics().setDepth(18);
    this.hitLineGlow = this.add.rectangle(W / 2, PLAYER_ANCHOR_Y - 40, W, 1, 0x00e5ff, 0.08).setDepth(17);
    this._redrawHitLine();
  }

  _redrawHitLine() {
    if (!this.hitLineG) return;
    const g = this.hitLineG;
    g.clear();
    const pulse = this.beatPulse || 0;
    const collectPulse = this.collectPulse || 0;
    const playerX = this.pX || this._laneXZ(this.pLane || 1, 0);
    const fieldY = PLAYER_ANCHOR_Y - 40;
    const fieldR = COLLECTION_RADIUS + pulse * 8 + collectPulse * 16;

    this.hitLineGlow.setPosition(playerX, fieldY).setSize(fieldR * 2.2, fieldR * 2.2)
      .setAlpha(0.05 + pulse * 0.08 + collectPulse * 0.08);

    g.lineStyle(12, 0xfff176, 0.04 + pulse * 0.04 + collectPulse * 0.05);
    g.strokeCircle(playerX, fieldY, fieldR + 8);
    g.lineStyle(3 + collectPulse * 3, 0xfff176, 0.44 + pulse * 0.28 + collectPulse * 0.34);
    g.strokeCircle(playerX, fieldY, fieldR);
    g.lineStyle(2, 0x00e5ff, 0.24 + collectPulse * 0.3);
    g.strokeCircle(playerX, fieldY, fieldR * 0.72);
  }

  _buildSpeedLines() {
    this.speedLines = [];
    for (let i = 0; i < 12; i++) {
      this.speedLines.push({
        gfx: this.add.graphics().setDepth(3.2),
        side: i % 2 === 0 ? -1 : 1,
        z: Math.random() * SPAWN_Z,
        angleJitter: Phaser.Math.FloatBetween(-0.2, 0.2),
      });
    }
  }

  _updateSpeedLines(dt) {
    if (!this.speedLines) return;
    const w = WORLDS[this.worldIdx];
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    for (const l of this.speedLines) {
      l.z -= this.speed * dt * 1.45;
      if (l.z < -40) l.z += SPAWN_Z;
      const z2 = l.z;
      const z1 = z2 + 90 + this.speed * 0.1;
      const t = zT(z2), t1 = zT(z1);
      const y = zY(z2), y1 = zY(z1);
      const outset = (22 + Math.abs(l.angleJitter) * 28);
      const x2 = this._curveCenterX(t) + l.side * (this._trackHalfWidth(t) + outset * zSc(z2));
      const x1 = this._curveCenterX(t1) + l.side * (this._trackHalfWidth(t1) + outset * zSc(z1));
      const alpha = 0.05 + t * 0.22 + (this.beatPulse || 0) * 0.12 + comboEnergy * 0.08;
      l.gfx.clear();
      l.gfx.lineStyle(Math.max(1, t * (4 + comboEnergy * 2)), w.accent, alpha * 0.55);
      l.gfx.beginPath();
      l.gfx.moveTo(x1, y1);
      l.gfx.lineTo(x2, y);
      l.gfx.strokePath();
    }
  }


  _redrawTrack() {
    const g = this.trackG;
    const hg = this.horizonG;
    g.clear();
    hg.clear();
    const w = WORLDS[this.worldIdx];
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    const segments = 24;
    const tMin = zT(SPAWN_Z * 1.15);
    const tMax = 1.45; // road continues past the player to the screen bottom

    // Build left/right/lane edge arrays, sampled uniformly in screen space
    const left = [], right = [], lane1 = [], lane2 = [];
    for (let i = 0; i <= segments; i++) {
      const t = tMin + (i / segments) * (tMax - tMin);
      const y = tY(t);
      const cx = this._curveCenterX(t);
      const hw = this._trackHalfWidth(t);
      left.push({ x: cx - hw, y });
      right.push({ x: cx + hw, y });
      lane1.push({ x: cx - hw * 0.333, y });
      lane2.push({ x: cx + hw * 0.333, y });
    }

    const strokeLine = (points, width, color, alpha) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
      g.strokePath();
    };

    // Ground fill: extends to screen bottom so the camera-floor wraps the
    // player; the top edge follows the road elevation so crests rise against
    // the sky. The far colour blends toward the sky so field and backdrop
    // melt together instead of meeting at a hard line.
    const groundTop = HORIZON_Y + Math.min(0, this.farY) - 2;
    // Far edge melts toward the horizon haze so the top of the field reads as
    // the same atmosphere as the sky, not a separate green slab.
    const farBlend = mixColor(w.grd.far, w.sky[2], 0.66);
    g.fillGradientStyle(farBlend, farBlend, w.grd.near, w.grd.near, 1);
    g.fillRect(0, groundTop, W, H - groundTop);

    // Track surface: alternating tie quads locked to world distance, so the
    // ground scrolls in exactly the same z-space as obstacles and coins.
    const firstTile = Math.floor(this.distance / TIE_SPACING);
    const tileCount = Math.ceil(SPAWN_Z * 1.2 / TIE_SPACING) + 1;
    for (let k = -1; k < tileCount; k++) {
      const tile = firstTile + k;
      const z0 = Math.max(-130, tile * TIE_SPACING - this.distance);
      const z1 = (tile + 1) * TIE_SPACING - this.distance;
      if (z0 >= SPAWN_Z * 1.2) break;
      const t0 = zT(z0), t1 = zT(z1);
      const y0 = zY(z0), y1 = zY(z1);
      const cx0 = this._curveCenterX(t0), cx1 = this._curveCenterX(t1);
      const hw0 = this._trackHalfWidth(t0), hw1 = this._trackHalfWidth(t1);
      const base = tile % 2 === 0 ? w.grd.tieA : w.grd.tieB;
      g.fillStyle(base, (0.5 + t1 * 0.35) * (1 - fogAt(z0) * 0.55));
      g.fillPoints([
        { x: cx1 - hw1, y: y1 },
        { x: cx1 + hw1, y: y1 },
        { x: cx0 + hw0, y: y0 },
        { x: cx0 - hw0, y: y0 },
      ], true);
    }

    // Lane dividers
    strokeLine(lane1, 1.5, w.grd.edge, 0.38);
    strokeLine(lane2, 1.5, w.grd.edge, 0.38);

    // Outer rail lines
    strokeLine(left, 4, w.grd.edge, 0.92 + comboEnergy * 0.08);
    strokeLine(right, 4, w.grd.edge, 0.92 + comboEnergy * 0.08);

    // Horizon glow line in accent colour, tracking the road elevation
    const hy = HORIZON_Y + this.farY;
    hg.lineStyle(14, w.accent, 0.07 + comboEnergy * 0.06);
    hg.beginPath(); hg.moveTo(0, hy); hg.lineTo(W, hy); hg.strokePath();
    hg.lineStyle(2.5, w.accent, 0.75 + comboEnergy * 0.2);
    hg.beginPath(); hg.moveTo(0, hy); hg.lineTo(W, hy); hg.strokePath();
  }

  _buildPlayer() {
    const d = 7;
    this.pal = equippedOutfit().palette;
    this.shadow = this.add.ellipse(this._laneXZ(1, 0), NEAR_Y + 4, 48, 16, 0x000000).setAlpha(0.5).setDepth(d - 1);
    this.vis = {
      aura: this.add.ellipse(0, 0, 58, 82, 0xffa726, 0).setDepth(d - 0.45),
      collectTrail: this.add.ellipse(0, 0, 86, 20, this.pal.trail, 0.08).setDepth(d - 0.6),
      bodyGlow: this.add.ellipse(0, 0, 56, 78, 0xfff176, 0.05).setDepth(d - 0.05),
      shield: this.add.ellipse(0, 0, 68, 88, 0x4fc3f7, 0.16).setStrokeStyle(3, 0x81d4fa, 0.92).setDepth(d + 1).setVisible(false),
      collectGlow: this.add.circle(0, 0, COLLECTION_RADIUS, 0xfff176, 0.08).setStrokeStyle(3, 0xfff176, 0.5).setDepth(d + 0.9).setVisible(this.rhythmMode),
      magnet: this.add.circle(0, 0, 50, 0xba68c8, 0.12).setStrokeStyle(3, 0xf3e5f5, 0.8).setDepth(d + 1).setVisible(false),
    };
    // The whole figure is one Graphics pass per frame (see src/runner.js)
    this.playerG = this.add.graphics().setDepth(d);
  }

  _syncPlayer(t) {
    const x = this.pX;
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    const grounded = !isAirborne(this.jumpH, this.riding); // roof counts: she runs along it
    const sliding = this.slideTimer > 0 && grounded;

    // Run cycle speeds up with the game; bob only while grounded
    const speedFrac = Phaser.Math.Clamp((this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
    const runPeriod = 88 - speedFrac * 32;
    const runPhase = t / runPeriod;
    const swing = grounded && !sliding ? Math.sin(runPhase) * (1 + comboEnergy * 0.22) : 0;
    const bob = grounded && !sliding ? Math.abs(Math.cos(runPhase)) * 2.6 : 0;

    // Landing squash & stretch
    const sqY = 1 - this.landSquash * 0.18;
    const sqX = 1 + this.landSquash * 0.13;

    // Double-jump front flip (flipT decays 1 → 0 → rotation sweeps 0 → 2π)
    const flipRot = this.flipT > 0 ? (1 - this.flipT) * Math.PI * 2 : 0;

    // Lean into lane changes; tilt with vertical velocity in the air
    const laneLean = Phaser.Math.Clamp((this._laneXZ(this.pLane, 0) - this.pX) * 0.0042, -0.2, 0.2);
    const tilt = (grounded ? 0 : Phaser.Math.Clamp(-this.jumpVel / 3000, -0.18, 0.18)) + laneLean;

    const feetY = PLAYER_ANCHOR_Y + 2 - this.jumpH - this.playerBounce * 9 - bob;
    // fieldY: the collection zone hovers just in front of the runner (toward horizon)
    const fieldY = PLAYER_ANCHOR_Y - 40 - this.jumpH * 0.18;
    const sFrac = Math.max(0.35, 1 - this.jumpH / 130);
    const ps = PLAYER_DRAW_SCALE * (1 + this.playerBounce * 0.035);
    const bodyCY = feetY - 42 * ps;
    const shieldScale = ps * (1 + (this.shieldCharges > 0 ? Math.sin(t / 140) * 0.06 : 0));
    const fieldScale = 1 + (this.beatPulse || 0) * 0.08 + this.collectPulse * 0.22 + comboEnergy * 0.06;
    const stepPulse = grounded && !sliding ? (0.5 + Math.abs(Math.sin(runPhase)) * 0.5) : 0;
    this.footstepPulse = Math.max(this.footstepPulse, stepPulse * 0.24);

    // Airborne tuck: legs pull up, arms raise
    const tuck = !grounded && !sliding ? Phaser.Math.Clamp(this.jumpH / 90, 0, 1) : 0;

    // ── Effects ──
    // High-combo speed aura in the world accent colour
    const auraAlpha = Math.max(0, comboEnergy - 0.5) * (0.42 + Math.sin(t / 85) * 0.12);
    this.vis.aura
      .setPosition(x, bodyCY + 6 * ps)
      .setScale(ps * (1.05 + comboEnergy * 0.3 + this.collectPulse * 0.2))
      .setFillStyle(WORLDS[this.worldIdx].accent, auraAlpha);
    this.vis.collectTrail
      .setPosition(x, PLAYER_ANCHOR_Y + 2)
      .setScale(ps * (1 + comboEnergy * 0.28 + this.collectPulse * 0.34), ps * (0.8 + this.footstepPulse + this.collectPulse * 0.4))
      .setAlpha(0.05 + comboEnergy * 0.09 + this.collectPulse * 0.13 + this.footstepPulse * 0.08);
    this.vis.collectGlow
      .setPosition(x, fieldY)
      .setScale(fieldScale)
      .setAlpha(0.08 + (this.beatPulse || 0) * 0.07 + this.collectPulse * 0.18 + comboEnergy * 0.08);
    this.vis.bodyGlow
      .setPosition(x, bodyCY + 3 * ps)
      .setScale(ps * (1 + comboEnergy * 0.16 + this.collectPulse * 0.15))
      .setAlpha(0.03 + comboEnergy * 0.1 + this.collectPulse * 0.1);
    this.vis.shield.setPosition(x, bodyCY + 2 * ps).setScale(shieldScale).setVisible(this.shieldCharges > 0);
    this.vis.magnet.setPosition(x, fieldY).setScale(ps * (1 + Math.sin(t / 110) * 0.08)).setVisible(this.magnetTimer > 0);
    // Shadow sits on the ground plane just below the player's feet
    this.shadow.setPosition(x, PLAYER_ANCHOR_Y + 4).setScale(sFrac * ps * 1.3, sFrac * ps * 0.5).setAlpha(sFrac * 0.55);

    // ── Figure: one Graphics pass driven by the pose (src/runner.js) ──
    drawRunner(this.playerG, {
      x,
      feetY,
      s: ps,
      rot: tilt + flipRot + (grounded && !sliding ? swing * 0.04 : 0),
      sqX,
      sqY,
      sliding,
      swing,
      tuck,
      lean: laneLean,
      tailSway: Math.sin(t / 164),
    }, this.pal);
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

    // One swipe = one action. The gesture fires the moment the threshold is
    // crossed, then locks until the finger lifts — so a single physical swipe
    // can never register as two lane changes. A fresh stroke (lift + swipe)
    // is needed for the next action, which is how Subway Surfers et al. feel.
    this.input.on('pointerdown', p => {
      unlockAudio();
      document.activeElement?.blur?.(); // keep keys flowing to the game
      this._touch = { x: p.x, y: p.y, armed: true };
      this._touchHeld = true;
    });
    this.input.on('pointermove', p => {
      if (!this._touch || this.pausedRun || !this.alive) return;
      const dx = p.x - this._touch.x;
      const dy = p.y - this._touch.y;
      const thr = TOUCH_THRESHOLD * DPR; // pointer coords are in framebuffer pixels
      if (this._touch.armed && Math.max(Math.abs(dx), Math.abs(dy)) > thr) {
        if (Math.abs(dy) > Math.abs(dx)) (dy < 0 ? this._jump() : this._slide(true));
        else this._switchLane(dx > 0 ? 1 : -1);
        this._touch.armed = false; // lock until lift
      }
    });
    this.input.on('pointerup', () => { this._touch = null; this._touchHeld = false; });
  }

  _bufferInput(action) {
    this.inputBuffer = { action, t: this.time.now };
  }

  _consumeBufferedInput() {
    const buf = this.inputBuffer;
    this.inputBuffer = null;
    if (!buf || this.time.now - buf.t > 200) return;
    if (buf.action === 'jump') this._jump();
    else this._slide(buf.touch);
  }

  _jump() {
    if (!this.alive || this.pausedRun || this.slideTimer > 0) return;
    const grounded = !isAirborne(this.jumpH, this.riding);
    if (grounded || this.jumpsUsed < 2) {
      this.riding = false;
      this.jumpVel = grounded ? JUMP_INIT : DOUBLE_JUMP_INIT;
      if (!grounded) this.flipT = 1; // front-flip on the double jump
      this.jumpsUsed = grounded ? 1 : this.jumpsUsed + 1;
      this.combo = Math.max(1, this.combo);
      this._toast(grounded ? 'Jump' : 'Double jump', this.pX, NEAR_Y - this.jumpH - 80);
      audio.jump();
    } else {
      this._bufferInput('jump'); // pressed a hair early — honor it on landing
    }
  }

  _slide(fromTouch = false) {
    if (!this.alive || this.pausedRun) return;
    if (this.jumpH > 8) {
      this.jumpVel = Math.min(this.jumpVel, -620);
      this._toast('Fast drop', this.pX, NEAR_Y - this.jumpH - 60);
      this._bufferInput('slide'); // slide as soon as the drop lands
      this.inputBuffer.touch = fromTouch;
      return;
    }
    this.slideTimer = SLIDE_DURATION;
    this.slideHoldMs = 0;
    this._slideTouchHold = fromTouch;
    this.combo = Math.max(1, this.combo);
    audio.switchLane();
  }

  _switchLane(dir) {
    if (!this.alive || this.pausedRun) return;
    const next = clampLane(this.pLane + dir);
    if (next === this.pLane) return;
    this.pLane = next;
    audio.switchLane();
  }

  _togglePause() {
    if (!this.alive) return;
    this.pausedRun = !this.pausedRun;
    if (this.pausedRun) {
      audio.stop();
      this.tweens.pauseAll();
      this.time.paused = true;
      UI.showPause({
        onResume: () => this._togglePause(),
        onRestart: () => {
          this._unfreeze();
          UI.hidePause();
          this.scene.restart({ rhythmMode: this.rhythmMode, rhythmTrack: this.rhythmTrack });
        },
        onMenu: () => this._exitToMenu(),
      });
    } else {
      if (this.rhythmMode) audio.playRhythm(this.rhythmTrack);
      else audio.playGame();
      this.tweens.resumeAll();
      this.time.paused = false;
      UI.hidePause();
      this._showCountdown('GO');
    }
  }

  // The scene clock and tween manager survive scene transitions, so anything
  // that leaves a paused run must unfreeze them or the next run starts dead.
  _unfreeze() {
    this.tweens.resumeAll();
    this.time.paused = false;
    this.pausedRun = false;
  }

  _exitToMenu() {
    this._unfreeze();
    audio.stop();
    UI.hidePause();
    UI.hideHUD();
    this.scene.start('Boot');
  }

  _showCountdown(text = 'READY') {
    UI.countdown(text);
  }

  // ── Rhythm mode helpers ────────────────────────────────────────────────────
  _rhythmLaneForBeat(beatIndex) {
    return RHYTHM_LANES[beatIndex % RHYTHM_LANES.length];
  }

  _spawnRhythmCoin(beatIndex, hitTime) {
    const lane = this._rhythmLaneForBeat(beatIndex);
    const coin = this._pCircle(0xfff176, 1, 6);
    const shine = this._pCircle(0xffffff, 0.78, 7);
    const ring = this._pCircle(0xff00ff, 0.12, 6).setStrokeStyle(2, 0x00e5ff, 0.9);
    this.gameObjs.push({
      type: 'coin', lane, z: SPAWN_Z, worldW: 60, worldH: 60,
      parts: [ring, coin, shine], ring, coin, shine, checked: false,
      beatIndex, hitTime, rhythmTimed: true,
    });
  }

  _spawnRhythmObstacle(beatIndex) {
    const coinLane = this._rhythmLaneForBeat(beatIndex);
    const lane = Phaser.Utils.Array.GetRandom([0, 1, 2].filter(v => v !== coinLane));
    const gfx = this._pGfx(5);
    this.gameObjs.push({
      type: 'obstacle', lane, z: SPAWN_Z, worldH: 58, worldW: 46, worldD: 38, color: 0x4527a0,
      gfx, parts: [gfx], checked: false,
      hitTime: beatIndex * this.beatMs, rhythmTimed: true,
    });
  }

  _resyncRhythm(newMusicTime) {
    this.musicTime = newMusicTime;
    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const o = this.gameObjs[i];
      if (o.rhythmTimed) {
        o.parts.forEach(p => this._releaseObj(p));
        this.gameObjs.splice(i, 1);
      }
    }
    this.nextRhythmBeat = Math.max(RHYTHM_APPROACH_BEATS, Math.floor(newMusicTime / this.beatMs) + 2);
    this.lastBeatPulse = -1;
  }

  _updateRhythmSpawner() {
    const currentBeat = Math.floor(this.musicTime / this.beatMs);
    if (currentBeat !== this.lastBeatPulse) {
      this.lastBeatPulse = currentBeat;
      this.beatPulse = 1;
      if (this.beatHalo) {
        this.beatHalo.setPosition(this.pX, PLAYER_ANCHOR_Y - 40).setScale(1.35).setAlpha(0.18);
        this.tweens.add({ targets: this.beatHalo, scale: 1, alpha: 0.08, duration: this.beatMs * 0.75, ease: 'Sine.easeOut' });
      }
    }

    const lookaheadHitTime = this.musicTime + this.approachMs;
    while (this.nextRhythmBeat * this.beatMs <= lookaheadHitTime) {
      const hitTime = this.nextRhythmBeat * this.beatMs;
      this._spawnRhythmCoin(this.nextRhythmBeat, hitTime);
      const obstacleEvery = this.rhythmTrack === 'hyper' ? 4 : this.rhythmTrack === 'chill' ? 16 : 8;
      if (this.musicTime > 6500 && this.nextRhythmBeat % obstacleEvery === obstacleEvery - 2) this._spawnRhythmObstacle(this.nextRhythmBeat);
      this.nextRhythmBeat += 1;
    }
  }

  // ── Spawn helpers ───────────────────────────────────────────────────────────
  _difficulty() {
    return difficultyAt(this.runTime);
  }

  _scheduleNextSpawn(extra = 0) {
    const { min: minGap, max: maxGap } = spawnGapRange(this._difficulty());
    this.spawnCursor = this.runTime + Phaser.Math.Between(Math.round(minGap), Math.round(maxGap)) + extra;
  }

  // Designed spawn patterns instead of random single objects. Every pattern
  // checks which lanes are already threatened near the spawn depth so at least
  // one survivable path always exists.
  _spawnPattern() {
    if (this.runTime < SAFE_START_MS) return;
    const difficulty = this._difficulty();
    const pool = this._patternTable().filter(p => difficulty >= (p.min || 0));
    const total = pool.reduce((s, p) => s + p.w, 0);
    let roll = Math.random() * total;
    const pick = pool.find(p => (roll -= p.w) <= 0) || pool[0];
    pick.fn(difficulty);
    this._scheduleNextSpawn(pick.extraGap || 0);
  }

  // The wagon (if any) currently under the player's feet — overlapping her
  // visual lane, with its roof span over the player plane. The front edge
  // shares the landing grace.
  _wagonUnder() {
    const laneF = this._playerLaneF();
    for (const o of this.gameObjs) {
      if (o.type === 'wagon' && Math.abs(o.lane - laneF) < 0.5 &&
          o.z <= WAGON_LANDING_GRACE && o.z + o.worldL >= -12) return o;
    }
    return null;
  }

  _blockedLanesNear(z, range = 650) {
    const blocked = new Set();
    for (const o of this.gameObjs) {
      if ((o.type === 'obstacle' || o.type === 'gate' || o.type === 'wagon') &&
          o.z + (o.worldL || 0) > z - range && o.z < z + range) blocked.add(o.lane);
    }
    return blocked;
  }

  _freeLanes(z = SPAWN_Z, range = 650) {
    const blocked = this._blockedLanesNear(z, range);
    return [0, 1, 2].filter(l => !blocked.has(l));
  }

  _patternTable() {
    if (this._patterns) return this._patterns;
    const anyLane = () => Phaser.Math.Between(0, 2);
    const pickFree = (range) => {
      const free = this._freeLanes(SPAWN_Z, range);
      return free.length ? Phaser.Utils.Array.GetRandom(free) : anyLane();
    };
    this._patterns = [
      { w: 14, fn: () => { // straight coin line
        this._spawnCoinLine(pickFree(), SPAWN_Z, Phaser.Math.Between(5, 7));
      } },
      { w: 14, fn: () => { // coin arc over a low crate — jump through the arc
        const lane = pickFree();
        this._spawnCrate(lane, SPAWN_Z + 330, { h: 56 });
        this._spawnCoinArc(lane, SPAWN_Z, 7);
      } },
      { w: 10, fn: () => { // slalom: coins weave across lanes
        let lane = anyLane();
        for (let s = 0; s < 3; s++) {
          this._spawnCoinLine(lane, SPAWN_Z + s * 360, 3);
          lane = Phaser.Math.Clamp(lane + (lane === 0 ? 1 : lane === 2 ? -1 : Phaser.Utils.Array.GetRandom([-1, 1])), 0, 2);
        }
      } },
      { w: 12, extraGap: 700, fn: () => { // train run: 1-3 cars with roof coins
        const free = this._freeLanes(SPAWN_Z, 1000);
        const lane = free.length ? Phaser.Utils.Array.GetRandom(free) : anyLane();
        this._spawnTrain(lane, SPAWN_Z, Phaser.Math.Between(1, 3));
        const others = free.filter(l => l !== lane);
        if (others.length > 1) this._spawnCrate(others[0], SPAWN_Z + 260, {});
      } },
      { w: 10, min: 0.05, fn: () => { // gate gauntlet: slide or take the coin lane
        const free = this._freeLanes(SPAWN_Z, 900);
        if (free.length < 2) { this._spawnCoinLine(pickFree(), SPAWN_Z, 5); return; }
        const lanes = Phaser.Utils.Array.Shuffle(free.slice());
        this._spawnGate(lanes[0], SPAWN_Z);
        if (lanes.length > 2) this._spawnGate(lanes[1], SPAWN_Z + 40);
        this._spawnCoinLine(lanes[lanes.length - 1], SPAWN_Z, 4);
      } },
      { w: 14, fn: (d) => { // crates in 1-2 lanes, one lane always left open
        const free = this._freeLanes(SPAWN_Z, 700);
        if (!free.length) return;
        const lanes = Phaser.Utils.Array.Shuffle(free.slice());
        const n = Math.min(Math.max(lanes.length - 1, 1), Math.random() < 0.3 + d * 0.3 ? 2 : 1);
        for (let i = 0; i < n; i++) this._spawnCrate(lanes[i], SPAWN_Z + i * 70, {});
      } },
      { w: 8, min: 0.1, fn: () => { // wall: two tall crates force the open lane
        const free = this._freeLanes(SPAWN_Z, 900);
        if (free.length < 3) { this._spawnCoinLine(pickFree(), SPAWN_Z, 5); return; }
        const open = anyLane();
        [0, 1, 2].filter(l => l !== open).forEach(l => this._spawnCrate(l, SPAWN_Z, { h: 96, w: 78 }));
        this._spawnCoinLine(open, SPAWN_Z - 60, 5);
      } },
      { w: 5, fn: () => this._spawnShield(pickFree(), SPAWN_Z) },
      { w: 5, fn: () => { const l = pickFree(); this._spawnMagnet(l, SPAWN_Z); this._spawnCoinLine(l, SPAWN_Z + 180, 4); } },
      { w: 7, min: 0.3, fn: () => { // zig-zag coin sprint across all lanes
        let lane = anyLane();
        for (let s = 0; s < 5; s++) {
          this._spawnCoinLine(lane, SPAWN_Z + s * 230, 2);
          lane = lane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
        }
      } },
      { w: 8, min: 0.35, extraGap: 400, fn: () => { // double-gate corridor
        const free = this._freeLanes(SPAWN_Z, 1100);
        if (free.length < 3) { this._spawnCoinLine(pickFree(), SPAWN_Z, 5); return; }
        const open = anyLane();
        [0, 1, 2].filter(l => l !== open).forEach(l => {
          this._spawnGate(l, SPAWN_Z);
          this._spawnGate(l, SPAWN_Z + 420);
        });
        this._spawnCoinLine(open, SPAWN_Z, 6);
      } },
      { w: 8, min: 0.45, extraGap: 400, fn: () => { // same lane: slide, then jump
        const lane = pickFree(900);
        this._spawnGate(lane, SPAWN_Z);
        this._spawnCrate(lane, SPAWN_Z + 420, { h: 60 });
        this._spawnCoinArc(lane, SPAWN_Z + 200, 5);
      } },
      { w: 7, min: 0.55, extraGap: 300, fn: () => { // crate drifting across lanes
        const free = this._freeLanes(SPAWN_Z, 800);
        const from = free.length ? Phaser.Utils.Array.GetRandom(free) : 1;
        const to = Phaser.Math.Clamp(from + (from === 0 ? 1 : from === 2 ? -1 : Phaser.Utils.Array.GetRandom([-1, 1])), 0, 2);
        this._spawnDriftingCrate(from, to);
      } },
    ];
    return this._patterns;
  }

  _spawnDriftingCrate(laneFrom, laneTo) {
    const gfx = this._pGfx(5);
    this.gameObjs.push({
      type: 'obstacle', lane: laneFrom, laneFrom, laneTo, drift: true,
      z: SPAWN_Z, worldH: 66, worldW: 54, worldD: 44, color: 0x8e24aa,
      gfx, parts: [gfx], checked: false,
    });
  }

  // ── Object pooling ────────────────────────────────────────────────────────
  // Spawned objects and particles churn constantly; reusing display objects
  // avoids per-spawn allocations and GC hitches on long mobile runs.
  _acquire(kind) {
    const o = this._pools[kind].pop();
    if (o) {
      o.setVisible(true).setActive(true).setAlpha(1).setScale(1);
      if (o.setRotation) o.setRotation(0);
      return o;
    }
    let created;
    if (kind === 'gfx') created = this.add.graphics();
    else if (kind === 'circle') created = this.add.circle(0, 0, 1, 0xffffff);
    else if (kind === 'ellipse') created = this.add.ellipse(0, 0, 1, 1, 0xffffff);
    else created = this.add.rectangle(0, 0, 1, 1, 0xffffff);
    created._poolKind = kind;
    return created;
  }

  _releaseObj(p) {
    if (!p || !p.scene) return; // already destroyed (e.g. scene shutdown)
    if (!p._poolKind) { p.destroy(); return; }
    if (p._poolKind === 'gfx') p.clear();
    p.setVisible(false).setActive(false);
    this._pools[p._poolKind].push(p);
  }

  _pGfx(depth) { return this._acquire('gfx').setDepth(depth); }
  _pCircle(color, alpha, depth) {
    const c = this._acquire('circle');
    c.setFillStyle(color, alpha === undefined ? 1 : alpha);
    c.setStrokeStyle();
    c.setRadius(1);
    return c.setDepth(depth);
  }
  _pEllipse(color, alpha, depth) {
    const e = this._acquire('ellipse');
    e.setFillStyle(color, alpha === undefined ? 1 : alpha);
    e.setStrokeStyle();
    e.setSize(1, 1);
    return e.setDepth(depth);
  }
  _pRect(color, alpha, depth) {
    const r = this._acquire('rect');
    r.setFillStyle(color, alpha === undefined ? 1 : alpha);
    r.setStrokeStyle();
    r.setSize(1, 1);
    return r.setDepth(depth);
  }

  _spawnCrate(lane, z, { h = Phaser.Math.Between(56, 88), w = Phaser.Math.Between(50, 72) } = {}) {
    const color = Phaser.Utils.Array.GetRandom([0xd32f2f, 0xe65100, 0x5d4037]);
    const gfx = this._pGfx(5);
    this.gameObjs.push({ type: 'obstacle', lane, z, worldH: h, worldW: w, worldD: Phaser.Math.Between(36, 56), color, gfx, parts: [gfx], checked: false });
  }

  _spawnGate(lane, z) {
    const gfx = this._pGfx(5);
    this.gameObjs.push({ type: 'gate', lane, z, worldH: 104, worldW: 108, gfx, parts: [gfx], checked: false });
  }

  _spawnShield(lane = Phaser.Math.Between(0, 2), z = SPAWN_Z) {
    const shadow = this._pEllipse(0x000000, 0.16, 4.5);
    const ring = this._pCircle(0x4fc3f7, 0.18, 6).setStrokeStyle(2, 0xb3e5fc, 0.95);
    const core = this._pCircle(0x81d4fa, 0.9, 6);
    const glint = this._pCircle(0xffffff, 0.75, 7);
    this.gameObjs.push({ type: 'shield', lane, z, worldW: 44, worldH: 44, parts: [shadow, ring, core, glint], shadow, ring, core, glint, checked: false });
  }

  _spawnMagnet(lane = Phaser.Math.Between(0, 2), z = SPAWN_Z) {
    const shadow = this._pEllipse(0x000000, 0.16, 4.5);
    const ring = this._pCircle(0x8e24aa, 0.2, 6).setStrokeStyle(2, 0xf3e5f5, 0.95);
    const core = this._pRect(0xba68c8, 1, 7);
    const spark = this._pCircle(0xffffff, 0.82, 8);
    this.gameObjs.push({ type: 'magnet', lane, z, worldW: 44, worldH: 44, parts: [shadow, ring, core, spark], shadow, ring, core, spark, checked: false });
  }

  _spawnCoin(lane, z, elev = 42) {
    const shadow = this._pEllipse(0x000000, 0.14, 4.5);
    const ring = this._pCircle(0xfff176, 0.1, 5).setStrokeStyle(2, 0xfff176, 0.55);
    const coin = this._pCircle(0xffd700, 1, 6);
    const shine = this._pCircle(0xfff59d, 0.72, 7);
    this.gameObjs.push({ type: 'coin', lane, z, elev, worldW: 49, worldH: 49, parts: [shadow, ring, coin, shine], shadow, ring, coin, shine, checked: false });
  }

  _spawnCoinLine(lane, z, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const elev = opts.arc ? 42 + Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 76 : 42;
      this._spawnCoin(lane, z + i * 110, elev);
    }
  }

  _spawnCoinArc(lane, z, count) {
    this._spawnCoinLine(lane, z, count, { arc: true });
  }

  _spawnTrain(lane, z, cars = 1) {
    for (let i = 0; i < cars; i++) this._spawnWagon(lane, z + i * (WAGON_LENGTH + 50), i);
  }

  _spawnWagon(lane, z, carIdx = 0) {
    const gfx = this._pGfx(5);
    const numCoins = Phaser.Math.Between(5, 8);
    const coins = [];
    for (let i = 0; i < numCoins; i++) {
      const t = numCoins > 1 ? i / (numCoins - 1) : 0.5;
      coins.push({
        obj: this._pCircle(0xffd700, 1, 6),
        shine: this._pCircle(0xffe082, 1, 6).setAlpha(0.7),
        fracX: Phaser.Math.FloatBetween(-0.2, 0.2),
        lengthT: t,
        collected: false,
      });
    }
    this.gameObjs.push({ type: 'wagon', lane, z, worldW: 128, worldH: 54, worldL: WAGON_LENGTH, carIdx, gfx, coins, parts: [gfx, ...coins.flatMap(c => [c.obj, c.shine])], checked: false });
  }

  // ── Projected 3D box rendering ───────────────────────────────────────────────
  // Draws a box standing on the ground at (lane, z): front face, top face, and
  // whichever side face is visible given the vanishing point. Returns the
  // front-face metrics for decorating.
  _drawBox(g, lane, z, w, h, depth, color, opts = {}) {
    const zB = z + depth;
    const scF = zSc(z), scB = zSc(zB);
    const xF = this._laneXZ(lane, z) + (opts.fracX || 0) * scF;
    const xB = this._laneXZ(lane, zB) + (opts.fracX || 0) * scB;
    const bF = zY(z) - (opts.base || 0) * scF;
    const bB = zY(zB) - (opts.base || 0) * scB;
    const tF = bF - h * scF;
    const tB = bB - h * scB;
    const hwF = (w / 2) * scF, hwB = (w / 2) * scB;
    const col = Phaser.Display.Color.IntegerToColor(color);
    const topCol = opts.topColor !== undefined ? opts.topColor : col.clone().lighten(20).color32;
    const sideCol = opts.sideColor !== undefined ? opts.sideColor : col.clone().darken(18).color32;
    const alpha = opts.alpha !== undefined ? opts.alpha : 1;

    g.fillStyle(topCol, alpha);
    g.fillPoints([{ x: xF - hwF, y: tF }, { x: xF + hwF, y: tF }, { x: xB + hwB, y: tB }, { x: xB - hwB, y: tB }], true);
    if (xB > xF + 0.5) {
      g.fillStyle(sideCol, alpha);
      g.fillPoints([{ x: xF + hwF, y: tF }, { x: xB + hwB, y: tB }, { x: xB + hwB, y: bB }, { x: xF + hwF, y: bF }], true);
    } else if (xB < xF - 0.5) {
      g.fillStyle(sideCol, alpha);
      g.fillPoints([{ x: xF - hwF, y: tF }, { x: xB - hwB, y: tB }, { x: xB - hwB, y: bB }, { x: xF - hwF, y: bF }], true);
    }
    g.fillStyle(color, alpha);
    g.fillRect(xF - hwF, tF, hwF * 2, bF - tF);
    return { xF, xB, bF, bB, tF, tB, hwF, hwB, scF, scB };
  }

  _drawGroundShadow(g, x, y, w, alpha = 0.28) {
    g.fillStyle(0x000000, alpha);
    g.fillEllipse(x, y + 2, w, w * 0.26);
  }

  // World-skinned static obstacles: mossy log / sandstone boulder / coral
  // block / void crystal. Hitboxes are untouched — only the dressing changes.
  _drawThemedObstacle(g, obj, z, sc) {
    const wld = WORLDS[this.worldIdx];
    const D = obj.worldD || 32;
    const box = (base, top, side) =>
      this._drawBox(g, obj.lane, z, obj.worldW, obj.worldH, D, base, { topColor: top, sideColor: side });

    if (wld.id === 'jungle') {
      const f = box(0x5d3f24, 0x4e8f4a, 0x432e1a);
      g.lineStyle(Math.max(1, 1.6 * sc), 0x3a2614, 0.55);
      for (const fr of [0.35, 0.68]) {
        g.beginPath();
        g.moveTo(f.xF - f.hwF, f.tF + (f.bF - f.tF) * fr);
        g.lineTo(f.xF + f.hwF, f.tF + (f.bF - f.tF) * fr);
        g.strokePath();
      }
      g.fillStyle(0x5ed06a, 0.95);
      g.fillCircle(f.xF - f.hwF * 0.55, f.tF, 4.5 * sc);
      g.fillCircle(f.xF - f.hwF * 0.18, f.tF - 3 * sc, 3.5 * sc);
      g.fillCircle(f.xF + f.hwF * 0.45, f.tF - 1 * sc, 3 * sc);
    } else if (wld.id === 'savanna') {
      const f = box(0xb08a4f, 0xd2a96a, 0x8a683a);
      g.lineStyle(Math.max(1, 1.5 * sc), 0x6e5430, 0.65);
      g.beginPath();
      g.moveTo(f.xF - f.hwF * 0.5, f.tF);
      g.lineTo(f.xF - f.hwF * 0.12, f.tF + (f.bF - f.tF) * 0.45);
      g.lineTo(f.xF - f.hwF * 0.4, f.bF);
      g.strokePath();
      g.fillStyle(0x8a683a, 1);
      g.fillEllipse(f.xF + f.hwF * 0.9, f.bF, 9 * sc, 5 * sc);
      g.fillEllipse(f.xF - f.hwF * 1.08, f.bF, 7 * sc, 4 * sc);
    } else if (wld.id === 'reef') {
      const f = box(0xd95590, 0xff8fc0, 0x9e3766);
      g.fillStyle(0xff8fc0, 0.6);
      g.fillCircle(f.xF - f.hwF * 0.45, f.tF + (f.bF - f.tF) * 0.3, 2.6 * sc);
      g.fillCircle(f.xF + f.hwF * 0.3, f.tF + (f.bF - f.tF) * 0.58, 2 * sc);
      g.fillCircle(f.xF - f.hwF * 0.08, f.tF + (f.bF - f.tF) * 0.78, 1.8 * sc);
      g.lineStyle(1.2, 0xbfefff, 0.65);
      g.strokeCircle(f.xF + f.hwF * 0.5, f.tF - 8 * sc, 3 * sc);
      g.strokeCircle(f.xF + f.hwF * 0.28, f.tF - 15 * sc, 2 * sc);
    } else {
      const f = box(0x2c2060, 0x4a3a96, 0x1e1546);
      g.fillStyle(0x6a55c2, 0.55);
      g.fillTriangle(
        f.xF - f.hwF * 0.5, f.bF,
        f.xF, f.tF + (f.bF - f.tF) * 0.25,
        f.xF + f.hwF * 0.5, f.bF
      );
      g.lineStyle(Math.max(1, 1.8 * sc), wld.accent, 0.5);
      g.beginPath();
      g.moveTo(f.xF - f.hwF, f.bF);
      g.lineTo(f.xF - f.hwF, f.tF);
      g.lineTo(f.xF + f.hwF, f.tF);
      g.lineTo(f.xF + f.hwF, f.bF);
      g.strokePath();
      g.fillStyle(wld.accent, 0.5);
      g.fillCircle(f.xF, f.tF, 2.5 * sc);
    }
  }

  _renderObj(obj) {
    const z = obj.z;
    const sy = zY(z);
    const sc = zSc(z);
    const visible = z <= SPAWN_Z * 1.05;
    // Distance fog: objects condense out of the haze instead of popping in
    const fogA = 1 - fogAt(z) * 0.94;
    obj.parts.forEach(part => { part.setVisible(visible); if (visible) part.setAlpha(fogA); });
    if (!visible) return;

    const t = zT(z);
    const x = this._laneXZ(obj.lane, z);
    const dp = 4 + Math.min(t, 1) * 5;

    if (obj.type === 'obstacle') {
      const g = obj.gfx;
      g.clear();
      this._drawGroundShadow(g, x, sy, obj.worldW * sc * 1.5);
      // Drifting and rhythm crates keep their signal colours; everything else
      // wears the current world's skin (same hitbox, themed dressing).
      if (obj.drift || obj.rhythmTimed) {
        const f = this._drawBox(g, obj.lane, z, obj.worldW, obj.worldH, obj.worldD || 32, obj.color);
        g.lineStyle(Math.max(1, 1.5 * sc), 0x000000, 0.14);
        g.beginPath();
        g.moveTo(f.xF - f.hwF, f.tF + (f.bF - f.tF) * 0.5);
        g.lineTo(f.xF + f.hwF, f.tF + (f.bF - f.tF) * 0.5);
        g.strokePath();
      } else {
        this._drawThemedObstacle(g, obj, z, sc);
      }
      g.setDepth(dp);
    }

    if (obj.type === 'gate') {
      const g = obj.gfx;
      g.clear();
      const sw = obj.worldW;
      this._drawGroundShadow(g, x, sy, sw * sc * 1.3, 0.2);
      // Posts: thin 3D boxes at the gate edges, in the world's material
      const postCol = { jungle: 0x5d4037, savanna: 0x8a683a, reef: 0x9e3766, deep: 0x2c2060 }[WORLDS[this.worldIdx].id];
      this._drawBox(g, obj.lane, z, 12, obj.worldH, 16, postCol, { fracX: -sw / 2 });
      this._drawBox(g, obj.lane, z, 12, obj.worldH, 16, postCol, { fracX: sw / 2 });
      // Glowing beam across the top — slide under it
      const pulseA = 0.5 + Math.sin(this.time.now / 90) * 0.16;
      const beam = this._drawBox(g, obj.lane, z, sw, 16, 12, 0xc62828, { base: obj.worldH - 16 });
      g.fillStyle(0xff8a80, pulseA * 0.5);
      g.fillRect(beam.xF - beam.hwF * 1.06, beam.tF - 3 * sc, beam.hwF * 2.12, (beam.bF - beam.tF) + 6 * sc);
      g.setDepth(dp);
    }

    if (obj.type === 'shield' || obj.type === 'magnet') {
      const pulse = 1 + Math.sin(this.time.now / 130) * 0.08;
      const r = Math.max(3, 22 * sc * pulse);
      const cy = zTopY(z, 56);
      obj.shadow.setPosition(x, sy + 2).setSize(r * 2.4, r * 0.65).setDepth(4.5);
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
      const timingPulse = obj.hitTime ? Math.max(0, 1 - Math.abs(this.musicTime - obj.hitTime) / RHYTHM_BEAT_WINDOW_MS) : 0;
      const pulse = 1 + Math.sin(this.time.now / 115 + obj.z) * 0.08 + timingPulse * 0.35;
      let r = Math.max(4, (obj.hitTime ? 24 : 20) * sc * pulse);
      let cy = zTopY(z, obj.elev !== undefined ? obj.elev : 42);
      let cx = x;
      if (obj.pulling) { // magnet: visibly fly to the player
        const pt = obj.pullT || 0;
        cx = Phaser.Math.Linear(cx, this.pX, pt);
        cy = Phaser.Math.Linear(cy, PLAYER_ANCHOR_Y - 44, pt);
        r *= 1 - pt * 0.4;
      }
      if (obj.shadow) obj.shadow.setPosition(x, sy + 2).setSize(r * 2, r * 0.55).setDepth(4.5).setAlpha(obj.pulling ? 0 : 0.14);
      obj.coin.setPosition(cx, cy).setRadius(r).setDepth(dp + 1);
      obj.shine.setPosition(cx - r * 0.3, cy - r * 0.35).setRadius(Math.max(1, r * 0.4)).setDepth(dp + 2);
      if (obj.ring) obj.ring.setPosition(cx, cy).setRadius(r * 1.65).setDepth(dp).setAlpha(0.12 + timingPulse * 0.25);
    }

    if (obj.type === 'arch') {
      const g = obj.gfx;
      g.clear();
      const w = WORLDS[this.worldIdx];
      const hw = this._trackHalfWidth(t);
      const cx = this._curveCenterX(t);
      const topY = zTopY(z, 205);
      const postW = Math.max(2, 9 * sc);
      const px1 = cx - hw - 12 * sc, px2 = cx + hw + 12 * sc;
      g.fillStyle(0x000000, 0.16);
      g.fillEllipse(px1, sy + 2, postW * 3, postW);
      g.fillEllipse(px2, sy + 2, postW * 3, postW);
      g.fillStyle(w.grd.tieB, 1);
      g.fillRect(px1 - postW / 2, topY, postW, sy - topY);
      g.fillRect(px2 - postW / 2, topY, postW, sy - topY);
      g.fillStyle(w.grd.tieA, 1);
      g.fillRect(px1 - 6 * sc, topY - 11 * sc, (px2 - px1) + 12 * sc, 11 * sc);
      g.fillStyle(w.accent, 0.4);
      g.fillRect(px1 - 6 * sc, topY - 4 * sc, (px2 - px1) + 12 * sc, Math.max(1, 2 * sc));
      g.setDepth(dp);
    }

    if (obj.type === 'wagon') {
      const g = obj.gfx;
      g.clear();
      const w = WORLDS[this.worldIdx];
      const L = obj.worldL;
      this._drawGroundShadow(g, this._laneXZ(obj.lane, z + L * 0.4), zY(z + L * 0.4), obj.worldW * zSc(z + L * 0.4) * 1.7, 0.3);
      // Bogie wheels along the visible side (drawn first so the body sits on
      // them) — without these the car reads as a floating slab.
      const dxL = this._laneXZ(obj.lane, z + L) - this._laneXZ(obj.lane, z);
      const sgn = dxL > 2 ? 1 : dxL < -2 ? -1 : 0;
      if (sgn) {
        g.fillStyle(0x101010, 1);
        for (let k = 0; k < 4; k++) {
          const wz = z + L * (0.16 + 0.23 * k);
          if (wz < -40 || wz > SPAWN_Z) continue;
          const wsc = zSc(wz);
          const wx = this._laneXZ(obj.lane, wz) + sgn * (obj.worldW / 2) * wsc * 0.92;
          g.fillCircle(wx, zY(wz), Math.max(2, 10 * wsc));
        }
      }
      // Train car: one long 3D box; the roof top-face is the walkable deck
      const bodyCol = obj.carIdx % 2 === 0 ? 0x4e342e : 0x5d4037;
      const f = this._drawBox(g, obj.lane, z, obj.worldW, WAGON_TOP, L, bodyCol, { topColor: 0x6d4c41 });
      // Window strip down the visible side
      if (sgn) {
        g.fillStyle(w.accent, 0.25);
        for (let k = 0; k < 4; k++) {
          const wz0 = z + L * (0.14 + 0.21 * k);
          const wz1 = wz0 + L * 0.12;
          if (wz1 < -20) continue;
          const x0 = this._laneXZ(obj.lane, wz0) + sgn * (obj.worldW / 2) * zSc(wz0);
          const x1 = this._laneXZ(obj.lane, wz1) + sgn * (obj.worldW / 2) * zSc(wz1);
          g.fillPoints([
            { x: x0, y: zTopY(wz0, WAGON_TOP * 0.74) },
            { x: x1, y: zTopY(wz1, WAGON_TOP * 0.74) },
            { x: x1, y: zTopY(wz1, WAGON_TOP * 0.46) },
            { x: x0, y: zTopY(wz0, WAGON_TOP * 0.46) },
          ], true);
        }
      }
      // Roof plank lines across the deck
      g.lineStyle(1, 0x3e2723, 0.55);
      for (let k = 1; k < 5; k++) {
        const pz = z + (L * k) / 5;
        const psc = zSc(pz);
        const px = this._laneXZ(obj.lane, pz);
        const py = zTopY(pz, WAGON_TOP);
        g.beginPath();
        g.moveTo(px - (obj.worldW / 2) * psc, py);
        g.lineTo(px + (obj.worldW / 2) * psc, py);
        g.strokePath();
      }
      // Front face details: cab window band + bumper
      g.fillStyle(w.accent, 0.32);
      g.fillRect(f.xF - f.hwF * 0.78, f.tF + (f.bF - f.tF) * 0.16, f.hwF * 1.56, (f.bF - f.tF) * 0.2);
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(f.xF - f.hwF * 0.9, f.bF - 6 * sc, f.hwF * 1.8, 6 * sc);
      // Wheels under the front face
      const wr = Math.max(2, 11 * sc);
      g.fillStyle(0x111111, 1);
      g.fillCircle(f.xF - f.hwF * 0.55, f.bF, wr);
      g.fillCircle(f.xF + f.hwF * 0.55, f.bF, wr);
      // While the player can stand on the roof, the car must render below her
      g.setDepth(z < 60 ? 6.5 : dp);
      obj.coins.forEach(c => {
        if (c.collected) return;
        const coinZ = Phaser.Math.Linear(z + L * 0.86, z + L * 0.18, c.lengthT);
        // Missed coins behind the player plane balloon at the camera and
        // stack into a gold column — cull them, they're uncollectible
        if (coinZ < -70) {
          c.obj.setVisible(false);
          c.shine.setVisible(false);
          return;
        }
        c.obj.setVisible(true);
        c.shine.setVisible(true);

        const coinSc = zSc(coinZ);
        const coinX = this._laneXZ(obj.lane, coinZ) + c.fracX * obj.worldW * coinSc;
        const coinTop = zTopY(coinZ, WAGON_TOP);
        // Clamp the near-field size: roof coins right at the camera otherwise
        // balloon into overlapping blobs
        const cr = Phaser.Math.Clamp(18 * coinSc, 3, 20);
        const cy = coinTop - cr - 4 * coinSc;
        const coinDepth = 5 + Math.min(zT(coinZ), 1) * 5;
        c.obj.setPosition(coinX, cy).setRadius(cr).setDepth(coinDepth + 1);
        c.shine.setPosition(coinX - cr * 0.3, cy - cr * 0.35).setRadius(Math.max(1, cr * 0.42)).setDepth(coinDepth + 2);
      });
    }
  }

  _handleCollision(obj) {
    if (obj.checked) return;
    // Visual-lane overlap: she collides with what she's drawn over, not with
    // the lane she's snapping toward. Solids need a real overlap (~half a
    // lane); the magnet still vacuums anything within roughly one lane.
    const laneF = this._playerLaneF();
    const magnetGrab = this.magnetTimer > 0 && (obj.type === 'coin' || obj.type === 'magnet') && withinReach(obj.lane, laneF);
    if (!lanesOverlap(obj.lane, laneF) && !magnetGrab) return;

    if (obj.type === 'shield') {
      obj.checked = true;
      obj.consumed = true;
      this.shieldCharges = 1;
      this._updateShieldUI();
      this._addScore(SHIELD_SCORE, 'Shield ready');
      this._collectionFeedback(obj.ring.x || this.pX, obj.ring.y || (PLAYER_ANCHOR_Y - 42), 0x4fc3f7);
      audio.powerUp();
      return;
    }

    if (obj.type === 'magnet') {
      obj.checked = true;
      obj.consumed = true;
      this.magnetTimer = MAGNET_DURATION;
      this._updatePowerUI();
      this._addScore(MAGNET_SCORE, 'Magnet on');
      this._collectionFeedback(obj.ring.x || this.pX, obj.ring.y || (PLAYER_ANCHOR_Y - 42), 0xba68c8);
      audio.powerUp();
      return;
    }

    if (obj.type === 'coin') {
      if (obj.pulling) return; // magnet flight collects it via pullT
      // Elevated (arc) coins need the player at jump height to grab them
      const elev = obj.elev !== undefined ? obj.elev : 42;
      if (!magnetGrab && Math.abs(this.jumpH + 40 - elev) > 62) return;
      this._collectLooseCoin(obj, magnetGrab ? 'Magnet' : null);
      return;
    }

    if (obj.type === 'gate') {
      obj.checked = true;
      const cleared = this.slideTimer > 0 || this.jumpH > 86;
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
      // Land only when actually near the roof plane and falling; the ride
      // itself is positional — update() keeps her up while a roof is under
      // her feet, and she runs off the real end of the real car.
      if (this.jumpH >= WAGON_TOP - 28 && this.jumpH <= WAGON_TOP + 16 && this.jumpVel <= 0) {
        obj.checked = true;
        const firstContact = !this.riding;
        this.riding = true;
        this.jumpH = WAGON_TOP;
        this.jumpVel = 0;
        this.jumpsUsed = 0;
        if (firstContact) {
          this.combo = Math.min(this.combo + 1, 5);
          this._addScore(15, 'Roof run!');
          this.landSquash = 1;
          this.cam.dipVel = -150;
          this._dustPuff(this.pX, PLAYER_ANCHOR_Y + 2 - WAGON_TOP, 4);
          audio.land();
        }
      } else if (this.jumpH < WAGON_TOP - 8 && !this.riding) {
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
    let rhythmBonus = 0;
    let rhythmLabel = null;
    if (obj.hitTime) {
      const timing = Math.abs(this.musicTime - obj.hitTime);
      if (timing <= 70) { rhythmBonus = 35; rhythmLabel = 'Perfect beat!'; this.rhythmStats.perfect++; }
      else if (timing <= RHYTHM_BEAT_WINDOW_MS) { rhythmBonus = 18; rhythmLabel = 'Good beat'; this.rhythmStats.good++; }
      else { rhythmLabel = 'Off beat'; this.rhythmStats.off++; }
    }
    this.combo = Math.min(this.combo + (obj.hitTime && rhythmBonus > 0 ? 0.4 : 0.25), 5);
    this._addScore(Math.round((COIN_SCORE + rhythmBonus) * this.combo), label || rhythmLabel || (this.combo >= 2 ? `Streak x${this.combo.toFixed(1)}` : null));
    UI.setCoins(this.coinCount);
    this._coinPop(obj.coin.x, obj.coin.y);
    this._collectionFeedback(obj.coin.x, obj.coin.y, obj.hitTime ? 0xfff176 : 0xffd700);
    audio.coin();
  }

  _updatePowerUI() {
    UI.setMagnet(this.magnetTimer > 0 ? this.magnetTimer / MAGNET_DURATION : 0);
  }

  _updateShieldUI() {
    UI.setShield(this.shieldCharges > 0);
  }

  _consumeShield(label) {
    if (this.shieldCharges <= 0) return false;
    this.shieldCharges = 0;
    this._updateShieldUI();
    this.riding = false;
    this.jumpVel = Math.max(this.jumpVel, 120);
    this._toast(label, W / 2, 162);
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x4fc3f7, 0.24).setDepth(24);
    this.time.delayedCall(140, () => flash.destroy());
    audio.shieldBreak();
    vibrate(60);
    if (!this.rhythmMode) {
      this.chaseT = 1; // the shadow beast closes in until the player recovers
      this._toast('It\'s right behind you!', W / 2, 190);
    }
    return true;
  }

  _addScore(points, label) {
    this.score += points;
    if (label) this._toast(label, W / 2, 142);
  }

  _toast(label, x, y) {
    const t = this.add.text(x, y, label, { fontSize: '15px', fontFamily: 'Arial Black, Arial', fill: '#b7ffb7', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 520, ease: 'Power2', onComplete: () => t.destroy() });
  }

  _collectionFeedback(x, y, color = 0xfff176) {
    this.collectPulse = 1;
    this.playerBounce = Math.min(1, 0.55 + Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1) * 0.45);
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    const fieldY = PLAYER_ANCHOR_Y - 42;
    const ring = this._pCircle(color, 0.08, 21)
      .setPosition(this.pX, fieldY)
      .setRadius(COLLECTION_RADIUS * 0.62)
      .setStrokeStyle(3 + comboEnergy * 3, color, 0.82);
    this.tweens.add({
      targets: ring,
      radius: COLLECTION_RADIUS * (1.22 + comboEnergy * 0.3),
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => this._releaseObj(ring),
    });
    const beam = this.add.line(0, 0, x, y, this.pX, fieldY, color, 0.42 + comboEnergy * 0.18).setOrigin(0, 0).setLineWidth(3 + comboEnergy * 2).setDepth(20);
    this.tweens.add({ targets: beam, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => beam.destroy() });

    const burstCount = 5 + Math.round(comboEnergy * 5);
    for (let i = 0; i < burstCount; i++) {
      const spark = this._pCircle(color, 0.78, 21)
        .setPosition(this.pX, fieldY)
        .setRadius(Phaser.Math.FloatBetween(2, 4 + comboEnergy * 2));
      const ang = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const dist = Phaser.Math.FloatBetween(16, 36 + comboEnergy * 24);
      this.tweens.add({
        targets: spark,
        x: this.pX + Math.cos(ang) * dist,
        y: fieldY + Math.sin(ang) * dist,
        scale: 0.12,
        alpha: 0,
        duration: Phaser.Math.Between(220, 420),
        ease: 'Quad.easeOut',
        onComplete: () => this._releaseObj(spark),
      });
    }
  }

  _coinPop(x, y) {
    const t = this.add.text(x, y, '+1', { fontSize: '20px', fontFamily: 'Arial Black', fill: '#fff176', stroke: '#3b2700', strokeThickness: 3 }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 520, ease: 'Power2', onComplete: () => t.destroy() });
    for (let i = 0; i < 7; i++) {
      const spark = this._pCircle(i % 2 ? 0x00e5ff : 0xfff176, 0.86, 21)
        .setPosition(x, y)
        .setRadius(Phaser.Math.FloatBetween(2, 4));
      const ang = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const dist = Phaser.Math.FloatBetween(18, 46);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist - 10,
        scale: 0.15,
        alpha: 0,
        duration: Phaser.Math.Between(260, 460),
        ease: 'Quad.easeOut',
        onComplete: () => this._releaseObj(spark),
      });
    }
  }

  // The shadow beast looms after a shield save; combos shake it off faster.
  _updateChase(dt) {
    if (this.rhythmMode || !this.chaserG) return;
    if (this.chaseT <= 0) { this.chaserG.clear(); return; }
    this.chaseT = Math.max(0, this.chaseT - (dt / 8) * (this.combo >= 3 ? 2 : 1));
    const g = this.chaserG;
    g.clear();
    if (this.chaseT < 0.05) return;
    const close = Phaser.Math.Clamp(this.chaseT, 0, 1);
    const x = W / 2 + (this.pX - W / 2) * 0.5;
    const y = H - 40 + (1 - close) * 130; // rises into view as it closes
    const sc = 0.7 + close * 0.7;
    const bob = Math.sin(this.time.now / 130) * 4 * close;
    g.fillStyle(0x0a0612, 0.78 + close * 0.18);
    g.fillEllipse(x, y + bob, 150 * sc, 110 * sc);
    g.fillEllipse(x - 60 * sc, y + 18 + bob * 1.2, 46 * sc, 60 * sc);
    g.fillEllipse(x + 60 * sc, y + 18 - bob * 1.2, 46 * sc, 60 * sc);
    const eyeA = Phaser.Math.Clamp(0.55 + close * 0.45 + Math.sin(this.time.now / 90) * 0.1, 0, 1);
    g.fillStyle(0xff1744, eyeA);
    g.fillCircle(x - 22 * sc, y - 18 * sc + bob, 7 * sc);
    g.fillCircle(x + 22 * sc, y - 18 * sc + bob, 7 * sc);
    g.fillStyle(0xffffff, eyeA * 0.7);
    g.fillCircle(x - 22 * sc, y - 18 * sc + bob, 2.5 * sc);
    g.fillCircle(x + 22 * sc, y - 18 * sc + bob, 2.5 * sc);
    if (this.chaseT > 0.4 && this.time.now - this._lastHeartbeat > 620) {
      this._lastHeartbeat = this.time.now;
      audio.heartbeat();
    }
  }

  _gameOver(reason = 'Run ended') {
    if (!this.alive) return;
    if (!this.rhythmMode && this.chaseT > 0.4) reason = 'Caught by the shadow beast!';
    this.alive = false;
    audio.gameOver();
    vibrate(180);

    const finalScore = Math.floor(this.score);
    const keys = bestKeys(this.rhythmMode, this.rhythmTrack);
    const oldBest = loadNumber(keys.score);
    const oldCoins = loadNumber(keys.coins);
    const newBest = finalScore > oldBest;
    if (newBest) saveNumber(keys.score, finalScore);
    if (this.coinCount > oldCoins) saveNumber(keys.coins, this.coinCount);
    addToWallet(this.coinCount); // run coins go into the shop wallet

    // Crash impact: shake + flash first, the sheet slides up after a short beat
    this.cameras.main.shake(280, 0.014);
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.3).setDepth(25);
    this.time.delayedCall(200, () => flash.destroy());

    const restart = () => {
      UI.hideGameOver();
      if (this.rhythmMode) audio.playRhythm(this.rhythmTrack);
      else audio.playGame();
      this.scene.restart({ rhythmMode: this.rhythmMode, rhythmTrack: this.rhythmTrack });
    };

    this.time.delayedCall(320, () => {
      this.cameras.main.setRotation(0);
      const st = this.rhythmStats;
      const total = st.perfect + st.good + st.off + st.miss;
      const ratio = total ? st.perfect / total : 0;
      UI.showGameOver({
        score: finalScore,
        newBest,
        coins: this.coinCount,
        bestScore: Math.max(oldBest, finalScore),
        wallet: getWallet(),
        reason,
        rhythm: this.rhythmMode
          ? { ...st, grade: ratio >= 0.8 ? 'S' : ratio >= 0.6 ? 'A' : ratio >= 0.4 ? 'B' : 'C' }
          : null,
        onRestart: restart,
        onMenu: () => {
          audio.stop();
          UI.hideGameOver();
          UI.hideHUD();
          this.scene.start('Boot');
        },
      });
    });

    this.time.delayedCall(350, () => {
      this.input.keyboard.once('keydown-SPACE', () => { unlockAudio(); restart(); });
      this.input.keyboard.once('keydown-ENTER', () => { unlockAudio(); restart(); });
    });
  }

  update(time, delta) {
    if (!this.alive) return;
    if (Phaser.Input.Keyboard.JustDown(this.pKey) || Phaser.Input.Keyboard.JustDown(this.escKey)) this._togglePause();
    if (this.pausedRun) return;

    const dt = delta / 1000;
    this.runTime += delta;
    if (this.rhythmMode) {
      // Beats follow the audio clock, not the game clock, so coins stay on
      // the music. A backwards jump means the track restarted (pause/resume,
      // late audio unlock) — drop scheduled beats and re-anchor.
      const tt = audio.getTrackTime ? audio.getTrackTime() : null;
      const newMusicTime = tt != null ? tt * 1000 : this.runTime;
      if (newMusicTime < this.musicTime - this.beatMs) this._resyncRhythm(newMusicTime);
      this.musicTime = newMusicTime;
    }
    this.beatPulse = Math.max(0, this.beatPulse - dt * (this.rhythmMode ? 4.4 : 2.2));
    this.collectPulse = Math.max(0, this.collectPulse - dt * 5.8);
    this.playerBounce = Math.max(0, this.playerBounce - dt * 6.5);
    this.footstepPulse = Math.max(0, this.footstepPulse - dt * 5.2);
    this.landSquash = Math.max(0, this.landSquash - dt * 7);
    this.flipT = Math.max(0, this.flipT - dt * 2.6);
    this.distance += this.speed * dt;
    // Each unlocked world raises the speed ceiling a notch
    this.speed = speedAt(this.runTime, this.worldIdx, BASE_SPEED, MAX_SPEED);
    this.level = levelAt(this.distance);
    this.score += SCORE_PER_SECOND * dt * (1 + Math.min(0.5, (this.combo - 1) * 0.08));
    UI.setScore(this.score);
    UI.setCombo(this.combo);
    UI.setMode(this.rhythmMode
      ? `${this.rhythmBpm} BPM · BEAT ${Math.max(1, Math.floor(this.musicTime / this.beatMs) + 1)}`
      : `LEVEL ${this.level}`);
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - delta);
      this._updatePowerUI();
    }
    if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - delta);
      this.slideHoldMs += delta;
      // Hold-to-slide: a touch slide keeps going while the finger stays down
      if (this.slideTimer <= 0 && this._slideTouchHold && this._touchHeld && this.slideHoldMs < 1600) {
        this.slideTimer = 90;
      }
      if (!this._slideDustAt || this.time.now - this._slideDustAt > 90) {
        this._slideDustAt = this.time.now;
        this._dustPuff(this.pX + Phaser.Math.Between(-12, 12), PLAYER_ANCHOR_Y + 2, 2);
      }
    }
    this._updateCurveMap();
    this._updateCamera(dt);
    this._redrawTrack();
    this._updateAtmosphere();
    this._redrawHitLine();
    if (this.lightPulse) this.lightPulse.setAlpha((this.beatPulse || 0) * 0.045 + this.collectPulse * 0.035);
    if (this.bdG) { this.bdG.x = -this.farX * 0.45; this.bdG.y = this.farY * 0.5; }
    if (this.beatHalo) this.beatHalo.setPosition(this.pX, PLAYER_ANCHOR_Y - 40);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this._jump();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.sKey)) this._slide();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.aKey)) this._switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.dKey)) this._switchLane(1);

    // Snappy lane change: ~0.12s to arrive so the hitbox (which tracks the
    // visual position, see _playerLaneF) never lags far behind a key press.
    this.pX += (this._laneXZ(this.pLane, 0) - this.pX) * Math.min(1, 19 * dt);

    // Roof riding is positional: she stays up exactly while a wagon is under
    // her feet, and gravity takes over the moment she runs off its real end.
    const plat = this._wagonUnder();
    if (this.riding) {
      if (plat && this.jumpVel <= 0) {
        this.jumpH = WAGON_TOP;
        this.jumpVel = 0;
        this.jumpsUsed = 0;
      } else {
        this.riding = false; // jumped off or ran past the end
      }
    }
    if (!this.riding) {
      const wasAir = this.jumpH > 2;
      const prevH = this.jumpH;
      this.jumpVel -= GRAVITY * dt;
      this.jumpH += this.jumpVel * dt;
      if (plat && this.jumpVel < 0 && prevH >= WAGON_TOP - 16 && this.jumpH <= WAGON_TOP) {
        // caught a roof on the way down (re-landing after a roof jump)
        this.riding = true;
        this.jumpH = WAGON_TOP;
        this.jumpVel = 0;
        this.jumpsUsed = 0;
        this.landSquash = 1;
        audio.land();
        this._consumeBufferedInput();
      } else if (this.jumpH <= 0) {
        this.jumpH = 0; this.jumpVel = 0; this.jumpsUsed = 0;
        if (wasAir) this._onLand();
      }
    }

    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const obj = this.gameObjs[i];
      // Rhythm-timed objects are positioned purely from their beat time so they
      // always arrive at the player exactly on the downbeat.
      const prevZ = obj.z;
      if (obj.rhythmTimed) obj.z = SPAWN_Z * (obj.hitTime - this.musicTime) / this.approachMs;
      else obj.z -= this.speed * dt;

      // Drifting crates slide between lanes on approach and settle by z=450,
      // leaving the player ~0.6s to react once the final lane is committed.
      if (obj.drift) {
        obj.lane = Phaser.Math.Linear(obj.laneTo, obj.laneFrom, Phaser.Math.Clamp((obj.z - 450) / 750, 0, 1));
      }

      // Magnet: nearby coins fly to the player instead of teleport-collecting
      if (obj.type === 'coin' && !obj.checked) {
        if (!obj.pulling && this.magnetTimer > 0 && Math.abs(obj.lane - this.pLane) <= 1 && obj.z < 230 && obj.z > -30) {
          obj.pulling = true;
          obj.pullT = 0;
        }
        if (obj.pulling) {
          obj.pullT = Math.min(1, (obj.pullT || 0) + dt * 5.5);
          if (obj.pullT >= 1) this._collectLooseCoin(obj, 'Magnet');
        }
      }

      // Riding a roof: its coins collect one by one as they sweep past her
      if (obj.type === 'wagon' && this.riding && Math.abs(obj.lane - this._playerLaneF()) < 0.6) {
        for (const c of obj.coins) {
          if (c.collected) continue;
          const coinZ = Phaser.Math.Linear(obj.z + obj.worldL * 0.86, obj.z + obj.worldL * 0.18, c.lengthT);
          if (coinZ <= 30 && coinZ >= -60) {
            c.collected = true;
            c.obj.setVisible(false);
            c.shine.setVisible(false);
            this.coinCount++;
            this.combo = Math.min(this.combo + 0.15, 5);
            this._addScore(Math.round(COIN_SCORE * this.combo));
            UI.setCoins(this.coinCount);
            // Light feedback only: at roof-run cadence (~10 coins/s) the full
            // collection ring + beam stacks into visual mush over the player
            this._coinPop(c.obj.x, c.obj.y);
            this.collectPulse = Math.min(1, this.collectPulse + 0.4);
            audio.coin();
          }
        }
      }

      // Near-miss: an obstacle whips past in the adjacent lane
      if ((obj.type === 'obstacle' || obj.type === 'gate') && prevZ > 0 && obj.z <= 0 &&
          Math.abs(obj.lane - this.pLane) === 1 && this.runTime - this.lastNearMiss > 700) {
        this.lastNearMiss = this.runTime;
        this._toast('Close!', this.pX + (obj.lane - this.pLane) * 50, PLAYER_ANCHOR_Y - 110);
      }

      const cleanupZ = -(100 + (obj.worldL || 0));
      if (obj.consumed || obj.z < cleanupZ) {
        if (obj.rhythmTimed && obj.type === 'coin' && !obj.checked) this.rhythmStats.miss++;
        obj.parts.forEach(p => this._releaseObj(p));
        this.gameObjs.splice(i, 1);
        continue;
      }
      this._renderObj(obj);
      if (obj.deco) continue;
      const collectable = obj.type === 'coin' || obj.type === 'shield' || obj.type === 'magnet';
      const canCollide = obj.type === 'wagon'
        ? obj.z <= WAGON_LANDING_GRACE && obj.z >= -obj.worldL
        : collectable
          ? obj.z <= (obj.rhythmTimed ? 20 : 45) && obj.z >= -40
          : obj.z <= 30 && obj.z >= -30;
      if (canCollide) this._handleCollision(obj);
    }

    this._updateWorldScenery(dt);
    this._tryAdvanceWorld();
    this._updateSpeedLines(dt);
    this._updateChase(dt);
    if (this.rhythmMode) this._updateRhythmSpawner(delta);
    else if (this.runTime >= this.spawnCursor) this._spawnPattern();

    // Occasional overhead arch — pure scenery, sells the depth
    if (this.distance >= this.nextArchDist) {
      this.nextArchDist = this.distance + Phaser.Math.Between(2600, 4400);
      const gfx = this._pGfx(5);
      this.gameObjs.push({ type: 'arch', lane: 1, z: SPAWN_Z, deco: true, gfx, parts: [gfx], checked: true });
    }
    this._syncPlayer(time);
  }
}
