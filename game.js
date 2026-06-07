'use strict';

// ─── Screen ───────────────────────────────────────────────────────────────────
const W = 400, H = 700;

// ─── Worlds ───────────────────────────────────────────────────────────────────
const WORLDS = [
  { id:'jungle',  no:'01', name:'JUNGLE',     accent:0xb6ff3d, accentStr:'#b6ff3d',
    sky:[0x0a2230,0x15485a,0x1e7a66],
    grd:{ near:0x1c3a22, far:0x0c2416, tieA:0x2a5436, tieB:0x173020, edge:0x5ed06a, path:0x234a2c }},
  { id:'savanna', no:'02', name:'SAVANNA',    accent:0xffb454, accentStr:'#ffb454',
    sky:[0x311c52,0x8a4258,0xff9a4d],
    grd:{ near:0x7a5a24, far:0x3a2a12, tieA:0x946e2a, tieB:0x5a4218, edge:0xffd27a, path:0x876326 }},
  { id:'reef',   no:'03', name:'CORAL REEF', accent:0x2be0ff, accentStr:'#2be0ff',
    sky:[0x1c72c0,0x0e4a86,0x072a4e],
    grd:{ near:0x15566e, far:0x082238, tieA:0x1e6e84, tieB:0x103c4e, edge:0x7df0ff, path:0x185a70 }},
  { id:'deep',   no:'04', name:'DEEP OCEAN', accent:0xb14dff, accentStr:'#b14dff',
    sky:[0x101a48,0x0a0e2a,0x05061a],
    grd:{ near:0x181442, far:0x080a22, tieA:0x241c56, tieB:0x130e30, edge:0xc98aff, path:0x1c1648 }},
];
const WORLD_SCORE = 4000;

// ─── Perspective ──────────────────────────────────────────────────────────────
const VP_X          = W / 2;
const HIT_LINE_Y    = 586;
const NEAR_Y        = HIT_LINE_Y + 34;
const COLLECTION_Y  = NEAR_Y - 6;
const COLLECTION_RADIUS = 58;
const HORIZON_Y     = 210;
const ROAD_END_Y    = NEAR_Y;
const TRACK_FAR_HW  = 5;
const TRACK_NEAR_HW = 120;
const PLAYER_ANCHOR_Y = NEAR_Y + 20;
const PLAYER_DRAW_SCALE = 1.06;
const PLAYER_VISUAL_LIFT = 10;

const pT  = y      => Phaser.Math.Clamp((y - HORIZON_Y) / (NEAR_Y - HORIZON_Y), 0, 1);
const pSc = y      => 0.12 + Math.pow(pT(y), 0.85) * 0.88;
const projectY = y => y;
const eY  = (y, h) => y - h * pSc(y);

// ─── MVP tuning ───────────────────────────────────────────────────────────────
const JUMP_INIT = 465;
const GRAVITY   = 900;
const WAGON_TOP = 72;
const WAGON_LENGTH = 185;
const WAGON_LANDING_GRACE = 26;
const WAGON_RIDE_MIN_MS = 1150;
const WAGON_RIDE_MAX_MS = 2200;
const APPROACH_START_Y = 327;
const BASE_SPEED = 145;
const MAX_SPEED = 430;
const TOUCH_THRESHOLD = 22;
const SCORE_PER_SECOND = 15;
const COIN_SCORE = 20;
const SHIELD_SCORE = 50;
const MAGNET_SCORE = 40;
const SLIDE_DURATION = 620;
const MAGNET_DURATION = 7600;
const DOUBLE_JUMP_INIT = 370;
const SAFE_START_MS = 1300;
const RHYTHM_BPM = 128;
const RHYTHM_BEAT_MS = 60000 / RHYTHM_BPM;
const RHYTHM_APPROACH_BEATS = 6;
const RHYTHM_APPROACH_MS = RHYTHM_BEAT_MS * RHYTHM_APPROACH_BEATS;
const RHYTHM_BEAT_WINDOW_MS = 160;
const RHYTHM_LANES = [1, 1, 2, 1, 0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0, 1];
const TURN_MAX_OFFSET = 34;
const TURN_NEAR_FACTOR = 0.05;
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
const unlockAudio = () => {
  if (window.audio && typeof audio.unlock === 'function') audio.unlock();
};
const setAudioMuted = (muted) => {
  if (window.audio && typeof audio.setMuted === 'function') audio.setMuted(muted);
};
const bestSummary = () => `Best: ${loadNumber(STORAGE_KEYS.bestScore)} · Coins: ${loadNumber(STORAGE_KEYS.bestCoins)}`;
const appVersionLabel = () => {
  const version = window.APP_VERSION || {};
  return `Version: ${version.label || version.commit || 'local-dev'}`;
};

// ─── Boot / menu scene ────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.muted = localStorage.getItem(STORAGE_KEYS.muted) === '1';
    setAudioMuted(this.muted);
    this._buildBackground();
    this._showMenu();

    const startMusic = () => {
      unlockAudio();
      if (!this.muted) audio.playMenu();
    };
    this.input.once('pointerdown', startMusic);
    this.input.keyboard.once('keydown', startMusic);
    document.addEventListener('touchend', unlockAudio, { once: true, passive: true });
    document.addEventListener('click', unlockAudio, { once: true, passive: true });
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
    r.on('pointerdown', () => {
      unlockAudio();
      onPress();
    });
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
    this.panel.add(this.add.text(cx, cy - 12, 'Three lanes. Jump, double-jump, slide, chain combos, and grab power-ups — or try Rhythm Run.', {
      fontSize: '15px', fontFamily: 'Arial', fill: '#d4e3ff', align: 'center', wordWrap: { width: 330 },
    }).setOrigin(0.5));

    this._button(cx, cy + 48, 220, 52, 'PLAY', () => this._startRun(false));
    this._button(cx, cy + 108, 220, 48, 'RHYTHM RUN', () => this._startRun(true), 0x8e24aa);
    this._button(cx, cy + 164, 220, 40, 'HOW TO PLAY', () => this._showHowTo(), 0x3949ab);
    this._button(cx, cy + 214, 220, 36, this.muted ? 'SOUND: OFF' : 'SOUND: ON', () => this._toggleSound(), 0x455a64);
    this.panel.add(this.add.text(cx, H - 24, appVersionLabel(), {
      fontSize: '12px', fontFamily: 'Arial', fill: '#8fa7c7',
    }).setOrigin(0.5));

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
      'Survive as long as possible. Jump crates, slide under red gates, collect coin trails, and land on wagons to build combos. Blue shields block one crash; purple magnets pull nearby coins. In Rhythm Run, glowing beat coins arrive on the downbeat: collect them near the pulse for Perfect/Good bonuses.', {
      fontSize: '16px', fontFamily: 'Arial', fill: '#ffffff', align: 'center',
      lineSpacing: 8, wordWrap: { width: 310 },
    }).setOrigin(0.5));
    this._button(cx, 510, 180, 48, 'GOT IT', () => {
      localStorage.setItem(STORAGE_KEYS.seenHelp, '1');
      this._showMenu();
    }, 0xff6b6b);
  }

  _activatePrimary() {
    unlockAudio();
    if (this.mode === 'help') {
      localStorage.setItem(STORAGE_KEYS.seenHelp, '1');
      this._showMenu();
      return;
    }
    if (this.mode === 'menu') this._startRun(false);
  }

  _toggleSound() {
    this.muted = !this.muted;
    localStorage.setItem(STORAGE_KEYS.muted, this.muted ? '1' : '0');
    setAudioMuted(this.muted);
    if (!this.muted) audio.playMenu();
    this._showMenu();
  }

  _startRun(rhythmMode = false) {
    unlockAudio();
    if (localStorage.getItem(STORAGE_KEYS.seenHelp) !== '1') {
      localStorage.setItem(STORAGE_KEYS.seenHelp, '1');
    }
    audio.stop();
    this.scene.start('Game', { rhythmMode });
  }
}

