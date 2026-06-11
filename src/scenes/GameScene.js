import {
  W, H, DPR,
  JUMP_INIT, GRAVITY, WAGON_TOP, WAGON_LENGTH, WAGON_LANDING_GRACE,
  WAGON_RIDE_MIN_MS, WAGON_RIDE_MAX_MS, BASE_SPEED, MAX_SPEED, TOUCH_THRESHOLD,
  SCORE_PER_SECOND, COIN_SCORE, SHIELD_SCORE, MAGNET_SCORE, SLIDE_DURATION,
  MAGNET_DURATION, DOUBLE_JUMP_INIT, SAFE_START_MS,
  RHYTHM_BPM, RHYTHM_BEAT_MS, RHYTHM_APPROACH_BEATS, RHYTHM_APPROACH_MS,
  RHYTHM_BEAT_WINDOW_MS, RHYTHM_LANES,
  TURN_MAX_OFFSET, TURN_NEAR_FACTOR, TURN_CHANGE_MIN_MS, TURN_CHANGE_MAX_MS,
  LANE_SIDE, STORAGE_KEYS, saveNumber, loadNumber, bestKeys, bestSummary,
} from '../constants.js';
import {
  setupHiDPI, VP_X, NEAR_Y, HORIZON_Y, SPAWN_Z, TRACK_NEAR_HW,
  COLLECTION_RADIUS, PLAYER_ANCHOR_Y, PLAYER_DRAW_SCALE, PLAYER_VISUAL_LIFT,
  TIE_SPACING, zT, zY, zSc, zTopY,
} from '../projection.js';
import {
  WORLDS, WORLD_SCORE, bdJungle, bdSavanna, bdReef, bdDeep,
  drawWorldWall, drawWorldScenery,
} from '../worlds.js';
import { audio, unlockAudio } from '../audio.js';

