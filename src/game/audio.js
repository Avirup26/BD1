// Procedural Web Audio engine — no audio assets, everything is synthesized.
import { rand, pick } from './utils.js';
import { PRAYER_TIMES } from './constants.js';

export const AudioEngine = {
  ctx: null,
  started: false,
  master: null, sfx: null, music: null, amb: null,
  noiseBuf: null,
  rainGain: null,
  engine: null, engineGain: null, engineBase: 0,
  sirenOsc: null, sirenGain: null, sirenPhase: 0, sirenOn: false,
  hornTimer: 2,
  lastAzanIdx: -1,
  radioOn: false, stationIdx: 0, nextNote: 0, step: 0,
  stations: [
    { name: 'বুড়িগঙ্গা FM — Folk', style: 'folk' },
    { name: 'Dhaka Beats — Hip-Hop', style: 'hiphop' },
    { name: 'লালবাগ Lo-Fi', style: 'lofi' }
  ],

  init() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return; // audio unavailable — game runs silent
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(c.destination);
    for (const k of ['sfx', 'music', 'amb']) {
      this[k] = c.createGain();
      this[k].connect(this.master);
    }
    this.sfx.gain.value = 0.9;
    this.music.gain.value = 0.5;
    this.amb.gain.value = 0.8;

    // 2-second white-noise buffer reused everywhere
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.cityAmbience();
    this.makeRain();
    this.makeSiren();
    this.started = true;
  },

  setVolume(v) { if (this.master) this.master.gain.value = v; },

  noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  },

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, dest = null, endFreq = null) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  },

  // ---- ambient city bed: low traffic rumble + filtered crowd murmur ----
  cityAmbience() {
    const c = this.ctx;
    const rumble = c.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 58;
    const rg = c.createGain(); rg.gain.value = 0.018;
    const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 120;
    rumble.connect(rf).connect(rg).connect(this.amb);
    rumble.start();

    const crowd = this.noiseSource(true);
    const cf = c.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 750;
    const cg = c.createGain(); cg.gain.value = 0.014;
    crowd.connect(cf).connect(cg).connect(this.amb);
    crowd.start();
    this.crowdGain = cg;
  },

  playHorn() {
    if (!this.started) return;
    const f = rand(380, 820);
    const n = Math.random() < 0.3 ? 2 : 1; // double-tap horns
    for (let i = 0; i < n; i++) this.tone(f, rand(0.12, 0.3), 'square', 0.05, i * 0.25, this.amb);
  },

  playBell() { this.tone(1450, 0.4, 'triangle', 0.12); this.tone(1820, 0.3, 'triangle', 0.07, 0.05); },

  playPunch() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.noiseSource();
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t); s.stop(t + 0.1);
  },

  playGunshot() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.noiseSource();
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t); s.stop(t + 0.2);
    this.tone(110, 0.12, 'sine', 0.4, 0, this.sfx, 45); // body thump
  },

  playExplosion() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.noiseSource();
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.9);
    const g = c.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t); s.stop(t + 1.2);
    this.tone(52, 0.8, 'sine', 0.6, 0, this.sfx, 28);
  },

  playPickup() { this.tone(880, 0.07, 'square', 0.08); this.tone(1320, 0.1, 'square', 0.08, 0.07); },
  playSplash() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.noiseSource();
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t); s.stop(t + 0.45);
  },

  // ---- azan: melodic call rendered with a slow vibrato sine ----
  playAzan(nameBn) {
    if (!this.started) return;
    const seq = [392, 440, 494, 523, 494, 440, 392]; // G A B C B A G
    const durs = [1.1, 0.8, 0.9, 1.5, 0.9, 0.8, 1.8];
    let t = 0.1;
    const c = this.ctx;
    seq.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 5.4; lg.gain.value = 4.5;
      lfo.connect(lg).connect(o.frequency);
      const t0 = c.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + durs[i]);
      o.connect(g).connect(this.amb);
      o.start(t0); o.stop(t0 + durs[i] + 0.1);
      lfo.start(t0); lfo.stop(t0 + durs[i] + 0.1);
      t += durs[i] * 0.92;
    });
  },

  checkAzan(gameMin, toast) {
    for (let i = 0; i < PRAYER_TIMES.length; i++) {
      const p = PRAYER_TIMES[i];
      if (Math.abs(gameMin - p.min) < 0.5 && this.lastAzanIdx !== i) {
        this.lastAzanIdx = i;
        this.playAzan(p.bn);
        toast(`🕌 ${p.bn}ের আজান হচ্ছে...`);
        return;
      }
    }
  },

  // ---- vehicle engine ----
  engineStart(baseFreq) {
    if (!this.started || baseFreq === 0) { this.engineBase = baseFreq; return; }
    this.engineStop();
    const c = this.ctx;
    this.engine = c.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = baseFreq * 0.5;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0.0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    this.engine.connect(f).connect(this.engineGain).connect(this.sfx);
    this.engine.start();
    this.engineBase = baseFreq;
  },
  engineUpdate(speedNorm) {
    if (!this.engine) return;
    this.engine.frequency.value = this.engineBase * (0.5 + speedNorm * 1.4);
    this.engineGain.gain.value = 0.02 + speedNorm * 0.045;
  },
  engineStop() {
    if (this.engine) { try { this.engine.stop(); } catch { /* already stopped */ } this.engine = null; }
  },

  // ---- police siren (two-tone wail, gain driven by proximity) ----
  makeSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = c.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.amb);
    this.sirenOsc.start();
  },
  sirenUpdate(dt, active, proximity) {
    if (!this.sirenOsc) return;
    this.sirenPhase += dt * 4.5;
    this.sirenOsc.frequency.value = Math.sin(this.sirenPhase) > 0 ? 660 : 880;
    const target = active ? 0.035 * proximity : 0;
    this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 6);
  },

  // ---- rain bed ----
  makeRain() {
    const c = this.ctx;
    const s = this.noiseSource(true);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    s.connect(f).connect(this.rainGain).connect(this.amb);
    s.start();
  },
  setRain(intensity) {
    if (this.rainGain) this.rainGain.gain.value = intensity * 0.07;
  },

  // ---- generative radio ----
  radioToggle(on) {
    this.radioOn = on;
    if (on && this.started) { this.nextNote = this.ctx.currentTime + 0.1; this.step = 0; }
  },
  nextStation() {
    this.stationIdx = (this.stationIdx + 1) % this.stations.length;
    this.step = 0;
    return this.stations[this.stationIdx].name;
  },
  radioTick() {
    if (!this.started || !this.radioOn) return;
    const c = this.ctx;
    const style = this.stations[this.stationIdx].style;
    while (this.nextNote < c.currentTime + 0.25) {
      const t = this.nextNote - c.currentTime;
      const s = this.step;
      if (style === 'hiphop') {
        if (s % 4 === 0) this.tone(95, 0.18, 'sine', 0.22, t, this.music, 40); // kick
        if (s % 4 === 2) { // snare-ish noise
          const src = this.noiseSource();
          const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
          const g = c.createGain();
          const t0 = c.currentTime + Math.max(0, t);
          g.gain.setValueAtTime(0.08, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
          src.connect(f).connect(g).connect(this.music);
          src.start(t0); src.stop(t0 + 0.1);
        }
        const bassline = [98, 0, 98, 0, 123.47, 0, 87.31, 0];
        const b = bassline[s % 8];
        if (b) this.tone(b, 0.2, 'square', 0.06, t, this.music);
        this.nextNote += 0.22;
      } else if (style === 'folk') {
        const penta = [392, 440, 494, 587, 659, 587, 494, 440];
        if (Math.random() < 0.85) {
          this.tone(penta[(s + (Math.random() < 0.2 ? 1 : 0)) % 8], 0.32, 'triangle', 0.08, t, this.music);
        }
        if (s % 8 === 0) this.tone(98, 1.2, 'sine', 0.04, t, this.music); // tanpura-ish drone
        if (s % 2 === 0) this.tone(180, 0.05, 'sine', 0.06, t, this.music, 70); // tabla-ish tap
        this.nextNote += 0.34;
      } else { // lofi
        if (s % 6 === 0) {
          const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 311.13]];
          const ch = chords[(s / 6) % 4 | 0];
          ch.forEach((f) => this.tone(f, 1.7, 'sine', 0.045, t, this.music));
          this.tone(ch[0] / 2, 1.7, 'triangle', 0.05, t, this.music);
        }
        if (s % 2 === 1 && Math.random() < 0.4) this.tone(rand(700, 1100), 0.06, 'sine', 0.015, t, this.music);
        this.nextNote += 0.36;
      }
      this.step++;
    }
  },

  // called every frame from the game loop
  tick(dt, opts) {
    if (!this.started) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // random horn bursts, denser in busy districts
    this.hornTimer -= dt * (opts.trafficDensity || 1);
    if (this.hornTimer <= 0) {
      this.playHorn();
      this.hornTimer = rand(3, 11);
    }
    if (this.crowdGain) this.crowdGain.gain.value = 0.008 + 0.012 * (opts.crowdDensity || 0.5);
    this.sirenUpdate(dt, opts.sirenActive, opts.sirenProximity || 0);
    this.radioTick();
    this.checkAzan(opts.gameMin, opts.toast);
  }
};
