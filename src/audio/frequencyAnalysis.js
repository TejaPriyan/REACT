// Frequency analysis: FFT, band definitions and the whole-track pre-scan.
//
// The pre-scan ("analyzeBuffer") turns an AudioBuffer into per-10ms curves for bass / mid / high /
// loudness plus a beat map, tempo estimate, build-ups and drops, a log-spectrum and waveform peaks.
// Live playback samples these curves at the audible position — which gives us look-ahead
// (anticipation), tight beat timing, scrubbing, and reverse playback.
// Everything runs locally; the live AnalyserNode path (analyser.js) is the fallback.

import { detectBeats, estimateTempo } from './beatDetection.js';
import { SPECTRUM_BINS } from './features.js';

export const BANDS = {
  bass: [30, 150],
  mid: [200, 3000],
  high: [4000, 14000],
};

export class FFT {
  constructor(n) {
    this.n = n;
    this.levels = Math.round(Math.log2(n));
    this.cos = new Float32Array(n / 2);
    this.sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) { this.cos[i] = Math.cos((2 * Math.PI * i) / n); this.sin[i] = Math.sin((2 * Math.PI * i) / n); }
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < this.levels; b++) r |= ((i >> b) & 1) << (this.levels - 1 - b);
      this.rev[i] = r;
    }
    this.window = new Float32Array(n);
    for (let i = 0; i < n; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    this.re = new Float32Array(n);
    this.im = new Float32Array(n);
  }
  /** Magnitude spectrum (n/2 bins) of `input` (length n; Hann window applied here). */
  magnitudes(input, out) {
    const { n, re, im, rev, window } = this;
    for (let i = 0; i < n; i++) { re[rev[i]] = input[i] * window[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tr = re[l] * this.cos[k] + im[l] * this.sin[k];
          const ti = -re[l] * this.sin[k] + im[l] * this.cos[k];
          re[l] = re[j] - tr; im[l] = im[j] - ti;
          re[j] += tr; im[j] += ti;
        }
      }
    }
    const inv = 2 / n;
    for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]) * inv;
    return out;
  }
}

/** Log-spaced spectrum bin edges (in FFT bins) for SPECTRUM_BINS bands from 40 Hz to 16 kHz. */
export function spectrumEdges(sampleRate, fftSize, bins = SPECTRUM_BINS) {
  const nyq = sampleRate / 2, perHz = fftSize / 2 / nyq;
  const fMin = 40, fMax = Math.min(16000, nyq * 0.98);
  const edges = [];
  for (let i = 0; i <= bins; i++) edges.push(Math.max(1, Math.round(fMin * Math.pow(fMax / fMin, i / bins) * perHz)));
  for (let i = 1; i < edges.length; i++) if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
  return edges;
}

const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

function percentile(arr, p) {
  const c = Float32Array.from(arr);
  c.sort();
  return c[Math.min(c.length - 1, Math.floor(c.length * p))] || 1e-6;
}

/** Windowed mean via prefix sums. */
function smoothCurve(src, radius) {
  const n = src.length, out = new Float32Array(n), pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + src[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius), b = Math.min(n, i + radius + 1);
    out[i] = (pre[b] - pre[a]) / (b - a);
  }
  return out;
}

