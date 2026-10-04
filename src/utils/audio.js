// Audio helpers: formatting, decoding, and a built-in demo track (rendered offline, entirely local)
// so the whole workflow can be tried without bringing a song.

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(sec) {
  return formatTime(sec);
}

export const AUDIO_ACCEPT = '.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,audio/*';

export function isAudioFile(f) {
  return /^audio\//.test(f.type) || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i.test(f.name);
}

/** decodeAudioData with Safari's old callback signature as a fallback. */
export function decode(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

/**
 * A 16-bar demo song at 124 BPM: pads → hats → half-time kick & bass → snare roll + riser → silence → DROP → groove → outro.
 * It has real quiet and loud sections, which is exactly what REACT's camera/preset logic wants to see.
 */
export async function synthDemoTrack() {
  const sr = 44100, bpm = 124, spb = 60 / bpm, bars = 16;
  const dur = bars * 4 * spb + 2.5;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(dur * sr), sr);
  const master = ctx.createGain();
  master.gain.value = 0.72;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.16;
  master.connect(comp); comp.connect(ctx.destination);

  const nb = ctx.createBuffer(1, sr * 2, sr);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = (t, len) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t, Math.random()); s.stop(t + len); return s; };
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };

  const kick = (t, amp = 0.9) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(43, t + 0.13);
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
  };
  const snare = (t, amp = 0.5) => {
    const n = noise(t, 0.25), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    env(g, t, 0.002, amp, 0.17);
    n.connect(bp); bp.connect(g); g.connect(master);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    env(og, t, 0.002, amp * 0.5, 0.11);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.2);
  };
  const hat = (t, amp = 0.2, open = false) => {
    const n = noise(t, 0.3), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7500;
    env(g, t, 0.001, amp, open ? 0.16 : 0.04);
    n.connect(hp); hp.connect(g); g.connect(master);
  };
  const bass = (t, f, len, amp = 0.55) => {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 7;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(140, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    g.gain.setValueAtTime(amp, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.02);
  };
  const pad = (t, len, freqs, amp) => {
    for (const f of freqs) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + Math.min(0.9, len * 0.4));
      g.gain.setValueAtTime(amp, t + len - 0.7); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.5);
    }
  };
  const arp = (t, f, amp = 0.09) => {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 2;
    env(g, t, 0.003, amp, 0.11);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16);
  };
  const riser = (t0, t1) => {
    const n = noise(t0, t1 - t0 + 0.1), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(350, t0); bp.frequency.exponentialRampToValueAtTime(9000, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t1); g.gain.linearRampToValueAtTime(0.0001, t1 + 0.04);
    n.connect(bp); bp.connect(g); g.connect(master);
  };
  const crash = (t) => {
    const n = noise(t, 2.2), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 4500;
    env(g, t, 0.003, 0.42, 1.8);
    n.connect(hp); hp.connect(g); g.connect(master);
  };

  const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const roots = [55, 43.65, 65.41, 49];
  for (let b = 0; b < bars; b++) {
    const T = b * 4 * spb;
    const ch = b % 4;
    pad(T, 4 * spb, chords[ch], b >= 8 && b < 14 ? 0.022 : b < 4 ? 0.034 : 0.026);
    if (b >= 2 && b !== 7) for (let i = 0; i < (b >= 8 ? 16 : 8); i++) {
      const t = T + (i * 4 * spb) / (b >= 8 ? 16 : 8);
      hat(t, (b >= 8 ? 0.16 : 0.12) * (i % 2 ? 1.25 : 0.8), b >= 8 && i % 4 === 2);
    }
    // kick
    if (b === 4 || b === 5) { kick(T, 0.75); kick(T + 2 * spb, 0.7); }
    if (b === 6) for (let i = 0; i < 4; i++) kick(T + i * spb, 0.85);
    if (b === 7) { kick(T, 0.85); kick(T + spb, 0.85); }
    if (b >= 8 && b <= 14) for (let i = 0; i < 4; i++) kick(T + i * spb, 0.95);
    if (b === 15) { kick(T, 0.8); kick(T + 2 * spb, 0.6); }
    // snare roll / backbeat
    if (b === 6) for (let i = 0; i < 4; i++) snare(T + 2 * spb + (i * spb) / 2, 0.22 + i * 0.06);
    if (b === 7) for (let i = 0; i < 16; i++) { if (i < 8) snare(T + (i * spb) / 2, 0.3 + (i / 16) * 0.5); else if (i < 12) snare(T + (i * spb) / 2, 0.5 + (i / 16) * 0.5); }
    if (b >= 8 && b <= 13) { snare(T + spb, 0.55); snare(T + 3 * spb, 0.55); }
    // bass
    if (b >= 4 && b < 8) for (let i = 0; i < 4; i++) { if (b === 7 && i > 1) break; bass(T + i * spb, roots[ch], spb * 0.9, 0.42); }
    if (b >= 8 && b <= 13) for (let i = 0; i < 8; i++) { const t = T + i * spb * 0.5 + spb * 0.25; bass(t, roots[ch] * (i % 4 === 3 ? 2 : 1), spb * 0.42, 0.6); }
    // arp
    if (b >= 8 && b <= 13) for (let i = 0; i < 16; i++) arp(T + (i * spb) / 4, chords[ch][i % 3] * (i % 8 > 4 ? 2 : 1) * 2, 0.07);
  }
  riser(6 * 4 * spb, 8 * 4 * spb - spb);
  crash(8 * 4 * spb);
  return ctx.startRendering();
}

/** Encode an AudioBuffer as 16-bit PCM WAV (used for tests / "save demo track"). */
export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}
