// Curated palettes — no colour pickers, only combinations that always look designed.
// Colours are linear-ish floats fed straight to the shaders; `accent` drives the UI chrome.

export const hex = (h) => {
  const n = parseInt((h || '#ffffff').replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const PALETTES = {
  mono: {
    id: 'mono', name: 'MONO', accent: '#f4f4f2',
    bg: hex('#040404'), c0: hex('#ffffff'), c1: hex('#b9b9b9'), c2: hex('#6e6e72'),
    envLow: hex('#050506'), envHigh: hex('#dfe3ea'), bloom: 0.9, grade: 0.0,
  },
  electric: {
    id: 'electric', name: 'ELECTRIC', accent: '#c8ff2e',
    bg: hex('#03040a'), c0: hex('#c8ff2e'), c1: hex('#f5f7ff'), c2: hex('#3557ff'),
    envLow: hex('#02030c'), envHigh: hex('#a9c0ff'), bloom: 1.15, grade: 0.15,
  },
  cosmic: {
    id: 'cosmic', name: 'COSMIC', accent: '#8f7bff',
    bg: hex('#04030c'), c0: hex('#8a6bff'), c1: hex('#ff5fd0'), c2: hex('#3fd2ff'),
    envLow: hex('#05030f'), envHigh: hex('#c7a8ff'), bloom: 1.25, grade: 0.2,
  },
  sunset: {
    id: 'sunset', name: 'SUNSET', accent: '#ff7a45',
    bg: hex('#0a0405'), c0: hex('#ff5a36'), c1: hex('#ffc069'), c2: hex('#ff2e7a'),
    envLow: hex('#0c0504'), envHigh: hex('#ffd3a0'), bloom: 1.1, grade: 0.2,
  },
  ice: {
    id: 'ice', name: 'ICE', accent: '#9fe6ff',
    bg: hex('#03080c'), c0: hex('#9fe6ff'), c1: hex('#effcff'), c2: hex('#4d8dff'),
    envLow: hex('#03080d'), envHigh: hex('#d7f3ff'), bloom: 0.95, grade: 0.05,
  },
  void: {
    id: 'void', name: 'VOID', accent: '#8b8ba0',
    bg: hex('#000000'), c0: hex('#8c8ca6'), c1: hex('#d6d6e6'), c2: hex('#3b3b4c'),
    envLow: hex('#000000'), envHigh: hex('#7a7a92'), bloom: 0.65, grade: 0.0,
  },
};

export function resolvePalette(id, customColors) {
  if (id === 'custom' && customColors) {
    const c0 = hex(customColors.c0 || '#00e5ff');
    const c1 = hex(customColors.c1 || '#ff007f');
    const c2 = hex(customColors.c2 || '#7928ca');
    const bg = hex(customColors.bg || '#04040a');
    return {
      id: 'custom', name: 'CUSTOM', accent: customColors.c0 || '#00e5ff',
      bg, c0, c1, c2,
      envLow: hex('#040408'), envHigh: hex('#d6d6f0'), bloom: 1.1, grade: 0.1,
    };
  }
  return PALETTES[id] || PALETTES.electric;
}

export const PALETTE_LIST = Object.values(PALETTES);
export const PALETTE_IDS = Object.keys(PALETTES);
