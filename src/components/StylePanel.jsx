import { useStore, appStore } from '../store.js';
import { usePerformance } from '../hooks/usePerformance.js';
import { FRAMES } from '../utils/frames.js';
import { MaterialPanel } from './MaterialPanel.jsx';
import { Choice, Section, Switch, Slider } from './ui.jsx';

export function StylePanel() {
  const frame = useStore(appStore, (s) => s.frame);
  const reduce = useStore(appStore, (s) => s.reduceMotion);
  const signature = useStore(appStore, (s) => s.signature);
  const textBrightness = useStore(appStore, (s) => s.textBrightness ?? 0.85);
  const glow = useStore(appStore, (s) => s.glow ?? 0.85);
  const perf = usePerformance();
  const q = Object.entries(perf.levels).map(([id, l]) => ({ id, label: l.label }));
  return (
    <>
      <MaterialPanel />
      <Section title="LIGHTING & GLOW">
        <Slider label="TEXT BRIGHTNESS" value={textBrightness} min={0.2} max={1.8} step={0.05} onChange={(v) => appStore.set({ textBrightness: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="GLOW & BLOOM" value={glow} min={0.0} max={2.0} step={0.05} onChange={(v) => appStore.set({ glow: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <p className="help">Tune text lighting and bloom for crisp legibility or dramatic glow.</p>
      </Section>
      <Section title="FRAME">
        <Choice label="Frame ratio" options={FRAMES} value={frame} onChange={(v) => appStore.set({ frame: v })} />
        <p className="help">The frame is what you export. 9:16 for Reels, TikTok and Shorts.</p>
      </Section>
      <Section title="PERFORMANCE" aside={perf.auto ? 'AUTO' : null}>
        <Choice label="Render quality" className="wrap" options={q} value={perf.quality} onChange={perf.set} />
        <p className="help">Resolution adapts on its own if the frame rate drops.</p>
      </Section>
      <Section title="OPTIONS">
        <Switch label="CALM MOTION" hint="Gentler camera and impacts" checked={reduce} onChange={(v) => appStore.set({ reduceMotion: v })} />
        <Switch label="MADE WITH REACT" hint="Sign-off at the end of recordings and Cinema" checked={signature} onChange={(v) => appStore.set({ signature: v })} />
      </Section>
    </>
  );
}
