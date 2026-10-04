// Recording & export.  Everything runs locally against the studio's live engine.
//
//   VIDEO  real-time capture: canvas.captureStream() + the Web Audio record bus → MediaRecorder
//   GIF    deterministic offline stepping (analysis curves → engine) → palette-quantised frames
//   PNG    the current frame at export resolution
//   FRAME  the best frame of the track (auto-picked peak moment), rendered offline
//
// The exporter reports through appStore.render { stage, progress, note } so the cinematic render screen shows real work.

import { studio } from '../engine/host.js';
import { audio, audioStore } from '../audio/audioState.js';
import { appStore, app } from '../store.js';
import { createFeatures } from '../audio/features.js';
import { encodeGif } from './gif.js';
import { SIZES } from './frames.js';
import { smoothstep } from '../engine/math.js';

export const STAGES = ['ANALYZING AUDIO', 'BUILDING MOTION', 'SYNCING BEATS', 'RENDERING', 'FINALIZING'];
export const SIGNOFF = 1.6;

export class ExportError extends Error {}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let current = null;
export function cancelExport() { if (current) current.cancelled = true; }
export const isExporting = () => !!current;

export function videoSupport() {
  const ok = typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  if (!ok) return { ok: false, mime: '' };
  // H.264 + AAC MP4 first (plays everywhere, accepted by social apps); otherwise WebM with a known codec
  const list = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ];
  const mime = list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
  return { ok: true, mime };
}

const slug = (s) => (s || 'react').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'react';
function fileName(ext) {
  const s = appStore.get();
  const base = s.object.kind === 'text' ? s.object.text : s.object.fileName.replace(/\.[^.]+$/, '');
  return `react-${slug(base)}-${s.preset}-${s.frame.replace(':', 'x')}.${ext}`;
}

function setRender(patch) { appStore.set({ render: { ...appStore.get().render, ...patch } }); }

/** Show a stage on the render screen for at least `min` ms so the sequence reads. */
async function stage(i, note, min = 520, work) {
  setRender({ stage: i, progress: 0, note: note || '' });
  const t0 = performance.now();
  const r = work ? await work() : undefined;
  const left = min - (performance.now() - t0);
  if (left > 0) await wait(left);
  if (current && current.cancelled) throw new ExportError('cancelled');
  return r;
}
const check = () => { if (current && current.cancelled) throw new ExportError('cancelled'); };

async function waitForAnalysis() {
  const t0 = performance.now();
  while (audio.loaded && !audio.analysis && audioStore.get().analyzing && performance.now() - t0 < 90000) {
    setRender({ progress: audioStore.get().progress });
    await wait(100);
    check();
  }
}

function pickStart(opts, D) {
  const dur = audio.duration;
  if (!dur) return 0;
  if (D >= dur - 0.25) return 0;
  if (opts.startFrom === 'best' && audio.analysis) return audio.bestWindow(D);
  if (opts.startFrom === 'playhead') { const p = audio.position; return p > dur - D ? Math.max(0, dur - D) : p; }
  return 0;
}

/** Common setup/teardown for anything that needs the engine at an exact size. */
async function withEngineSize(W, H, fn) {
  const host = studio.host;
  if (!host) throw new ExportError('The studio is not ready yet.');
  const eng = host.engine;
  const saved = { rate: audio.rate, loop: audio.loop, reverse: audio.reverse, pos: audio.position, volume: audio.volume };
  audio.pause();
  if (audio.reverse) audio.setReverse(false);
  if (audio.loop) audio.setLoop(false);
  if (audio.rate !== 1) audio.setRate(1);
  eng.setFixedSize(W, H);
  eng.sig.alpha = 0; eng.sig.fade = 0;
  try { return await fn(host, eng); }
  finally {
    eng.sig.alpha = 0; eng.sig.fade = 0;
    eng.setFixedSize(null);
    host.resume();
    try { audio.setRate(saved.rate); audio.setLoop(saved.loop); if (saved.reverse) audio.setReverse(true); } catch { /* ignore */ }
    if (audio.gain) { audio.gain.gain.cancelScheduledValues(0); audio.gain.gain.value = audio.muted ? 0 : audio.volume; }
    if (audio.recGain) { audio.recGain.gain.cancelScheduledValues(0); audio.recGain.gain.value = 1; }
    audio.seek(saved.pos);
  }
}

