'use strict';

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
const VP_X           = 200;
const HORIZON_Y      = 210;   // 30 % of 700 — matches design
const NEAR_Y         = 635;
const TRACK_FAR_HW   = 5;     // converges to near-point at horizon
const TRACK_NEAR_HW  = 120;   // 30 % of 400 at player level

const pT     = y      => Math.max(0, (y - HORIZON_Y) / (NEAR_Y - HORIZON_Y));
const pSc    = y      => 0.12 + Math.pow(pT(y), 0.85) * 0.88;
const _trkHW = t      => TRACK_FAR_HW + t * (TRACK_NEAR_HW - TRACK_FAR_HW);
const lX     = (li,y) => VP_X + [-1,0,1][li] * _trkHW(pT(y)) * 0.667;
const eY     = (y,h)  => y - h * pSc(y);
const LANE_NX = [0,1,2].map(l => Math.round(lX(l, NEAR_Y)));

// ─── Jump / speed ─────────────────────────────────────────────────────────────
const JUMP_INIT = 460, GRAVITY = 900, WAGON_TOP = 72, BASE_SPEED = 195;

// ─── Boot scene ───────────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    const cx = W/2, cy = H/2;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x070d1a,0x070d1a,0x132038,0x132038,1);
    sky.fillRect(0,0,W,H);
    for (let i = 0; i < 60; i++) {
      this.add.circle(Phaser.Math.Between(0,W), Phaser.Math.Between(0,320),
        Math.random()<0.25?2:1, 0xffffff).setAlpha(Phaser.Math.FloatBetween(0.15,0.9));
    }
    this.add.circle(315,55,28,0xfff9c4).setAlpha(0.9);
    this.add.circle(304,47,22,0x132038).setAlpha(0.5);
    this.add.text(cx,cy-130,"Sofia's",{fontSize:'52px',fontFamily:'Arial Black,Arial',fill:'#ffd700',stroke:'#b8860b',strokeThickness:6}).setOrigin(0.5);
    this.add.text(cx,cy-62,'Endless Runner',{fontSize:'28px',fontFamily:'Arial',fill:'#fff',stroke:'#000',strokeThickness:4}).setOrigin(0.5);
    this.add.text(cx,cy+12,'← → / swipe  –  switch lane',{fontSize:'16px',fontFamily:'Arial',fill:'#aaaaff'}).setOrigin(0.5);
    this.add.text(cx,cy+40,'↑ / swipe up  –  jump',{fontSize:'16px',fontFamily:'Arial',fill:'#aaaaff'}).setOrigin(0.5);
    this.add.text(cx,cy+68,'Jump on wagons to grab coins!',{fontSize:'14px',fontFamily:'Arial',fill:'#88aadd'}).setOrigin(0.5);
    const btn = this.add.rectangle(cx,cy+145,200,54,0xff6b6b).setInteractive({useHandCursor:true});
    this.add.text(cx,cy+145,'PLAY',{fontSize:'28px',fontFamily:'Arial Black,Arial',fill:'#fff'}).setOrigin(0.5);
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
    this.worldIdx   = 0;
    this.worldNext  = WORLD_SCORE;
    this.speed      = BASE_SPEED;
    this.score      = 0;
    this.coinCount  = 0;
    this.alive      = true;
    this.pLane      = 1;
    this.pX         = LANE_NX[1];
    this.jumpH      = 0;
    this.jumpVel    = 0;
    this.rideTimer  = 0;
    this.gameObjs   = [];
    this.lastObs    = 0;
    this.lastWagon  = 1000;
    this.markOffset = 0;
    this.marks      = [];
    this.scenery    = [];
    this._worldGfx  = [];

    this._buildWorldVisuals();
    this._buildPlayer();
    this._buildUI();
    this._buildControls();
    audio.playGame();

    this.time.addEvent({
      delay:4000,
      callback:()=>{ this.speed = Math.min(this.speed+15,540); },
      loop:true,
    });
  }

  // ── World visual layer ───────────────────────────────────────────────────────

  _buildWorldVisuals() {
    this._worldGfx.forEach(g => g.destroy());  this._worldGfx = [];
    this.marks.forEach(m => m.gfx.destroy());  this.marks = [];
    this.scenery.forEach(s => s.gfx.destroy()); this.scenery = [];

    const w = WORLDS[this.worldIdx];
    this._buildBg(w);
    this._buildTrack(w);
    this._buildTrackMarks();
    this._buildSideScenery();
  }

  _reg(gfx) { this._worldGfx.push(gfx); return gfx; }

  // ── Background ───────────────────────────────────────────────────────────────

  _buildBg(w) {
    const g = this._reg(this.add.graphics().setDepth(0));
    const mid = HORIZON_Y * 0.55;

    // Sky — 3-stop gradient via 2 rects
    g.fillGradientStyle(w.sky[0],w.sky[0],w.sky[1],w.sky[1],1);
    g.fillRect(0,0,W,mid);
    g.fillGradientStyle(w.sky[1],w.sky[1],w.sky[2],w.sky[2],1);
    g.fillRect(0,mid,W,HORIZON_Y-mid+2);

    // Ground below horizon
    g.fillGradientStyle(w.grd.far,w.grd.far,w.grd.near,w.grd.near,1);
    g.fillRect(0,HORIZON_Y,W,H-HORIZON_Y);

    if      (w.id==='jungle')  this._bdJungle(g,w);
    else if (w.id==='savanna') this._bdSavanna(g,w);
    else if (w.id==='reef')    this._bdReef(g,w);
    else                       this._bdDeep(g,w);
  }

  _bdJungle(g,w) {
    // Stars
    for(let i=0;i<38;i++){
      g.fillStyle(0xffffff, 0.2+Math.random()*0.7);
      g.fillRect(Math.random()*W, Math.random()*(HORIZON_Y-20), 1, 1);
    }
    // Moon + crescent
    g.fillStyle(0xeaf6ff,0.92); g.fillCircle(310,52,27);
    g.fillStyle(0x0a2230,0.7);  g.fillCircle(300,46,22);
    // Distant misty mountains
    g.fillStyle(0x0c2016,0.65);
    for(let i=0;i<9;i++){
      g.fillEllipse(i*50-10+14, HORIZON_Y-4, 58, (30+i%3*14)*2);
    }
    // Temple silhouette
    g.fillStyle(0x0c2a22,0.9);
    g.fillPoints([{x:56,y:HORIZON_Y},{x:56,y:HORIZON_Y-48},{x:68,y:HORIZON_Y-48},
      {x:68,y:HORIZON_Y-64},{x:86,y:HORIZON_Y-64},{x:86,y:HORIZON_Y-48},
      {x:98,y:HORIZON_Y-48},{x:98,y:HORIZON_Y}],true);
    g.fillStyle(w.accent,0.12);
    g.fillRect(68,HORIZON_Y-64,18,64);
    // Hanging canopy from top
    g.fillStyle(0x0a1c14,1);
    for(let i=0;i<14;i++){
      const cx=i*30-5, cw=38+(i%4)*10, ch=18+(i%3)*12;
      g.fillEllipse(cx+cw/2,-5,cw,ch*2);
    }
    // Canopy edge highlights
    g.lineStyle(2,w.accent,0.15);
    for(let i=0;i<7;i++) g.strokeCircle(i*60+14,0,22+(i%2)*10);
    // Jungle ridge at horizon
    g.fillStyle(0x0c2018,0.92);
    for(let i=0;i<17;i++){
      const rh=22+(i*17)%24;
      g.fillEllipse(i*26-4+13, HORIZON_Y-rh*0.5+2, 28, rh*2);
    }
    // Firefly dots
    g.fillStyle(w.accent,0.55);
    for(let i=0;i<12;i++){
      g.fillCircle(30+i*28+(i%3)*12, 40+i*12+(i%4)*8, 1.5);
    }
  }

  _bdSavanna(g,w) {
    // Large glowing sun
    g.fillStyle(0xffe6a0,1); g.fillCircle(W/2, HORIZON_Y*0.42, 52);
    g.fillStyle(0xff9a4d,0.85); g.fillCircle(W/2, HORIZON_Y*0.42, 40);
    g.lineStyle(3,0xff9a4d,0.12); g.strokeCircle(W/2,HORIZON_Y*0.42,72);
    g.lineStyle(3,0xff9a4d,0.06); g.strokeCircle(W/2,HORIZON_Y*0.42,92);
    // Rolling hills
    g.fillStyle(0x3a1f3e,0.7);
    g.fillEllipse(W/2,HORIZON_Y+5,340,78);
    g.fillStyle(0x2a1530,0.55);
    g.fillEllipse(W/2-60,HORIZON_Y+2,200,52);
    // Acacia silhouettes
    [[58,HORIZON_Y-28,5,26],[292,HORIZON_Y-24,5,22],[162,HORIZON_Y-16,4,18]].forEach(([ax,ay,tw,th])=>{
      g.fillStyle(0x120c1c,1);
      g.fillRect(ax-tw/2,ay,tw,th);
      g.fillEllipse(ax,ay-5,48,11);
    });
    // Heat haze lines
    for(let i=0;i<3;i++){
      g.lineStyle(2,0x00000010,0.08);
      g.beginPath(); g.moveTo(0,HORIZON_Y-26+i*9); g.lineTo(W,HORIZON_Y-26+i*9); g.strokePath();
    }
    // Birds
    [[0.23,0.18],[0.31,0.23],[0.69,0.16]].forEach(([bx,by])=>{
      const px=bx*W, py=by*HORIZON_Y;
      g.lineStyle(2,0x1a102088,0.6);
      g.beginPath(); g.moveTo(px-7,py); g.lineTo(px,py-4); g.lineTo(px+7,py); g.strokePath();
    });
    // Grass tufts at horizon
    g.fillStyle(0x5a4a18,0.8);
    for(let i=0;i<22;i++){
      g.fillRect(i*20-4, HORIZON_Y-4, 3, 6+(i%3)*4);
    }
  }

  _bdReef(g,w) {
    // Surface shimmer at top
    g.fillStyle(0xbfebff,0.5); g.fillRect(0,0,W,6);
    g.lineStyle(2,0x7df0ff,0.55);
    for(let i=0;i<20;i++){
      const sx=i*22, sw=10+(i*7)%12;
      g.beginPath(); g.moveTo(sx,3); g.lineTo(sx+sw,3); g.strokePath();
    }
    // God-rays
    const rots=[-12,-4,5,14,24];
    for(let i=0;i<5;i++){
      g.fillStyle(0x2be0ff,0.05);
      const cx=40+i*70, r=rots[i]*Math.PI/180;
      g.beginPath();
      g.moveTo(cx,0);
      g.lineTo(cx+Math.sin(r)*HORIZON_Y*1.6+10, HORIZON_Y*1.6);
      g.lineTo(cx+Math.sin(r)*HORIZON_Y*1.6+50, HORIZON_Y*1.6);
      g.lineTo(cx+40, 0);
      g.closePath(); g.fillPath();
    }
    // Distant reef mounds
    g.fillStyle(0x0a2e4c,0.72);
    for(let i=0;i<9;i++){
      const mx=i*46+4, mw=32, mh=12+(i%3)*14;
      g.fillEllipse(mx+mw/2,HORIZON_Y+1,mw,mh*2);
    }
    // Bubbles
    g.fillStyle(0x2be0ff,0.32);
    for(let i=0;i<20;i++){
      const bx=15+i*19+(i%4)*11, by=10+(i*23)%HORIZON_Y;
      g.fillCircle(bx,by,1+(i%3));
    }
  }

  _bdDeep(g,w) {
    // Particles / stars
    for(let i=0;i<44;i++){
      const c=i%2===0?0xb14dff:0x2be0ff;
      g.fillStyle(c, 0.15+0.5*(i%5)/4);
      g.fillCircle((i*97+13)%W, (i*53+7)%(HORIZON_Y-10), i%5===0?2:1);
    }
    // Bioluminescent glow pools near horizon
    [[0.22,0xb14dff],[0.54,0x2be0ff],[0.80,0xb14dff]].forEach(([bx,bc])=>{
      g.fillStyle(bc,0.08); g.fillCircle(bx*W,HORIZON_Y+5,58);
    });
    // God-rays (dim)
    for(let i=0;i<4;i++){
      g.fillStyle(0xb14dff,0.04);
      const cx=50+i*100;
      g.beginPath();
      g.moveTo(cx,0); g.lineTo(cx+30,HORIZON_Y); g.lineTo(cx+52,HORIZON_Y); g.lineTo(cx+22,0);
      g.closePath(); g.fillPath();
    }
    // Abyssal spires at horizon
    g.fillStyle(0x1c1448,0.85);
    for(let i=0;i<12;i++){
      const sx=i*36-8, sw=18, sh=16+(i%4)*14;
      g.fillTriangle(sx+sw/2,HORIZON_Y-sh, sx,HORIZON_Y+2, sx+sw,HORIZON_Y+2);
    }
  }

  // ── Track ────────────────────────────────────────────────────────────────────

  _buildTrack(w) {
    const g = this._reg(this.add.graphics().setDepth(2));

    const lxF=VP_X-TRACK_FAR_HW,  rxF=VP_X+TRACK_FAR_HW;
    const lxN=VP_X-TRACK_NEAR_HW, rxN=VP_X+TRACK_NEAR_HW;

    // Path fill
    g.fillStyle(w.grd.path,1);
    g.fillPoints([{x:lxF,y:HORIZON_Y},{x:rxF,y:HORIZON_Y},{x:rxN,y:NEAR_Y},{x:lxN,y:NEAR_Y}],true);

    // Perspective ties — power-spaced for realism
    for(let i=0;i<18;i++){
      const st=i/17;
      const tp=Math.pow(st,1.85);
      const ty=HORIZON_Y+tp*(NEAR_Y-HORIZON_Y);
      const thw=_trkHW(pT(ty));
      const th=Math.max(1.5,tp*18);
      g.fillStyle(i%2?w.grd.tieA:w.grd.tieB, 0.28+tp*0.68);
      g.fillRect(VP_X-thw, ty-th/2, thw*2, th);
    }

    // Center sheen
    g.fillStyle(w.accent,0.06);
    g.fillPoints([{x:VP_X-4,y:HORIZON_Y},{x:VP_X+4,y:HORIZON_Y},
      {x:VP_X+TRACK_NEAR_HW*0.45,y:NEAR_Y},{x:VP_X-TRACK_NEAR_HW*0.45,y:NEAR_Y}],true);

    // Rail lines: outer edges + inner lane dividers
    [[-1,true],[-1/3,false],[1/3,false],[1,true]].forEach(([b,edge])=>{
      const farX  = VP_X + b*TRACK_FAR_HW;
      const nearX = VP_X + b*TRACK_NEAR_HW;
      if(edge){
        g.lineStyle(4,w.grd.edge,0.18);
        g.beginPath(); g.moveTo(farX,HORIZON_Y); g.lineTo(nearX,NEAR_Y); g.strokePath();
      }
      g.lineStyle(edge?3:2, w.grd.edge, edge?1:0.55);
      g.beginPath(); g.moveTo(farX,HORIZON_Y); g.lineTo(nearX,NEAR_Y); g.strokePath();
    });

    // Horizon glow line
    g.lineStyle(8,w.accent,0.18);
    g.beginPath(); g.moveTo(lxF,HORIZON_Y); g.lineTo(rxF,HORIZON_Y); g.strokePath();
    g.lineStyle(3,w.accent,0.9);
    g.beginPath(); g.moveTo(lxF,HORIZON_Y); g.lineTo(rxF,HORIZON_Y); g.strokePath();

    // Near edge
    g.lineStyle(3,w.grd.edge,0.7);
    g.beginPath(); g.moveTo(lxN,NEAR_Y); g.lineTo(rxN,NEAR_Y); g.strokePath();
  }

  // ── Track marks ──────────────────────────────────────────────────────────────

  _buildTrackMarks() {
    for(let i=0;i<9;i++){
      this.marks.push({baseT:(i+0.5)/9, gfx:this.add.graphics().setDepth(3)});
    }
  }

  _updateTrackMarks(dt) {
    this.markOffset=(this.markOffset+this.speed*dt/(NEAR_Y-HORIZON_Y))%1;
    const w=WORLDS[this.worldIdx];
    for(const m of this.marks){
      const t=(m.baseT+this.markOffset)%1;
      const y=HORIZON_Y+t*(NEAR_Y-HORIZON_Y);
      const hw=_trkHW(t), lh=Math.max(1,t*2.5);
      m.gfx.clear();
      m.gfx.fillStyle(w.grd.edge, t*0.14);
      m.gfx.fillRect(VP_X-hw, y-lh, hw*2, lh);
    }
  }

  // ── Side scenery ─────────────────────────────────────────────────────────────

  _buildSideScenery() {
    for(let i=0;i<9;i++){
      const baseT=(i+0.5)/9;
      [-1,1].forEach(side=>{
        this.scenery.push({gfx:this.add.graphics().setDepth(3), baseT, side});
      });
    }
  }

  _updateSideScenery(dt) {
    const w=WORLDS[this.worldIdx];
    for(const s of this.scenery){
      s.baseT=(s.baseT+this.speed*dt/(NEAR_Y-HORIZON_Y))%1;
      const t=s.baseT;
      const worldY=HORIZON_Y+t*(NEAR_Y-HORIZON_Y);
      const sc=pSc(worldY);
      const thw=_trkHW(t);
      const sideX=VP_X+s.side*(thw+20*sc);
      s.gfx.clear();
      if(sc>0.14) this._drawScenery(s.gfx,w,sideX,worldY,sc,s.side,t);
      s.gfx.setDepth(2+t*3);
    }
  }

  _drawScenery(g,w,x,y,sc,side,t) {
    if(w.id==='jungle'){
      // Trunk
      const tH=Math.round(50*sc), tW=Math.max(2,Math.round(7*sc));
      g.fillStyle(0x2d1a0e,1);
      g.fillRect(x-tW/2, y-tH, tW, tH);
      // Canopy
      const cr=Math.round(25*sc);
      g.fillStyle(0x0c2018,1); g.fillCircle(x,y-tH,cr);
      g.fillStyle(0x1a3820,0.75); g.fillCircle(x-cr*0.4,y-tH-cr*0.25,cr*0.62);
      g.fillStyle(w.accent,0.16); g.fillCircle(x,y-tH-cr*0.4,cr*0.4);
      // Fern
      if(t>0.3){
        g.fillStyle(0x1c4028,1);
        g.fillTriangle(x+side*4*sc,y, x-side*2*sc,y-14*sc, x+side*14*sc,y-7*sc);
        g.fillTriangle(x-side*2*sc,y, x-side*12*sc,y-9*sc, x+side*4*sc,y-5*sc);
      }
    } else if(w.id==='savanna'){
      // Acacia trunk
      const tH=Math.round(46*sc), tW=Math.max(2,Math.round(5*sc));
      g.fillStyle(0x2a1a08,1);
      g.fillRect(x-tW/2, y-tH, tW, tH);
      // Flat canopy
      g.fillStyle(0x120c1c,1);
      g.fillEllipse(x, y-tH+2, Math.round(56*sc), Math.round(12*sc));
      // Grass tufts
      g.fillStyle(0x5a4218,0.9);
      for(let j=-2;j<=2;j++) g.fillRect(x+j*5*sc, y-4*sc, Math.max(1,2*sc), Math.round(6*sc));
      // Rock
      if(t>0.45&&t<0.82){
        g.fillStyle(0x3a2a14,1); g.fillEllipse(x+side*16*sc,y,Math.round(18*sc),Math.round(10*sc));
        g.fillStyle(0x5a4222,0.6); g.fillEllipse(x+side*14*sc,y-2*sc,Math.round(10*sc),Math.round(6*sc));
      }
    } else if(w.id==='reef'){
      // Coral stem
      const ch=Math.round(36*sc);
      g.lineStyle(Math.max(1.5,4*sc),0xff3dae,0.9);
      g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-ch); g.strokePath();
      // Branches
      g.lineStyle(Math.max(1,2.5*sc),0xff3dae,0.75);
      g.beginPath(); g.moveTo(x,y-ch*0.4); g.lineTo(x-10*sc,y-ch*0.75); g.strokePath();
      g.beginPath(); g.moveTo(x,y-ch*0.55); g.lineTo(x+8*sc,y-ch*0.85); g.strokePath();
      // Tips
      g.fillStyle(0x2be0ff,0.9);
      g.fillCircle(x,y-ch,Math.max(2,4*sc));
      g.fillCircle(x-10*sc,y-ch*0.75,Math.max(1.5,3*sc));
      g.fillCircle(x+8*sc,y-ch*0.85,Math.max(1.5,2.5*sc));
      // Kelp
      if(t<0.65){
        g.lineStyle(Math.max(1,2*sc),0x185a70,0.85);
        g.beginPath();
        for(let s2=0;s2<=5;s2++){
          const ky=y-s2*9*sc, kxo=(x+side*12*sc)+Math.sin(s2*1.1)*5*sc;
          s2===0?g.moveTo(kxo,ky):g.lineTo(kxo,ky);
        }
        g.strokePath();
      }
      // Bubble
      g.lineStyle(1,0x7df0ff,0.4);
      g.strokeCircle(x+side*6*sc, y-ch*0.5, Math.max(2,3*sc));
    } else { // deep ocean
      // Spire
      const sh=Math.round(58*sc);
      g.fillStyle(0x241c56,1);
      g.fillTriangle(x,y-sh, x-Math.round(9*sc),y, x+Math.round(9*sc),y);
      g.fillStyle(0x3a2870,0.7);
      g.fillTriangle(x,y-sh, x-Math.round(4*sc),y-sh*0.4, x+Math.round(4*sc),y-sh*0.4);
      // Bioluminescent tip + glow ring
      g.fillStyle(w.accent,0.6); g.fillCircle(x,y-sh,Math.max(2,4*sc));
      g.lineStyle(1,w.accent,0.28); g.strokeCircle(x,y-sh,Math.max(3,7*sc));
      // Anemone
      if(t>0.35){
        const ar=Math.round(9*sc), ax=x+side*18*sc, ay=y-ar;
        g.fillStyle(0x3a1f6e,1); g.fillCircle(ax,ay,ar);
        g.lineStyle(Math.max(1,1.5*sc),w.accent,0.65);
        for(let j=0;j<5;j++){
          const ang=j/5*Math.PI-Math.PI*0.05;
          g.beginPath(); g.moveTo(ax,ay);
          g.lineTo(ax+Math.cos(ang)*ar*1.6, ay-Math.sin(ang)*ar*1.6);
          g.strokePath();
        }
      }
    }
  }

  // ── Player ───────────────────────────────────────────────────────────────────

  _buildPlayer() {
    const d=10;
    this.shadow=this.add.ellipse(LANE_NX[1],NEAR_Y+4,48,16,0x000000).setAlpha(0.5).setDepth(d-1);
    this.vis={
      legL:this.add.rectangle(0,0,13,22,0x1565c0).setDepth(d),
      legR:this.add.rectangle(0,0,13,22,0x1565c0).setDepth(d),
      body:this.add.rectangle(0,0,32,34,0xe91e8c).setDepth(d),
      armL:this.add.rectangle(0,0,11,24,0xffb3ba).setDepth(d),
      armR:this.add.rectangle(0,0,11,24,0xffb3ba).setDepth(d),
      head:this.add.circle(0,0,15,0xffcc99).setDepth(d),
      hair:this.add.rectangle(0,0,33,10,0x5d4037).setDepth(d),
      eyeL:this.add.circle(0,0,3,0x1a1a2e).setDepth(d),
      eyeR:this.add.circle(0,0,3,0x1a1a2e).setDepth(d),
    };
  }

  _syncPlayer(t) {
    const x=this.pX, sy=NEAR_Y-this.jumpH;
    const grounded=this.jumpH<2;
    const swing=grounded?Math.sin(t/88):0;
    const tilt=grounded?0:Phaser.Math.Clamp(-this.jumpVel/3000,-0.18,0.18);
    const sFrac=Math.max(0.35,1-this.jumpH/130);
    this.shadow.setPosition(x,NEAR_Y+4).setScale(sFrac,sFrac*0.45).setAlpha(sFrac*0.5);
    this.vis.legL.setPosition(x-9,sy+31).setScale(1,1+swing*0.45);
    this.vis.legR.setPosition(x+9,sy+31).setScale(1,1-swing*0.45);
    this.vis.body.setPosition(x,sy+6).setRotation(tilt);
    this.vis.armL.setPosition(x-24,sy+4).setRotation(swing*0.5);
    this.vis.armR.setPosition(x+24,sy+4).setRotation(-swing*0.5);
    this.vis.head.setPosition(x,sy-22).setRotation(tilt);
    this.vis.hair.setPosition(x,sy-32).setRotation(tilt);
    this.vis.eyeL.setPosition(x-6,sy-26);
    this.vis.eyeR.setPosition(x+6,sy-26);
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  _buildUI() {
    const w=WORLDS[0];
    this.add.rectangle(W/2,28,W,48,0x000000,0.55).setDepth(20);
    this.scoreTxt=this.add.text(W/2,28,'Score: 0',{fontSize:'20px',fontFamily:'Arial',fill:'#fff'}).setOrigin(0.5).setDepth(21);
    this.add.circle(24,28,11,0xffd700).setDepth(20);
    this.coinTxt=this.add.text(42,28,'0',{fontSize:'20px',fontFamily:'Arial',fill:'#ffd700'}).setOrigin(0,0.5).setDepth(21);
    this.worldBanner=this.add.text(W/2,H-28,`WORLD ${w.no} · ${w.name}`,{
      fontSize:'13px',fontFamily:'Arial Black,Arial',fill:w.accentStr,
      stroke:'#000000',strokeThickness:4,
      backgroundColor:'#00000088',padding:{x:10,y:5},
    }).setOrigin(0.5).setDepth(21);
  }

  _refreshBanner() {
    const w=WORLDS[this.worldIdx];
    this.worldBanner.setText(`WORLD ${w.no} · ${w.name}`).setStyle({fill:w.accentStr});
  }

  // ── Controls ─────────────────────────────────────────────────────────────────

  _buildControls() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointerdown', p=>{ this._touch={x:p.x,y:p.y}; });
    this.input.on('pointerup',   p=>{
      if(!this._touch) return;
      const dx=p.x-this._touch.x, dy=p.y-this._touch.y;
      if(Math.abs(dy)>Math.abs(dx)){ if(dy<-25) this._jump(); }
      else if(Math.abs(dx)>25){ this._switchLane(dx>0?1:-1); }
      this._touch=null;
    });
  }

  _jump() {
    if(!this.alive) return;
    if(this.jumpH<2||this.rideTimer>0){ this.rideTimer=0; this.jumpVel=JUMP_INIT; audio.jump(); }
  }

  _switchLane(dir) {
    if(!this.alive) return;
    const next=Phaser.Math.Clamp(this.pLane+dir,0,2);
    if(next===this.pLane) return;
    this.pLane=next; audio.switchLane();
  }

  // ── World progression ────────────────────────────────────────────────────────

  _tryAdvanceWorld() {
    if(this.worldIdx>=WORLDS.length-1||this.score<this.worldNext) return;
    this.worldIdx++;
    this.worldNext+=WORLD_SCORE;
    this._buildWorldVisuals();
    this._refreshBanner();
    const w=WORLDS[this.worldIdx];
    const flash=this.add.text(W/2,H/2,`WORLD ${w.no}\n${w.name}`,{
      fontSize:'30px',fontFamily:'Arial Black,Arial',fill:w.accentStr,
      stroke:'#000000',strokeThickness:6,align:'center',
    }).setOrigin(0.5).setDepth(30).setAlpha(1);
    this.tweens.add({targets:flash,alpha:0,y:H/2-50,duration:1800,ease:'Power2',
      onComplete:()=>flash.destroy()});
  }

  // ── Spawn ────────────────────────────────────────────────────────────────────

  _spawnObstacle(time) {
    const count=Math.random()<0.3?2:1;
    const lanes=Phaser.Utils.Array.Shuffle([0,1,2]).slice(0,count);
    for(const lane of lanes){
      const h=Phaser.Math.Between(42,65), ww=Phaser.Math.Between(30,48);
      const color=Phaser.Utils.Array.GetRandom([0xd32f2f,0xe65100,0x5d4037]);
      const face=this.add.rectangle(0,0,1,1,color).setDepth(5);
      const top =this.add.rectangle(0,0,1,1,Phaser.Display.Color.IntegerToColor(color).lighten(25).color32).setDepth(5);
      const side=this.add.rectangle(0,0,1,1,Phaser.Display.Color.IntegerToColor(color).darken(20).color32).setDepth(5);
      this.gameObjs.push({type:'obstacle',lane,worldY:HORIZON_Y+6,worldH:h,worldW:ww,
        parts:[face,top,side],face,top,side,checked:false});
    }
    this.lastObs=time;
  }

  _spawnWagon(time) {
    const lane=Phaser.Math.Between(0,2), ww=86, wh=52;
    const body=this.add.rectangle(0,0,1,1,0x4e342e).setDepth(5);
    const roof=this.add.rectangle(0,0,1,1,0x6d4c41).setDepth(5);
    const wl  =this.add.circle(0,0,1,0x1a1a1a).setDepth(5);
    const wr  =this.add.circle(0,0,1,0x1a1a1a).setDepth(5);
    const numCoins=Phaser.Math.Between(3,6);
    const coins=[];
    for(let i=0;i<numCoins;i++){
      const tt=numCoins>1?i/(numCoins-1):0.5;
      coins.push({
        obj:  this.add.circle(0,0,1,0xffd700).setDepth(6),
        shine:this.add.circle(0,0,1,0xffe082).setAlpha(0.7).setDepth(6),
        fracT:tt-0.5,collected:false,
      });
    }
    this.gameObjs.push({type:'wagon',lane,worldY:HORIZON_Y+6,worldW:ww,worldH:wh,
      parts:[body,roof,wl,wr,...coins.flatMap(c=>[c.obj,c.shine])],
      body,roof,wl,wr,coins,checked:false});
    this.lastWagon=time;
  }

  // ── Render objects ───────────────────────────────────────────────────────────

  _renderObj(obj) {
    const y=obj.worldY, sc=pSc(y), x=lX(obj.lane,y), dp=4+pT(y)*5;

    if(obj.type==='obstacle'){
      const sw=obj.worldW*sc, sh=obj.worldH*sc, fy=y-sh/2;
      obj.face.setPosition(x,fy).setSize(sw,sh).setDepth(dp);
      const th=sh*0.18;
      obj.top.setPosition(x,fy-sh/2-th/2).setSize(sw*1.06,th).setDepth(dp);
      const sdw=sw*0.12;
      obj.side.setPosition(x+sw/2+sdw/2,fy).setSize(sdw,sh).setDepth(dp);
    }

    if(obj.type==='wagon'){
      const sw=obj.worldW*sc, sh=obj.worldH*sc;
      const suf=eY(y,WAGON_TOP), bcy=suf+sh/2;
      obj.body.setPosition(x,bcy).setSize(sw,sh).setDepth(dp);
      const rh=sh*0.22;
      obj.roof.setPosition(x,suf-rh/2).setSize(sw*1.06,rh).setDepth(dp);
      const wrr=Math.max(2,10*sc), wy=suf+sh+wrr;
      obj.wl.setPosition(x-sw*0.33,wy).setRadius(wrr).setDepth(dp);
      obj.wr.setPosition(x+sw*0.33,wy).setRadius(wrr).setDepth(dp);
      obj.coins.forEach(c=>{
        if(c.collected) return;
        const cr=Math.max(2,9*sc), cx=x+c.fracT*sw, cy=suf-cr-4*sc;
        c.obj.setPosition(cx,cy).setRadius(cr).setDepth(dp+1);
        c.shine.setPosition(cx-cr*0.3,cy-cr*0.35).setRadius(Math.max(1,cr*0.42)).setDepth(dp+1);
      });
    }
  }

  // ── Collision ────────────────────────────────────────────────────────────────

  _handleCollision(obj) {
    if(obj.checked||obj.lane!==this.pLane) return;
    if(obj.type==='obstacle'){
      obj.checked=true;
      if(this.jumpH<obj.worldH-8) this._gameOver();
    }
    if(obj.type==='wagon'){
      if(this.jumpH>=WAGON_TOP-28&&this.jumpVel<=0){
        obj.checked=true;
        this.jumpH=WAGON_TOP; this.jumpVel=0; this.rideTimer=1100;
        obj.coins.forEach(c=>{
          if(!c.collected){
            c.collected=true; this.coinCount++;
            this._coinPop(c.obj.x,c.obj.y);
            c.obj.setVisible(false); c.shine.setVisible(false);
            audio.coin();
          }
        });
        this.coinTxt.setText(this.coinCount); audio.land();
      } else if(this.jumpH<WAGON_TOP-8){
        obj.checked=true; this._gameOver();
      }
    }
  }

  // ── Game over ────────────────────────────────────────────────────────────────

  _gameOver() {
    if(!this.alive) return;
    this.alive=false; audio.gameOver();
    const flash=this.add.rectangle(W/2,H/2,W,H,0xff0000,0.3).setDepth(25);
    this.time.delayedCall(200,()=>flash.destroy());
    this.add.rectangle(W/2,H/2,340,265,0x000000,0.9).setDepth(25);
    this.add.text(W/2,H/2-88,'GAME OVER',{fontSize:'42px',fontFamily:'Arial Black,Arial',fill:'#ff6b6b',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(26);
    this.add.text(W/2,H/2-18,`Score: ${Math.floor(this.score)}`,{fontSize:'26px',fontFamily:'Arial',fill:'#fff'}).setOrigin(0.5).setDepth(26);
    this.add.text(W/2,H/2+22,`Coins: ${this.coinCount}`,{fontSize:'22px',fontFamily:'Arial',fill:'#ffd700'}).setOrigin(0.5).setDepth(26);
    const btn=this.add.rectangle(W/2,H/2+92,190,50,0xff6b6b).setInteractive({useHandCursor:true}).setDepth(26);
    this.add.text(W/2,H/2+92,'PLAY AGAIN',{fontSize:'22px',fontFamily:'Arial Black,Arial',fill:'#fff'}).setOrigin(0.5).setDepth(27);
    const restart=()=>{ audio.playGame(); this.scene.restart(); };
    btn.on('pointerdown',restart);
    this.time.delayedCall(400,()=>this.input.keyboard.once('keydown',restart));
  }

  _coinPop(x,y) {
    const t=this.add.text(x,y,'+1',{fontSize:'18px',fontFamily:'Arial Black',fill:'#ffd700'}).setOrigin(0.5).setDepth(22);
    this.tweens.add({targets:t,y:y-50,alpha:0,duration:520,ease:'Power2',onComplete:()=>t.destroy()});
  }

  // ── Main update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    if(!this.alive) return;
    const dt=delta/1000;

    this.score+=delta*0.015;
    this.scoreTxt.setText('Score: '+Math.floor(this.score));
    this._tryAdvanceWorld();

    // Input
    if(Phaser.Input.Keyboard.JustDown(this.cursors.up)||Phaser.Input.Keyboard.JustDown(this.wKey)||Phaser.Input.Keyboard.JustDown(this.spaceKey)) this._jump();
    if(Phaser.Input.Keyboard.JustDown(this.cursors.left)||Phaser.Input.Keyboard.JustDown(this.aKey)) this._switchLane(-1);
    if(Phaser.Input.Keyboard.JustDown(this.cursors.right)||Phaser.Input.Keyboard.JustDown(this.dKey)) this._switchLane(1);

    // Lane lerp
    this.pX+=(LANE_NX[this.pLane]-this.pX)*11*dt;

    // Jump / ride
    if(this.rideTimer>0){
      this.rideTimer-=delta; this.jumpH=WAGON_TOP; this.jumpVel=0;
      if(this.rideTimer<=0) this.jumpVel=80;
    } else {
      this.jumpVel-=GRAVITY*dt; this.jumpH+=this.jumpVel*dt;
      if(this.jumpH<=0){ this.jumpH=0; this.jumpVel=0; }
    }

    // Game objects
    for(let i=this.gameObjs.length-1;i>=0;i--){
      const obj=this.gameObjs[i];
      obj.worldY+=this.speed*dt;
      if(obj.worldY>NEAR_Y+80){ obj.parts.forEach(p=>p.destroy()); this.gameObjs.splice(i,1); continue; }
      this._renderObj(obj);
      if(obj.worldY>=NEAR_Y-18&&obj.worldY<=NEAR_Y+18) this._handleCollision(obj);
    }

    this._updateTrackMarks(dt);
    this._updateSideScenery(dt);

    // Spawn
    const obsGap  =Math.max(900,  2200-this.speed*4.5);
    const wagonGap=Math.max(4500, 9000-this.speed*15);
    if(time-this.lastObs>obsGap) this._spawnObstacle(time);
    if(time-this.lastWagon>wagonGap){ this._spawnWagon(time); this.lastObs=time+500; }

    this._syncPlayer(time);
  }
}

// ─── Phaser config ────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#060c18',
  input: { activePointers: 3 },
  physics: { default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
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
