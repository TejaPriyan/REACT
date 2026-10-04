// A procedural "song" used by the landing page, DISCOVER previews and the studio when no audio is loaded.
// It behaves like an analysed track: quiet intro → build (snare roll) → DROP → groove, on an 8-bar cycle.
// Nothing here is audible unless the caller wires `onStep` to a synth.

import { createFeatures } from './features.js';
import { clamp, smoothstep } from '../engine/math.js';

const LEVEL = [0.1, 0.14, 0.26, 0.42, 0.72, 1.0, 0.86, 0.7]; // per bar
const rndSeed = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export class ProceduralRhythm {
  constructor({ bpm = 118, loopBars = 8, intensity = 1 } = {}) {
    this.bpm = bpm;
    this.loopBars = loopBars;
    this.intensity = intensity;
    this.t = 0;
    this.step = -1;
    this.kick = 0; this.snare = 0; this.hat = 0; this.chord = 0;
    this.lastKick = 9; this.lastSnare = 9; this.lastHat = 9; this.lastChord = 9;
    this.energy = 0;
    this.f = createFeatures();
    this.onStep = null; // (kind, strength, time) => void
  }
  get stepDur() { return 60 / this.bpm / 4; }

  /** Jump to the middle of the cycle (used by DISCOVER previews so tiles show the good part). */
  seek(seconds) { this.t = seconds; this.step = Math.floor(seconds / this.stepDur) - 1; }

  sample(dt, out) {
    const f = out || this.f;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const sd = this.stepDur;
    const cur = Math.floor(this.t / sd);
    f.beat = false; f.drop = false; f.beatStrength = 0;
    while (this.step < cur) {
      this.step++;
      const s16 = this.step % 16, bar = Math.floor(this.step / 16) % this.loopBars, beat = s16 >> 2, sub = s16 & 3;
      const level = LEVEL[bar % LEVEL.length];
      const drop = bar === 5;
      const vary = 0.85 + 0.15 * rndSeed(this.step);
      // kick
      let kick = 0;
      if (bar >= 5 || bar === 3 || bar === 4) kick = sub === 0 && (bar >= 5 || beat === 0 || beat === 2) ? 1 : 0;
      if (bar === 2 && s16 === 0) kick = 0.55;
      if (kick) { this.lastKick = 0; this.kickAmp = kick * vary * (0.6 + 0.4 * level); this.emit(f, 'kick', this.kickAmp); }
      // snare / clap
      let snare = 0;
      if (bar >= 5 && sub === 0 && (beat === 1 || beat === 3)) snare = 1;
      if (bar === 4) { const roll = s16 < 8 ? 4 : s16 < 12 ? 2 : 1; if (s16 % roll === 0) snare = 0.4 + 0.6 * (s16 / 16); }
      if (snare) { this.lastSnare = 0; this.snareAmp = snare * vary; this.emit(f, 'snare', snare > 0.7 ? 0.75 : 0.4); }
      // hats
      const hatStride = bar >= 5 ? 2 : bar >= 2 ? 4 : 8;
      if (level > 0.12 && s16 % hatStride === 0 && !(bar === 4 && s16 > 8)) { this.lastHat = 0; this.hatAmp = (0.35 + 0.5 * level) * (sub === 2 ? 1 : 0.7); this.emit(f, 'hat', 0); }
      // chord stab on offbeats (mid content)
      if (level > 0.3 && s16 % 8 === 6) { this.lastChord = 0; this.chordAmp = 0.5 + 0.4 * level; }
      if (s16 === 0 && bar === 5) { f.drop = true; }
    }
    this.lastKick += dt; this.lastSnare += dt; this.lastHat += dt; this.lastChord += dt;
    const barF = (this.t / (sd * 16)) % this.loopBars;
    const bar = Math.floor(barF), barPos = barF - bar;
    const levelNow = LEVEL[bar] + (LEVEL[(bar + 1) % LEVEL.length] - LEVEL[bar]) * smoothstep(0.75, 1, barPos) * (bar === 4 ? 1 : 0.5);
    const I = this.intensity;
    const kickEnv = Math.exp(-this.lastKick * 8) * (this.kickAmp || 0);
    const snEnv = Math.exp(-this.lastSnare * 11) * (this.snareAmp || 0);
    const hatEnv = Math.exp(-this.lastHat * 26) * (this.hatAmp || 0);
    const chEnv = Math.exp(-this.lastChord * 4.5) * (this.chordAmp || 0);
    f.bass = clamp((kickEnv * 1.05 + 0.18 * levelNow * (bar >= 5 ? 1 : 0.3)) * I, 0, 1.3);
    f.mid = clamp((snEnv * 0.85 + chEnv * 0.55 + 0.1 * levelNow) * I, 0, 1.2);
    f.high = clamp((hatEnv * 0.9 + 0.06 * levelNow) * I, 0, 1.2);
    f.rms = clamp(0.12 * levelNow + f.bass * 0.5 + f.mid * 0.3 + f.high * 0.15, 0, 1.2);
    this.energy += (levelNow - this.energy) * (1 - Math.exp(-dt / (levelNow > this.energy ? 0.5 : 1.2)));
    f.energy = this.energy;
    f.calm = 1 - smoothstep(0.18, 0.5, this.energy);
    f.build = bar === 4 ? smoothstep(0, 1, barPos) : bar === 3 ? smoothstep(0.4, 1, barPos) * 0.4 : 0;
    f.dropSoon = bar === 4 ? smoothstep(0.86, 1, barPos) : 0;
    f.bpm = this.bpm;
    f.phase = (this.t / (60 / this.bpm)) % 1;
    f.time = this.t; f.position = this.t; f.playing = true;
    // pseudo spectrum
    const sp = f.spectrum, n = sp.length;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const lo = f.bass * Math.exp(-x * 9), mi = f.mid * Math.exp(-Math.pow((x - 0.4) * 3, 2)), hi = f.high * Math.exp(-Math.pow((x - 0.8) * 3.2, 2));
      sp[i] = clamp(lo + mi + hi + 0.04 * levelNow + 0.03 * rndSeed(i + this.step * 0.1), 0, 1);
    }
    return f;
  }

  emit(f, kind, strength) {
    if (kind === 'kick' || kind === 'snare') { f.beat = true; f.beatStrength = Math.max(f.beatStrength, strength); }
    if (this.onStep) this.onStep(kind, strength, this.t);
  }
}
