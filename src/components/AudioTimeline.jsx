import { useEffect, useRef, useState } from 'react';
import { useStore, appStore } from '../store.js';
import { audio } from '../audio/audioState.js';
import { useAudio } from '../hooks/useAudio.js';
import { formatTime } from '../utils/audio.js';
import { KEY_PROP_MAP } from '../engine/animation.js';
import { Play, Pause, Loop, Reverse, Volume, Mute, Diamond } from './ui.jsx';

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const fmtSpeed = (s) => (s === 0.25 ? '¼×' : s === 0.5 ? '½×' : `${s}×`);

function drawWave(canvas, { peaks, beats, drops, duration }, color, beatColor, dpr) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const laneTop = 14, mid = laneTop + (h - laneTop) / 2, amp = (h - laneTop) / 2 - 3;
  if (peaks) {
    const cols = peaks.length / 2;
    const step = 3, bw = 2;
    g.fillStyle = color;
    for (let x = 0; x < w; x += step) {
      const a = Math.floor((x / w) * cols), b = Math.max(a + 1, Math.floor(((x + step) / w) * cols));
      let mn = 0, mx = 0;
      for (let i = a; i < b && i < cols; i++) { if (peaks[i * 2] < mn) mn = peaks[i * 2]; if (peaks[i * 2 + 1] > mx) mx = peaks[i * 2 + 1]; }
      const up = Math.pow(Math.min(1, mx * 1.15), 0.8) * amp, dn = Math.pow(Math.min(1, -mn * 1.15), 0.8) * amp;
      g.fillRect(x, mid - Math.max(0.5, up), bw, Math.max(1, up + dn));
    }
    // beat ticks (information: where the analysis thinks the hits are)
    g.fillStyle = beatColor;
    for (const b of beats) {
      const x = Math.round((b.t / duration) * w);
      g.fillRect(x, 4, 1, 3 + Math.min(1, b.s) * 4);
    }
    // drops
    g.fillRect(0, 0, 0, 0);
    for (const d of drops) { const x = Math.round((d / duration) * w); g.fillRect(x - 1, 0, 2, h); }
  } else {
    g.fillStyle = color;
    for (let x = 0; x < w; x += 6) g.fillRect(x, mid - 0.5, 2, 1);
  }
}

