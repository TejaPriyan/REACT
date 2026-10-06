import { useEffect, useRef, useState } from 'react';
import { EngineHost, studio } from '../engine/host.js';
import { makeObject } from '../engine/objectBuilder.js';
import { useInteraction } from '../hooks/useInteraction.js';
import { detectQuality } from '../utils/performance.js';
import { frameAspect } from '../utils/frames.js';
import { applySignoff, SIGNOFF } from '../utils/export.js';
import { isAudioFile } from '../utils/audio.js';
import { useStore, appStore, app } from '../store.js';
import { audio, audioStore } from '../audio/audioState.js';
import { loadAudioFile } from '../hooks/useAudio.js';
import { AudioPanel, DropHero } from './AudioUpload.jsx';
import { ObjectPanel, loadObjectFile } from './ObjectUpload.jsx';
import { MotionPanel } from './ReactionPanel.jsx';
import { StylePanel } from './StylePanel.jsx';
import { ExportPanel } from './ExportPanel.jsx';
import { AudioTimeline } from './AudioTimeline.jsx';
import { Sparkle, Cinema, Close } from './ui.jsx';

const TABS = [{ id: 'audio', label: 'AUDIO' }, { id: 'object', label: 'OBJECT' }, { id: 'motion', label: 'MOTION' }, { id: 'style', label: 'STYLE' }];
const PANELS = { audio: AudioPanel, object: ObjectPanel, motion: MotionPanel, style: StylePanel, export: ExportPanel };

const cfgFrom = (s) => ({
  preset: s.preset, material: s.material, palette: s.palette, background: s.background, particles: s.particles, camera: s.camera,
  intensity: s.intensity, mapping: s.mapping, keyframes: s.keyframes, reduceMotion: s.reduceMotion, size: s.object.size,
  textBrightness: s.textBrightness ?? 0.85, glow: s.glow ?? 0.85, particleReactivity: s.particleReactivity ?? 1.0,
  customColors: s.customColors,
});

