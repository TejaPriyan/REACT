import { useStore, appStore } from '../store.js';
import { MATERIAL_LIST, MATERIALS, BACKGROUNDS } from '../engine/presets.js';
import { PALETTES } from '../engine/palettes.js';
import { Choice, Section } from './ui.jsx';

const css = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

export function MaterialPanel() {
  const material = useStore(appStore, (s) => s.material);
  const palette = useStore(appStore, (s) => s.palette);
  const customColors = useStore(appStore, (s) => s.customColors) || { c0: '#00e5ff', c1: '#ff007f', c2: '#7928ca', bg: '#04040a' };
  const background = useStore(appStore, (s) => s.background);

  const updateColor = (key, val) => {
    appStore.set({ customColors: { ...customColors, [key]: val } });
  };

  return (
    <>
      <Section title="MATERIAL">
        <div className="grid2" role="radiogroup" aria-label="Material">
          {MATERIAL_LIST.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={material === m.id} className={`tile mat ${material === m.id ? 'on' : ''}`} onClick={() => appStore.set({ material: m.id })}>
              <i className="mat-chip" data-m={m.id} /> {m.name}
            </button>
          ))}
        </div>
        <p className="help">{MATERIALS[material].hint}</p>
      </Section>
      <Section title="PALETTE">
        <div className="swatches" role="radiogroup" aria-label="Palette">
          {Object.values(PALETTES).map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={palette === p.id} className={`swatch ${palette === p.id ? 'on' : ''}`} onClick={() => appStore.set({ palette: p.id })}>
              <i style={{ background: `linear-gradient(135deg, ${css(p.c0)}, ${css(p.c1)} 55%, ${css(p.c2)})` }} />
              <span>{p.name}</span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={palette === 'custom'} className={`swatch ${palette === 'custom' ? 'on' : ''}`} onClick={() => appStore.set({ palette: 'custom' })}>
            <i style={{ background: `linear-gradient(135deg, ${customColors.c0}, ${customColors.c1} 55%, ${customColors.c2})` }} />
            <span>CUSTOM</span>
          </button>
        </div>
        {palette === 'custom' && (
          <div className="custom-palette-row">
            <div className="cp-item">
              <label>PRIMARY</label>
              <div className="cp-input-wrap">
                <input type="color" value={customColors.c0} onChange={(e) => updateColor('c0', e.target.value)} />
                <span>{customColors.c0.toUpperCase()}</span>
              </div>
            </div>
            <div className="cp-item">
              <label>SECONDARY</label>
              <div className="cp-input-wrap">
                <input type="color" value={customColors.c1} onChange={(e) => updateColor('c1', e.target.value)} />
                <span>{customColors.c1.toUpperCase()}</span>
              </div>
            </div>
            <div className="cp-item">
              <label>ACCENT</label>
              <div className="cp-input-wrap">
                <input type="color" value={customColors.c2} onChange={(e) => updateColor('c2', e.target.value)} />
                <span>{customColors.c2.toUpperCase()}</span>
              </div>
            </div>
            <div className="cp-item">
              <label>BACKGROUND</label>
              <div className="cp-input-wrap">
                <input type="color" value={customColors.bg} onChange={(e) => updateColor('bg', e.target.value)} />
                <span>{customColors.bg.toUpperCase()}</span>
              </div>
            </div>
          </div>
        )}
      </Section>
      <Section title="BACKGROUND">
        <Choice label="Background" className="wrap" options={BACKGROUNDS} value={background} onChange={(v) => appStore.set({ background: v })} />
      </Section>
    </>
  );
}
