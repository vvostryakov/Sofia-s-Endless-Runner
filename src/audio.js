// Procedural audio manager — Web Audio API, no files needed

class AudioManager {
  constructor() {
    this._ctx = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._track = null;
    this._loopTimer = null;
    this._muted = false;
    this._musicVol = 1;
    this._sfxVol = 1;
    this._pendingPlayId = 0;
    this._scheduleFn = null;
    this._trackStart = null;
    this._nextLoopStart = 0;
  }

  _init() {
    if (this._ctx) return true;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;

    this._ctx = new AudioContextCtor();

    this._musicGain = this._ctx.createGain();
    this._musicGain.connect(this._ctx.destination);

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.connect(this._ctx.destination);

    this._applyGains();
    return true;
  }

  _applyGains() {
    if (!this._ctx) return;
    this._musicGain.gain.value = this._muted ? 0 : 0.38 * this._musicVol;
    this._sfxGain.gain.value = this._muted ? 0 : 0.75 * this._sfxVol;
  }

  setMusicVolume(frac) {
    this._musicVol = Math.max(0, Math.min(1, frac));
    this._applyGains();
  }

  setSfxVolume(frac) {
    this._sfxVol = Math.max(0, Math.min(1, frac));
    this._applyGains();
  }

  _resume() {
    if (!this._ctx || this._ctx.state === 'running' || this._ctx.state === 'closed' || typeof this._ctx.resume !== 'function') {
      return null;
    }

    return this._ctx.resume();
  }

  _restartCurrentTrack() {
    if (!this._track || !this._scheduleFn || this._loopTimer || this._ctx.state !== 'running') return;
    this._loop(this._scheduleFn);
  }

  unlock() {
    if (!this._init()) return;

    const resumePromise = this._resume();
    if (resumePromise && typeof resumePromise.then === 'function') {
      resumePromise.then(() => this._restartCurrentTrack()).catch(() => {});
    } else {
      this._restartCurrentTrack();
    }
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


  // ── Rhythm Run music — simple beat-test loop, 128 BPM ─────────────────────

  _scheduleRhythm(startTime) {
    const BPM = 128, beat = 60 / BPM;
    const len = 16 * beat;

    // Bright lead marks every collectable beat.
    const lead = [72, 72, 79, 76, 74, 76, 79, 83, 81, 79, 76, 74, 72, 74, 76, 79];
    lead.forEach((n, i) => {
      this._note(n, startTime + i * beat, beat * 0.32, i % 4 === 0 ? 0.13 : 0.09, 'square');
    });

    // Bass pulse keeps the rhythm easy to hear.
    const bass = [48, 48, 43, 43, 45, 45, 47, 47, 48, 48, 43, 43, 45, 47, 48, 48];
    bass.forEach((n, i) => {
      this._note(n, startTime + i * beat, beat * 0.36, 0.12, 'sawtooth');
    });

    // Drum grid: kick on downbeats, snare on 2 and 4, hats on eighth notes.
    [0, 4, 8, 12].forEach(i => this._kick(startTime + i * beat));
    [2, 6, 10, 14].forEach(i => this._snare(startTime + i * beat));
    for (let i = 0; i < 32; i++) this._hat(startTime + i * beat * 0.5);

    return len;
  }

  _snare(t) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.09);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(gain);
    gain.connect(this._musicGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  _hat(t) {
    this._note(103, t, 0.035, 0.028, 'triangle');
  }

  // ── Loop driver ───────────────────────────────────────────────────────────

  _loop(scheduleFn) {
    if (!this._ctx || this._ctx.state !== 'running') return;

    // Schedule each iteration at an absolute time so loops never drift —
    // the game derives beat timing from this clock via getTrackTime().
    if (this._trackStart === null) {
      this._trackStart = this._ctx.currentTime + 0.05;
      this._nextLoopStart = this._trackStart;
    }
    const len = scheduleFn.call(this, this._nextLoopStart);
    this._nextLoopStart += len;
    const waitMs = Math.max(20, (this._nextLoopStart - this._ctx.currentTime - 0.12) * 1000);
    this._loopTimer = setTimeout(() => {
      if (this._track) this._loop(scheduleFn);
    }, waitMs);
  }

  // Seconds since the current track actually started playing, or null when
  // no track is audibly running (stopped, or still waiting on user unlock).
  getTrackTime() {
    if (!this._ctx || !this._track || this._trackStart === null) return null;
    return Math.max(0, this._ctx.currentTime - this._trackStart);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  _playTrack(track, scheduleFn) {
    if (!this._init()) return;

    this.stop();
    this._track = track;
    this._scheduleFn = scheduleFn;
    const playId = ++this._pendingPlayId;
    const start = () => {
      if (this._track === track && this._pendingPlayId === playId) this._restartCurrentTrack();
    };
    const resumePromise = this._resume();

    if (resumePromise && typeof resumePromise.then === 'function') {
      resumePromise.then(start).catch(() => {});
    } else {
      start();
    }
  }

  playMenu() {
    this._playTrack('menu', this._scheduleMenu);
  }

  playGame() {
    this._playTrack('game', this._scheduleGame);
  }

  playRhythm() {
    this._playTrack('rhythm', this._scheduleRhythm);
  }

  stop() {
    this._pendingPlayId++;
    this._track = null;
    this._scheduleFn = null;
    this._trackStart = null;
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
  }

  setMuted(muted) {
    this._muted = muted;
    this._applyGains();
  }

  // ── SFX ───────────────────────────────────────────────────────────────────

  jump() {
    if (!this._init()) return;
    this.unlock();
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
    if (!this._init()) return;
    this.unlock();
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
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    [79, 83, 86].forEach((n, i) => {
      this._note(n, t + i * 0.055, 0.11, 0.22, 'square', 'sfx');
    });
  }

  switchLane() {
    if (!this._init()) return;
    this.unlock();
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

  powerUp() {
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => {
      this._note(n, t + i * 0.045, 0.13, 0.18, 'triangle', 'sfx');
    });
  }

  shieldBreak() {
    if (!this._init()) return;
    this.unlock();
    const ctx = this._ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(760, t);
    osc.frequency.exponentialRampToValueAtTime(170, t + 0.16);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  gameOver() {
    if (!this._init()) return;
    this.unlock();
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

export const audio = new AudioManager();
// Kept on window for console debugging.
window.audio = audio;
export const unlockAudio = () => audio.unlock();
export const setAudioMuted = (muted) => audio.setMuted(muted);