export async function analyzeBuffer(buffer, { onProgress, shouldCancel } = {}) {
  const t0 = performance.now();
  const sr0 = buffer.sampleRate;
  const N0 = buffer.length;
  const dec = sr0 >= 40000 ? 2 : 1;
  const sr = sr0 / dec;
  const fftSize = 1024;
  const hopSec = buffer.duration > 330 ? 0.02 : 0.01;
  const hop = Math.round(sr * hopSec);
  const rate = 1 / hopSec;
  const N = Math.floor(N0 / dec);

  // mono, decimated by averaging (a cheap low-pass)
  const mono = new Float32Array(N);
  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let c = 0; c < chans.length; c++) for (let d = 0; d < dec; d++) s += chans[c][i * dec + d];
    mono[i] = s / (chans.length * dec);
  }

  // waveform overview (min/max peaks)
  const cols = 1600;
  const peaks = new Float32Array(cols * 2);
  for (let x = 0; x < cols; x++) {
    const a = Math.floor((x / cols) * N), b = Math.max(a + 1, Math.floor(((x + 1) / cols) * N));
    let mn = 1, mx = -1;
    const stride = Math.max(1, Math.floor((b - a) / 64));
    for (let i = a; i < b; i += stride) { const v = mono[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    peaks[x * 2] = mn; peaks[x * 2 + 1] = mx;
  }

  const frames = Math.max(1, Math.floor(N / hop));
  const fft = new FFT(fftSize);
  const mags = new Float32Array(fftSize / 2);
  const prevLog = new Float32Array(fftSize / 2);
  const buf = new Float32Array(fftSize);
  const binHz = sr / fftSize;
  const rng = (lo, hi) => [Math.max(1, Math.floor(lo / binHz)), Math.min(fftSize / 2 - 1, Math.ceil(hi / binHz))];
  const [b0, b1] = rng(...BANDS.bass), [m0, m1] = rng(...BANDS.mid), [h0, h1] = rng(BANDS.high[0], Math.min(BANDS.high[1], (sr / 2) * 0.98));
  const fluxMaxBin = Math.min(fftSize / 2 - 1, Math.floor(9000 / binHz));
  const edges = spectrumEdges(sr, fftSize);

  const bass = new Float32Array(frames), mid = new Float32Array(frames), high = new Float32Array(frames);
  const rms = new Float32Array(frames), flux = new Float32Array(frames);
  const spec = new Float32Array(frames * SPECTRUM_BINS);

  let lastYield = performance.now();
  for (let k = 0; k < frames; k++) {
    const start = k * hop - (fftSize >> 1);
    let e = 0;
    for (let i = 0; i < fftSize; i++) {
      const idx = start + i;
      const v = idx >= 0 && idx < N ? mono[idx] : 0;
      buf[i] = v; e += v * v;
    }
    rms[k] = Math.sqrt(e / fftSize);
    fft.magnitudes(buf, mags);
    let sb = 0, sm = 0, sh = 0;
    for (let i = b0; i <= b1; i++) sb += mags[i] * mags[i];
    for (let i = m0; i <= m1; i++) sm += mags[i] * mags[i];
    for (let i = h0; i <= h1; i++) sh += mags[i] * mags[i];
    bass[k] = Math.pow(Math.sqrt(sb / (b1 - b0 + 1)), 0.6);
    mid[k] = Math.pow(Math.sqrt(sm / (m1 - m0 + 1)), 0.6);
    high[k] = Math.pow(Math.sqrt(sh / (h1 - h0 + 1)), 0.6);
    let fl = 0;
    for (let i = 1; i <= fluxMaxBin; i++) {
      const l = Math.log1p(60 * mags[i]);
      const d = l - prevLog[i];
      if (d > 0) fl += d;
      prevLog[i] = l;
    }
    flux[k] = fl;
    for (let j = 0; j < SPECTRUM_BINS; j++) {
      let s = 0;
      for (let i = edges[j]; i < edges[j + 1]; i++) s += mags[i] * mags[i];
      spec[k * SPECTRUM_BINS + j] = Math.pow(Math.sqrt(s / (edges[j + 1] - edges[j])), 0.5);
    }
    if ((k & 255) === 255 && performance.now() - lastYield > 12) {
      onProgress && onProgress((k / frames) * 0.85);
      await yieldToUI();
      lastYield = performance.now();
      if (shouldCancel && shouldCancel()) return null;
    }
  }

  // normalise to the track (96th percentile → 1)
  const nb = percentile(bass, 0.96), nm = percentile(mid, 0.96), nh = percentile(high, 0.96), nr = percentile(rms, 0.96);
  for (let k = 0; k < frames; k++) { bass[k] /= nb; mid[k] /= nm; high[k] /= nh; rms[k] /= nr; }
  const ns = percentile(spec, 0.97);
  const specU8 = new Uint8Array(frames * SPECTRUM_BINS);
  for (let i = 0; i < spec.length; i++) specU8[i] = Math.min(255, Math.round((spec[i] / ns) * 220));

  // energy (slow loudness), build-ups, drops, calm
  const energy = smoothCurve(rms, Math.round(0.45 * rate));
  const fastE = smoothCurve(rms, Math.round(0.12 * rate));
  const slowE = smoothCurve(rms, Math.round(2.2 * rate));
  const eMax = percentile(energy, 0.97) || 1;
  for (let k = 0; k < frames; k++) energy[k] = Math.min(1.2, energy[k] / eMax);
  const build = new Float32Array(frames), calm = new Float32Array(frames);
  const at = (arr, sec) => arr[Math.max(0, Math.min(frames - 1, Math.round(sec * rate)))];
  for (let k = 0; k < frames; k++) {
    const t = k / rate;
    const rise = at(slowE, t) - at(slowE, t - 3.2);
    build[k] = Math.max(0, Math.min(1, rise / (0.28 * eMax)));
    const c = 1 - Math.max(0, Math.min(1, (energy[k] - 0.18) / 0.32));
    calm[k] = c * c * (3 - 2 * c);
  }
  // drops: sudden loudness jump after a quieter passage
  const drops = [];
  const dScore = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    const t = k / rate;
    const after = (at(slowE, t + 1.2) + at(fastE, t + 0.5)) * 0.5, before = at(slowE, t - 0.6);
    dScore[k] = (after - before) / eMax;
  }
  const dThr = Math.max(0.16, percentile(dScore, 0.985) * 0.6);
  for (let k = 2; k < frames - 2; k++) {
    if (dScore[k] > dThr && dScore[k] >= dScore[k - 1] && dScore[k] >= dScore[k + 1]) {
      const t = k / rate;
      if (!drops.length || t - drops[drops.length - 1] > 7) drops.push(t);
      else if (dScore[k] > dScore[Math.round(drops[drops.length - 1] * rate)]) drops[drops.length - 1] = t;
    }
  }
  onProgress && onProgress(0.92);
  await yieldToUI();

  const beats = detectBeats(flux, rate);
  // refine each drop to the sharpest loudness onset near it, then snap to the nearest beat
  for (let di = 0; di < drops.length; di++) {
    const k0 = Math.round(drops[di] * rate), span = Math.round(1.1 * rate), w = Math.max(2, Math.round(0.06 * rate));
    let bestK = k0, bestD = -1;
    for (let k = Math.max(w, k0 - span); k < Math.min(frames - w - 1, k0 + span); k++) {
      const d = fastE[k + w] - fastE[k - w];
      if (d > bestD) { bestD = d; bestK = k; }
    }
    let t = bestK / rate, nb = null;
    for (const b of beats) if (Math.abs(b.t - t) < 0.18 && (!nb || Math.abs(b.t - t) < Math.abs(nb.t - t))) nb = b;
    drops[di] = nb ? nb.t : t;
  }
  const tempo = estimateTempo(flux, rate);
  onProgress && onProgress(1);

  return {
    version: 1,
    rate, frames, duration: buffer.duration, sampleRate: sr0,
    bass, mid, high, rms, energy, build, calm, spec: specU8, specBins: SPECTRUM_BINS,
    beats, // [{ t, s }]  s = 0.25..1.4
    bpm: tempo.bpm, beatOffset: tempo.offset, beatConfidence: tempo.confidence,
    drops, peaks, analyzeMs: performance.now() - t0,
  };
}
