// Real-time analysis straight from a Web Audio AnalyserNode.
// Used before the pre-scan finishes (or if it fails) — same feature shape, adaptive gain.

import { BANDS, spectrumEdges } from './frequencyAnalysis.js';
import { BeatDetector } from './beatDetection.js';
import { SPECTRUM_BINS } from './features.js';
import { Running } from '../engine/physics.js';
import { clamp, smoothstep } from '../engine/math.js';

export class LiveAnalyser {
  constructor(ctx, node) {
    this.ctx = ctx;
    this.node = node;
    node.fftSize = 2048;
    node.smoothingTimeConstant = 0.35;
    node.minDecibels = -90;
    node.maxDecibels = -12;
    this.freq = new Uint8Array(node.frequencyBinCount);
    this.time = new Uint8Array(node.fftSize);
    this.prev = new Float32Array(node.frequencyBinCount);
    this.det = new BeatDetector();
    this.agc = {
      bass: new Running(0.9992, 0.12), mid: new Running(0.9992, 0.12),
      high: new Running(0.9992, 0.12), rms: new Running(0.9992, 0.04),
    };
    this.energy = 0;
    this.build = 0;
    this.lastE = 0;
    this.edges = spectrumEdges(ctx.sampleRate, node.fftSize);
    const hz = ctx.sampleRate / node.fftSize;
    const r = (lo, hi) => [Math.max(1, Math.floor(lo / hz)), Math.min(node.frequencyBinCount - 1, Math.ceil(hi / hz))];
    this.rb = r(...BANDS.bass);
    this.rm = r(...BANDS.mid);
    this.rh = r(...BANDS.high);
  }

  read(dt, f) {
    const { freq, time, rb, rm, rh } = this;
    this.node.getByteFrequencyData(freq);
    this.node.getByteTimeDomainData(time);
    const mean = (a, b) => { let s = 0; for (let i = a; i <= b; i++) s += freq[i]; return s / (b - a + 1) / 255; };
    let e = 0;
    for (let i = 0; i < time.length; i++) { const v = (time[i] - 128) / 128; e += v * v; }
    const rms = Math.sqrt(e / time.length);
    f.bass = this.agc.bass.push(Math.pow(mean(rb[0], rb[1]), 1.6));
    f.mid = this.agc.mid.push(Math.pow(mean(rm[0], rm[1]), 1.6));
    f.high = this.agc.high.push(Math.pow(mean(rh[0], rh[1]), 1.6));
    f.rms = this.agc.rms.push(rms);
    this.energy += (f.rms - this.energy) * (1 - Math.exp(-dt / (f.rms > this.energy ? 0.4 : 1.1)));
    f.energy = clamp(this.energy, 0, 1.2);
    f.calm = 1 - smoothstep(0.15, 0.45, this.energy);
    // spectral flux → beat
    let fl = 0;
    const top = Math.min(freq.length - 1, 380);
    for (let i = 1; i <= top; i++) {
      const v = freq[i] / 255;
      const d = v - this.prev[i];
      if (d > 0) fl += d;
      this.prev[i] = v;
    }
    const s = this.det.push(fl, dt);
    f.beat = s > 0;
    f.beatStrength = s;
    // crude build detector
    this.build = clamp(this.build + (this.energy - this.lastE > 0 ? 1 : -1) * dt * 0.15, 0, 1);
    this.lastE = this.energy;
    f.build = this.build; f.drop = false; f.dropSoon = 0;
    for (let j = 0; j < SPECTRUM_BINS; j++) {
      let sum = 0;
      const a = this.edges[j], b = this.edges[j + 1];
      for (let i = a; i < b; i++) sum += freq[i];
      f.spectrum[j] = sum / (b - a) / 255;
    }
    return f;
  }
}