export default function Studio({ active }) {
  const rootEl = useRef(null), stageEl = useRef(null), frameEl = useRef(null), slot = useRef(null), engRef = useRef(null), hostRef = useRef(null);
  const [gl, setGl] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [building, setBuilding] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const frame = useStore(appStore, (s) => s.frame);
  const panel = useStore(appStore, (s) => s.panel);
  const cinema = useStore(appStore, (s) => s.cinema);
  const screen = useStore(appStore, (s) => s.screen);
  const obj = useStore(appStore, (s) => s.object);
  const overlay = useStore(appStore, (s) => s.overlay);
  const rendering = screen === 'rendering';
  const ar = frameAspect(frame);

  // ── engine ──
  useEffect(() => {
    let host, unsub;
    try {
      const st = appStore.get();
      host = new EngineHost(slot.current, { quality: 'balanced', config: cfgFrom(st), source: (dt) => audio.sample(dt) });
      let q = st.quality;
      if (st.qualityAuto) { q = detectQuality(host.engine.caps); appStore.set({ quality: q }); }
      host.engine.setQuality(q);
      let lastQ = q;
      const sync = (s) => { host.config(cfgFrom(s)); if (s.quality !== lastQ) { lastQ = s.quality; host.engine.setQuality(s.quality); } };
      sync(appStore.get());
      unsub = appStore.sub(sync);
      hostRef.current = host; engRef.current = host.engine; studio.host = host;
      window.__studio = host;
    } catch (e) {
      console.error('[studio] WebGL unavailable', e);
      setGl(false);
    }
    return () => { if (unsub) unsub(); if (host) host.dispose(); hostRef.current = null; engRef.current = null; };
  }, []);

  // while the "drop your sound" prompt is up, lift the object into the upper half of the frame
  const loaded = useStore(audioStore, (s) => s.loaded && !s.analyzing);
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const mq = matchMedia('(max-width: 760px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // on phones the panel is a sheet over the bottom of the frame: lift the object clear of it
  const lift = (loaded ? 0 : 0.26) + (narrow && panel && !cinema ? 0.3 : 0);
  useEffect(() => { const h = hostRef.current; if (h) h.config({ offsetY: Math.min(0.44, lift) }); }, [lift, gl]);

  // pause the loop whenever the studio isn't what's on screen
  useEffect(() => { const h = hostRef.current; if (h) (active ? h.resume() : h.pause()); }, [active, gl]);

  // ── object (text / logo / image / video) ──
  const objKey = JSON.stringify([obj.kind, obj.text, obj.overlayText, obj.textPos, obj.font, obj.weight, obj.spacing, obj.lineHeight, obj.align, obj.fileUrl, frame]);
  const firstBuild = useRef(true);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let dead = false;
    const delay = firstBuild.current ? 0 : 160;
    firstBuild.current = false;
    const t = setTimeout(async () => {
      setBuilding(obj.kind !== 'text');
      try {
        const o = await makeObject(obj, frameAspect(frame));
        if (dead || !o) return;
        host.engine.setObject(o);
        if (o.video) o.video.play().catch(() => {});
      } catch (e) {
        console.error('[object]', e);
        app.toast((e && e.message) || "Couldn't load that file.", 4500);
        if (!dead) app.setObject({ kind: 'text', fileUrl: null, fileName: '' });
      } finally { if (!dead) setBuilding(false); }
    }, delay);
    return () => { dead = true; clearTimeout(t); };
  }, [objKey, gl]);

  useInteraction(frameEl, engRef);

  // ── drag & drop anywhere on the stage ──
  const dnd = {
    onDragEnter: (e) => { e.preventDefault(); setDragging(true); },
    onDragOver: (e) => { e.preventDefault(); setDragging(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); },
    onDrop: (e) => {
      e.preventDefault(); setDragging(false);
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (isAudioFile(f)) loadAudioFile(f);
      else if (!loadObjectFile(f, 'image')) app.toast('That file type is not supported. Drop audio, an image, a logo or a video.');
    },
  };

  // ── cinema ──
  const exitCinema = () => {
    audio.pause();
    const eng = engRef.current;
    if (eng) { eng.sig.alpha = 0; eng.sig.fade = 0; }
    appStore.set({ cinema: false });
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  const enterCinema = () => {
    if (!audio.loaded) { app.toast('Add a sound first. Cinema plays your track fullscreen.'); return; }
    const el = rootEl.current;
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    appStore.set({ cinema: true, panel: null });
    audio.setLoop(false); audio.setReverse(false); audio.setRate(1);
    audio.seek(0);
    audio.play();
    setShowExit(true);
  };
  useEffect(() => {
    if (!cinema) return undefined;
    const host = hostRef.current;
    const eng = engRef.current;
    let endTimer = 0;
    const sign = appStore.get().signature;
    const prev = host.onFrame;
    host.onFrame = () => {
      if (audio.playing) {
        const left = audio.duration - audio.position;
        if (left < SIGNOFF) applySignoff(eng, 1 - left / SIGNOFF, sign);
      }
    };
    audio.onEnded = () => {
      applySignoff(eng, 1, sign);
      endTimer = setTimeout(exitCinema, sign ? 1400 : 500);
    };
    const onFs = () => { if (!document.fullscreenElement && appStore.get().cinema) exitCinema(); };
    document.addEventListener('fullscreenchange', onFs);
    const hide = setTimeout(() => setShowExit(false), 2600);
    return () => { host.onFrame = prev; audio.onEnded = null; clearTimeout(endTimer); clearTimeout(hide); document.removeEventListener('fullscreenchange', onFs); };
  }, [cinema]);
  const poke = () => { if (!appStore.get().cinema) return; setShowExit(true); clearTimeout(poke.t); poke.t = setTimeout(() => setShowExit(false), 2200); };

  // ── keyboard ──
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (appStore.get().overlay) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' && e.target.type !== 'range' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (appStore.get().cinema) exitCinema();
        else if (appStore.get().panel) appStore.set({ panel: null });
        return;
      }
      if (typing || appStore.get().screen !== 'studio') return;
      const onBtn = tag === 'button' || tag === 'a' || e.target.getAttribute('role') === 'slider' || e.target.getAttribute('role') === 'radio' || tag === 'input';
      if (e.key === ' ' && !onBtn) { e.preventDefault(); audio.toggle(); }
      else if (e.key === 'ArrowRight' && !onBtn) { audio.seek(audio.position + 2); }
      else if (e.key === 'ArrowLeft' && !onBtn) { audio.seek(audio.position - 2); }
      else if (e.key === 'c' || e.key === 'C') { appStore.get().cinema ? exitCinema() : enterCinema(); }
      else if (e.key === 's' || e.key === 'S') { surprise(); }
      else if (e.key === 'r' || e.key === 'R') { appStore.set({ panel: appStore.get().panel === 'export' ? null : 'export' }); }
      else if (/^[1-4]$/.test(e.key)) { const id = TABS[Number(e.key) - 1].id; appStore.set({ panel: appStore.get().panel === id ? null : id }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const surprise = () => {
    app.surprise();
    const eng = engRef.current;
    if (eng) { eng.camera.whip(0.9); eng.pointer.clicks.push(performance.now()); }
  };
  const toggle = (id) => appStore.set({ panel: panel === id ? null : id });
  const Panel = panel ? PANELS[panel] : null;

  return (
    <div ref={rootEl} className={`studio ${cinema ? 'cinema' : ''} ${rendering ? 'is-rendering' : ''} ${panel ? 'has-panel' : ''}`} hidden={screen === 'landing' || undefined} onPointerMove={poke}>
      <div className="brand" data-ui>
        <button type="button" className="mark" onClick={() => app.go('landing')} aria-label="REACT. Back to the start"><i />REACT</button>
      </div>
      <nav className="tabs" aria-label="Studio sections" data-ui>
        {TABS.map((t, i) => (
          <button key={t.id} type="button" className={panel === t.id ? 'on' : ''} aria-expanded={panel === t.id} aria-keyshortcuts={String(i + 1)} onClick={() => toggle(t.id)}>{t.label}</button>
        ))}
      </nav>
      <div className="actions" data-ui>
        <button type="button" className="btn ghost surprise" onClick={surprise} aria-keyshortcuts="S"><Sparkle size={14} /><span>SURPRISE ME</span></button>
        <button type="button" className="btn ghost cin" onClick={enterCinema} aria-keyshortcuts="C" aria-label="Cinema mode"><Cinema size={16} /><span>CINEMA</span></button>
        <button type="button" className={`btn rec-btn ${panel === 'export' ? 'on' : ''}`} onClick={() => toggle('export')} aria-keyshortcuts="R"><i className="dot" />RECORD</button><a href="https://www.buymeacoffee.com/TejaPriyan" target="_blank" rel="noopener noreferrer" className="btn ghost" title="Buy me a pizza" style={{ color: "#FFDD00", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}><span>🍕</span><span>PIZZA</span></a>
      </div>

      <div className={`stage ${dragging ? 'drag' : ''}`} ref={stageEl} {...dnd}>
        <div className="frame" ref={frameEl} style={{ '--ar': ar, '--arn': ar }}>
          <div className="gl-slot" ref={slot} />
          {!gl && <div className="nogl"><b>REACT needs WebGL2.</b><span>Turn on hardware acceleration in your browser settings, or try a recent Chrome, Edge, Firefox or Safari.</span></div>}
          <DropHero dragging={dragging} />
          {building && <div className="chip-loading">LOADING…</div>}
        </div>
        {dragging && <div className="dropveil" aria-hidden="true">DROP IT HERE</div>}
      </div>

      {Panel && (
        <aside className="panel" data-ui aria-label={`${panel} settings`}>
          <button type="button" className="icon panel-x" aria-label="Close panel" onClick={() => appStore.set({ panel: null })}><Close size={16} /></button>
          <div className="panel-scroll"><Panel /></div>
        </aside>
      )}

      <AudioTimeline />
      {cinema && <button type="button" className={`cinema-exit ${showExit ? 'show' : ''}`} onClick={exitCinema} aria-label="Exit Cinema"><Close size={16} /><span>ESC</span></button>}
    </div>
  );
}