export function applySignoff(eng, p, on) {
  if (!on) { eng.sig.alpha = 0; eng.sig.fade = 0; return; }
  eng.sig.alpha = smoothstep(0.08, 0.42, p);
  eng.sig.fade = 0.92 * smoothstep(0.0, 0.45, p);
}

// ───────────────────────────── VIDEO ─────────────────────────────
async function exportVideo(opts) {
  const sup = videoSupport();
  if (!sup.ok) throw new ExportError("This browser can't record video from a canvas. Use a recent Chrome, Edge, Firefox or Safari, or export a PNG, FRAME or GIF instead.");
  if (!audio.loaded) throw new ExportError('Add a sound first. REACT records the music together with the picture.');
  const ratio = appStore.get().frame;
  const [W, H] = SIZES.video[ratio][opts.quality];
  const D = Math.min(opts.duration, audio.duration);
  const sign = appStore.get().signature;
  let note = '';

  await stage(0, 'Reading the whole track', 400, waitForAnalysis);
  return withEngineSize(W, H, async (host, eng) => {
    await stage(1, `${W}×${H}`, 700, async () => { await nextFrame(); await nextFrame(); await nextFrame(); });
    const start = await stage(2, '', 700, async () => {
      const t = pickStart(opts, D);
      audio.seek(t);
      await wait(380); // let the springs settle on the opening frame
      const A = audio.analysis;
      if (A) {
        const n = A.beats.filter((b) => b.t >= t && b.t <= t + D).length;
        setRender({ note: `${n} beats in ${Math.round(D)} s` });
      }
      return t;
    });

    // RENDERING — real time
    setRender({ stage: 3, progress: 0, note: '' });
    const stream = host.engine.canvas.captureStream(30);
    let hasAudio = false;
    try {
      const as = audio.getRecordStream();
      as.getAudioTracks().forEach((t) => { stream.addTrack(t); hasAudio = true; });
    } catch { /* video only */ }
    if (!hasAudio) note = 'Audio could not be attached, so this recording is silent.';
    const recStartWall = performance.now();
    const rec = new MediaRecorder(stream, {
      ...(sup.mime ? { mimeType: sup.mime } : {}),
      videoBitsPerSecond: opts.quality === 'high' ? 14e6 : 8e6,
      audioBitsPerSecond: 192000,
    });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    let drawn = 0;
    const prevOnFrame = host.onFrame;
    host.onFrame = () => { drawn++; };
    const wall0 = performance.now();
    const started = new Promise((r) => { rec.onstart = r; });
    const stopped = new Promise((r) => { rec.onstop = r; });
    rec.start(250);
    await started;
    await audio.play();
    const t0 = audio.position;
    let ended = false;
    const prevEnded = audio.onEnded;
    audio.onEnded = () => { ended = true; };
    const Deff = Math.min(D, audio.duration - start);
    const speakers = audio.gain, bus = audio.recGain;
    const fadeStart = Math.max(0, Deff - (sign ? SIGNOFF : 0.18));
    let faded = false;
    try {
      for (;;) {
        await nextFrame();
        if (current && current.cancelled) break;
        const el = audio.position - t0;
        setRender({ progress: Math.min(1, el / Deff), note: `${Math.min(Deff, Math.max(0, el)).toFixed(1)} s of ${Deff.toFixed(0)} s` });
        if (el >= fadeStart) {
          const p = Math.min(1, (el - fadeStart) / (Deff - fadeStart));
          applySignoff(eng, p, sign);
          if (!faded) {
            faded = true;
            const ctx = audio.ctx, now = ctx.currentTime, len = Math.max(0.1, Deff - el);
            for (const g of [speakers, bus]) { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0.0001, now + len); }
          }
        }
        if (el >= Deff - 0.02 || ended) break;
        if ((performance.now() - wall0) / 1000 > Deff * 3 + 12) break;   // the audio clock stalled — never hang
      }
      if (sign && !(current && current.cancelled)) {
        // Hold the finished end card until a few frames of it have really been drawn (and captured) —
        // on a slow device the last loop pass would otherwise stop the recorder before the card ever rendered.
        applySignoff(eng, 1, true);
        const d0 = drawn, w0 = performance.now();
        while (drawn - d0 < 3 && performance.now() - w0 < 4000) await nextFrame();
      }
    } finally {
      host.onFrame = prevOnFrame;
      audio.onEnded = prevEnded;
      audio.pause();
      if (rec.state !== 'inactive') { try { rec.requestData(); } catch { /* ignore */ } rec.stop(); }
    }
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    check();

    await stage(4, '', 700);
    const secsWall = Math.max(0.5, (performance.now() - recStartWall) / 1000);
    const fps = drawn / secsWall;
    if (fps < 24 && !note) note = `This device drew about ${Math.round(fps)} frames per second while recording, so the video will look choppy. Try PERFORMANCE quality, STANDARD size, or a shorter length.`;
    const type = (rec.mimeType || sup.mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    if (!blob.size) throw new ExportError('The recording came out empty. Try again, or lower the quality.');
    const ext = /mp4/.test(type) ? 'mp4' : 'webm';
    return { kind: 'video', blob, type, ext, w: W, h: H, duration: Deff, filename: fileName(ext), size: blob.size, hasAudio, note, warn: !!note };
  });
}

