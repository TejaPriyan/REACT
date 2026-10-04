// Tiny external store (zustand-like). Low-frequency UI/config state lives here;
// anything that changes every frame (audio features, springs, particles) stays inside the engine.

import { useSyncExternalStore } from 'react';
import { PRESETS, CURATED, cloneMapping, SOURCES, TARGETS } from './engine/presets.js';
import { FONTS, loadFontFile, registerCustomFont } from './engine/sampler.js';

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      subs.forEach((f) => f(state));
    },
    sub(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.sub, () => selector(store.get()), () => selector(store.get()));
}

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const appStore = createStore({
  screen: 'landing',            // landing | studio | rendering | result
  overlay: null,                // 'discover' | null
  cinema: false,
  panel: null,                  // audio | object | motion | style | keys | route | export
  transition: null,             // 'in' while the cinematic wipe runs
  object: {
    kind: 'text', text: '', overlayText: '', textPos: 'bottom', font: 'display', weight: 800, size: 1, spacing: 0, lineHeight: 0.95, align: 'center',
    fileUrl: null, fileName: '', fileType: '',
  },
  textBrightness: 0.85,
  glow: 0.85,
  particleReactivity: 1.0,
  customColors: { c0: '#00e5ff', c1: '#ff007f', c2: '#7928ca', bg: '#04040a' },
  customFonts: [],
  preset: 'impact', material: 'chrome', palette: 'mono', background: 'studio',
  particles: 'auto', camera: 'auto', intensity: 1,
  mapping: cloneMapping(PRESETS.impact.mapping),
  keyframes: [],
  frame: '9:16',                // composition aspect: 9:16 | 16:9 | 1:1
  quality: 'balanced', qualityAuto: true,
  reduceMotion,
  signature: true,
  exportOpts: { format: 'video', duration: 15, quality: 'standard', startFrom: 'best' },
  render: { stage: -1, progress: 0, note: '' },   // cinematic render screen
  studioEntered: false,
  result: null,                 // { url, blob, type, ext, w, h, duration, kind, filename, size }
  toast: '',
});

export const app = {
  get: appStore.get,
  set: appStore.set,
  setPreset(id) {
    if (!PRESETS[id]) return;
    appStore.set({ preset: id, mapping: cloneMapping(PRESETS[id].mapping), particles: 'auto', camera: 'auto' });
  },
  usePreset(id, extra = {}) {
    // "USE THIS STYLE" from DISCOVER: preset + its signature look
    const p = PRESETS[id];
    appStore.set({ preset: id, mapping: cloneMapping(p.mapping), particles: 'auto', camera: 'auto', material: p.material, palette: p.palette, background: p.bg, ...extra });
  },
  setMapping(list) { appStore.set({ mapping: list }); },
  toggleMapping(src, dst) {
    const cur = appStore.get().mapping;
    const exists = cur.find((m) => m.src === src && m.dst === dst);
    appStore.set({ mapping: exists ? cur.filter((m) => m !== exists) : [...cur, { src, dst, amt: 1 }] });
  },
  setMappingAmount(src, dst, amt) {
    appStore.set({ mapping: appStore.get().mapping.map((m) => (m.src === src && m.dst === dst ? { ...m, amt } : m)) });
  },
  setObject(patch) { appStore.set({ object: { ...appStore.get().object, ...patch } }); },
  /** Cinematic wipe between screens: bars close, the screen swaps underneath, bars open. */
  go(screen, { overlay = null, after } = {}) {
    if (appStore.get().transition) return;
    appStore.set({ transition: 'close' });
    setTimeout(() => {
      const patch = { screen, overlay, transition: 'open' };
      if (screen === 'studio') patch.studioEntered = true;
      appStore.set(patch);
      if (after) after();
      setTimeout(() => appStore.set({ transition: null }), 620);
    }, 460);
  },
  toast(msg, ms = 2600) {
    appStore.set({ toast: msg });
    clearTimeout(app._t);
    app._t = setTimeout(() => appStore.set({ toast: '' }), ms);
  },

  /** ✦ SURPRISE ME — curated combinations only, so it always looks designed. */
  surprise() {
    const s = appStore.get();
    const pool = CURATED.filter((c) => !(c.preset === s.preset && c.material === s.material && c.palette === s.palette));
    const c = pool[(Math.random() * pool.length) | 0];
    const mapping = cloneMapping(PRESETS[c.preset].mapping);
    // sometimes re-route one source so the *behaviour* changes too (e.g. BASS → CAMERA instead of BASS → SCALE)
    if (Math.random() < 0.5) {
      const m = mapping.find((x) => x.src === 'bass') || mapping[0];
      const alt = ['scale', 'camera', 'distortion', 'glow'].filter((t) => t !== m.dst);
      m.dst = alt[(Math.random() * alt.length) | 0];
    }
    const patch = {
      preset: c.preset, material: c.material, palette: c.palette, background: c.bg,
      particles: Math.random() < 0.35 ? 'auto' : c.particles, camera: c.camera, mapping,
      intensity: 0.9 + Math.random() * 0.35,
    };
    if (s.object.kind === 'text') {
      const fonts = ['display', 'condensed', 'wide', 'grotesk', 'serif'];
      const font = fonts[(Math.random() * fonts.length) | 0];
      const weights = { display: [700, 800], condensed: [400], wide: [500, 800], grotesk: [500, 700], serif: [700, 900], mono: [500] }[font];
      patch.object = { ...s.object, font, weight: weights[(Math.random() * weights.length) | 0], spacing: [0, 0, 0.04, 0.1, 0.18][(Math.random() * 5) | 0] };
    }
    appStore.set(patch);
  },

  /** NEW VISUAL — a clean slate (sound and object cleared, look kept). */
  newVisual(audioApi) {
    if (audioApi) audioApi.clear();
    appStore.set({ object: { kind: 'text', text: '', overlayText: '', textPos: 'bottom', font: 'display', weight: 800, size: 1, spacing: 0, lineHeight: 0.95, align: 'center', fileUrl: null, fileName: '', fileType: '' }, keyframes: [], panel: 'audio' });
  },

  /** REMIX — keep audio + asset, change preset / material / reaction / camera / particles. */
  remix() {
    const s = appStore.get();
    const pool = CURATED.filter((c) => c.preset !== s.preset || c.material !== s.material);
    const c = pool[(Math.random() * pool.length) | 0];
    appStore.set({
      preset: c.preset, material: c.material, background: c.bg, particles: c.particles, camera: c.camera,
      mapping: cloneMapping(PRESETS[c.preset].mapping),
    });
  },
};

export { SOURCES, TARGETS, FONTS, loadFontFile, registerCustomFont };