// ─── Game scene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    this.rhythmMode = data.rhythmMode === true;
  }

  create() {
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
    this.beatPulse = 0;
    this.collectPulse = 0;
    this.playerBounce = 0;
    this.footstepPulse = 0;

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
    this._buildWorldLayer();
    this._buildTrack();
    this._buildHitLine();
    this._buildTrackMarks();
    this._buildSideScenery();
    this._buildSpeedLines();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();
    if (!this.rhythmMode) this._scheduleNextSpawn(900);

    if (this.rhythmMode) audio.playRhythm();
    else audio.playGame();
    this._showCountdown();
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
    const mid = HORIZON_Y * 0.55;
    g.fillGradientStyle(w.sky[0],w.sky[0],w.sky[1],w.sky[1],1);
    g.fillRect(0,0,W,mid);
    g.fillGradientStyle(w.sky[1],w.sky[1],w.sky[2],w.sky[2],1);
    g.fillRect(0,mid,W,H-mid);

    if      (w.id==='jungle')  this._bdJungle(g,w);
    else if (w.id==='savanna') this._bdSavanna(g,w);
    else if (w.id==='reef')    this._bdReef(g,w);
    else                       this._bdDeep(g,w);
  }

  _bdJungle(g,w) {
    for(let i=0;i<38;i++){ g.fillStyle(0xffffff,0.15+Math.random()*0.65); g.fillRect(Math.random()*W,Math.random()*(HORIZON_Y-10),1,1); }
    g.fillStyle(0xeaf6ff,0.9); g.fillCircle(310,52,27);
    g.fillStyle(w.sky[0],0.7); g.fillCircle(300,46,22);
    g.fillStyle(0x0c2016,0.6); for(let i=0;i<9;i++) g.fillEllipse(i*50+14,HORIZON_Y-4,56,(28+i%3*12)*2);
    g.fillStyle(0x0c2a22,0.9);
    g.fillPoints([{x:56,y:HORIZON_Y},{x:56,y:HORIZON_Y-46},{x:68,y:HORIZON_Y-46},{x:68,y:HORIZON_Y-62},{x:86,y:HORIZON_Y-62},{x:86,y:HORIZON_Y-46},{x:98,y:HORIZON_Y-46},{x:98,y:HORIZON_Y}],true);
    g.fillStyle(0x0a1c14,1); for(let i=0;i<14;i++) g.fillEllipse(i*30+14,-4,36,(18+i%3*10)*2);
    g.lineStyle(2,w.accent,0.12); for(let i=0;i<7;i++) g.strokeCircle(i*60+14,0,22+i%2*10);
    g.fillStyle(0x0c2018,0.92); for(let i=0;i<17;i++) g.fillEllipse(i*26+13,HORIZON_Y-((22+i*17%24)*0.5)+2,26,(22+i*17%24)*2);
    g.fillStyle(w.accent,0.5); for(let i=0;i<12;i++) g.fillCircle(30+i*28+(i%3)*12,40+i*12+(i%4)*8,1.5);
  }

  _bdSavanna(g,w) {
    g.fillStyle(0xffe6a0,1); g.fillCircle(W/2,HORIZON_Y*0.42,52);
    g.fillStyle(0xff9a4d,0.85); g.fillCircle(W/2,HORIZON_Y*0.42,40);
    g.lineStyle(3,0xff9a4d,0.1); g.strokeCircle(W/2,HORIZON_Y*0.42,72);
    g.fillStyle(0x3a1f3e,0.7); g.fillEllipse(W/2,HORIZON_Y+5,340,78);
    [[58,HORIZON_Y-28,5,26],[292,HORIZON_Y-24,5,22],[162,HORIZON_Y-16,4,18]].forEach(([ax,ay,tw,th])=>{
      g.fillStyle(0x120c1c,1); g.fillRect(ax-tw/2,ay,tw,th); g.fillEllipse(ax,ay-5,48,11);
    });
    [[0.23,0.18],[0.31,0.23],[0.69,0.16]].forEach(([bx,by])=>{
      g.lineStyle(2,0x1a102088,0.6); const px=bx*W,py=by*HORIZON_Y;
      g.beginPath(); g.moveTo(px-7,py); g.lineTo(px,py-4); g.lineTo(px+7,py); g.strokePath();
    });
  }

  _bdReef(g,w) {
    g.fillStyle(0xbfebff,0.5); g.fillRect(0,0,W,6);
    g.lineStyle(2,0x7df0ff,0.5); for(let i=0;i<20;i++){ g.beginPath(); g.moveTo(i*22,3); g.lineTo(i*22+(10+(i*7)%12),3); g.strokePath(); }
    const rots=[-12,-4,5,14,24];
    for(let i=0;i<5;i++){ g.fillStyle(0x2be0ff,0.05); const cx=40+i*70,r=rots[i]*Math.PI/180; g.beginPath(); g.moveTo(cx,0); g.lineTo(cx+Math.sin(r)*HORIZON_Y*1.6+10,HORIZON_Y*1.6); g.lineTo(cx+Math.sin(r)*HORIZON_Y*1.6+50,HORIZON_Y*1.6); g.lineTo(cx+40,0); g.closePath(); g.fillPath(); }
    g.fillStyle(0x0a2e4c,0.72); for(let i=0;i<9;i++) g.fillEllipse(i*46+4+16,HORIZON_Y+1,32,(12+(i%3)*14)*2);
    g.fillStyle(0x2be0ff,0.3); for(let i=0;i<20;i++) g.fillCircle(15+i*19+(i%4)*11,10+(i*23)%HORIZON_Y,1+(i%3));
  }

  _bdDeep(g,w) {
    for(let i=0;i<44;i++){ const c=i%2===0?0xb14dff:0x2be0ff; g.fillStyle(c,0.12+0.5*(i%5)/4); g.fillCircle((i*97+13)%W,(i*53+7)%(HORIZON_Y-10),i%5===0?2:1); }
    [[0.22,0xb14dff],[0.54,0x2be0ff],[0.80,0xb14dff]].forEach(([bx,bc])=>{ g.fillStyle(bc,0.08); g.fillCircle(bx*W,HORIZON_Y+5,58); });
    for(let i=0;i<4;i++){ g.fillStyle(0xb14dff,0.04); const cx=50+i*100; g.beginPath(); g.moveTo(cx,0); g.lineTo(cx+30,HORIZON_Y); g.lineTo(cx+52,HORIZON_Y); g.lineTo(cx+22,0); g.closePath(); g.fillPath(); }
    g.fillStyle(0x1c1448,0.85); for(let i=0;i<12;i++) g.fillTriangle(i*36-8+9,HORIZON_Y-16-(i%4)*14,i*36-8,HORIZON_Y+2,i*36-8+18,HORIZON_Y+2);
  }

  _buildWorldScenery(w) {
    for(let i=0;i<8;i++){
      const baseT=(i+0.5)/8;
      [-1,1].forEach(side=>{
        this.worldScenery.push({gfx:this._regW(this.add.graphics().setDepth(3.8)), baseT, side});
      });
    }
  }

  _updateWorldScenery(dt) {
    const w = WORLDS[this.worldIdx];
    for(const s of this.worldScenery){
      s.baseT=(s.baseT+this.speed*dt/(ROAD_END_Y-HORIZON_Y))%1;
      const t=s.baseT;
      const worldY=HORIZON_Y+t*(ROAD_END_Y-HORIZON_Y);
      const sc=pSc(worldY);
      if(sc<0.13){ s.gfx.clear(); continue; }
      const hw = this._trackHalfWidth(t);
      const sideX = this._curveCenterX(worldY) + s.side * (hw + 20 * sc);
      s.gfx.clear();
      this._drawWorldScenery(s.gfx,w,sideX,worldY,sc,s.side,t);
      s.gfx.setDepth(3.8+t*0.1);
    }
  }

  _drawWorldScenery(g,w,x,y,sc,side,t) {
    if(w.id==='jungle'){
      const tH=Math.round(48*sc),tW=Math.max(2,Math.round(6*sc));
      g.fillStyle(0x2d1a0e,1); g.fillRect(x-tW/2,y-tH,tW,tH);
      const cr=Math.round(22*sc);
      g.fillStyle(0x0c2018,1); g.fillCircle(x,y-tH,cr);
      g.fillStyle(0x1a3820,0.7); g.fillCircle(x-cr*0.4,y-tH-cr*0.25,cr*0.6);
      g.fillStyle(w.accent,0.14); g.fillCircle(x,y-tH-cr*0.4,cr*0.38);
      if(t>0.3){ g.fillStyle(0x1c4028,1); g.fillTriangle(x+side*4*sc,y,x-side*2*sc,y-12*sc,x+side*12*sc,y-6*sc); }
    } else if(w.id==='savanna'){
      const tH=Math.round(44*sc),tW=Math.max(2,Math.round(5*sc));
      g.fillStyle(0x2a1a08,1); g.fillRect(x-tW/2,y-tH,tW,tH);
      g.fillStyle(0x120c1c,1); g.fillEllipse(x,y-tH+2,Math.round(52*sc),Math.round(11*sc));
      g.fillStyle(0x5a4218,0.9); for(let j=-2;j<=2;j++) g.fillRect(x+j*5*sc,y-4*sc,Math.max(1,2*sc),Math.round(6*sc));
      if(t>0.45&&t<0.82){ g.fillStyle(0x3a2a14,1); g.fillEllipse(x+side*15*sc,y,Math.round(16*sc),Math.round(9*sc)); }
    } else if(w.id==='reef'){
      const ch=Math.round(32*sc);
      g.lineStyle(Math.max(1.5,3.5*sc),0xff3dae,0.9); g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-ch); g.strokePath();
      g.lineStyle(Math.max(1,2*sc),0xff3dae,0.75);
      g.beginPath(); g.moveTo(x,y-ch*0.4); g.lineTo(x-9*sc,y-ch*0.72); g.strokePath();
      g.beginPath(); g.moveTo(x,y-ch*0.55); g.lineTo(x+7*sc,y-ch*0.82); g.strokePath();
      g.fillStyle(0x2be0ff,0.9); g.fillCircle(x,y-ch,Math.max(2,3.5*sc)); g.fillCircle(x-9*sc,y-ch*0.72,Math.max(1.5,2.5*sc)); g.fillCircle(x+7*sc,y-ch*0.82,Math.max(1.5,2.5*sc));
      if(t<0.65){ g.lineStyle(Math.max(1,2*sc),0x185a70,0.82); g.beginPath(); for(let s2=0;s2<=5;s2++){ const ky=y-s2*8*sc,kxo=(x+side*11*sc)+Math.sin(s2*1.1)*4*sc; s2===0?g.moveTo(kxo,ky):g.lineTo(kxo,ky); } g.strokePath(); }
      g.lineStyle(1,0x7df0ff,0.35); g.strokeCircle(x+side*5*sc,y-ch*0.45,Math.max(2,2.5*sc));
    } else {
      const sh=Math.round(54*sc);
      g.fillStyle(0x241c56,1); g.fillTriangle(x,y-sh,x-Math.round(8*sc),y,x+Math.round(8*sc),y);
      g.fillStyle(w.accent,0.55); g.fillCircle(x,y-sh,Math.max(2,3.5*sc));
      g.lineStyle(1,w.accent,0.25); g.strokeCircle(x,y-sh,Math.max(3,6*sc));
      if(t>0.35){ const ar=Math.round(8*sc),ax=x+side*16*sc,ay=y-ar; g.fillStyle(0x3a1f6e,1); g.fillCircle(ax,ay,ar); g.lineStyle(Math.max(1,1.5*sc),w.accent,0.6); for(let j=0;j<5;j++){ const ang=j/5*Math.PI-0.05; g.beginPath(); g.moveTo(ax,ay); g.lineTo(ax+Math.cos(ang)*ar*1.5,ay-Math.sin(ang)*ar*1.5); g.strokePath(); } }
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
    return TRACK_FAR_HW + Phaser.Math.Clamp(t, 0, 1) * (TRACK_NEAR_HW - TRACK_FAR_HW);
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

  _buildHitLine() {
    this.hitLineG = this.add.graphics().setDepth(18);
    this.hitLineGlow = this.add.rectangle(W / 2, HIT_LINE_Y, W, 1, 0x00e5ff, 0.16).setDepth(17);
    this.hitPrompt = this.add.text(W / 2, HIT_LINE_Y + 30, 'COLLECT  •  SWIPE LANES', {
      fontSize: '10px', fontFamily: 'Arial Black, Arial', fill: '#b2ebff', stroke: '#00121f', strokeThickness: 2,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(19).setAlpha(0.72);
    this._redrawHitLine();
  }

  _redrawHitLine() {
    if (!this.hitLineG) return;
    const g = this.hitLineG;
    g.clear();
    const t = pT(COLLECTION_Y);
    const cx = this._curveCenterX(COLLECTION_Y);
    const hw = this._trackHalfWidth(t) * 0.86;
    const pulse = this.beatPulse || 0;
    const collectPulse = this.collectPulse || 0;
    const y = projectY(COLLECTION_Y);
    const laneA = cx - hw * 0.333;
    const laneB = cx + hw * 0.333;

    this.hitLineGlow
      .setPosition(cx, y)
      .setSize(hw * 1.92, 12 + pulse * 18 + collectPulse * 18)
      .setAlpha(0.08 + pulse * 0.18 + collectPulse * 0.16);

    // The old flat hit line is now a soft absorption band that sits in front of
    // the runner. It keeps rhythm timing readable without implying notes should
    // pass through the avatar model.
    g.lineStyle(8 + pulse * 5, 0x00e5ff, 0.12 + pulse * 0.14);
    g.beginPath();
    g.moveTo(cx - hw, y);
    g.lineTo(cx + hw, y);
    g.strokePath();
    g.lineStyle(2 + pulse * 1.5, 0xe0ffff, 0.68 + pulse * 0.2);
    g.beginPath();
    g.moveTo(cx - hw, y);
    g.lineTo(cx + hw, y);
    g.strokePath();

    [cx - hw, laneA, laneB, cx + hw].forEach((x, i) => {
      g.lineStyle(i === 0 || i === 3 ? 2 : 1, 0xb2ebff, 0.26 + pulse * 0.18);
      g.beginPath();
      g.moveTo(x, y - 10);
      g.lineTo(x, y + 10);
      g.strokePath();
    });

    const playerX = this.pX || this._laneX(this.pLane || 1, COLLECTION_Y);
    const fieldY = PLAYER_ANCHOR_Y - 42;
    const fieldR = COLLECTION_RADIUS + pulse * 8 + collectPulse * 16;
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
        baseT: Math.random(),
        angleJitter: Phaser.Math.FloatBetween(-0.2, 0.2),
      });
    }
  }

  _updateSpeedLines(dt) {
    if (!this.speedLines) return;
    const w = WORLDS[this.worldIdx];
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    for (const l of this.speedLines) {
      l.baseT = (l.baseT + this.speed * dt * 1.28 / (ROAD_END_Y - HORIZON_Y)) % 1;
      const t = Math.max(0.05, l.baseT);
      const t2 = Math.min(1, t + 0.07 + this.speed / 6200);
      const y = HORIZON_Y + t * (ROAD_END_Y - HORIZON_Y);
      const y2 = HORIZON_Y + t2 * (ROAD_END_Y - HORIZON_Y);
      const hw = this._trackHalfWidth(t);
      const hw2 = this._trackHalfWidth(t2);
      const cx = this._curveCenterX(y);
      const cx2 = this._curveCenterX(y2);
      const outset = (22 + Math.abs(l.angleJitter) * 28) * pSc(y);
      const outset2 = (22 + Math.abs(l.angleJitter) * 28) * pSc(y2);
      const x1 = cx + l.side * (hw + outset);
      const x2 = cx2 + l.side * (hw2 + outset2);
      const alpha = 0.05 + t * 0.22 + (this.beatPulse || 0) * 0.12 + comboEnergy * 0.08;
      l.gfx.clear();
      l.gfx.lineStyle(Math.max(1, t * (4 + comboEnergy * 2)), w.accent, alpha * 0.55);
      l.gfx.beginPath();
      l.gfx.moveTo(x1, y);
      l.gfx.lineTo(x2, y2);
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
    const segments = 28;

    // Build left/right/lane edge arrays
    const left = [], right = [], lane1 = [], lane2 = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = HORIZON_Y + t * (ROAD_END_Y - HORIZON_Y);
      const cx = this._curveCenterX(y);
      const hw = this._trackHalfWidth(pT(y));
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

    // Ground fill: gradient from far to near colour
    g.fillGradientStyle(w.grd.far, w.grd.far, w.grd.near, w.grd.near, 1);
    g.fillRect(0, HORIZON_Y, W, ROAD_END_Y - HORIZON_Y + 80);

    // Path (track surface) trapezoid
    g.fillStyle(w.grd.path, 1);
    g.fillPoints([...left, ...right.slice().reverse()], true);

    // Perspective ties — power-spaced, denser near horizon
    const tieCount = 18;
    for (let i = 0; i < tieCount; i++) {
      const rawT = i / tieCount;
      const t = Math.pow(rawT, 1.8);
      const y = HORIZON_Y + t * (ROAD_END_Y - HORIZON_Y);
      const cx = this._curveCenterX(y);
      const hw = this._trackHalfWidth(pT(y));
      const col = i % 2 === 0 ? w.grd.tieA : w.grd.tieB;
      g.fillStyle(col, 0.45 + t * 0.35);
      const th = Math.max(1, 3 * pT(y));
      g.fillRect(cx - hw, y - th / 2, hw * 2, th);
    }

    // Lane dividers
    strokeLine(lane1, 1.5, w.grd.edge, 0.38);
    strokeLine(lane2, 1.5, w.grd.edge, 0.38);

    // Outer rail lines
    strokeLine(left, 4, w.grd.edge, 0.92 + comboEnergy * 0.08);
    strokeLine(right, 4, w.grd.edge, 0.92 + comboEnergy * 0.08);

    // Animated scrolling depth pulse
    for (let i = 0; i < 5; i++) {
      const t = ((i / 5 + this.markOffset) % 1);
      const y2 = HORIZON_Y + t * (ROAD_END_Y - HORIZON_Y);
      const cx2 = this._curveCenterX(y2);
      const hw2 = this._trackHalfWidth(pT(y2));
      const alpha = (0.08 + t * 0.22) * (0.5 + (this.beatPulse || 0) * 0.5 + comboEnergy * 0.3);
      g.lineStyle(Math.max(1, 2.5 * pT(y2)), w.grd.edge, alpha);
      g.beginPath(); g.moveTo(cx2 - hw2, y2); g.lineTo(cx2 + hw2, y2); g.strokePath();
    }

    // Horizon glow line in accent colour
    hg.lineStyle(14, w.accent, 0.07 + comboEnergy * 0.06);
    hg.beginPath(); hg.moveTo(0, HORIZON_Y); hg.lineTo(W, HORIZON_Y); hg.strokePath();
    hg.lineStyle(2.5, w.accent, 0.75 + comboEnergy * 0.2);
    hg.beginPath(); hg.moveTo(0, HORIZON_Y); hg.lineTo(W, HORIZON_Y); hg.strokePath();

    // Near edge
    const nearCx = this._curveCenterX(ROAD_END_Y);
    const nearHw = this._trackHalfWidth(1);
    g.lineStyle(4, w.grd.edge, 0.55);
    g.beginPath(); g.moveTo(nearCx - nearHw, ROAD_END_Y); g.lineTo(nearCx + nearHw, ROAD_END_Y); g.strokePath();
  }

  _buildTrackMarks() {
    for (let i = 0; i < 11; i++) this.marks.push({ baseT: (i + 0.5) / 11, gfx: this.add.graphics().setDepth(3) });
  }

  _updateTrackMarks(dt) {
    this.markOffset = (this.markOffset + this.speed * dt / (ROAD_END_Y - HORIZON_Y)) % 1;
    for (const m of this.marks) {
      const t = (m.baseT + this.markOffset) % 1;
      const y = HORIZON_Y + t * (ROAD_END_Y - HORIZON_Y);
      const y2 = Math.min(ROAD_END_Y, y + Phaser.Math.Linear(2, 24, Math.pow(t, 1.35)));
      const sy = projectY(y);
      const sy2 = projectY(y2);
      const hw = this._trackHalfWidth(pT(y));
      const hw2 = this._trackHalfWidth(pT(y2));
      const cx = this._curveCenterX(y);
      const cx2 = this._curveCenterX(y2);
      m.gfx.clear();
      m.gfx.fillStyle(0x90a4ae, 0.06 + t * 0.2);
      m.gfx.fillPoints([
        { x: cx - hw * 0.96, y: sy },
        { x: cx + hw * 0.96, y: sy },
        { x: cx2 + hw2 * 0.86, y: sy2 },
        { x: cx2 - hw2 * 0.86, y: sy2 },
      ], true);
    }
  }

  _buildSideScenery() {
    // World scenery (_buildWorldScenery) replaces the old lamp-post scenery
  }

  _updateSideScenery(dt) {
    // World scenery (_updateWorldScenery) replaces the old lamp-post scenery
  }

  _buildPlayer() {
    const d = 7;
    this.shadow = this.add.ellipse(this._laneX(1, NEAR_Y), NEAR_Y + 4, 48, 16, 0x000000).setAlpha(0.5).setDepth(d - 1);
    this.vis = {
      collectTrail: this.add.ellipse(0, 0, 86, 20, 0x00e5ff, 0.08).setDepth(d - 0.6),
      armL: this.add.rectangle(0, 0, 10, 25, 0xffb3ba).setDepth(d - 0.2),
      armR: this.add.rectangle(0, 0, 10, 25, 0xffb3ba).setDepth(d - 0.2),
      legL: this.add.rectangle(0, 0, 13, 25, 0x1565c0).setDepth(d),
      legR: this.add.rectangle(0, 0, 13, 25, 0x1565c0).setDepth(d),
      body: this.add.rectangle(0, 0, 34, 36, 0xe91e8c).setDepth(d + 0.1),
      backStripe: this.add.rectangle(0, 0, 5, 28, 0xff9bd0).setDepth(d + 0.2),
      head: this.add.circle(0, 0, 15, 0xffcc99).setDepth(d + 0.15),
      hair: this.add.rectangle(0, 0, 35, 16, 0x5d4037).setDepth(d + 0.3),
      headphoneL: this.add.circle(0, 0, 5, 0x00e5ff, 0.78).setStrokeStyle(2, 0xffffff, 0.46).setDepth(d + 0.45),
      headphoneR: this.add.circle(0, 0, 5, 0x00e5ff, 0.78).setStrokeStyle(2, 0xffffff, 0.46).setDepth(d + 0.45),
      headphoneBand: this.add.rectangle(0, 0, 25, 4, 0x00e5ff, 0.62).setDepth(d + 0.44),
      ponytail: this.add.ellipse(0, 0, 16, 24, 0x4e342e).setDepth(d + 0.25),
      bow: this.add.triangle(0, 0, -8, -5, -8, 5, 8, 0, 0xffd54f).setDepth(d + 0.4),
      shield: this.add.ellipse(0, 0, 68, 88, 0x4fc3f7, 0.16).setStrokeStyle(3, 0x81d4fa, 0.92).setDepth(d + 1).setVisible(false),
      collectGlow: this.add.circle(0, 0, COLLECTION_RADIUS, 0xfff176, 0.08).setStrokeStyle(3, 0xfff176, 0.5).setDepth(d + 0.9),
      bodyGlow: this.add.ellipse(0, 0, 56, 78, 0xfff176, 0.05).setDepth(d + 0.05),
      magnet: this.add.circle(0, 0, 42, 0xba68c8, 0.12).setStrokeStyle(3, 0xf3e5f5, 0.8).setDepth(d + 1).setVisible(false),
    };
  }

  _syncPlayer(t) {
    const x = this.pX;
    const comboEnergy = Phaser.Math.Clamp((this.combo - 1) / 4, 0, 1);
    const sy = PLAYER_ANCHOR_Y - PLAYER_VISUAL_LIFT - this.jumpH - this.playerBounce * 11;
    const fieldY = PLAYER_ANCHOR_Y - 42 - this.jumpH * 0.18;
    const grounded = this.jumpH < 2;
    const sliding = this.slideTimer > 0 && grounded;
    const swing = grounded && !sliding ? Math.sin(t / 82) * (1 + comboEnergy * 0.22) : 0;
    const tilt = grounded ? 0 : Phaser.Math.Clamp(-this.jumpVel / 3000, -0.18, 0.18);
    const sFrac = Math.max(0.35, 1 - this.jumpH / 130);
    const ps = PLAYER_DRAW_SCALE * (1 + this.playerBounce * 0.035);
    const pos = (offset) => offset * ps;
    const shieldScale = ps * (1 + (this.shieldCharges > 0 ? Math.sin(t / 140) * 0.06 : 0));
    const fieldScale = 1 + (this.beatPulse || 0) * 0.08 + this.collectPulse * 0.22 + comboEnergy * 0.06;
    const stepPulse = grounded && !sliding ? (0.5 + Math.abs(Math.sin(t / 82)) * 0.5) : 0;
    this.footstepPulse = Math.max(this.footstepPulse, stepPulse * 0.24);
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
    this.shadow.setPosition(x, PLAYER_ANCHOR_Y + 5).setScale(sFrac * ps * 1.2, sFrac * ps * 0.55).setAlpha(sFrac * 0.58);
    this.vis.legL.setPosition(x - pos(sliding ? 17 : 9), sy + pos(sliding ? 28 : 33)).setScale(ps * (sliding ? 1.55 : 1), ps * (sliding ? 0.52 : 1 + swing * 0.45)).setRotation(sliding ? 0.35 : 0);
    this.vis.legR.setPosition(x + pos(sliding ? 15 : 9), sy + pos(sliding ? 31 : 33)).setScale(ps * (sliding ? 1.55 : 1), ps * (sliding ? 0.52 : 1 - swing * 0.45)).setRotation(sliding ? 0.35 : 0);
    this.vis.body.setPosition(x, sy + pos(sliding ? 17 : 7)).setScale(ps, ps * (sliding ? 0.62 : 1)).setRotation(sliding ? Math.PI / 2 : tilt);
    this.vis.backStripe.setPosition(x, sy + pos(sliding ? 17 : 7)).setScale(ps, ps * (sliding ? 0.62 : 1)).setRotation(sliding ? Math.PI / 2 : tilt);
    this.vis.armL.setPosition(x - pos(sliding ? 18 : 23), sy + pos(sliding ? 19 : 7)).setScale(ps).setRotation(sliding ? 1.15 : swing * 0.5);
    this.vis.armR.setPosition(x + pos(sliding ? 18 : 23), sy + pos(sliding ? 19 : 7)).setScale(ps).setRotation(sliding ? 1.15 : -swing * 0.5);
    const headX = x + pos(sliding ? 31 : 0);
    const headY = sy + pos(sliding ? 11 : -22);
    const headRot = sliding ? Math.PI / 2 : tilt;
    const headphoneFlash = 0.52 + this.collectPulse * 0.44 + comboEnergy * 0.24;
    this.vis.head.setPosition(headX, headY).setScale(ps).setRotation(headRot);
    this.vis.hair.setPosition(x + pos(sliding ? 38 : 0), sy + pos(sliding ? 10 : -29)).setScale(ps).setRotation(headRot);
    this.vis.headphoneL.setPosition(headX - pos(sliding ? 0 : 14), headY + pos(sliding ? -11 : -1)).setScale(ps * (1 + this.collectPulse * 0.16)).setAlpha(headphoneFlash).setRotation(headRot);
    this.vis.headphoneR.setPosition(headX + pos(sliding ? 0 : 14), headY + pos(sliding ? 11 : -1)).setScale(ps * (1 + this.collectPulse * 0.16)).setAlpha(headphoneFlash).setRotation(headRot);
    this.vis.headphoneBand.setPosition(headX, headY - pos(sliding ? 0 : 13)).setScale(ps, ps).setAlpha(0.28 + this.collectPulse * 0.34 + comboEnergy * 0.18).setRotation(headRot);
    this.vis.ponytail.setPosition(x + pos(sliding ? 24 : 0), sy + pos(sliding ? 22 : -17)).setScale(ps).setRotation(sliding ? Math.PI / 2 : tilt);
    this.vis.bow.setPosition(x + pos(sliding ? 19 : 0), sy + pos(sliding ? 23 : -18)).setScale(ps).setRotation(sliding ? Math.PI / 2 : tilt);
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

    this.add.circle(W - 84, 32, 9, 0xffd700).setDepth(22);
    this.coinTxt = this.add.text(W - 68, 32, '0', {
      fontSize: '19px', fontFamily: 'Arial Black, Arial', fill: '#ffd700', stroke: '#1b1200', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(22);
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
      this.beatHalo = this.add.circle(W / 2, PLAYER_ANCHOR_Y - 42, COLLECTION_RADIUS, 0xfff176, 0.08).setStrokeStyle(3, 0xfff176, 0.45).setDepth(16);
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
      if (this.rhythmMode) audio.playRhythm();
      else audio.playGame();
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
      type: 'coin', lane, worldY: APPROACH_START_Y, worldW: 60, worldH: 60,
      parts: [ring, coin, shine], ring, coin, shine, checked: false,
      beatIndex, hitTime, rhythmSpeed: (NEAR_Y - APPROACH_START_Y) / (RHYTHM_APPROACH_MS / 1000),
    });
  }

  _spawnRhythmObstacle(beatIndex) {
    const coinLane = this._rhythmLaneForBeat(beatIndex);
    const lane = Phaser.Utils.Array.GetRandom([0, 1, 2].filter(v => v !== coinLane));
    const face = this.add.rectangle(0, 0, 1, 1, 0x4527a0).setDepth(5);
    const top = this.add.rectangle(0, 0, 1, 1, 0x7e57c2).setDepth(5);
    const side = this.add.rectangle(0, 0, 1, 1, 0x311b92).setDepth(5);
    this.gameObjs.push({
      type: 'obstacle', lane, worldY: APPROACH_START_Y, worldH: 46, worldW: 34,
      parts: [face, top, side], face, top, side, checked: false,
      rhythmSpeed: (NEAR_Y - APPROACH_START_Y) / (RHYTHM_APPROACH_MS / 1000),
    });
  }

  _updateRhythmSpawner() {
    const currentBeat = Math.floor(this.runTime / RHYTHM_BEAT_MS);
    if (currentBeat !== this.lastBeatPulse) {
      this.lastBeatPulse = currentBeat;
      this.beatPulse = 1;
      if (this.beatHalo) {
        this.beatHalo.setPosition(this.pX, PLAYER_ANCHOR_Y - 42).setScale(1.35).setAlpha(0.18);
        this.tweens.add({ targets: this.beatHalo, scale: 1, alpha: 0.08, duration: RHYTHM_BEAT_MS * 0.75, ease: 'Sine.easeOut' });
      }
    }

    const lookaheadHitTime = this.runTime + RHYTHM_APPROACH_MS;
    while (this.nextRhythmBeat * RHYTHM_BEAT_MS <= lookaheadHitTime) {
      const hitTime = this.nextRhythmBeat * RHYTHM_BEAT_MS;
      this._spawnRhythmCoin(this.nextRhythmBeat, hitTime);
      if (this.runTime > 6500 && this.nextRhythmBeat % 8 === 6) this._spawnRhythmObstacle(this.nextRhythmBeat);
      this.nextRhythmBeat += 1;
    }
  }

  // ── Spawn helpers ───────────────────────────────────────────────────────────
  _difficulty() {
    return Phaser.Math.Clamp(this.runTime / 90000, 0, 1);
  }

  _scheduleNextSpawn(extra = 0) {
    const difficulty = this._difficulty();
    const minGap = Phaser.Math.Linear(2450, 1750, difficulty);
    const maxGap = Phaser.Math.Linear(3900, 2750, difficulty);
    this.spawnCursor = this.runTime + Phaser.Math.Between(Math.round(minGap), Math.round(maxGap)) + extra;
  }

  _spawnPattern() {
    const difficulty = this._difficulty();
    if (this.runTime < SAFE_START_MS) return;

    const roll = Math.random();
    if (roll < 0.06 + difficulty * 0.02) this._spawnShield();
    else if (roll < 0.12 + difficulty * 0.03) this._spawnMagnet();
    else if (roll < 0.25 + difficulty * 0.06) this._spawnWagon();
    else if (roll < 0.43 + difficulty * 0.08) this._spawnCoinTrail(difficulty);
    else this._spawnObstacle(this.time.now, difficulty);
    this._scheduleNextSpawn();
  }

  _spawnObstacle(time, difficulty = this._difficulty()) {
    const blockedCount = Math.random() < 0.24 + difficulty * 0.18 ? 2 : 1;
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, blockedCount);
    const spawnGate = this.runTime > 9000 && Math.random() < 0.2 + difficulty * 0.14;
    for (const lane of lanes) {
      if (spawnGate) {
        const beam = this.add.rectangle(0, 0, 1, 1, 0xc62828).setDepth(5);
        const glow = this.add.rectangle(0, 0, 1, 1, 0xff8a80, 0.55).setDepth(6);
        const postL = this.add.rectangle(0, 0, 1, 1, 0x5d4037).setDepth(5);
        const postR = this.add.rectangle(0, 0, 1, 1, 0x5d4037).setDepth(5);
        this.gameObjs.push({ type: 'gate', lane, worldY: APPROACH_START_Y, worldH: 86, worldW: 74, parts: [beam, glow, postL, postR], beam, glow, postL, postR, checked: false });
      } else {
        const h = Phaser.Math.Between(42, 68);
        const w = Phaser.Math.Between(30, 48);
        const color = Phaser.Utils.Array.GetRandom([0xd32f2f, 0xe65100, 0x5d4037]);
        const face = this.add.rectangle(0, 0, 1, 1, color).setDepth(5);
        const top = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.IntegerToColor(color).lighten(25).color32).setDepth(5);
        const side = this.add.rectangle(0, 0, 1, 1, Phaser.Display.Color.IntegerToColor(color).darken(20).color32).setDepth(5);
        this.gameObjs.push({ type: 'obstacle', lane, worldY: APPROACH_START_Y, worldH: h, worldW: w, parts: [face, top, side], face, top, side, checked: false });
      }
    }
  }

  _spawnShield() {
    const lane = Phaser.Math.Between(0, 2);
    const ring = this.add.circle(0, 0, 1, 0x4fc3f7, 0.18).setStrokeStyle(2, 0xb3e5fc, 0.95).setDepth(6);
    const core = this.add.circle(0, 0, 1, 0x81d4fa, 0.9).setDepth(6);
    const glint = this.add.circle(0, 0, 1, 0xffffff, 0.75).setDepth(7);
    this.gameObjs.push({ type: 'shield', lane, worldY: APPROACH_START_Y, worldW: 44, worldH: 44, parts: [ring, core, glint], ring, core, glint, checked: false });
  }


  _spawnMagnet() {
    const lane = Phaser.Math.Between(0, 2);
    const ring = this.add.circle(0, 0, 1, 0x8e24aa, 0.2).setStrokeStyle(2, 0xf3e5f5, 0.95).setDepth(6);
    const core = this.add.rectangle(0, 0, 1, 1, 0xba68c8).setDepth(7);
    const spark = this.add.circle(0, 0, 1, 0xffffff, 0.82).setDepth(8);
    this.gameObjs.push({ type: 'magnet', lane, worldY: APPROACH_START_Y, worldW: 44, worldH: 44, parts: [ring, core, spark], ring, core, spark, checked: false });
  }

  _spawnCoinTrail(difficulty = this._difficulty()) {
    const lane = Phaser.Math.Between(0, 2);
    const laneDrift = Math.random() < 0.25 + difficulty * 0.2 ? Phaser.Utils.Array.GetRandom([-1, 1]) : 0;
    const count = Phaser.Math.Between(3, 5);
    for (let i = 0; i < count; i++) {
      const trailLane = Phaser.Math.Clamp(lane + (i > count / 2 ? laneDrift : 0), 0, 2);
      const ring = this.add.circle(0, 0, 1, 0xfff176, 0.1).setStrokeStyle(2, 0xfff176, 0.55).setDepth(5);
      const coin = this.add.circle(0, 0, 1, 0xffd700).setDepth(6);
      const shine = this.add.circle(0, 0, 1, 0xfff59d, 0.72).setDepth(7);
      this.gameObjs.push({ type: 'coin', lane: trailLane, worldY: APPROACH_START_Y - i * 58, worldW: 49, worldH: 49, parts: [ring, coin, shine], ring, coin, shine, checked: false });
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
    this.gameObjs.push({ type: 'wagon', lane, worldY: APPROACH_START_Y, worldW: ww, worldH: wh, worldL: wl, parts: [deck, body, roof, wheelL, wheelR, ...coins.flatMap(c => [c.obj, c.shine])], deck, body, roof, wl: wheelL, wr: wheelR, coins, checked: false });
  }

  _renderObj(obj) {
    const y = obj.worldY;
    const sy = projectY(y);
    const visible = y >= HORIZON_Y;
    obj.parts.forEach(part => part.setVisible(visible));
    if (!visible) return;

    const sc = pSc(y);
    const x = this._laneX(obj.lane, y);
    const dp = 4 + pT(y) * 5;

    if (obj.type === 'obstacle') {
      const sw = obj.worldW * sc;
      const sh = obj.worldH * sc;
      const fy = sy - sh / 2;
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
      const topY = eY(y, obj.worldH);
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
      const timingPulse = obj.hitTime ? Math.max(0, 1 - Math.abs(this.runTime - obj.hitTime) / RHYTHM_BEAT_WINDOW_MS) : 0;
      const pulse = 1 + Math.sin(this.time.now / 115 + obj.worldY) * 0.08 + timingPulse * 0.35;
      const r = Math.max(4, (obj.hitTime ? 21 : 17.5) * sc * pulse);
      const cy = eY(y, 42);
      obj.coin.setPosition(x, cy).setRadius(r).setDepth(dp + 1);
      obj.shine.setPosition(x - r * 0.3, cy - r * 0.35).setRadius(Math.max(1, r * 0.4)).setDepth(dp + 2);
      if (obj.ring) obj.ring.setPosition(x, cy).setRadius(r * 1.65).setDepth(dp).setAlpha(0.12 + timingPulse * 0.25);
    }

    if (obj.type === 'wagon') {
      const rearY = Math.max(HORIZON_Y + 4, y - obj.worldL);
      const rearSc = pSc(rearY);
      const rearX = this._laneX(obj.lane, rearY);
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
        const coinVisible = coinWorldY >= HORIZON_Y;
        c.obj.setVisible(coinVisible);
        c.shine.setVisible(coinVisible);
        if (!coinVisible) return;

        const coinSc = pSc(coinWorldY);
        const coinX = this._laneX(obj.lane, coinWorldY) + c.fracX * obj.worldW * coinSc;
        const coinTop = eY(coinWorldY, WAGON_TOP);
        const cr = Math.max(3, 15.75 * coinSc);
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
      const timing = Math.abs(this.runTime - obj.hitTime);
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

    const restart = () => {
      if (this.rhythmMode) audio.playRhythm();
      else audio.playGame();
      this.scene.restart({ rhythmMode: this.rhythmMode });
    };
    restartBtn.on('pointerdown', () => { unlockAudio(); restart(); });
    menuBtn.on('pointerdown', () => { unlockAudio(); audio.stop(); this.scene.start('Boot'); });
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
    this.beatPulse = Math.max(0, this.beatPulse - dt * (this.rhythmMode ? 4.4 : 2.2));
    this.collectPulse = Math.max(0, this.collectPulse - dt * 5.8);
    this.playerBounce = Math.max(0, this.playerBounce - dt * 6.5);
    this.footstepPulse = Math.max(0, this.footstepPulse - dt * 5.2);
    this.distance += this.speed * dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.runTime * 0.0017 + this.distance * 0.01);
    this.level = 1 + Math.floor(this.distance / 950);
    this.score += SCORE_PER_SECOND * dt * (1 + Math.min(0.5, (this.combo - 1) * 0.08));
    this.scoreTxt.setText(String(Math.floor(this.score)));
    this.comboTxt.setText(`x${this.combo.toFixed(1)}`);
    if (this.rhythmMode && this.beatTxt) this.beatTxt.setText(`${RHYTHM_BPM} BPM  •  BEAT ${Math.max(1, Math.floor(this.runTime / RHYTHM_BEAT_MS) + 1)}`);
    this.modeTxt.setText(this.rhythmMode ? 'RHYTHM RUN' : `LEVEL ${this.level}`);
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - delta);
      this._updatePowerUI();
    }
    if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - delta);
    this._updateTrackCurve(delta);
    this._updateTrackMarks(dt);
    this._redrawTrack();
    this._redrawHitLine();
    if (this.lightPulse) this.lightPulse.setAlpha((this.beatPulse || 0) * 0.045 + this.collectPulse * 0.035);
    if (this.beatHalo) this.beatHalo.setPosition(this.pX, PLAYER_ANCHOR_Y - 42);

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
      obj.worldY += (obj.rhythmSpeed || this.speed) * dt;
      const cleanupY = NEAR_Y + 80 + (obj.worldL || 0);
      if (obj.consumed || obj.worldY > cleanupY) {
        obj.parts.forEach(p => p.destroy());
        this.gameObjs.splice(i, 1);
        continue;
      }
      this._renderObj(obj);
      const collectable = obj.type === 'coin' || obj.type === 'shield' || obj.type === 'magnet';
      const canCollide = obj.type === 'wagon'
        ? obj.worldY >= NEAR_Y - WAGON_LANDING_GRACE && obj.worldY <= NEAR_Y + obj.worldL
        : collectable
          ? obj.worldY >= COLLECTION_Y - 22 && obj.worldY <= COLLECTION_Y + 20
          : obj.worldY >= NEAR_Y - 18 && obj.worldY <= NEAR_Y + 18;
      if (canCollide) this._handleCollision(obj);
    }

    this._updateSideScenery(dt);
    this._updateWorldScenery(dt);
    this._tryAdvanceWorld();
    this._updateSpeedLines(dt);
    if (this.rhythmMode) this._updateRhythmSpawner(delta);
    else if (this.runTime >= this.spawnCursor) this._spawnPattern();
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
