// Procedural audio manager — Web Audio API, no files needed.
//
// 2026 mobile-game voice: every note runs through a lowpass filter + ADSR for
// a warm, non-fatiguing tone (no raw chiptune edges), the whole mix glues
// through a compressor, and a procedural convolution reverb gives the music
// and SFX a sense of space. Drums are real filtered-noise hits, not bleeps.

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
    const ctx = this._ctx;

    // Master glue compressor → destination
    this._master = ctx.createDynamicsCompressor();
    this._master.threshold.value = -16;
    this._master.knee.value = 22;
    this._master.ratio.value = 3;
    this._master.attack.value = 0.005;
    this._master.release.value = 0.2;
    this._master.connect(ctx.destination);

    this._musicGain = ctx.createGain();
    this._musicGain.connect(this._master);

    this._sfxGain = ctx.createGain();
    this._sfxGain.connect(this._master);

    // Convolution reverb send shared by music + SFX
    this._reverb = ctx.createConvolver();
    this._reverb.buffer = this._makeImpulse(2.4, 2.8);
    this._reverbReturn = ctx.createGain();
    this._reverbReturn.gain.value = 0.85;
    this._reverb.connect(this._reverbReturn);
    this._reverbReturn.connect(this._master);

    // Shared white-noise buffer for percussion
    this._noise = this._makeNoise(1);

    this._applyGains();
    return true;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this._ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _makeNoise(seconds) {
    const ctx = this._ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _applyGains() {
    if (!this._ctx) return;
    this._musicGain.gain.value = this._muted ? 0 : 0.34 * this._musicVol;
    this._sfxGain.gain.value = this._muted ? 0 : 0.7 * this._sfxVol;
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

  // ── Core synth voice ───────────────────────────────────────────────────────
  // Filtered, optionally detuned tone with a soft attack/decay/release and a
  // reverb send. This single voice builds every melodic/harmonic part.
  _voice(midi, t, dur, opts = {}) {
    const ctx = this._ctx;
    if (!ctx) return;
    const {
      type = 'sawtooth', vol = 0.1, bus = 'music',
      cutoff = 2200, q = 1, detune = 0, reverb = 0.16,
      attack = 0.012, release = 0.16, sub = false, glide = 0,
    } = opts;
    const freq = this._freq(midi);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff;
    filt.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.6), t + Math.max(attack + 0.02, dur * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);

    filt.connect(g);
    g.connect(bus === 'sfx' ? this._sfxGain : this._musicGain);
    if (reverb > 0 && this._reverb) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      g.connect(send);
      send.connect(this._reverb);
    }

    const stopAt = t + dur + release + 0.05;
    const mkOsc = (det) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = det;
      if (glide > 0) {
        o.frequency.setValueAtTime(this._freq(midi - glide), t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
      } else {
        o.frequency.value = freq;
      }
      o.connect(filt);
      o.start(t);
      o.stop(stopAt);
    };
    mkOsc(detune);
    if (detune) mkOsc(-detune); // supersaw width

    if (sub) {
      const so = ctx.createOscillator();
      so.type = 'sine';
      so.frequency.value = freq / 2;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(vol * 0.8, t + attack);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
      so.connect(sg);
      sg.connect(this._musicGain);
      so.start(t);
      so.stop(stopAt);
    }
  }

  // ── Percussion (filtered noise + tonal bodies) ──────────────────────────────
  _noiseHit(t, { dur = 0.06, type = 'highpass', freq = 8000, q = 1, vol = 0.2, bus = 'music', reverb = 0 } = {}) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(bus === 'sfx' ? this._sfxGain : this._musicGain);
    if (reverb > 0 && this._reverb) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      g.connect(send);
      send.connect(this._reverb);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _kick(t, vol = 0.9) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.42 * vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(gain);
    gain.connect(this._musicGain);
    osc.start(t);
    osc.stop(t + 0.3);
    // transient click
    this._noiseHit(t, { dur: 0.02, type: 'highpass', freq: 2600, vol: 0.12 * vol });
  }

  _snare(t, vol = 1) {
    // noise body + short tonal ring
    this._noiseHit(t, { dur: 0.16, type: 'bandpass', freq: 1900, q: 0.7, vol: 0.22 * vol, reverb: 0.14 });
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    gain.gain.setValueAtTime(0.12 * vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain);
    gain.connect(this._musicGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  _hat(t, open = false) {
    this._noiseHit(t, { dur: open ? 0.12 : 0.04, type: 'highpass', freq: 9000, vol: open ? 0.06 : 0.05 });
  }

  _clap(t, vol = 1) {
    [0, 0.012, 0.024].forEach((o) =>
      this._noiseHit(t + o, { dur: 0.09, type: 'bandpass', freq: 1700, q: 0.8, vol: 0.13 * vol, reverb: 0.18 }));
  }

  // ── Menu music — warm dreamy lo-fi in C ─────────────────────────────────────

  _scheduleMenu(startTime) {
    const BPM = 82, beat = 60 / BPM;
    const len = 16 * beat;

    // Soft electric-piano chords (filtered triangle stacks, lots of reverb)
    [[60, 64, 67], [57, 60, 64], [55, 59, 62], [53, 57, 60]].forEach(([a, b, c], i) => {
      const t = startTime + i * beat * 4;
      [a, b, c].forEach((n, k) =>
        this._voice(n + 12, t, beat * 3.6, { type: 'triangle', vol: 0.05, cutoff: 1500, reverb: 0.3, attack: 0.04 + k * 0.01, release: 0.5 }));
    });

    // Gentle bell melody
    const mel = [72, 76, 79, 81, 79, 76, 72, 69, 71, 74, 77, 79, 77, 74, 71, 67];
    mel.forEach((n, i) =>
      this._voice(n, startTime + i * beat * 0.5, beat * 0.45, { type: 'triangle', vol: 0.06, cutoff: 2600, reverb: 0.34, attack: 0.005, release: 0.3 }));

    // Sub bass walk
    [48, 45, 47, 43].forEach((n, i) =>
      this._voice(n, startTime + i * beat * 4, beat * 3.4, { type: 'sine', vol: 0.12, cutoff: 600, reverb: 0.08, attack: 0.03 }));

    // Soft shaker on offbeats
    for (let i = 0; i < 16; i++) this._noiseHit(startTime + (i + 0.5) * beat, { dur: 0.03, type: 'highpass', freq: 7000, vol: 0.02 });

    return len;
  }

  // ── Game music — warm synthwave, 140 BPM ────────────────────────────────────

  _scheduleGame(startTime) {
    const BPM = 140, beat = 60 / BPM;
    const len = 16 * beat;
    const swing = beat * 0.06;

    // Plucky saw lead (detuned, filtered, short) with a touch of delay-ish reverb
    const mel = [67, 67, 71, 72, 74, 72, 71, 69, 67, 69, 71, 72, 71, 69, 67, 64];
    mel.forEach((n, i) =>
      this._voice(n, startTime + i * beat + (i % 2 ? swing : 0), beat * 0.5, {
        type: 'sawtooth', vol: 0.07, cutoff: 2400, q: 2, detune: 8, reverb: 0.2, attack: 0.006, release: 0.18,
      }));

    // Warm filtered sub bass
    const bass = [48, 48, 47, 47, 45, 45, 47, 47, 48, 48, 47, 47, 45, 43, 45, 47];
    bass.forEach((n, i) =>
      this._voice(n, startTime + i * beat, beat * 0.46, { type: 'sawtooth', vol: 0.1, cutoff: 520, q: 3, reverb: 0.05, sub: true, attack: 0.008 }));

    // Pad swells under it
    [[55, 59, 62], [53, 57, 60], [52, 55, 59], [50, 53, 57]].forEach(([a, b, c], i) => {
      const t = startTime + i * beat * 4;
      [a, b, c].forEach((n) => this._voice(n, t, beat * 3.6, { type: 'sawtooth', vol: 0.022, cutoff: 1100, detune: 10, reverb: 0.3, attack: 0.2, release: 0.5 }));
    });

    // Four-on-the-floor kick, claps on 2 & 4, offbeat hats
    [0, 4, 8, 12].forEach((i) => this._kick(startTime + i * beat));
    [4, 12].forEach((i) => this._clap(startTime + i * beat));
    for (let i = 0; i < 16; i++) this._hat(startTime + (i + 0.5) * beat, i % 4 === 3);

    return len;
  }

  // ── Rhythm Run — three tracks, layered by combo intensity ───────────────────

  setIntensityCallback(fn) {
    this._intensityFn = fn;
  }

  _intensity() {
    return this._intensityFn ? this._intensityFn() : 2;
  }

  _scheduleRhythmCore(startTime, BPM, lead, bass) {
    const beat = 60 / BPM;
    const len = 16 * beat;
    const intensity = this._intensity();

    lead.forEach((n, i) => {
      if (n === null) return;
      this._voice(n, startTime + i * beat, beat * 0.42, {
        type: 'sawtooth', vol: i % 4 === 0 ? 0.085 : 0.06, cutoff: 2600, q: 2, detune: 7, reverb: 0.22, attack: 0.005, release: 0.16,
      });
    });
    bass.forEach((n, i) =>
      this._voice(n, startTime + i * beat, beat * 0.44, { type: 'sawtooth', vol: 0.1, cutoff: 540, q: 3, sub: true, reverb: 0.05 }));

    // Drum grid: kick on downbeats, snare on 2 and 4.
    [0, 4, 8, 12].forEach((i) => this._kick(startTime + i * beat));
    [4, 12].forEach((i) => this._snare(startTime + i * beat));

    // Layer 1 (combo warm): hats on eighth notes.
    if (intensity >= 1) {
      for (let i = 0; i < 32; i++) this._hat(startTime + i * beat * 0.5, i % 8 === 7);
    }
    // Layer 2 (combo hot): sparkling arp an octave up.
    if (intensity >= 2) {
      lead.forEach((n, i) => {
        if (n === null || i % 2 === 0) return;
        this._voice(n + 12, startTime + (i + 0.5) * beat, beat * 0.18, { type: 'triangle', vol: 0.045, cutoff: 4000, reverb: 0.3, attack: 0.003, release: 0.12 });
      });
    }
    return len;
  }

  _scheduleRhythmChill(startTime) {
    return this._scheduleRhythmCore(startTime, 100,
      [72, null, 76, null, 79, null, 76, null, 74, null, 77, null, 76, null, 72, null],
      [48, 48, 45, 45, 43, 43, 45, 45, 48, 48, 45, 45, 43, 45, 47, 47]);
  }

  _scheduleRhythm(startTime) {
    return this._scheduleRhythmCore(startTime, 128,
      [72, 72, 79, 76, 74, 76, 79, 83, 81, 79, 76, 74, 72, 74, 76, 79],
      [48, 48, 43, 43, 45, 45, 47, 47, 48, 48, 43, 43, 45, 47, 48, 48]);
  }

  _scheduleRhythmHyper(startTime) {
    return this._scheduleRhythmCore(startTime, 152,
      [76, 79, 83, 79, 84, 83, 79, 76, 78, 81, 84, 81, 86, 84, 81, 78],
      [48, 48, 48, 43, 45, 45, 45, 40, 48, 48, 48, 43, 45, 47, 48, 50]);
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

  playRhythm(trackId = 'classic') {
    const fn = trackId === 'chill' ? this._scheduleRhythmChill
      : trackId === 'hyper' ? this._scheduleRhythmHyper
      : this._scheduleRhythm;
    this._playTrack(`rhythm-${trackId}`, fn);
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
    const t = this._ctx.currentTime;
    // soft upward pluck with a whoosh of filtered noise
    this._voice(69, t, 0.16, { type: 'triangle', vol: 0.16, bus: 'sfx', cutoff: 3000, reverb: 0.12, attack: 0.004, release: 0.12, glide: -7 });
    this._noiseHit(t, { dur: 0.14, type: 'highpass', freq: 1200, q: 0.6, vol: 0.06, bus: 'sfx' });
  }

  land() {
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    this._voice(45, t, 0.12, { type: 'sine', vol: 0.2, bus: 'sfx', cutoff: 900, reverb: 0.06, attack: 0.002, release: 0.08, glide: 6 });
    this._noiseHit(t, { dur: 0.07, type: 'lowpass', freq: 2400, vol: 0.1, bus: 'sfx' });
  }

  coin() {
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    // bright two-note bell with a shimmer of reverb
    [84, 91].forEach((n, i) =>
      this._voice(n, t + i * 0.05, 0.18, { type: 'triangle', vol: 0.18, bus: 'sfx', cutoff: 6000, reverb: 0.26, attack: 0.002, release: 0.18 }));
  }

  switchLane() {
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    // quick filtered whoosh
    this._noiseHit(t, { dur: 0.1, type: 'bandpass', freq: 2400, q: 0.5, vol: 0.12, bus: 'sfx', reverb: 0.08 });
    this._voice(76, t, 0.08, { type: 'triangle', vol: 0.05, bus: 'sfx', cutoff: 3200, reverb: 0.08, attack: 0.003, release: 0.06, glide: -4 });
  }

  powerUp() {
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) =>
      this._voice(n, t + i * 0.05, 0.2, { type: 'triangle', vol: 0.13, bus: 'sfx', cutoff: 5000, reverb: 0.28, attack: 0.004, release: 0.2 }));
  }

  shieldBreak() {
    if (!this._init()) return;
    this.unlock();
    const t = this._ctx.currentTime;
    this._voice(72, t, 0.22, { type: 'sawtooth', vol: 0.16, bus: 'sfx', cutoff: 2600, q: 4, detune: 12, reverb: 0.2, attack: 0.003, release: 0.18, glide: 10 });
    this._noiseHit(t, { dur: 0.22, type: 'bandpass', freq: 3000, q: 0.5, vol: 0.16, bus: 'sfx', reverb: 0.22 });
  }

  // Low double-thump while the chaser is close
  heartbeat() {
    if (!this._init()) return;
    const t = this._ctx.currentTime;
    [0, 0.2].forEach((off, i) =>
      this._voice(33 - i * 2, t + off, 0.16, { type: 'sine', vol: i ? 0.16 : 0.24, bus: 'sfx', cutoff: 400, reverb: 0.1, attack: 0.004, release: 0.12 }));
  }

  gameOver() {
    if (!this._init()) return;
    this.unlock();
    this.stop();
    const t = this._ctx.currentTime;
    // warm descending fall
    [72, 69, 65, 60].forEach((n, i) =>
      this._voice(n, t + i * 0.16, 0.3, { type: 'sawtooth', vol: 0.14, bus: 'sfx', cutoff: 1800, q: 2, detune: 8, reverb: 0.3, attack: 0.006, release: 0.26 }));
    // soft sub thud
    this._voice(36, t + 0.66, 0.5, { type: 'sine', vol: 0.3, bus: 'sfx', cutoff: 500, reverb: 0.2, attack: 0.004, release: 0.4, glide: 8 });
  }
}

export const RHYTHM_TRACK_INFO = {
  chill:   { bpm: 100, label: 'CHILL',   color: 0x00897b },
  classic: { bpm: 128, label: 'CLASSIC', color: 0x8e24aa },
  hyper:   { bpm: 152, label: 'HYPER',   color: 0xd81b60 },
};

export const audio = new AudioManager();
// Kept on window for console debugging.
window.audio = audio;
export const unlockAudio = () => audio.unlock();
export const setAudioMuted = (muted) => audio.setMuted(muted);
