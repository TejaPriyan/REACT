// Manual keyframes — deliberately tiny. A property either has keyframes (smooth interpolation
// between them, held at the ends) or it is neutral. Values ride *on top of* the audio-driven motion.

export const KEY_PROPS = [
  { id: 'scale', label: 'SCALE', min: 0.2, max: 2.5, neutral: 1, step: 0.01, unit: '×' },
  { id: 'rotation', label: 'ROTATE', min: -180, max: 180, neutral: 0, step: 1, unit: '°' },
  { id: 'position', label: 'POSITION', min: -1, max: 1, neutral: 0, step: 0.01, unit: '' },
  { id: 'opacity', label: 'OPACITY', min: 0, max: 1, neutral: 1, step: 0.01, unit: '' },
  { id: 'camera', label: 'CAMERA', min: -1, max: 1, neutral: 0, step: 0.01, unit: '' },
  { id: 'distortion', label: 'DISTORT', min: 0, max: 1, neutral: 0, step: 0.01, unit: '' },
  { id: 'particles', label: 'PARTICLES', min: 0, max: 2, neutral: 1, step: 0.01, unit: '×' },
];

export const KEY_PROP_MAP = Object.fromEntries(KEY_PROPS.map((p) => [p.id, p]));

const ease = (t) => t * t * (3 - 2 * t);

export function sampleKeyframes(keys, time, out) {
  for (const p of KEY_PROPS) out[p.id] = p.neutral;
  if (!keys || !keys.length) return out;
  const byProp = {};
  for (const k of keys) (byProp[k.prop] || (byProp[k.prop] = [])).push(k);
  for (const id in byProp) {
    const list = byProp[id].sort((a, b) => a.t - b.t);
    if (time <= list[0].t) { out[id] = list[0].v; continue; }
    const last = list[list.length - 1];
    if (time >= last.t) { out[id] = last.v; continue; }
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (time >= a.t && time <= b.t) {
        out[id] = a.v + (b.v - a.v) * ease((time - a.t) / Math.max(1e-6, b.t - a.t));
        break;
      }
    }
  }
  return out;
}

let keyId = 1;
export function makeKey(prop, t, v) { return { id: `k${Date.now().toString(36)}${keyId++}`, prop, t, v }; }