export function AudioTimeline() {
  const a = useAudio();
  const keys = useStore(appStore, (s) => s.keyframes);
  const palette = useStore(appStore, (s) => s.palette);
  const wrap = useRef(null), base = useRef(null), played = useRef(null), head = useRef(null), cur = useRef(null);
  const [size, setSize] = useState(0);
  const drag = useRef(null);

  // size + redraw
  useEffect(() => {
    const ro = new ResizeObserver(() => setSize(wrap.current ? wrap.current.clientWidth : 0));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!base.current) return;
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#f4f4f2';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const data = { peaks: a.peaks, beats: a.beats, drops: a.drops, duration: a.duration || 1 };
    drawWave(base.current, data, 'rgba(236,235,230,0.26)', 'rgba(236,235,230,0.38)', dpr);
    drawWave(played.current, data, accent, accent, dpr);
  }, [a.peaks, a.beats, a.drops, a.duration, size, palette]);

  // playhead — straight to the DOM, every frame
  useEffect(() => {
    let raf = 0, lastSec = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const d = audio.duration;
      const p = d ? audio.position / d : 0;
      if (head.current) head.current.style.left = `${(p * 100).toFixed(3)}%`;
      if (played.current) played.current.style.clipPath = `inset(0 ${(100 - p * 100).toFixed(3)}% 0 0)`;
      const sec = Math.floor(audio.position);
      if (sec !== lastSec && cur.current) { lastSec = sec; cur.current.textContent = formatTime(audio.position); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seekFrom = (e) => {
    const r = wrap.current.getBoundingClientRect();
    audio.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration);
  };
  const down = (e) => {
    if (!a.loaded || a.micActive) return;
    wrap.current.setPointerCapture(e.pointerId);
    drag.current = { was: audio.playing };
    if (audio.playing) audio.pause();
    seekFrom(e);
  };
  const move = (e) => { if (drag.current) seekFrom(e); };
  const up = () => { if (!drag.current) return; const was = drag.current.was; drag.current = null; if (was) audio.play(); };
  const key = (e) => {
    if (!a.loaded || a.micActive) return;
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowRight') { audio.seek(audio.position + step); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { audio.seek(audio.position - step); e.preventDefault(); }
    else if (e.key === 'Home') { audio.seek(0); e.preventDefault(); }
    else if (e.key === 'End') { audio.seek(audio.duration); e.preventDefault(); }
  };
  const cycleSpeed = () => audio.setRate(SPEEDS[(SPEEDS.indexOf(a.rate) + 1) % SPEEDS.length]);

  return (
    <div className="timeline" data-ui>
      {a.micActive ? (
        <div className="tl-left">
          <button type="button" className="play on" aria-label="Stop Microphone" onClick={() => audio.stopMic()}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#ff3366', borderRadius: '50%', boxShadow: '0 0 8px #ff3366' }} />
          </button>
          <div className="clock" aria-live="off"><span style={{ color: '#ff3366', fontWeight: 600, letterSpacing: '0.12em', fontSize: '10px' }}>LIVE MIC</span></div>
        </div>
      ) : (
        <div className="tl-left">
          <button type="button" className="play" aria-label={a.playing ? 'Pause' : 'Play'} disabled={!a.loaded || (a.analyzing && !a.ready && false)}
            onClick={() => audio.toggle()}>{a.playing ? <Pause size={20} /> : <Play size={20} />}</button>
          <div className="clock" aria-live="off"><span ref={cur}>0:00</span><i>/</i><span>{formatTime(a.duration)}</span></div>
        </div>
      )}
      <div className={`tl-wave ${a.loaded ? '' : 'empty'}`} ref={wrap} role="slider" tabIndex={a.loaded && !a.micActive ? 0 : -1}
        aria-label="Playhead" aria-valuemin={0} aria-valuemax={Math.round(a.duration)} aria-valuetext={a.loaded ? `${formatTime(a.duration)} track` : 'No sound loaded'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
        {!a.micActive && <canvas ref={base} className="wv base" />}
        {!a.micActive && <canvas ref={played} className="wv played" />}
        <div className="keylane">
          {a.loaded && !a.micActive && keys.map((k) => (
            <button key={k.id} type="button" className="kd" style={{ left: `${(k.t / a.duration) * 100}%` }} title={`${KEY_PROP_MAP[k.prop].label} @ ${formatTime(k.t)}`}
              onPointerDown={(e) => e.stopPropagation()} onClick={() => audio.seek(k.t)} aria-label={`Keyframe ${KEY_PROP_MAP[k.prop].label} at ${formatTime(k.t)}`}><Diamond size={10} /></button>
          ))}
        </div>
        {!a.micActive && <div className="playhead" ref={head} />}
        {a.micActive ? (
          <span className="tl-hint" style={{ color: 'var(--ink)' }}>🎤 Real-time microphone input — reacting live to voice / instruments</span>
        ) : !a.loaded ? (
          <span className="tl-hint">Your sound appears here</span>
        ) : null}
      </div>
      <div className="tl-right">
        <button type="button" className={`icon ${a.loop ? 'on' : ''}`} aria-pressed={a.loop} aria-label="Loop" title="Loop" onClick={() => audio.setLoop(!a.loop)}><Loop /></button>
        <button type="button" className={`icon ${a.reverse ? 'on' : ''}`} aria-pressed={a.reverse} aria-label="Reverse" title="Reverse" onClick={() => audio.setReverse(!a.reverse)}><Reverse /></button>
        <div className="speeds" role="radiogroup" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={a.rate === s} className={a.rate === s ? 'on' : ''} onClick={() => audio.setRate(s)}>{fmtSpeed(s)}</button>
          ))}
        </div>
        <button type="button" className="speed-cycle" aria-label={`Speed ${fmtSpeed(a.rate)}. Change`} onClick={cycleSpeed}>{fmtSpeed(a.rate)}</button>
        <button type="button" className={`icon ${a.muted ? 'on' : ''}`} aria-pressed={a.muted} aria-label={a.muted ? 'Unmute' : 'Mute'} onClick={() => audio.setMuted(!a.muted)}>{a.muted ? <Mute /> : <Volume />}</button>
      </div>
    </div>
  );
}
