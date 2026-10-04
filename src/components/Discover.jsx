import { useEffect, useRef, useState } from 'react';
import { EngineHost } from '../engine/host.js';
import { makeObject } from '../engine/objectBuilder.js';
import { ProceduralRhythm } from '../audio/procedural.js';
import { createFeatures } from '../audio/features.js';
import { PRESET_LIST, MATERIALS, cloneMapping } from '../engine/presets.js';
import { PALETTES } from '../engine/palettes.js';
import { useStore, appStore, app } from '../store.js';
import { Close } from './ui.jsx';

const lookOf = (p) => ({ preset: p.id, material: p.material, palette: p.palette, background: p.bg, particles: 'auto', camera: 'auto', intensity: 1, mapping: cloneMapping(p.mapping), keyframes: [], size: 1, offsetY: 0, reduceMotion: false });
const POSTER = [270, 480];

/**
 * DISCOVER — one shared engine renders a poster for every preset (once), then plays live inside whichever tile
 * you hover or tap.  One WebGL context instead of eight.
 */
export function Discover() {
  const screen = useStore(appStore, (s) => s.screen);
  const [posters, setPosters] = useState({});
  const [active, setActive] = useState(null);
  const [ready, setReady] = useState(false);
  const hostRef = useRef(null), rhythmRef = useRef(null), mediaRefs = useRef({}), parkRef = useRef(null), readyRef = useRef(false);
  const close = () => appStore.set({ overlay: null });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let dead = false, host;
    const park = parkRef.current;
    (async () => {
      try {
        const rhythm = new ProceduralRhythm({ bpm: 118 });
        rhythmRef.current = rhythm;
        host = new EngineHost(park, { quality: 'performance', config: lookOf(PRESET_LIST[0]), autoScale: false, source: null });
        host.pause();
        hostRef.current = host;
        const eng = host.engine;
        const obj = await makeObject({ kind: 'text', text: 'REACT', font: 'display', weight: 800, spacing: 0.01, lineHeight: 1, align: 'center' }, POSTER[0] / POSTER[1]);
        if (dead) return;
        eng.setFixedSize(POSTER[0], POSTER[1]);
        eng.setObject(obj);
        const f = createFeatures();
        const out = {};
        for (const p of PRESET_LIST) {
          if (dead) return;
          eng.setConfig(lookOf(p));
          eng.driver.reset();
          rhythm.t = 0; rhythm.seek(9.55);   // just before the drop, so the poster catches the hit
          for (let i = 0; i < 46; i++) eng.frame(1 / 30, rhythm.sample(1 / 30, f));
          out[p.id] = eng.canvas.toDataURL('image/jpeg', 0.86);
          setPosters({ ...out });
          await new Promise((r) => setTimeout(r, 16));
        }
        eng.setFixedSize(null);
        readyRef.current = true;
        setReady(true);
        host.source = (dt) => rhythm.sample(dt);
      } catch (e) { console.error('[discover]', e); }
    })();
    return () => { dead = true; if (host) host.dispose(); hostRef.current = null; };
  }, []);

  // move the live canvas into the active tile
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;
    if (!active) { host.pause(); if (parkRef.current) parkRef.current.appendChild(host.canvas); return; }
    const p = PRESET_LIST.find((x) => x.id === active);
    const tile = mediaRefs.current[active];
    if (!tile) return;
    tile.appendChild(host.canvas);
    host.engine.setConfig(lookOf(p));
    host.engine.driver.reset();
    rhythmRef.current.t = 0; rhythmRef.current.seek(8.4);
    host.canvas.classList.add('live');
    host.resume();
    host.resize();
  }, [active, ready]);

  const use = (p) => {
    app.usePreset(p.id);
    if (screen === 'landing') app.go('studio', { after: () => appStore.set({ panel: matchMedia('(max-width: 760px)').matches ? null : 'audio' }) });
    else { appStore.set({ overlay: null }); app.toast(`${p.name} applied`); }
  };

  return (
    <div className="discover" role="dialog" aria-modal="true" aria-label="Discover styles">
      <header className="dc-head">
        <div>
          <h2>DISCOVER</h2>
          <p>Eight ways for sound to move a word. Hover or tap a style to see it react.</p>
        </div>
        <button type="button" className="icon" aria-label="Close" onClick={close} autoFocus><Close /></button>
      </header>
      <div className="dc-grid">
        {PRESET_LIST.map((p) => (
          <article key={p.id} className={`dc-card ${active === p.id ? 'on' : ''}`}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActive(p.id); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
            onFocus={() => setActive(p.id)}
            onClick={(e) => { if (!e.target.closest('button')) setActive(active === p.id ? null : p.id); }}>
            <div className="dc-media" ref={(el) => { mediaRefs.current[p.id] = el; }}
              style={{ '--pa': `rgb(${PALETTES[p.palette].c0.map((v) => Math.round(v * 255)).join(',')})` }}>
              {posters[p.id] ? <img src={posters[p.id]} alt="" /> : <span className="dc-wait" />}
            </div>
            <div className="dc-meta">
              <h3>{p.name}</h3>
              <p>{p.blurb}</p>
              <small><span>{MATERIALS[p.material].name}</span><span>{PALETTES[p.palette].name}</span></small>
              <button type="button" className="btn primary" onClick={() => use(p)} onFocus={() => setActive(p.id)}>USE THIS STYLE</button>
            </div>
          </article>
        ))}
      </div>
      <div className="park" ref={parkRef} aria-hidden="true" />
    </div>
  );
}
