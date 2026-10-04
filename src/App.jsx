import { useEffect } from 'react';
import { useStore, appStore } from './store.js';
import { PALETTES, resolvePalette } from './engine/palettes.js';
import { Landing } from './components/Landing.jsx';
import Studio from './components/Studio.jsx';
import { Rendering } from './components/Rendering.jsx';
import { Result } from './components/Result.jsx';
import { Discover } from './components/Discover.jsx';
import { About } from './components/About.jsx';

export default function App() {
  const screen = useStore(appStore, (s) => s.screen);
  const overlay = useStore(appStore, (s) => s.overlay);
  const transition = useStore(appStore, (s) => s.transition);
  const toast = useStore(appStore, (s) => s.toast);
  const entered = useStore(appStore, (s) => s.studioEntered);
  const palette = useStore(appStore, (s) => s.palette);
  const customColors = useStore(appStore, (s) => s.customColors);
  const reduce = useStore(appStore, (s) => s.reduceMotion);

  // the interface takes its accent from the palette you chose
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', resolvePalette(palette, customColors).accent);
  }, [palette, customColors]);
  useEffect(() => { document.documentElement.dataset.reduce = reduce ? '1' : '0'; }, [reduce]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => appStore.set({ reduceMotion: mq.matches });
    mq.addEventListener && mq.addEventListener('change', on);
    return () => mq.removeEventListener && mq.removeEventListener('change', on);
  }, []);

  return (
    <div className="app" data-screen={screen}>
      {screen === 'landing' && <Landing />}
      {entered && <Studio active={screen === 'studio' || screen === 'rendering'} />}
      {screen === 'rendering' && <Rendering />}
      {screen === 'result' && <Result />}
      {overlay === 'discover' && <Discover />}
      {overlay === 'about' && <About />}
      <div className={`wipe ${transition || ''}`} aria-hidden="true" />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
      <button type="button" className="creator-badge" onClick={() => appStore.set({ overlay: 'about' })} aria-label="About Creator Teja Priyan">
        <img src="favicon.png" alt="" />
        <span>BY TEJA PRIYAN</span>
      </button>
    </div>
  );
}
