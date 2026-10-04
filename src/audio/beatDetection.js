// Beat / transient detection and tempo estimation — no dependencies, no network.

/** Offline: pick strong onsets from a spectral-flux envelope (adaptive threshold, local max, min spacing). */
export function detectBeats(flux, rate) {
  const n = flux.length;
  const win = Math.round(0.6 * rate);
  const pre = new Float64Array(n + 1), pre2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { pre[i + 1] = pre[i] + flux[i]; pre2[i + 1] = pre2[i] + flux[i] * flux[i]; }
  const sorted = Float32Array.from(flux).sort();
  const ref = sorted[Math.floor(n * 0.96)] || 1;
  const beats = [];
  const minGap = Math.round(0.085 * rate);
  const lm = Math.max(2, Math.round(0.04 * rate));
  let last = -1e9;
  for (let i = lm; i < n - lm; i++) {
    const a = Math.max(0, i - win), b = Math.min(n, i + win);
    const cnt = b - a;
    const mean = (pre[b] - pre[a]) / cnt;
    const std = Math.sqrt(Math.max(0, (pre2[b] - pre2[a]) / cnt - mean * mean));
    const thr = mean + 1.15 * std + 0.06 * ref;
    const v = flux[i];
    if (v <= thr) continue;
    let isMax = true;
    for (let j = i - lm; j <= i + lm; j++) if (flux[j] > v) { isMax = false; break; }
    if (!isMax) continue;
    if (i - last < minGap) {
      if (beats.length && v > beats[beats.length - 1].raw) { beats[beats.length - 1] = { t: i / rate, s: 0, raw: v, thr }; last = i; }
      continue;
    }
    beats.push({ t: i / rate, s: 0, raw: v, thr });
    last = i;
  }
  for (const b of beats) b.s = Math.max(0.25, Math.min(1.4, 0.35 + 0.95 * ((b.raw - b.thr) / (ref * 0.9) + 0.35)));
  return beats.map(({ t, s }) => ({ t, s }));
}

/** Tempo via autocorrelation of the onset envelope + a gentle prior around 90–150 BPM. */
export function estimateTempo(flux, rate) {
  const n = flux.length;
  if (n < rate * 4) return { bpm: 0, offset: 0, confidence: 0 };
  let mean = 0;
  for (let i = 0; i < n; i++) mean += flux[i];
  mean /= n;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.max(0, flux[i] - mean);
  const minBpm = 62, maxBpm = 190;
  const minLag = Math.floor((60 / maxBpm) * rate), maxLag = Math.ceil((60 / minBpm) * rate);
  const ac = new Float64Array(maxLag * 2 + 4);
  const limit = Math.min(n, Math.floor(rate * 90)); // 90 s is plenty
  for (let lag = minLag - 1; lag <= Math.min(maxLag * 2 + 2, limit - 1); lag++) {
    let s = 0;
    for (let i = 0; i + lag < limit; i++) s += x[i] * x[i + lag];
    ac[lag] = s / (limit - lag);
  }
  let best = minLag, bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * rate) / lag;
    const prior = Math.exp(-Math.pow(Math.log2(bpm / 122), 2) / (2 * 0.55 * 0.55));
    // reward the double lag too (bars & subdivisions reinforce the true tempo)
    const score = (ac[lag] + 0.5 * ac[lag * 2]) * (0.4 + 0.6 * prior);
    if (score > bestScore) { bestScore = score; best = lag; }
  }
  // parabolic refinement
  const y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1];
  const den = y0 - 2 * y1 + y2;
  const frac = den !== 0 ? (0.5 * (y0 - y2)) / den : 0;
  const lag = best + Math.max(-0.5, Math.min(0.5, frac));
  let bpm = (60 * rate) / lag;
  while (bpm < 78) bpm *= 2;
  while (bpm > 176) bpm /= 2;
  const period = 60 / bpm;
  // phase: offset that lines the grid up with the strongest onsets
  const steps = 40;
  let bestOff = 0, bestSum = -1;
  for (let s = 0; s < steps; s++) {
    const off = (s / steps) * period;
    let sum = 0;
    for (let t = off; t < Math.min(n / rate, 60); t += period) sum += x[Math.min(n - 1, Math.round(t * rate))];
    if (sum > bestSum) { bestSum = sum; bestOff = off; }
  }
  const zero = ac[0] || ac[minLag] || 1;
  const conf = Math.max(0, Math.min(1, (ac[best] / zero) * 3));
  return { bpm: Math.round(bpm * 10) / 10, offset: bestOff, confidence: conf };
}

/** Realtime transient detector on a stream of per-frame flux values (live analyser path). */
export class BeatDetector {
  constructor({ minGap = 0.11, sensitivity = 1.25 } = {}) {
    this.hist = new Float32Array(64);
    this.i = 0; this.filled = 0;
    this.minGap = minGap;
    this.k = sensitivity;
    this.since = 9;
    this.prev = 0; this.prev2 = 0;
    this.peak = 0.05;
  }
  /** returns 0 for "no beat" or strength (0.3..1.4) — call once per frame. */
  push(flux, dt) {
    this.since += dt;
    const h = this.hist, n = this.filled;
    let mean = 0, sq = 0;
    for (let j = 0; j < n; j++) { mean += h[j]; sq += h[j] * h[j]; }
    if (n) { mean /= n; sq = Math.sqrt(Math.max(0, sq / n - mean * mean)); }
    const thr = mean + this.k * sq + 0.02;
    // a beat is a local maximum, detected one frame late (prev is the peak)
    let out = 0;
    if (this.prev > thr && this.prev >= this.prev2 && this.prev >= flux && this.since > this.minGap) {
      this.peak = Math.max(this.peak * 0.995, this.prev);
      out = Math.max(0.3, Math.min(1.4, 0.4 + (this.prev - thr) / (this.peak * 0.8)));
      this.since = 0;
    } else this.peak *= 0.9995;
    h[this.i] = flux; this.i = (this.i + 1) % h.length; this.filled = Math.min(h.length, this.filled + 1);
    this.prev2 = this.prev; this.prev = flux;
    return out;
  }
}