// ───────────────────────────── offline stepping (GIF / FRAME) ─────────────────────────────
/** Advance the engine from position p0 to p1 with fixed small steps, driven by the analysis (no playback). */
function stepOffline(eng, f, p0, p1, sub = 1 / 60) {
  let prev = p0;
  const n = Math.max(1, Math.round((p1 - p0) / sub));
  const dt = (p1 - p0) / n;
  for (let i = 1; i <= n; i++) {
    const pos = p0 + dt * i;
    if (audio.analysis) audio.featuresAt(pos, prev, f); else { f.position = pos; }
    eng.update(dt, f);
    prev = pos;
  }
}

async function exportGif(opts) {
  if (!audio.loaded) throw new ExportError('Add a sound first. The GIF is built from the beats of your track.');
  const ratio = appStore.get().frame;
  const [W, H] = SIZES.gif[ratio][opts.quality];
  const D = Math.min(opts.duration, 15, audio.duration);
  const fps = 12, delay = 8;
  const sign = appStore.get().signature;
  await stage(0, 'Reading the whole track', 400, waitForAnalysis);
  return withEngineSize(W, H, async (host, eng) => {
    host.pause();
    const f = createFeatures();
    let start = 0;
    await stage(1, `${W}×${H}`, 600, async () => { await nextFrame(); start = pickStart(opts, D); });
    await stage(2, '', 500);
    const frames = [];
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const g = c2.getContext('2d', { willReadFrequently: true });
    setRender({ stage: 3, progress: 0 });
    stepOffline(eng, f, Math.max(0, start - 0.6), start);                 // settle
    const N = Math.round(D * fps);
    for (let k = 0; k < N; k++) {
      const p0 = start + k / fps, p1 = start + (k + 1) / fps;
      const t = k / fps;
      applySignoff(eng, (t - (D - SIGNOFF)) / SIGNOFF, sign && t > D - SIGNOFF);
      stepOffline(eng, f, p0, p1);
      eng.render();
      g.drawImage(eng.canvas, 0, 0, W, H);
      frames.push(g.getImageData(0, 0, W, H).data);
      if (k % 2 === 0) { setRender({ progress: (k + 1) / N * 0.7, note: `frame ${k + 1} of ${N}` }); await wait(0); check(); }
    }
    setRender({ stage: 4, progress: 0.7, note: 'Building the palette' });
    await wait(60);
    const blob = await encodeGif(frames, W, H, {
      delay, onProgress: (p) => setRender({ progress: 0.7 + p * 0.3 }), shouldCancel: () => current && current.cancelled,
    });
    check();
    return { kind: 'gif', blob, type: 'image/gif', ext: 'gif', w: W, h: H, duration: D, filename: fileName('gif'), size: blob.size, hasAudio: false, note: 'GIFs are silent.', warn: false };
  });
}

