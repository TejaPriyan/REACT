// The audio engine: transport (play / pause / scrub / loop / reverse / speed), Web Audio graph,
// and the per-frame feature sampler that feeds the visuals.
//
//   source ─▶ analyser ─▶ gain(volume/mute) ─▶ speakers
//                    └──▶ recGain(1.0) ─────▶ MediaStreamDestination   (what RECORD captures)
//
// Features come from the pre-scan (look-ahead, scrubbing, exact beat times) when it is ready,
// otherwise from the live AnalyserNode.  Nothing plays until the user presses play.

import { createFeatures, SPECTRUM_BINS } from './features.js';
import { analyzeBuffer } from './frequencyAnalysis.js';
import { LiveAnalyser } from './analyser.js';
import { clamp, damp, smoothstep, lerp } from '../engine/math.js';
import { createStore } from '../store.js';
import { decode } from '../utils/audio.js';

export const audioStore = createStore({
  loaded: false, name: '', duration: 0,
  playing: false, volume: 0.85, muted: false, rate: 1, loop: false, reverse: false,
  analyzing: false, progress: 0, ready: false, bpm: 0, beats: [], drops: [], peaks: null,
  error: '', sampleRate: 0, channels: 0, micActive: false,
});

function bisect(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; }
  return lo;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.reversed = null;
    this.name = '';
    this.analysis = null;
    this.pos = 0;           // position while paused
    this.playing = false;
    this.dir = 1;
    this.rate = 1;
    this.loop = false;
    this.volume = 0.85;
    this.muted = false;
    this.startPos = 0;
    this.startCtx = 0;
    this.src = null;
    this._token = 0;
    this._srcToken = 0;
    this.features = createFeatures();
    this.liveAmt = 0;
    this.scrubUntil = 0;
    this.prevPa = 0;
    this.onEnded = null;
    this.micStream = null;
    this.micSource = null;
    this.micActive = false;
  }

  get duration() { return this.buffer ? this.buffer.duration : 0; }
  get loaded() { return !!this.buffer; }

  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        const resume = () => { this.ctx && this.ctx.resume().catch(() => {}); };
        window.addEventListener('click', resume, { once: true, passive: true });
        window.addEventListener('keydown', resume, { once: true, passive: true });
        window.addEventListener('pointerdown', resume, { once: true, passive: true });
      }
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    if (ctx.state === 'suspended') {
      const resume = () => { ctx && ctx.resume().catch(() => {}); };
      window.addEventListener('click', resume, { once: true, passive: true });
      window.addEventListener('keydown', resume, { once: true, passive: true });
      window.addEventListener('pointerdown', resume, { once: true, passive: true });
    }
    this.analyserNode = ctx.createAnalyser();
    this.gain = ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : this.volume;
    this.recGain = ctx.createGain();
    this.recGain.gain.value = 1;
    this.recDest = ctx.createMediaStreamDestination();
    this.analyserNode.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.analyserNode.connect(this.recGain);
    this.recGain.connect(this.recDest);
    this.live = new LiveAnalyser(ctx, this.analyserNode);
    return ctx;
  }

  get latency() {
    const c = this.ctx;
    if (!c) return 0;
    return clamp((c.outputLatency || 0) + (c.baseLatency || 0), 0, 0.25);
  }

  // ───────────── loading ─────────────
  async loadFile(file) {
    const ab = await file.arrayBuffer();
    return this.loadArrayBuffer(ab, file.name);
  }
  async loadArrayBuffer(ab, name) {
    this.ensureContext();
    let buf;
    try { buf = await decode(this.ctx, ab); }
    catch { audioStore.set({ error: "This browser couldn't decode that audio file. Try MP3, WAV or OGG." }); throw new Error('decode'); }
    return this.loadBuffer(buf, name);
  }
  async loadBuffer(buf, name) {
    this.ensureContext();
    this.stopSource();
    this.playing = false;
    const token = ++this._token;
    this.buffer = buf;
    this.reversed = null;
    this.analysis = null;
    this.pos = 0;
    this.prevPa = 0;
    this.name = name;
    audioStore.set({
      loaded: true, name, duration: buf.duration, playing: false, analyzing: true, progress: 0, ready: false,
      bpm: 0, beats: [], drops: [], peaks: null, error: '', sampleRate: buf.sampleRate, channels: buf.numberOfChannels,
    });
    let lastP = 0;
    try {
      const a = await analyzeBuffer(buf, {
        onProgress: (p) => { if (p - lastP > 0.02 || p === 1) { lastP = p; audioStore.set({ progress: p }); } },
        shouldCancel: () => token !== this._token,
      });
      if (a && token === this._token) {
        this.analysis = a;
        audioStore.set({ analyzing: false, ready: true, progress: 1, bpm: a.bpm, beats: a.beats, drops: a.drops, peaks: a.peaks });
      }
    } catch (e) {
      console.error('[audio] analysis failed', e);
      if (token === this._token) audioStore.set({ analyzing: false, ready: false, error: 'Analysis failed — using live analysis instead.' });
    }
    return buf;
  }

  clear() {
    this.stopMic();
    this._token++;
    this.stopSource();
    this.playing = false;
    this.buffer = null; this.reversed = null; this.analysis = null; this.pos = 0; this.name = '';
    audioStore.set({ loaded: false, micActive: false, name: '', duration: 0, playing: false, analyzing: false, ready: false, beats: [], drops: [], peaks: null, bpm: 0, error: '' });
  }

  async startMic() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch {}
    }
    if (this.micActive) return true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        audioStore.set({ error: 'Microphone not supported in this browser' });
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stopSource();
      this.buffer = null;
      this.reversed = null;
      this.analysis = null;
      this.pos = 0;
      this.playing = true;
      this.name = 'LIVE MICROPHONE / LINE-IN';
      this.micStream = stream;
      this.micSource = this.ctx.createMediaStreamSource(stream);
      // Route exclusively to analyserNode for reactivity; DO NOT route to speakers to avoid audio feedback
      this.micSource.connect(this.analyserNode);
      this.micActive = true;
      audioStore.set({
        loaded: true,
        micActive: true,
        name: 'LIVE MICROPHONE / LINE-IN',
        duration: 9999,
        playing: true,
        analyzing: false,
        ready: true,
        bpm: 120,
        beats: [],
        drops: [],
        peaks: null,
        error: '',
      });
      return true;
    } catch (err) {
      console.error('[audio] microphone access error:', err);
      audioStore.set({ error: 'Microphone access denied or unavailable.' });
      return false;
    }
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch {}
      this.micSource = null;
    }
    this.micActive = false;
    audioStore.set({ micActive: false });
    if (this.name === 'LIVE MICROPHONE / LINE-IN') {
      this.clear();
    }
  }

  toggleMic() {
    return this.micActive ? this.stopMic() : this.startMic();
  }

  // ───────────── transport ─────────────
  get position() {
    if (!this.buffer) return 0;
    if (!this.playing) return this.pos;
    const d = this.buffer.duration;
    let p = this.startPos + (this.ctx.currentTime - this.startCtx) * this.rate * this.dir;
    if (this.loop) p = ((p % d) + d) % d;
    else p = clamp(p, 0, d);
    return p;
  }

  _getReversed() {
    if (this.reversed) return this.reversed;
    const b = this.buffer;
    const r = this.ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) {
      const src = b.getChannelData(c), dst = r.getChannelData(c);
      for (let i = 0, n = b.length; i < n; i++) dst[i] = src[n - 1 - i];
    }
    this.reversed = r;
    return r;
  }

  stopSource() {
    if (this.src) {
      this._srcToken++;
      try { this.src.onended = null; this.src.stop(); } catch { /* already stopped */ }
      try { this.src.disconnect(); } catch { /* ignore */ }
      this.src = null;
    }
  }

  async play() {
    if (!this.buffer) return;
    this.ensureContext();
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch { /* ignore */ } }
    const d = this.buffer.duration;
    let p = this.pos;
    if (!this.loop) {
      if (this.dir > 0 && p >= d - 0.02) p = 0;
      if (this.dir < 0 && p <= 0.02) p = d;
    }
    this._startAt(p);
  }

  _startAt(p) {
    this.stopSource();
    const d = this.buffer.duration;
    p = clamp(p, 0, d);
    const src = this.ctx.createBufferSource();
    src.buffer = this.dir > 0 ? this.buffer : this._getReversed();
    src.playbackRate.value = this.rate;
    src.loop = this.loop;
    src.connect(this.analyserNode);
    const offset = this.dir > 0 ? p : d - p;
    const token = ++this._srcToken;
    src.onended = () => {
      if (token !== this._srcToken || this.loop) return;
      this.pos = this.dir > 0 ? d : 0;
      this.playing = false;
      this.src = null;
      audioStore.set({ playing: false });
      this.onEnded && this.onEnded();
    };
    src.start(0, Math.min(offset, d - 0.0005));
    this.src = src;
    this.startPos = p;
    this.startCtx = this.ctx.currentTime;
    this.playing = true;
    this.prevPa = p;
    audioStore.set({ playing: true });
  }

  pause() {
    if (!this.playing) return;
    this.pos = this.position;
    this.stopSource();
    this.playing = false;
    audioStore.set({ playing: false });
  }

  toggle() { return this.playing ? this.pause() : this.play(); }

  seek(t) {
    if (!this.buffer) return;
    t = clamp(t, 0, this.buffer.duration);
    this.scrubUntil = performance.now() + 350;
    if (this.playing) this._startAt(t);
    else { this.pos = t; this.prevPa = t; }
  }

  _rebase() {
    if (!this.playing) return;
    const p = this.position;
    this.startPos = p;
    this.startCtx = this.ctx.currentTime;
  }

  setRate(r) {
    this._rebase();
    this.rate = r;
    if (this.src) this.src.playbackRate.value = r;
    audioStore.set({ rate: r });
  }
  setLoop(v) {
    this.loop = v;
    if (this.src) this.src.loop = v;
    audioStore.set({ loop: v });
  }
  setReverse(v) {
    const dir = v ? -1 : 1;
    if (dir === this.dir) return;
    const was = this.playing;
    const p = this.position;
    if (was) this.stopSource();
    this.dir = dir;
    this.pos = p;
    audioStore.set({ reverse: v });
    if (was) this._startAt(p);
  }
  setVolume(v) {
    this.volume = v;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : v;
    audioStore.set({ volume: v });
  }
  setMuted(m) {
    this.muted = m;
    if (this.gain) this.gain.gain.value = m ? 0 : this.volume;
    audioStore.set({ muted: m });
  }

  /** Stream carrying exactly what the track plays (unaffected by volume/mute) — for RECORD. */
  getRecordStream() {
    this.ensureContext();
    return this.recDest.stream;
  }


  // ───────────── analysis lookups (shared by live playback and offline export) ─────────────
  _fill(A, f, pa, L) {
    const fi = pa * A.rate;
    const i0 = Math.min(A.frames - 1, Math.max(0, Math.floor(fi)));
    const i1 = Math.min(A.frames - 1, i0 + 1);
    const t = fi - i0;
    f.bass = lerp(A.bass[i0], A.bass[i1], t) * L;
    f.mid = lerp(A.mid[i0], A.mid[i1], t) * L;
    f.high = lerp(A.high[i0], A.high[i1], t) * L;
    f.rms = lerp(A.rms[i0], A.rms[i1], t) * L;
    f.energy = lerp(A.energy[i0], A.energy[i1], t) * L;
    f.build = lerp(A.build[i0], A.build[i1], t) * L;
    f.calm = lerp(1, lerp(A.calm[i0], A.calm[i1], t), L);
    const o = i0 * A.specBins;
    for (let j = 0; j < SPECTRUM_BINS; j++) f.spectrum[j] = (A.spec[o + j] / 255) * L;
    f.bpm = A.bpm;
    if (A.bpm > 0) { const per = 60 / A.bpm; f.phase = ((((pa - A.beatOffset) / per) % 1) + 1) % 1; }
  }
  _events(A, f, a, b) {
    if (Math.abs(b - a) >= 0.3 || a === b) return;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const beats = A.beats;
    // beat strengths are relative to the track; weight them by absolute loudness so a quiet passage stays quiet
    const gate = 0.1 + 0.9 * smoothstep(0.1, 0.48, f.energy);
    for (let i = bisect(beats, lo); i < beats.length && beats[i].t <= hi; i++) {
      if (beats[i].t > lo) { f.beat = true; f.beatStrength = Math.max(f.beatStrength, beats[i].s * gate); }
    }
    for (const dT of A.drops) if (dT > lo && dT <= hi) f.drop = true;
  }
  _dropSoon(A, pa, forward) {
    let soon = 0;
    if (forward) for (const dT of A.drops) { const dd = dT - pa; if (dd > 0 && dd < 0.6) soon = Math.max(soon, 1 - dd / 0.6); }
    return soon;
  }

  /** Offline sampling at an exact position (GIF / FRAME export, deterministic — no playback needed). */
  featuresAt(pos, prevPos, f = this.features) {
    const A = this.analysis;
    f.beat = false; f.beatStrength = 0; f.drop = false;
    f.position = pos; f.playing = true;
    if (!A) return f;
    const pa = clamp(pos, 0, A.duration);
    this._fill(A, f, pa, 1);
    this._events(A, f, clamp(prevPos, 0, A.duration), pa);
    f.dropSoon = this._dropSoon(A, pa, true);
    return f;
  }

  /**
   * "Best moment": the window of `len` seconds with the most contrast and energy, ideally containing a drop
   * with a build-up in front of it.  Returns the start time in seconds.
   */
  bestWindow(len) {
    const A = this.analysis, d = this.duration;
    if (!A || len >= d - 0.5) return 0;
    const r = A.rate, step = Math.max(1, Math.round(0.25 * r)), n = Math.round(len * r);
    let best = 0, bestScore = -1;
    for (let k = 0; k + n < A.frames; k += step) {
      let sum = 0, mn = 9, mx = 0;
      for (let i = k; i < k + n; i += 4) { const e = A.energy[i]; sum += e; if (e < mn) mn = e; if (e > mx) mx = e; }
      const mean = sum / Math.ceil(n / 4);
      const t0 = k / r;
      let bonus = 0;
      for (const dT of A.drops) {
        const rel = dT - t0;
        if (rel > len * 0.22 && rel < len * 0.7) bonus = Math.max(bonus, 0.7 - Math.abs(rel - len * 0.38) / len);
      }
      let beatsIn = 0;
      for (let i = bisect(A.beats, t0); i < A.beats.length && A.beats[i].t < t0 + len; i++) beatsIn++;
      const density = Math.min(1, beatsIn / (len * 1.6));
      const score = mean * 0.55 + (mx - mn) * 0.7 + bonus + density * 0.25;
      if (score > bestScore) { bestScore = score; best = t0; }
    }
    return clamp(best, 0, Math.max(0, d - len));
  }

  // ───────────── features ─────────────
  sample(dt, f = this.features) {
    f.time += dt;
    const A = this.analysis;
    const playing = this.playing;
    const scrubbing = performance.now() < this.scrubUntil;
    const pos = this.position;
    f.position = pos;
    f.playing = playing;
    this.liveAmt = damp(this.liveAmt, playing || scrubbing || this.micActive ? 1 : 0, playing || this.micActive ? 40 : 8, dt);
    const L = this.liveAmt;
    f.beat = false; f.beatStrength = 0; f.drop = false;

    if (this.micActive) {
      f.playing = true;
      this.live.read(dt, f);
      f.bpm = 0;
      return f;
    }

    if (A && this.buffer) {
      const lat = playing ? this.dir * this.rate * this.latency : 0;
      const pa = clamp(pos - lat, 0, A.duration);
      this._fill(A, f, pa, L);
      // beats & drops: fire when the playhead crosses them (either direction)
      if (playing) this._events(A, f, this.prevPa, pa);
      this.prevPa = pa;
      // anticipation: a drop within the next ~0.6 s (forward playback only)
      f.dropSoon = this._dropSoon(A, pa, this.dir > 0) * L;
    } else if (this.live && playing && this.buffer) {
      this.live.read(dt, f);
      f.bpm = 0;
      f.build *= L;
    } else {
      const k = Math.exp(-dt * 6);
      f.bass *= k; f.mid *= k; f.high *= k; f.rms *= k; f.energy *= k; f.build *= k; f.dropSoon = 0;
      f.calm = lerp(f.calm, 1, 1 - k);
      for (let j = 0; j < SPECTRUM_BINS; j++) f.spectrum[j] *= k;
    }
    return f;
  }
}

export const audio = new AudioEngine();
if (typeof window !== 'undefined') window.__audio = audio;
