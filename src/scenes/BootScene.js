import { W, H, STORAGE_KEYS, loadString, loadVolume } from '../constants.js';
import { setupHiDPI, HORIZON_Y } from '../projection.js';
import { audio, unlockAudio, setAudioMuted } from '../audio.js';
import { initUI, showMenu, menuPrimary } from '../ui.js';

// ─── Boot / menu scene ────────────────────────────────────────────────────────
// The menu itself is DOM (src/ui.js); this scene only paints the living
// backdrop behind it and owns the keyboard shortcuts + audio bootstrapping.
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    setupHiDPI(this);
    setAudioMuted(loadString(STORAGE_KEYS.muted) === '1');
    audio.setMusicVolume(loadVolume(STORAGE_KEYS.musicVol) / 100);
    audio.setSfxVolume(loadVolume(STORAGE_KEYS.sfxVol) / 100);
    this._buildBackground();

    initUI(this.game);
    showMenu({ onStart: (rhythm, track = 'classic') => this._startRun(rhythm, track) });

    // The DOM menu sits over the canvas, so listen at the document level for
    // the first gesture; the listener must not outlive the menu scene.
    const startMusic = () => {
      unlockAudio();
      if (loadString(STORAGE_KEYS.muted) !== '1') audio.playMenu();
    };
    document.addEventListener('pointerdown', startMusic, { once: true });
    this.input.keyboard.once('keydown', startMusic);
    this.events.once('shutdown', () => document.removeEventListener('pointerdown', startMusic));
    document.addEventListener('touchend', unlockAudio, { once: true, passive: true });
    document.addEventListener('click', unlockAudio, { once: true, passive: true });
    this.input.keyboard.on('keydown-SPACE', () => menuPrimary());
    this.input.keyboard.on('keydown-ENTER', () => menuPrimary());
  }

  _buildBackground() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x070d1a, 0x070d1a, 0x132038, 0x132038, 1);
    sky.fillRect(0, 0, W, H);

    // Twinkling stars
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H * 0.6),
        Math.random() < 0.22 ? 2 : 1, 0xffffff
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.9));
      this.stars.push({ obj: star, phase: Math.random() * Math.PI * 2, rate: Phaser.Math.FloatBetween(0.6, 2) });
    }

    this.add.circle(318, 64, 28, 0xfff9c4).setAlpha(0.85);
    this.add.circle(307, 56, 22, 0x132038).setAlpha(0.55);

    // Aurora ribbons drifting behind the DOM glass panels
    this.auroraG = this.add.graphics();

    // Distant rolling hills silhouette
    const hills = this.add.graphics();
    hills.fillStyle(0x0b1626, 1);
    hills.beginPath();
    hills.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      hills.lineTo(x, H * 0.66 + Math.sin(x * 0.013) * 26 + Math.sin(x * 0.031 + 2) * 14);
    }
    hills.lineTo(W, H);
    hills.closePath();
    hills.fillPath();
  }

  update(time) {
    for (const s of this.stars) {
      s.obj.setAlpha(0.25 + Math.abs(Math.sin(time * 0.0006 * s.rate + s.phase)) * 0.65);
    }
    const g = this.auroraG;
    g.clear();
    const bands = [
      { y: HORIZON_Y - 130, amp: 22, hue: 0x1de9b6, alpha: 0.05, speed: 0.00021 },
      { y: HORIZON_Y - 70, amp: 30, hue: 0x7c4dff, alpha: 0.045, speed: 0.00015 },
    ];
    for (const b of bands) {
      g.fillStyle(b.hue, b.alpha);
      g.beginPath();
      g.moveTo(0, b.y);
      for (let x = 0; x <= W; x += 10) {
        g.lineTo(x, b.y + Math.sin(x * 0.012 + time * b.speed * 9) * b.amp);
      }
      for (let x = W; x >= 0; x -= 10) {
        g.lineTo(x, b.y + 64 + Math.sin(x * 0.014 + time * b.speed * 7 + 1.6) * b.amp);
      }
      g.closePath();
      g.fillPath();
    }
  }

  _startRun(rhythmMode, rhythmTrack) {
    unlockAudio();
    audio.stop();
    this.scene.start('Game', { rhythmMode, rhythmTrack });
  }
}