// ───────────────────────────── PNG / FRAME ─────────────────────────────
async function exportPng(opts) {
  const ratio = appStore.get().frame;
  const [W, H] = SIZES.image[ratio][opts.quality];
  await stage(0, '', 250);
  return withEngineSize(W, H, async (host, eng) => {
    await stage(1, `${W}×${H}`, 450, async () => { await nextFrame(); await nextFrame(); await nextFrame(); });
    await stage(2, '', 250);
    setRender({ stage: 3, progress: 0.5 });
    const blob = await eng.captureFrame('image/png');
    await stage(4, '', 350);
    return { kind: 'image', blob, type: 'image/png', ext: 'png', w: W, h: H, duration: 0, filename: fileName('png'), size: blob.size, hasAudio: false, note: '' };
  });
}

/** Best frame: the strongest hit at or just after the first drop (or the loudest beat). */
function heroMoment() {
  const A = audio.analysis;
  if (!A) return audio.position;
  // the camera whips in on the drop; half a second later the word is readable again with the burst still in the air
  if (A.drops.length) return Math.min(A.duration, A.drops[0] + 0.5);
  let best = null;
  for (const b of A.beats) if (!best || b.s > best.s) best = b;
  return best ? best.t + 0.1 : audio.position;
}

async function exportFrame(opts) {
  const ratio = appStore.get().frame;
  const [W, H] = SIZES.image[ratio][opts.quality];
  if (audio.loaded) await stage(0, 'Reading the whole track', 300, waitForAnalysis); else await stage(0, '', 250);
  return withEngineSize(W, H, async (host, eng) => {
    host.pause();
    const f = createFeatures();
    await stage(1, `${W}×${H}`, 450, async () => { await nextFrame(); });
    const at = await stage(2, 'Finding the strongest moment', 600, async () => heroMoment());
    setRender({ stage: 3, progress: 0.3, note: audio.loaded ? `at ${at.toFixed(1)} s` : '' });
    if (audio.loaded && audio.analysis) { stepOffline(eng, f, Math.max(0, at - 1.4), at, 1 / 60); }
    else { for (let i = 0; i < 40; i++) eng.update(1 / 60, f); }
    eng.render();
    const blob = await eng.captureFrame('image/png');
    await stage(4, '', 350);
    return { kind: 'image', blob, type: 'image/png', ext: 'png', w: W, h: H, duration: 0, filename: fileName('png'), size: blob.size, hasAudio: false, note: audio.loaded ? `Captured at ${at.toFixed(1)} s` : '' };
  });
}

// ───────────────────────────── entry ─────────────────────────────
export async function runExport(opts = appStore.get().exportOpts) {
  if (current) return null;
  current = { cancelled: false };
  const prevScreen = appStore.get().screen;
  appStore.set({ screen: 'rendering', cinema: false, render: { stage: 0, progress: 0, note: '' } });
  try {
    const fn = { video: exportVideo, gif: exportGif, png: exportPng, frame: exportFrame }[opts.format] || exportVideo;
    const result = await fn(opts);
    if (opts.format === 'png' || opts.format === 'frame') { /* fall through */ }
    const url = URL.createObjectURL(result.blob);
    const old = appStore.get().result;
    if (old && old.url) setTimeout(() => URL.revokeObjectURL(old.url), 5000);
    result.url = url;
    setRender({ stage: STAGES.length, progress: 1, note: '' });
    appStore.set({ result });
    await wait(1100);   // "YOUR VISUAL IS READY."
    appStore.set({ screen: 'result' });
    return result;
  } catch (e) {
    appStore.set({ screen: 'studio' });
    if (!(e instanceof ExportError && e.message === 'cancelled')) {
      console.error('[export]', e);
      app.toast(e instanceof ExportError ? e.message : 'The export stopped unexpectedly. Try a lower quality or a shorter length.', 6500);
    } else app.toast('Export cancelled.');
    return null;
  } finally {
    current = null;
    if (appStore.get().screen === 'rendering') appStore.set({ screen: prevScreen === 'rendering' ? 'studio' : prevScreen });
  }
}
