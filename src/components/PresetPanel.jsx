import { useStore, appStore, app } from '../store.js';
import { PRESET_LIST, PRESETS, PARTICLE_BEHAVIORS, CAMERA_MODES } from '../engine/presets.js';
import { Choice, Section, Slider } from './ui.jsx';

export function PresetPanel() {
  const preset = useStore(appStore, (s) => s.preset);
  const particles = useStore(appStore, (s) => s.particles);
  const camera = useStore(appStore, (s) => s.camera);
  const intensity = useStore(appStore, (s) => s.intensity);
  const particleReactivity = useStore(appStore, (s) => s.particleReactivity ?? 1.0);
  return (
    <>
      <Section title="PRESET">
        <div className="grid2" role="radiogroup" aria-label="Preset">
          {PRESET_LIST.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} className={`tile ${preset === p.id ? 'on' : ''}`} onClick={() => app.setPreset(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        <p className="help">{PRESETS[preset].blurb}</p>
        <Slider label="INTENSITY" value={intensity} min={0} max={2} step={0.01} onChange={(v) => appStore.set({ intensity: v })} format={(v) => `${Math.round(v * 100)}%`} />
      </Section>
      <Section title="PARTICLES">
        <Choice label="Particle behavior" className="wrap" options={PARTICLE_BEHAVIORS} value={particles} onChange={(v) => appStore.set({ particles: v })} />
        <Slider label="REACTIVITY" value={particleReactivity} min={0} max={2} step={0.05} onChange={(v) => appStore.set({ particleReactivity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <p className="help">Controls how dynamically particles burst, pulse, and swirl with the music.</p>
      </Section>
      <Section title="CAMERA">
        <Choice label="Camera" className="wrap" options={CAMERA_MODES} value={camera} onChange={(v) => appStore.set({ camera: v })} />
      </Section>
    </>
  );
}
