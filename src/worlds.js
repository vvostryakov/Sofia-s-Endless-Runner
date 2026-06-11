import { W } from './constants.js';
import { HORIZON_Y } from './projection.js';

// ─── Worlds ───────────────────────────────────────────────────────────────────
export const WORLDS = [
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
export const WORLD_SCORE = 4000;

export function bdJungle(g, w) {
  for(let i=0;i<38;i++){ g.fillStyle(0xffffff,0.15+Math.random()*0.65); g.fillRect(Math.random()*W,Math.random()*(HORIZON_Y-10),1,1); }
  g.fillStyle(0xeaf6ff,0.9); g.fillCircle(310,52,27);
  g.fillStyle(w.sky[0],0.7); g.fillCircle(300,46,22);
  g.fillStyle(0x0c2016,0.6); for(let i=-2;i<11;i++) g.fillEllipse(i*50+14,HORIZON_Y-4,56,(28+Math.abs(i)%3*12)*2);
  g.fillStyle(0x0c2a22,0.9);
  g.fillPoints([{x:56,y:HORIZON_Y},{x:56,y:HORIZON_Y-46},{x:68,y:HORIZON_Y-46},{x:68,y:HORIZON_Y-62},{x:86,y:HORIZON_Y-62},{x:86,y:HORIZON_Y-46},{x:98,y:HORIZON_Y-46},{x:98,y:HORIZON_Y}],true);
  g.fillStyle(0x0a1c14,1); for(let i=0;i<14;i++) g.fillEllipse(i*30+14,-4,36,(18+i%3*10)*2);
  g.lineStyle(2,w.accent,0.12); for(let i=0;i<7;i++) g.strokeCircle(i*60+14,0,22+i%2*10);
  g.fillStyle(0x0c2018,0.92); for(let i=-3;i<20;i++) g.fillEllipse(i*26+13,HORIZON_Y-((22+Math.abs(i)*17%24)*0.5)+2,26,(22+Math.abs(i)*17%24)*2);
  g.fillStyle(w.accent,0.5); for(let i=0;i<12;i++) g.fillCircle(30+i*28+(i%3)*12,40+i*12+(i%4)*8,1.5);
}

export function bdSavanna(g, w) {
  g.fillStyle(0xffe6a0,1); g.fillCircle(W/2,HORIZON_Y*0.42,52);
  g.fillStyle(0xff9a4d,0.85); g.fillCircle(W/2,HORIZON_Y*0.42,40);
  g.lineStyle(3,0xff9a4d,0.1); g.strokeCircle(W/2,HORIZON_Y*0.42,72);
  g.fillStyle(0x3a1f3e,0.7); g.fillEllipse(W/2,HORIZON_Y+5,460,78);
  [[58,HORIZON_Y-28,5,26],[292,HORIZON_Y-24,5,22],[162,HORIZON_Y-16,4,18]].forEach(([ax,ay,tw,th])=>{
    g.fillStyle(0x120c1c,1); g.fillRect(ax-tw/2,ay,tw,th); g.fillEllipse(ax,ay-5,48,11);
  });
  [[0.23,0.18],[0.31,0.23],[0.69,0.16]].forEach(([bx,by])=>{
    g.lineStyle(2,0x1a102088,0.6); const px=bx*W,py=by*HORIZON_Y;
    g.beginPath(); g.moveTo(px-7,py); g.lineTo(px,py-4); g.lineTo(px+7,py); g.strokePath();
  });
}

export function bdReef(g, w) {
  g.fillStyle(0xbfebff,0.5); g.fillRect(0,0,W,6);
  g.lineStyle(2,0x7df0ff,0.5); for(let i=0;i<20;i++){ g.beginPath(); g.moveTo(i*22,3); g.lineTo(i*22+(10+(i*7)%12),3); g.strokePath(); }
  const rots=[-12,-4,5,14,24];
  for(let i=0;i<5;i++){ g.fillStyle(0x2be0ff,0.05); const cx=40+i*70,r=rots[i]*Math.PI/180; g.beginPath(); g.moveTo(cx,0); g.lineTo(cx+Math.sin(r)*HORIZON_Y*1.6+10,HORIZON_Y*1.6); g.lineTo(cx+Math.sin(r)*HORIZON_Y*1.6+50,HORIZON_Y*1.6); g.lineTo(cx+40,0); g.closePath(); g.fillPath(); }
  g.fillStyle(0x0a2e4c,0.72); for(let i=-2;i<11;i++) g.fillEllipse(i*46+4+16,HORIZON_Y+1,32,(12+(Math.abs(i)%3)*14)*2);
  g.fillStyle(0x2be0ff,0.3); for(let i=0;i<20;i++) g.fillCircle(15+i*19+(i%4)*11,10+(i*23)%HORIZON_Y,1+(i%3));
}

export function bdDeep(g, w) {
  for(let i=0;i<44;i++){ const c=i%2===0?0xb14dff:0x2be0ff; g.fillStyle(c,0.12+0.5*(i%5)/4); g.fillCircle((i*97+13)%W,(i*53+7)%(HORIZON_Y-10),i%5===0?2:1); }
  [[0.22,0xb14dff],[0.54,0x2be0ff],[0.80,0xb14dff]].forEach(([bx,bc])=>{ g.fillStyle(bc,0.08); g.fillCircle(bx*W,HORIZON_Y+5,58); });
  for(let i=0;i<4;i++){ g.fillStyle(0xb14dff,0.04); const cx=50+i*100; g.beginPath(); g.moveTo(cx,0); g.lineTo(cx+30,HORIZON_Y); g.lineTo(cx+52,HORIZON_Y); g.lineTo(cx+22,0); g.closePath(); g.fillPath(); }
  g.fillStyle(0x1c1448,0.85); for(let i=-2;i<14;i++) g.fillTriangle(i*36-8+9,HORIZON_Y-16-(Math.abs(i)%4)*14,i*36-8,HORIZON_Y+2,i*36-8+18,HORIZON_Y+2);
}

export function drawWorldWall(g, w, x, y, sc, side, jitter) {
  // Small repeating edge filler, one per world theme
  if(w.id==='jungle'){
    g.fillStyle(0x14301c,0.95);
    g.fillEllipse(x,y-5*sc,Math.round(26*sc),Math.round(16*sc));
    g.fillEllipse(x+side*9*sc,y-2*sc,Math.round(18*sc),Math.round(11*sc));
    g.fillStyle(w.accent,0.2); g.fillCircle(x-side*4*sc,y-9*sc,Math.max(1,2*sc));
  } else if(w.id==='savanna'){
    g.fillStyle(0x4a3617,0.95);
    g.fillEllipse(x,y-3*sc,Math.round(20*sc),Math.round(10*sc));
    g.fillStyle(0x6d5422,0.9);
    for(let j=-1;j<=1;j++) g.fillRect(x+j*5*sc-1*sc,y-11*sc,Math.max(1,1.6*sc),Math.round(9*sc));
  } else if(w.id==='reef'){
    g.fillStyle(0x0f4a60,0.95);
    g.fillEllipse(x,y-4*sc,Math.round(22*sc),Math.round(13*sc));
    g.fillStyle(jitter>0.5?0xff3dae:0x2be0ff,0.5);
    g.fillCircle(x+side*5*sc,y-9*sc,Math.max(1,2.5*sc));
  } else {
    g.fillStyle(0x191244,0.95);
    g.fillRect(x-5*sc,y-14*sc,Math.round(10*sc),Math.round(14*sc));
    g.fillStyle(w.accent,0.3); g.fillRect(x-3*sc,y-11*sc,Math.max(1,2*sc),Math.max(1,2*sc));
  }
}

export function drawWorldScenery(g, w, x, y, sc, side, t) {
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