// ─── Game scene ───────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    this.rhythmMode = data.rhythmMode === true;
  }

  create() {
    // Clear references to display objects from a previous run of this scene —
    // after scene.restart they point at destroyed objects and must not be used.
    this.worldBanner = null;
    this.hitLineG = null;
    this.hitLineGlow = null;
    this.beatHalo = null;
    this.beatTxt = null;
    this.pauseOverlay = null;
    this.camBase = setupHiDPI(this);
    this.cameras.main.setRotation(0);
    this.cam = { x: 0, vel: 0, lean: 0, dip: 0, dipVel: 0 };
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
    this.jumpsUsed = 0;
    this.level = 1;
    this.trackTurn = 0;
    this.targetTrackTurn = 0;
    this.nextTurnAt = TURN_CHANGE_MIN_MS;
    this.turnSway = 0;
    this.nextRhythmBeat = RHYTHM_APPROACH_BEATS;
    this.lastBeatPulse = -1;
    this.musicTime = 0;
    this.beatPulse = 0;
    this.collectPulse = 0;
    this.playerBounce = 0;
    this.footstepPulse = 0;

    this.pLane = 1;
    this.pX = this._laneXZ(1, 0);
    this.jumpH = 0;
    this.jumpVel = 0;
    this.rideTimer = 0;

    this.gameObjs = [];

    this._buildBg();
    this._buildWorldLayer();
    this._buildTrack();
    this._buildHitLine();
    this._buildSpeedLines();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();
    if (!this.rhythmMode) this._scheduleNextSpawn(900);

    if (this.rhythmMode) audio.playRhythm();
    else audio.playGame();
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
    });
  }

  // ── World visual layer (backdrop + scenery, rebuilt on world change) ─────────

  _buildWorldLayer() {
    this._worldGfx.forEach(g => g.destroy()); this._worldGfx = [];
    this.worldScenery.forEach(s => s.gfx.destroy()); this.worldScenery = [];
    const w = WORLDS[this.worldIdx];
    this._buildWorldBackdrop(w);
    this._buildWorldScenery(w);
    if (this.worldBanner) this._refreshWorldBanner();
  }

  _regW(gfx) { this._worldGfx.push(gfx); return gfx; }

  _buildWorldBackdrop(w) {
    const g = this._regW(this.add.graphics().setDepth(0));
    this.bdG = g; // drifts sideways with track turns for horizon parallax
    const mid = HORIZON_Y * 0.55;
    g.fillGradientStyle(w.sky[0],w.sky[0],w.sky[1],w.sky[1],1);
    g.fillRect(-60,0,W+120,mid);
    g.fillGradientStyle(w.sky[1],w.sky[1],w.sky[2],w.sky[2],1);
    g.fillRect(-60,mid,W+120,H-mid);

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
    const w=WORLDS[this.worldIdx];
    const flash=this.add.text(W/2,H/2,`WORLD ${w.no}\n${w.name}`,{fontSize:'28px',fontFamily:'Arial Black,Arial',fill:w.accentStr,stroke:'#000000',strokeThickness:6,align:'center'}).setOrigin(0.5).setDepth(50).setAlpha(1);
    this.tweens.add({targets:flash,alpha:0,y:H/2-50,duration:1800,ease:'Power2',onComplete:()=>flash.destroy()});
  }

  _refreshWorldBanner() {
    const w=WORLDS[this.worldIdx];
    if(this.worldBanner) this.worldBanner.setText(`WORLD ${w.no} · ${w.name}`).setStyle({fill:w.accentStr});
  }

  // ── Static background ───────────────────────────────────────────────────────
  _buildBg() {
    // World backdrop (depth 0) provides sky + ground; only keep the combo flash overlay
    this.lightPulse = this.add.rectangle(W / 2, H / 2, W, H, 0x00e5ff, 0).setDepth(0.8);
  }

  _trackHalfWidth(t) {
    // Slight FOV widening with speed sells acceleration without moving the camera
    const speedFrac = this.speed ? (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) : 0;
    const boost = 1 + speedFrac * 0.08 * Math.min(Phaser.Math.Clamp(t, 0, 1.5), 1);
    return TRACK_NEAR_HW * Phaser.Math.Clamp(t, 0, 1.5) * boost;
  }

  _curveOffset(t) {
    const horizonWeight = 1 - t * (1 - TURN_NEAR_FACTOR);
    return this.trackTurn * horizonWeight + Math.sin((t + this.turnSway) * Math.PI) * this.trackTurn * 0.1 * (1 - t);
  }

  _curveCenterX(t) {
    // Lateral camera offset: near geometry shifts fully, the vanishing point
    // stays put — pure camera translation, so lane changes slide the world.
    const camX = this.cam ? this.cam.x : 0;
    return VP_X + this._curveOffset(t) - camX * Math.min(t, 1.5);
  }

  _laneXZ(lane, z) {
    const t = zT(z);
    return this._curveCenterX(t) + LANE_SIDE[lane] * this._trackHalfWidth(t) * 0.667;
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

  _updateCamera(dt) {
    // Critically-damped spring chasing 80% of the player's lane offset, so the
    // runner rests slightly off-center and the world slides on lane changes.
    const target = LANE_SIDE[this.pLane] * TRACK_NEAR_HW * 0.667 * 0.8;
    this.cam.vel += ((target - this.cam.x) * 70 - this.cam.vel * 16) * dt;
    this.cam.x += this.cam.vel * dt;

    // Roll into the strafe, ease back upright
    const leanTarget = Phaser.Math.Clamp(this.cam.vel * 0.00035, -0.04, 0.04);
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
  }

  _dustPuff(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const puff = this.add.circle(x + Phaser.Math.FloatBetween(-14, 14), y, Phaser.Math.FloatBetween(2.5, 5), 0xcfd8dc, 0.4).setDepth(6.5);
      this.tweens.add({
        targets: puff,
        x: puff.x + Phaser.Math.FloatBetween(-26, 26),
        y: y - Phaser.Math.FloatBetween(4, 16),
        scale: 0.2,
        alpha: 0,
        duration: Phaser.Math.Between(240, 420),
        ease: 'Quad.easeOut',
        onComplete: () => puff.destroy(),
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
      const y = HORIZON_Y + t * (NEAR_Y - HORIZON_Y);
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

    // Ground fill: extends to screen bottom so the camera-floor wraps the player
    g.fillGradientStyle(w.grd.far, w.grd.far, w.grd.near, w.grd.near, 1);
    g.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

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
      g.fillStyle(base, 0.5 + t1 * 0.35);
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

    // Horizon glow line in accent colour
    hg.lineStyle(14, w.accent, 0.07 + comboEnergy * 0.06);
    hg.beginPath(); hg.moveTo(0, HORIZON_Y); hg.lineTo(W, HORIZON_Y); hg.strokePath();
    hg.lineStyle(2.5, w.accent, 0.75 + comboEnergy * 0.2);
    hg.beginPath(); hg.moveTo(0, HORIZON_Y); hg.lineTo(W, HORIZON_Y); hg.strokePath();
  }

  _buildPlayer() {
    const d = 7;
    this.shadow = this.add.ellipse(this._laneXZ(1, 0), NEAR_Y + 4, 48, 16, 0x000000).setAlpha(0.5).setDepth(d - 1);
    this.vis = {
      aura: this.add.ellipse(0, 0, 58, 82, 0xffa726, 0).setDepth(d - 0.45),
      collectTrail: this.add.ellipse(0, 0, 86, 20, 0x00e5ff, 0.08).setDepth(d - 0.6),
      armL: this.add.rectangle(0, 0, 9, 24, 0xe91e8c).setDepth(d - 0.2),
      armR: this.add.rectangle(0, 0, 9, 24, 0xe91e8c).setDepth(d - 0.2),
      legL: this.add.rectangle(0, 0, 13, 26, 0x1565c0).setDepth(d),
      legR: this.add.rectangle(0, 0, 13, 26, 0x1565c0).setDepth(d),
      body: this.add.rectangle(0, 0, 34, 36, 0xe91e8c).setDepth(d + 0.1),
      backStripe: this.add.rectangle(0, 0, 5, 28, 0xff9bd0).setDepth(d + 0.2),
      head: this.add.circle(0, 0, 13, 0xffcc99).setDepth(d + 0.15),
      hair: this.add.circle(0, 0, 15.5, 0x5d4037).setDepth(d + 0.3),
      hairShine: this.add.ellipse(0, 0, 16, 8, 0x6d4c41).setDepth(d + 0.34),
      headphoneL: this.add.ellipse(0, 0, 5, 9, 0x1c262b).setDepth(d + 0.45),
      headphoneR: this.add.ellipse(0, 0, 5, 9, 0x1c262b).setDepth(d + 0.45),
      headphoneBand: this.add.rectangle(0, 0, 28, 3.5, 0x1c262b).setDepth(d + 0.44),
      ponytail: this.add.ellipse(0, 0, 9, 24, 0x4e342e).setDepth(d + 0.36),
      bow: this.add.triangle(0, 0, -7, -4, -7, 4, 7, 0, 0xffd54f).setDepth(d + 0.5),
      shield: this.add.ellipse(0, 0, 68, 88, 0x4fc3f7, 0.16).setStrokeStyle(3, 0x81d4fa, 0.92).setDepth(d + 1).setVisible(false),
      collectGlow: this.add.circle(0, 0, COLLECTION_RADIUS, 0xfff176, 0.08).setStrokeStyle(3, 0xfff176, 0.5).setDepth(d + 0.9).setVisible(this.rhythmMode),
      bodyGlow: this.add.ellipse(0, 0, 56, 78, 0xfff176, 0.05).setDepth(d + 0.05),
      magnet: this.add.circle(0, 0, 42, 0xba68c8, 0.12).setStrokeStyle(3, 0xf3e5f5, 0.8).setDepth(d + 1).setVisible(false),
    };
  }

  _syncPlayer(t) {
    const x = this.pX;
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    const grounded = this.jumpH < 2;
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
    const tilt = (grounded ? 0 : Phaser.Math.Clamp(-this.jumpVel / 3000, -0.18, 0.18)) + laneLean + flipRot;

    const sy = PLAYER_ANCHOR_Y - PLAYER_VISUAL_LIFT - this.jumpH - this.playerBounce * 11 - bob;
    // fieldY: the collection zone hovers just in front of the runner (toward horizon)
    const fieldY = PLAYER_ANCHOR_Y - 40 - this.jumpH * 0.18;
    const sFrac = Math.max(0.35, 1 - this.jumpH / 130);
    const ps = PLAYER_DRAW_SCALE * (1 + this.playerBounce * 0.035);
    const pos = (offset) => offset * ps;
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
      .setPosition(x, sy + pos(6))
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
      .setPosition(x, sy + pos(3))
      .setScale(ps * (1 + comboEnergy * 0.16 + this.collectPulse * 0.15))
      .setAlpha(0.03 + comboEnergy * 0.1 + this.collectPulse * 0.1);
    this.vis.shield.setPosition(x, sy + pos(2)).setScale(shieldScale).setVisible(this.shieldCharges > 0);
    this.vis.magnet.setPosition(x, fieldY).setScale(ps * (1 + Math.sin(t / 110) * 0.08)).setVisible(this.magnetTimer > 0);
    // Shadow sits on the ground plane just below the player's feet
    this.shadow.setPosition(x, PLAYER_ANCHOR_Y + 4).setScale(sFrac * ps * 1.3, sFrac * ps * 0.5).setAlpha(sFrac * 0.55);

    // ── Body (back-facing) ──
    const legLift = tuck * 9;
    this.vis.legL.setPosition(x - pos(sliding ? 17 : 9), sy + pos((sliding ? 28 : 33) - legLift))
      .setScale(ps * (sliding ? 1.55 : 1) * sqX, ps * (sliding ? 0.52 : (1 + swing * 0.45) * (1 - tuck * 0.45)) * sqY)
      .setRotation(sliding ? 0.35 : tuck * 0.5 + laneLean);
    this.vis.legR.setPosition(x + pos(sliding ? 15 : 9), sy + pos((sliding ? 31 : 33) - legLift))
      .setScale(ps * (sliding ? 1.55 : 1) * sqX, ps * (sliding ? 0.52 : (1 - swing * 0.45) * (1 - tuck * 0.45)) * sqY)
      .setRotation(sliding ? 0.35 : -tuck * 0.5 + laneLean);
    this.vis.body.setPosition(x, sy + pos(sliding ? 17 : 7)).setScale(ps * sqX, ps * (sliding ? 0.62 : 1) * sqY).setRotation(sliding ? Math.PI / 2 : tilt + swing * 0.04);
    this.vis.backStripe.setPosition(x, sy + pos(sliding ? 17 : 7)).setScale(ps * sqX, ps * (sliding ? 0.62 : 1) * sqY).setRotation(sliding ? Math.PI / 2 : tilt + swing * 0.04);
    this.vis.armL.setPosition(x - pos(sliding ? 18 : 20), sy + pos(sliding ? 19 : 9 - tuck * 6)).setScale(ps).setRotation(sliding ? 1.15 : swing * 0.42 - tuck * 0.7 + laneLean);
    this.vis.armR.setPosition(x + pos(sliding ? 18 : 20), sy + pos(sliding ? 19 : 9 - tuck * 6)).setScale(ps).setRotation(sliding ? 1.15 : -swing * 0.42 + tuck * 0.7 + laneLean);

    // ── Head — back-facing view ──
    // The character runs away from the camera: hair circle covers the skull,
    // headphone cups peek out at the sides, and the ponytail swings below.
    const headX = x + pos(sliding ? 31 : 0);
    const headY = sy + pos(sliding ? 11 : -22);
    const headRot = sliding ? Math.PI / 2 : tilt;
    const tailSwing = grounded && !sliding ? Math.sin(t / 164) * 3.5 : 0;

    // From behind only hair is visible; the skin circle is just a neck hint
    this.vis.head.setPosition(headX, headY + pos(6)).setScale(ps).setRotation(headRot);
    this.vis.hair.setPosition(headX, headY).setScale(ps).setRotation(headRot);
    this.vis.hairShine.setPosition(headX - pos(3), headY - pos(7)).setScale(ps).setRotation(headRot - 0.35);
    this.vis.headphoneL.setPosition(headX - pos(sliding ? 0 : 15), headY + pos(sliding ? -15 : 1)).setScale(ps).setRotation(headRot);
    this.vis.headphoneR.setPosition(headX + pos(sliding ? 0 : 15), headY + pos(sliding ? 15 : 1)).setScale(ps).setRotation(headRot);
    this.vis.headphoneBand.setPosition(headX, headY - pos(sliding ? 0 : 14)).setScale(ps).setRotation(headRot);
    // High side ponytail: swings with the run cycle and whips on lane changes
    const whip = laneLean * -42;
    this.vis.ponytail.setPosition(headX + pos(sliding ? -20 : 11 + tailSwing + whip), headY + pos(sliding ? -11 : 4)).setScale(ps).setRotation(headRot + (sliding ? -0.5 : 0.42 + tailSwing * 0.06 + whip * 0.02));
    this.vis.bow.setPosition(headX + pos(sliding ? -14 : 9), headY + pos(sliding ? -9 : -9)).setScale(ps).setRotation(sliding ? Math.PI * 0.75 : -Math.PI / 4);
  }

  _buildUI() {
    this.uiPanel = this.add.rectangle(W / 2, 38, W, 76, 0x020711, 0.58).setDepth(20);
    this.add.rectangle(W / 2, 77, W, 2, 0x00e5ff, 0.14).setDepth(21);

    // Gameplay-first HUD: combo is the primary rhythm reward, score is second,
    // coins and powerups are secondary, and technical BPM/beat data is tucked
    // below the main readout.
    this.comboTxt = this.add.text(W / 2, 30, 'x1.0', {
      fontSize: '38px', fontFamily: 'Arial Black, Arial', fill: '#fff176', stroke: '#241a00', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(22);
    this.comboLabel = this.add.text(W / 2, 62, 'COMBO', {
      fontSize: '10px', fontFamily: 'Arial Black, Arial', fill: '#ffe082', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(22).setAlpha(0.82);

    this.scoreLabel = this.add.text(58, 16, 'SCORE', {
      fontSize: '9px', fontFamily: 'Arial Black, Arial', fill: '#89dfff', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(22).setAlpha(0.72);
    this.scoreTxt = this.add.text(58, 39, '0', {
      fontSize: '24px', fontFamily: 'Arial Black, Arial', fill: '#ffffff', stroke: '#00121f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(22);

    this.add.circle(W - 110, 32, 9, 0xffd700).setDepth(22);
    this.coinTxt = this.add.text(W - 52, 32, '0', {
      fontSize: '19px', fontFamily: 'Arial Black, Arial', fill: '#ffd700', stroke: '#1b1200', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(22);
    this.modeTxt = this.add.text(W / 2, 82, this.rhythmMode ? 'RHYTHM RUN' : 'ENDLESS RUN', {
      fontSize: '10px', fontFamily: 'Arial Black, Arial', fill: '#b2ebff', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(22).setAlpha(0.56);

    this.powerTxt = this.add.text(18, 100, 'MAGNET —', {
      fontSize: '11px', fontFamily: 'Arial Black, Arial', fill: '#ce93d8', stroke: '#130018', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(21).setAlpha(0.78);
    this.shieldTxt = this.add.text(W - 18, 100, 'SHIELD —', {
      fontSize: '11px', fontFamily: 'Arial Black, Arial', fill: '#81d4fa', stroke: '#00121f', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(21).setAlpha(0.78);

    if (this.rhythmMode) {
      this.beatHalo = this.add.circle(W / 2, PLAYER_ANCHOR_Y - 40, COLLECTION_RADIUS, 0xfff176, 0.08).setStrokeStyle(3, 0xfff176, 0.45).setDepth(16);
      this.beatTxt = this.add.text(W / 2, 112, '128 BPM', {
        fontSize: '10px', fontFamily: 'Arial Black, Arial', fill: '#fff176', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(21).setAlpha(0.58);
    }

    this.pauseBtn = this.add.rectangle(W - 28, 32, 34, 34, 0x17212f, 0.94).setInteractive({ useHandCursor: true }).setDepth(22);
    this.pauseBtn.setStrokeStyle(1, 0x80deea, 0.45);
    this.add.text(W - 28, 32, 'II', { fontSize: '16px', fontFamily: 'Arial Black, Arial', fill: '#dff7ff' }).setOrigin(0.5).setDepth(23);
    this.pauseBtn.on('pointerdown', () => { unlockAudio(); this._togglePause(); });
    this._updatePowerUI();
    this._updateShieldUI();

    // World banner
    const w0 = WORLDS[0];
    this.worldBanner = this.add.text(W/2, H-26, `WORLD ${w0.no} · ${w0.name}`, {
      fontSize:'12px', fontFamily:'Arial Black,Arial', fill:w0.accentStr,
      stroke:'#000000', strokeThickness:4, backgroundColor:'#00000088', padding:{x:9,y:4},
    }).setOrigin(0.5).setDepth(22);
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

    this.input.on('pointerdown', p => { unlockAudio(); this._touch = { x: p.x, y: p.y, t: this.time.now }; });
    this.input.on('pointerup', p => {
      if (!this._touch || this.pausedRun || !this.alive) return;
      const dx = p.x - this._touch.x;
      const dy = p.y - this._touch.y;
      const thr = TOUCH_THRESHOLD * DPR; // pointer coords are in framebuffer pixels
      if (Math.abs(dy) > Math.abs(dx) && dy < -thr) this._jump();
      else if (Math.abs(dy) > Math.abs(dx) && dy > thr) this._slide();
      else if (Math.abs(dx) > thr) this._switchLane(dx > 0 ? 1 : -1);
      this._touch = null;
    });
  }

  _jump() {
    if (!this.alive || this.pausedRun || this.slideTimer > 0) return;
    const grounded = this.jumpH < 2 || this.rideTimer > 0;
    if (grounded || this.jumpsUsed < 2) {
      this.rideTimer = 0;
      this.jumpVel = grounded ? JUMP_INIT : DOUBLE_JUMP_INIT;
      if (!grounded) this.flipT = 1; // front-flip on the double jump
      this.jumpsUsed = grounded ? 1 : this.jumpsUsed + 1;
      this.combo = Math.max(1, this.combo);
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
      this.tweens.pauseAll();
      this.time.paused = true;
      this._showPauseOverlay();
    } else {
      if (this.rhythmMode) audio.playRhythm();
      else audio.playGame();
      this.tweens.resumeAll();
      this.time.paused = false;
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
    resume.on('pointerdown', () => { unlockAudio(); this._togglePause(); });
    menu.on('pointerdown', () => { unlockAudio(); audio.stop(); this.scene.start('Boot'); });
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

  // ── Rhythm mode helpers ────────────────────────────────────────────────────
  _rhythmLaneForBeat(beatIndex) {
    return RHYTHM_LANES[beatIndex % RHYTHM_LANES.length];
  }

  _spawnRhythmCoin(beatIndex, hitTime) {
    const lane = this._rhythmLaneForBeat(beatIndex);
    const coin = this.add.circle(0, 0, 1, 0xfff176).setDepth(6);
    const shine = this.add.circle(0, 0, 1, 0xffffff, 0.78).setDepth(7);
    const ring = this.add.circle(0, 0, 1, 0xff00ff, 0.12).setStrokeStyle(2, 0x00e5ff, 0.9).setDepth(6);
    this.gameObjs.push({
      type: 'coin', lane, z: SPAWN_Z, worldW: 60, worldH: 60,
      parts: [ring, coin, shine], ring, coin, shine, checked: false,
      beatIndex, hitTime, rhythmTimed: true,
    });
  }

  _spawnRhythmObstacle(beatIndex) {
    const coinLane = this._rhythmLaneForBeat(beatIndex);
    const lane = Phaser.Utils.Array.GetRandom([0, 1, 2].filter(v => v !== coinLane));
    const gfx = this.add.graphics().setDepth(5);
    this.gameObjs.push({
      type: 'obstacle', lane, z: SPAWN_Z, worldH: 46, worldW: 34, worldD: 30, color: 0x4527a0,
      gfx, parts: [gfx], checked: false,
      hitTime: beatIndex * RHYTHM_BEAT_MS, rhythmTimed: true,
    });
  }

  _resyncRhythm(newMusicTime) {
    this.musicTime = newMusicTime;
    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const o = this.gameObjs[i];
      if (o.rhythmTimed) {
        o.parts.forEach(p => p.destroy());
        this.gameObjs.splice(i, 1);
      }
    }
    this.nextRhythmBeat = Math.max(RHYTHM_APPROACH_BEATS, Math.floor(newMusicTime / RHYTHM_BEAT_MS) + 2);
    this.lastBeatPulse = -1;
  }

  _updateRhythmSpawner() {
    const currentBeat = Math.floor(this.musicTime / RHYTHM_BEAT_MS);
    if (currentBeat !== this.lastBeatPulse) {
      this.lastBeatPulse = currentBeat;
      this.beatPulse = 1;
      if (this.beatHalo) {
        this.beatHalo.setPosition(this.pX, PLAYER_ANCHOR_Y - 40).setScale(1.35).setAlpha(0.18);
        this.tweens.add({ targets: this.beatHalo, scale: 1, alpha: 0.08, duration: RHYTHM_BEAT_MS * 0.75, ease: 'Sine.easeOut' });
      }
    }

    const lookaheadHitTime = this.musicTime + RHYTHM_APPROACH_MS;
    while (this.nextRhythmBeat * RHYTHM_BEAT_MS <= lookaheadHitTime) {
      const hitTime = this.nextRhythmBeat * RHYTHM_BEAT_MS;
      this._spawnRhythmCoin(this.nextRhythmBeat, hitTime);
      if (this.musicTime > 6500 && this.nextRhythmBeat % 8 === 6) this._spawnRhythmObstacle(this.nextRhythmBeat);
      this.nextRhythmBeat += 1;
    }
  }

  // ── Spawn helpers ───────────────────────────────────────────────────────────
  _difficulty() {
    return Phaser.Math.Clamp(this.runTime / 90000, 0, 1);
  }

  _scheduleNextSpawn(extra = 0) {
    const difficulty = this._difficulty();
    const minGap = Phaser.Math.Linear(1300, 850, difficulty);
    const maxGap = Phaser.Math.Linear(2100, 1350, difficulty);
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
        this._spawnCrate(lane, SPAWN_Z + 330, { h: 44 });
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
        [0, 1, 2].filter(l => l !== open).forEach(l => this._spawnCrate(l, SPAWN_Z, { h: 78, w: 52 }));
        this._spawnCoinLine(open, SPAWN_Z - 60, 5);
      } },
      { w: 5, fn: () => this._spawnShield(pickFree(), SPAWN_Z) },
      { w: 5, fn: () => { const l = pickFree(); this._spawnMagnet(l, SPAWN_Z); this._spawnCoinLine(l, SPAWN_Z + 180, 4); } },
    ];
    return this._patterns;
  }

  _spawnCrate(lane, z, { h = Phaser.Math.Between(42, 68), w = Phaser.Math.Between(34, 50) } = {}) {
    const color = Phaser.Utils.Array.GetRandom([0xd32f2f, 0xe65100, 0x5d4037]);
    const gfx = this.add.graphics().setDepth(5);
    this.gameObjs.push({ type: 'obstacle', lane, z, worldH: h, worldW: w, worldD: Phaser.Math.Between(28, 44), color, gfx, parts: [gfx], checked: false });
  }

  _spawnGate(lane, z) {
    const gfx = this.add.graphics().setDepth(5);
    this.gameObjs.push({ type: 'gate', lane, z, worldH: 86, worldW: 74, gfx, parts: [gfx], checked: false });
  }

  _spawnShield(lane = Phaser.Math.Between(0, 2), z = SPAWN_Z) {
    const shadow = this.add.ellipse(0, 0, 1, 1, 0x000000, 0.16).setDepth(4.5);
    const ring = this.add.circle(0, 0, 1, 0x4fc3f7, 0.18).setStrokeStyle(2, 0xb3e5fc, 0.95).setDepth(6);
    const core = this.add.circle(0, 0, 1, 0x81d4fa, 0.9).setDepth(6);
    const glint = this.add.circle(0, 0, 1, 0xffffff, 0.75).setDepth(7);
    this.gameObjs.push({ type: 'shield', lane, z, worldW: 44, worldH: 44, parts: [shadow, ring, core, glint], shadow, ring, core, glint, checked: false });
  }

  _spawnMagnet(lane = Phaser.Math.Between(0, 2), z = SPAWN_Z) {
    const shadow = this.add.ellipse(0, 0, 1, 1, 0x000000, 0.16).setDepth(4.5);
    const ring = this.add.circle(0, 0, 1, 0x8e24aa, 0.2).setStrokeStyle(2, 0xf3e5f5, 0.95).setDepth(6);
    const core = this.add.rectangle(0, 0, 1, 1, 0xba68c8).setDepth(7);
    const spark = this.add.circle(0, 0, 1, 0xffffff, 0.82).setDepth(8);
    this.gameObjs.push({ type: 'magnet', lane, z, worldW: 44, worldH: 44, parts: [shadow, ring, core, spark], shadow, ring, core, spark, checked: false });
  }

  _spawnCoin(lane, z, elev = 42) {
    const shadow = this.add.ellipse(0, 0, 1, 1, 0x000000, 0.14).setDepth(4.5);
    const ring = this.add.circle(0, 0, 1, 0xfff176, 0.1).setStrokeStyle(2, 0xfff176, 0.55).setDepth(5);
    const coin = this.add.circle(0, 0, 1, 0xffd700).setDepth(6);
    const shine = this.add.circle(0, 0, 1, 0xfff59d, 0.72).setDepth(7);
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
    const gfx = this.add.graphics().setDepth(5);
    const numCoins = Phaser.Math.Between(5, 8);
    const coins = [];
    for (let i = 0; i < numCoins; i++) {
      const t = numCoins > 1 ? i / (numCoins - 1) : 0.5;
      coins.push({
        obj: this.add.circle(0, 0, 1, 0xffd700).setDepth(6),
        shine: this.add.circle(0, 0, 1, 0xffe082).setAlpha(0.7).setDepth(6),
        fracX: Phaser.Math.FloatBetween(-0.2, 0.2),
        lengthT: t,
        collected: false,
      });
    }
    this.gameObjs.push({ type: 'wagon', lane, z, worldW: 96, worldH: 54, worldL: WAGON_LENGTH, carIdx, gfx, coins, parts: [gfx, ...coins.flatMap(c => [c.obj, c.shine])], checked: false });
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

  _renderObj(obj) {
    const z = obj.z;
    const sy = zY(z);
    const sc = zSc(z);
    const visible = z <= SPAWN_Z * 1.05;
    obj.parts.forEach(part => part.setVisible(visible));
    if (!visible) return;

    const t = zT(z);
    const x = this._laneXZ(obj.lane, z);
    const dp = 4 + Math.min(t, 1) * 5;

    if (obj.type === 'obstacle') {
      const g = obj.gfx;
      g.clear();
      this._drawGroundShadow(g, x, sy, obj.worldW * sc * 1.5);
      const f = this._drawBox(g, obj.lane, z, obj.worldW, obj.worldH, obj.worldD || 32, obj.color);
      // Plank detail on the front face
      g.lineStyle(Math.max(1, 1.5 * sc), 0x000000, 0.14);
      g.beginPath();
      g.moveTo(f.xF - f.hwF, f.tF + (f.bF - f.tF) * 0.5);
      g.lineTo(f.xF + f.hwF, f.tF + (f.bF - f.tF) * 0.5);
      g.strokePath();
      g.setDepth(dp);
    }

    if (obj.type === 'gate') {
      const g = obj.gfx;
      g.clear();
      const sw = obj.worldW;
      this._drawGroundShadow(g, x, sy, sw * sc * 1.3, 0.2);
      // Posts: thin 3D boxes at the gate edges
      this._drawBox(g, obj.lane, z, 9, obj.worldH, 14, 0x5d4037, { fracX: -sw / 2 });
      this._drawBox(g, obj.lane, z, 9, obj.worldH, 14, 0x5d4037, { fracX: sw / 2 });
      // Glowing beam across the top — slide under it
      const pulseA = 0.5 + Math.sin(this.time.now / 90) * 0.16;
      const beam = this._drawBox(g, obj.lane, z, sw, 13, 10, 0xc62828, { base: obj.worldH - 13 });
      g.fillStyle(0xff8a80, pulseA * 0.5);
      g.fillRect(beam.xF - beam.hwF * 1.06, beam.tF - 3 * sc, beam.hwF * 2.12, (beam.bF - beam.tF) + 6 * sc);
      g.setDepth(dp);
    }

    if (obj.type === 'shield' || obj.type === 'magnet') {
      const pulse = 1 + Math.sin(this.time.now / 130) * 0.08;
      const r = Math.max(3, 18 * sc * pulse);
      const cy = zTopY(z, 48);
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
      let r = Math.max(4, (obj.hitTime ? 21 : 17.5) * sc * pulse);
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
      const topY = zTopY(z, 175);
      const postW = Math.max(2, 7 * sc);
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
      // Train car: one long 3D box; the roof top-face is the walkable deck
      const bodyCol = obj.carIdx % 2 === 0 ? 0x4e342e : 0x5d4037;
      const f = this._drawBox(g, obj.lane, z, obj.worldW, WAGON_TOP, L, bodyCol, { topColor: 0x6d4c41 });
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
      const wr = Math.max(2, 9 * sc);
      g.fillStyle(0x111111, 1);
      g.fillCircle(f.xF - f.hwF * 0.55, f.bF, wr);
      g.fillCircle(f.xF + f.hwF * 0.55, f.bF, wr);
      // While the player can stand on the roof, the car must render below her
      g.setDepth(z < 60 ? 6.5 : dp);
      obj.coins.forEach(c => {
        if (c.collected) return;
        const coinZ = Phaser.Math.Linear(z + L * 0.86, z + L * 0.18, c.lengthT);
        c.obj.setVisible(true);
        c.shine.setVisible(true);

        const coinSc = zSc(coinZ);
        const coinX = this._laneXZ(obj.lane, coinZ) + c.fracX * obj.worldW * coinSc;
        const coinTop = zTopY(coinZ, WAGON_TOP);
        const cr = Math.max(3, 15.75 * coinSc);
        const cy = coinTop - cr - 4 * coinSc;
        const coinDepth = 5 + Math.min(zT(coinZ), 1) * 5;
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
        const remainingLength = Math.max(0, obj.z + obj.worldL);
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
            this._collectionFeedback(c.obj.x, c.obj.y, 0xffd700);
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
    let rhythmBonus = 0;
    let rhythmLabel = null;
    if (obj.hitTime) {
      const timing = Math.abs(this.musicTime - obj.hitTime);
      if (timing <= 70) { rhythmBonus = 35; rhythmLabel = 'Perfect beat!'; }
      else if (timing <= RHYTHM_BEAT_WINDOW_MS) { rhythmBonus = 18; rhythmLabel = 'Good beat'; }
      else { rhythmLabel = 'Off beat'; }
    }
    this.combo = Math.min(this.combo + (obj.hitTime && rhythmBonus > 0 ? 0.4 : 0.25), 5);
    this._addScore(Math.round((COIN_SCORE + rhythmBonus) * this.combo), label || rhythmLabel || (this.combo >= 2 ? `Streak x${this.combo.toFixed(1)}` : null));
    this.coinTxt.setText(this.coinCount);
    this._coinPop(obj.coin.x, obj.coin.y);
    this._collectionFeedback(obj.coin.x, obj.coin.y, obj.hitTime ? 0xfff176 : 0xffd700);
    audio.coin();
  }

  _updatePowerUI() {
    this.powerTxt.setText(this.magnetTimer > 0 ? `MAGNET ${Math.ceil(this.magnetTimer / 1000)}s` : 'MAGNET —');
    this.powerTxt.setAlpha(this.magnetTimer > 0 ? 1 : 0.62);
  }

  _updateShieldUI() {
    this.shieldTxt.setText(this.shieldCharges > 0 ? 'SHIELD ON' : 'SHIELD —');
    this.shieldTxt.setAlpha(this.shieldCharges > 0 ? 1 : 0.62);
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

  _collectionFeedback(x, y, color = 0xfff176) {
    this.collectPulse = 1;
    this.playerBounce = Math.min(1, 0.55 + Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1) * 0.45);
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    const fieldY = PLAYER_ANCHOR_Y - 42;
    const ring = this.add.circle(this.pX, fieldY, COLLECTION_RADIUS * 0.62, color, 0.08)
      .setStrokeStyle(3 + comboEnergy * 3, color, 0.82)
      .setDepth(21);
    this.tweens.add({
      targets: ring,
      radius: COLLECTION_RADIUS * (1.22 + comboEnergy * 0.3),
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    const beam = this.add.line(0, 0, x, y, this.pX, fieldY, color, 0.42 + comboEnergy * 0.18).setOrigin(0, 0).setLineWidth(3 + comboEnergy * 2).setDepth(20);
    this.tweens.add({ targets: beam, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => beam.destroy() });

    const burstCount = 5 + Math.round(comboEnergy * 5);
    for (let i = 0; i < burstCount; i++) {
      const spark = this.add.circle(this.pX, fieldY, Phaser.Math.FloatBetween(2, 4 + comboEnergy * 2), color, 0.78).setDepth(21);
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
        onComplete: () => spark.destroy(),
      });
    }
  }

  _coinPop(x, y) {
    const t = this.add.text(x, y, '+1', { fontSize: '20px', fontFamily: 'Arial Black', fill: '#fff176', stroke: '#3b2700', strokeThickness: 3 }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 520, ease: 'Power2', onComplete: () => t.destroy() });
    for (let i = 0; i < 7; i++) {
      const spark = this.add.circle(x, y, Phaser.Math.FloatBetween(2, 4), i % 2 ? 0x00e5ff : 0xfff176, 0.86).setDepth(21);
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
        onComplete: () => spark.destroy(),
      });
    }
  }

  _gameOver(reason = 'Run ended') {
    if (!this.alive) return;
    this.alive = false;
    audio.gameOver();

    const finalScore = Math.floor(this.score);
    const keys = bestKeys(this.rhythmMode);
    const oldBest = loadNumber(keys.score);
    const oldCoins = loadNumber(keys.coins);
    const newBest = finalScore > oldBest;
    if (newBest) saveNumber(keys.score, finalScore);
    if (this.coinCount > oldCoins) saveNumber(keys.coins, this.coinCount);

    // Crash impact: shake + flash first, the panel lands after a short beat
    this.cameras.main.shake(280, 0.014);
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.3).setDepth(25);
    this.time.delayedCall(200, () => flash.destroy());

    this.time.delayedCall(320, () => {
      this.cameras.main.setRotation(0);
      this.add.rectangle(W / 2, H / 2, 348, 326, 0x000000, 0.9).setDepth(25);
      this.add.text(W / 2, H / 2 - 122, 'GAME OVER', { fontSize: '40px', fontFamily: 'Arial Black, Arial', fill: '#ff6b6b', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(26);
      this.add.text(W / 2, H / 2 - 76, reason, { fontSize: '16px', fontFamily: 'Arial', fill: '#cfd8dc' }).setOrigin(0.5).setDepth(26);
      this.add.text(W / 2, H / 2 - 30, `Score: ${finalScore}${newBest ? '  NEW BEST!' : ''}`, { fontSize: '24px', fontFamily: 'Arial', fill: newBest ? '#b7ffb7' : '#fff' }).setOrigin(0.5).setDepth(26);
      this.add.text(W / 2, H / 2 + 5, `Coins: ${this.coinCount}`, { fontSize: '21px', fontFamily: 'Arial', fill: '#ffd700' }).setOrigin(0.5).setDepth(26);
      this.add.text(W / 2, H / 2 + 34, bestSummary(this.rhythmMode), { fontSize: '15px', fontFamily: 'Arial', fill: '#9ecbff' }).setOrigin(0.5).setDepth(26);

      const restartBtn = this.add.rectangle(W / 2, H / 2 + 96, 200, 50, 0xff6b6b).setInteractive({ useHandCursor: true }).setDepth(26);
      const menuBtn = this.add.rectangle(W / 2, H / 2 + 154, 200, 38, 0x455a64).setInteractive({ useHandCursor: true }).setDepth(26);
      this.add.text(W / 2, H / 2 + 96, 'PLAY AGAIN', { fontSize: '21px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5).setDepth(27);
      this.add.text(W / 2, H / 2 + 154, 'MAIN MENU', { fontSize: '16px', fontFamily: 'Arial Black, Arial', fill: '#fff' }).setOrigin(0.5).setDepth(27);
      restartBtn.on('pointerdown', () => { unlockAudio(); restart(); });
      menuBtn.on('pointerdown', () => { unlockAudio(); audio.stop(); this.scene.start('Boot'); });
    });

    const restart = () => {
      if (this.rhythmMode) audio.playRhythm();
      else audio.playGame();
      this.scene.restart({ rhythmMode: this.rhythmMode });
    };
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
      if (newMusicTime < this.musicTime - RHYTHM_BEAT_MS) this._resyncRhythm(newMusicTime);
      this.musicTime = newMusicTime;
    }
    this.beatPulse = Math.max(0, this.beatPulse - dt * (this.rhythmMode ? 4.4 : 2.2));
    this.collectPulse = Math.max(0, this.collectPulse - dt * 5.8);
    this.playerBounce = Math.max(0, this.playerBounce - dt * 6.5);
    this.footstepPulse = Math.max(0, this.footstepPulse - dt * 5.2);
    this.landSquash = Math.max(0, this.landSquash - dt * 7);
    this.flipT = Math.max(0, this.flipT - dt * 2.6);
    this.distance += this.speed * dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.runTime * 0.0035);
    this.level = 1 + Math.floor(this.distance / 4500);
    this.score += SCORE_PER_SECOND * dt * (1 + Math.min(0.5, (this.combo - 1) * 0.08));
    this.scoreTxt.setText(String(Math.floor(this.score)));
    this.comboTxt.setText(`x${this.combo.toFixed(1)}`);
    if (this.rhythmMode && this.beatTxt) this.beatTxt.setText(`${RHYTHM_BPM} BPM  •  BEAT ${Math.max(1, Math.floor(this.musicTime / RHYTHM_BEAT_MS) + 1)}`);
    this.modeTxt.setText(this.rhythmMode ? 'RHYTHM RUN' : `LEVEL ${this.level}`);
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - delta);
      this._updatePowerUI();
    }
    if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - delta);
      if (!this._slideDustAt || this.time.now - this._slideDustAt > 90) {
        this._slideDustAt = this.time.now;
        this._dustPuff(this.pX + Phaser.Math.Between(-12, 12), PLAYER_ANCHOR_Y + 2, 2);
      }
    }
    this._updateTrackCurve(delta);
    this._updateCamera(dt);
    this._redrawTrack();
    this._redrawHitLine();
    if (this.lightPulse) this.lightPulse.setAlpha((this.beatPulse || 0) * 0.045 + this.collectPulse * 0.035);
    if (this.bdG) this.bdG.x = -this.trackTurn * 0.5;
    if (this.beatHalo) this.beatHalo.setPosition(this.pX, PLAYER_ANCHOR_Y - 40);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this._jump();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.sKey)) this._slide();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.aKey)) this._switchLane(-1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.dKey)) this._switchLane(1);

    this.pX += (this._laneXZ(this.pLane, 0) - this.pX) * 11 * dt;

    if (this.rideTimer > 0) {
      this.rideTimer -= delta;
      this.jumpH = WAGON_TOP;
      this.jumpVel = 0;
      if (this.rideTimer <= 0) this.jumpVel = 80;
    } else {
      const wasAir = this.jumpH > 2;
      this.jumpVel -= GRAVITY * dt;
      this.jumpH += this.jumpVel * dt;
      if (this.jumpH <= 0) {
        this.jumpH = 0; this.jumpVel = 0; this.jumpsUsed = 0;
        if (wasAir) this._onLand();
      }
    }

    for (let i = this.gameObjs.length - 1; i >= 0; i--) {
      const obj = this.gameObjs[i];
      // Rhythm-timed objects are positioned purely from their beat time so they
      // always arrive at the player exactly on the downbeat.
      const prevZ = obj.z;
      if (obj.rhythmTimed) obj.z = SPAWN_Z * (obj.hitTime - this.musicTime) / RHYTHM_APPROACH_MS;
      else obj.z -= this.speed * dt;

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

      // Near-miss: an obstacle whips past in the adjacent lane
      if ((obj.type === 'obstacle' || obj.type === 'gate') && prevZ > 0 && obj.z <= 0 &&
          Math.abs(obj.lane - this.pLane) === 1 && this.runTime - this.lastNearMiss > 700) {
        this.lastNearMiss = this.runTime;
        this._toast('Close!', this.pX + (obj.lane - this.pLane) * 50, PLAYER_ANCHOR_Y - 110);
      }

      const cleanupZ = -(100 + (obj.worldL || 0));
      if (obj.consumed || obj.z < cleanupZ) {
        obj.parts.forEach(p => p.destroy());
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
    if (this.rhythmMode) this._updateRhythmSpawner(delta);
    else if (this.runTime >= this.spawnCursor) this._spawnPattern();

    // Occasional overhead arch — pure scenery, sells the depth
    if (this.distance >= this.nextArchDist) {
      this.nextArchDist = this.distance + Phaser.Math.Between(2600, 4400);
      const gfx = this.add.graphics().setDepth(5);
      this.gameObjs.push({ type: 'arch', lane: 1, z: SPAWN_Z, deco: true, gfx, parts: [gfx], checked: true });
    }
    this._syncPlayer(time);
  }
}
