import { W, DPR, H } from './constants.js';
import { storage } from './platform/storage.js';
import { migrateSave } from './engine/save.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';

// Bring any older save up to the current schema before the game reads it.
migrateSave(storage);

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
    autoCenter: Phaser.Scale.NO_CENTER, // index.html centers via flexbox
    width: W * DPR,
    height: H * DPR,
  },
};

window.game = new Phaser.Game(config);
