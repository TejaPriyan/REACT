import { useState } from 'react';
import { useStore, appStore } from '../store.js';
import { useAudio } from '../hooks/useAudio.js';
import { KEY_PROPS, KEY_PROP_MAP, makeKey } from '../engine/animation.js';
import { formatTime } from '../utils/audio.js';
import { Choice, Section, Slider, Trash } from './ui.jsx';

export function KeyframePanel() {
  const keys = useStore(appStore, (s) => s.keyframes);
  const { loaded, audio } = useAudio();
  const [prop, setProp] = useState('scale');
  const def = KEY_PROP_MAP[prop];
  const [vals, setVals] = useState({});
  const val = vals[prop] ?? def.neutral;
  const add = () => {
    const t = Math.round(audio.position * 100) / 100;
    const rest = keys.filter((k) => !(k.prop === prop && Math.abs(k.t - t) < 0.05));
    appStore.set({ keyframes: [...rest, makeKey(prop, t, val)] });
  };
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  return (
    <Section title="KEYFRAMES" aside={keys.length ? `${keys.length}` : null}>
      <Choice label="Keyframe property" className="wrap" value={prop} options={KEY_PROPS.map((p) => ({ id: p.id, label: p.label }))} onChange={setProp} />
      <Slider label="VALUE" value={val} min={def.min} max={def.max} step={def.step} onChange={(v) => setVals({ ...vals, [prop]: v })}
        format={(v) => `${def.step >= 1 ? Math.round(v) : v.toFixed(2)}${def.unit}`} />
      <button type="button" className="btn ghost wide" disabled={!loaded} onClick={add}>ADD KEY AT {formatTime(audio.position)}</button>
      {!loaded && <p className="help">Load a sound to place keyframes on its timeline.</p>}
      {sorted.length > 0 && (
        <ul className="keys">
          {sorted.map((k) => (
            <li key={k.id}>
              <button type="button" className="keygo" onClick={() => { audio.seek(k.t); setProp(k.prop); setVals({ ...vals, [k.prop]: k.v }); }}>
                <span>{formatTime(k.t)}</span><b>{KEY_PROP_MAP[k.prop].label}</b><em>{KEY_PROP_MAP[k.prop].step >= 1 ? Math.round(k.v) : k.v.toFixed(2)}{KEY_PROP_MAP[k.prop].unit}</em>
              </button>
              <button type="button" className="icon sm" aria-label="Delete keyframe" onClick={() => appStore.set({ keyframes: keys.filter((x) => x.id !== k.id) })}><Trash size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > 0 && <button type="button" className="link" onClick={() => appStore.set({ keyframes: [] })}>CLEAR ALL</button>}
    </Section>
  );
}
