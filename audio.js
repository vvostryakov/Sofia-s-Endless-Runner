// Procedural audio manager — Web Audio API, no files needed

class AudioManager {
  constructor() {
    this._ctx = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._track = null;
    this._loopTimer = null;
    this._muted = false;
  }

  _init() {
    if (this._ctx) {
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return;
    }
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = this._muted ? 0 : 0.38;
    this._musicGain.connect(this._ctx.destination);

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this._muted ? 0 : 0.75;
    this._sfxGain.connect(this._ctx.destination);
  }

  _freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _note(midi, t, dur, vol = 0.15, type = 'square', bus = 'music') {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = this._freq(midi);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.88);
    osc.connect(gain);
    gain.connect(bus === 'sfx' ? this._sfxGain : this._musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  _kick(t) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.12);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this._musicGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // ── Menu music — dreamy, slow arpeggio in C major ─────────────────────────

  _scheduleMenu(startTime) {
    const BPM = 84, beat = 60 / BPM;
    const len = 16 * beat;

    // Rising/falling melody (triangle, soft)
    const mel = [72,76,79,81, 79,76,72,69, 71,74,77,79, 77,74,71,67];
    mel.forEach((n, i) => {
      this._note(n, startTime + i * beat * 0.5, beat * 0.42, 0.11, 'triangle');
    });

    // Chord pads (sine, very gentle, 4-beat blocks)
    [[60,64,67],[57,60,64],[55,59,62],[53,57,60]].forEach(([a, b, c], i) => {
      const t = startTime + i * beat * 4;
      [a, b, c].forEach(n => this._note(n, t, beat * 3.7, 0.055, 'sine'));
    });

    // Slow bass walk (sine)
    [48, 45, 47, 43].forEach((n, i) => {
      this._note(n, startTime + i * beat * 4, beat * 3.4, 0.09, 'sine');
    });

    return len;
  }

  // ── Game music — upbeat chiptune, 140 BPM ────────────────────────────────

  _scheduleGame(startTime) {
    const BPM = 140, beat = 60 / BPM;
    const len = 16 * beat;

    // Melody (square)
    const mel = [67,67,71,72, 74,72,71,69, 67,69,71,72, 71,69,67,64];
    mel.forEach((n, i) => {
      this._note(n, startTime + i * beat, beat * 0.78, 0.08, 'square');
    });

    // Running bass (sawtooth, every beat)
    const bass = [48,48,47,47, 45,45,47,47, 48,48,47,47, 45,43,45,47];
    bass.forEach((n, i) => {
      this._note(n, startTime + i * beat, beat * 0.44, 0.10, 'sawtooth');
    });

    // Offbeat hi-hat (short high triangle)
    for (let i = 1; i < 16; i += 2) {
      this._note(98, startTime + i * beat, beat * 0.07, 0.035, 'triangle');
    }

    // Kick on beats 1, 5, 9, 13
    [0, 4, 8, 12].forEach(i => this._kick(startTime + i * beat));

    return len;
  }

  // ── Loop driver ───────────────────────────────────────────────────────────

  _loop(scheduleFn) {
    const len = scheduleFn.call(this, this._ctx.currentTime + 0.05);
    this._loopTimer = setTimeout(() => {
      if (this._track) this._loop(scheduleFn);
    }, (len - 0.08) * 1000);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  playMenu() {
    this._init();
    this.stop();
    this._track = 'menu';
    this._loop(this._scheduleMenu);
  }

  playGame() {
    this._init();
    this.stop();
    this._track = 'game';
    this._loop(this._scheduleGame);
  }

  stop() {
    this._track = null;
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
  }

  setMuted(muted) {
    this._muted = muted;
    if (!this._ctx) return;
    this._musicGain.gain.value = muted ? 0 : 0.38;
    this._sfxGain.gain.value = muted ? 0 : 0.75;
  }

  // ── SFX ───────────────────────────────────────────────────────────────────

  jump() {
    this._init();
    const ctx = this._ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.09);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  land() {
    this._init();
    const ctx = this._ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  coin() {
    this._init();
    const t = this._ctx.currentTime;
    [79, 83, 86].forEach((n, i) => {
      this._note(n, t + i * 0.055, 0.11, 0.22, 'square', 'sfx');
    });
  }

  switchLane() {
    this._init();
    const ctx = this._ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.065);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  gameOver() {
    this._init();
    this.stop();
    const t = this._ctx.currentTime;
    // Descending wail
    [72, 69, 65, 60].forEach((n, i) => {
      this._note(n, t + i * 0.17, 0.28, 0.18, 'sawtooth', 'sfx');
    });
    // Final thud
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t + 0.72);
    osc.frequency.exponentialRampToValueAtTime(18, t + 1.05);
    gain.gain.setValueAtTime(0.55, t + 0.72);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t + 0.72);
    osc.stop(t + 1.15);
  }
}

window.audio = new AudioManager();
