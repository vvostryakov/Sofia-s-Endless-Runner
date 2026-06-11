import { W, H, STORAGE_KEYS, saveString, loadString, bestSummary, appVersionLabel } from '../constants.js';
import { setupHiDPI } from '../projection.js';
import { audio, unlockAudio, setAudioMuted } from '../audio.js';

// ─── Boot / menu scene ────────────────────────────────────────────────────────
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    setupHiDPI(this);
    this.muted = loadString(STORAGE_KEYS.muted) === '1';
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
    this.panel.add(this.add.text(cx, cy - 66, `Run — ${bestSummary(false)}`, {
      fontSize: '15px', fontFamily: 'Arial', fill: '#b7e4ff',
    }).setOrigin(0.5));
    this.panel.add(this.add.text(cx, cy - 46, `Rhythm — ${bestSummary(true)}`, {
      fontSize: '15px', fontFamily: 'Arial', fill: '#d8b7ff',
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
      saveString(STORAGE_KEYS.seenHelp, '1');
      this._showMenu();
    }, 0xff6b6b);
  }

  _activatePrimary() {
    unlockAudio();
    if (this.mode === 'help') {
      saveString(STORAGE_KEYS.seenHelp, '1');
      this._showMenu();
      return;
    }
    if (this.mode === 'menu') this._startRun(false);
  }

  _toggleSound() {
    this.muted = !this.muted;
    saveString(STORAGE_KEYS.muted, this.muted ? '1' : '0');
    setAudioMuted(this.muted);
    if (!this.muted) audio.playMenu();
    this._showMenu();
  }

  _startRun(rhythmMode = false) {
    unlockAudio();
    if (loadString(STORAGE_KEYS.seenHelp) !== '1') {
      saveString(STORAGE_KEYS.seenHelp, '1');
    }
    audio.stop();
    this.scene.start('Game', { rhythmMode });
  }
}
