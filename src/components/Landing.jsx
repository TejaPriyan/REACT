import { useEffect, useRef, useState } from 'react';
import { EngineHost } from '../engine/host.js';
import { makeObject } from '../engine/objectBuilder.js';
import { ProceduralRhythm } from '../audio/procedural.js';
import { useInteraction } from '../hooks/useInteraction.js';
import { detectQuality } from '../utils/performance.js';
import { useStore, appStore, app } from '../store.js';
import { audio } from '../audio/audioState.js';

const LOOK = { preset: 'impact', material: 'chrome', palette: 'mono', background: 'void', particles: 'auto', camera: 'auto', intensity: 1.05, size: 1, offsetY: 0.13 };

export function Landing() {
  const root = useRef(null), stage = useRef(null), engRef = useRef(null), hostRef = useRef(null);
  const [gl, setGl] = useState(true);
  const overlay = useStore(appStore, (s) => s.overlay);
  const reduce = useStore(appStore, (s) => s.reduceMotion);

  useEffect(() => {
    let host, dead = false;
    try {
      const rhythm = new ProceduralRhythm({ bpm: 118 });
      rhythm.seek(6.4);
      host = new EngineHost(stage.current, { quality: 'balanced', config: { ...LOOK, reduceMotion: appStore.get().reduceMotion }, source: (dt) => rhythm.sample(dt) });
      host.engine.setQuality(detectQuality(host.engine.caps));
      hostRef.current = host; engRef.current = host.engine;
      window.__landing = host;
      (async () => {
        const r = stage.current.getBoundingClientRect();
        const obj = await makeObject({ kind: 'text', text: 'REACT', font: 'display', weight: 800, spacing: 0.01, lineHeight: 1, align: 'center' }, r.width / r.height);
        if (!dead && obj) host.engine.setObject(obj);
      })();
    } catch (e) {
      console.error('[landing] WebGL unavailable', e);
      setGl(false);
    }
    return () => { dead = true; if (host) host.dispose(); hostRef.current = null; engRef.current = null; };
  }, []);

  useEffect(() => { if (hostRef.current) hostRef.current.engine.setConfig({ reduceMotion: reduce }); }, [reduce]);
  useEffect(() => { const h = hostRef.current; if (h) (overlay ? h.pause() : h.resume()); }, [overlay]);
  useInteraction(root, engRef, { global: true });

  const create = () => {
    const eng = engRef.current;
    if (eng) {
      eng.camera.whip(1);
      eng.pointer.active = true; eng.pointer.x = 0; eng.pointer.y = 0.12;
      eng.pointer.clicks.push(performance.now());
    }
    app.go('studio', { after: () => { if (!audio.loaded && !matchMedia('(max-width: 760px)').matches) appStore.set({ panel: 'audio' }); } });
  };

  return (
    <main className="landing" ref={root}>
      <div className="landing-stage" ref={stage} />
      {!gl && <div className="landing-fallback" aria-hidden="true">REACT</div>}
      <header className="ln-top" data-ui>
        <span className="mark"><i />REACT</span>
        <nav aria-label="Main" style={{ display: 'flex', gap: '16px' }}>
          <button type="button" className="link" onClick={() => appStore.set({ overlay: 'about' })}>ABOUT</button>
          <button type="button" className="link" onClick={() => appStore.set({ overlay: 'discover' })}>DISCOVER</button>
        </nav>
      </header>
      <h1 className="sr">REACT — MAKE SOUND VISIBLE.</h1>
      <section className="ln-hero" data-ui>
        <p className="tagline">MAKE SOUND VISIBLE.</p>
        <div className="ln-cta">
          <button type="button" className="btn primary big" onClick={create}>CREATE VISUAL</button>
          <button type="button" className="btn ghost big" onClick={() => appStore.set({ overlay: 'discover' })}>EXPLORE</button>
        </div>
      </section>
      <footer className="ln-foot" data-ui>
        <span>YOUR MEDIA STAYS IN YOUR BROWSER.</span>
        <span className="hint">The title is reacting to a built-in rhythm. Move, click or drag across it.</span>
      </footer>
    </main>
  );
}
