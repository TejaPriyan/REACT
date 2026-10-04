// Reaction presets + mapping vocabulary. Presets are *data*; their motion lives in /effects.

export const SOURCES = [
  { id: 'bass', label: 'BASS', hint: 'kick & sub' },
  { id: 'mid', label: 'MID', hint: 'voice & instruments' },
  { id: 'high', label: 'HIGH', hint: 'hats & air' },
  { id: 'energy', label: 'ENERGY', hint: 'overall loudness' },
  { id: 'beat', label: 'BEAT', hint: 'transients' },
];

export const TARGETS = [
  { id: 'scale', label: 'SCALE' },
  { id: 'rotation', label: 'ROTATION' },
  { id: 'position', label: 'DISPLACE' },
  { id: 'distortion', label: 'DISTORT' },
  { id: 'camera', label: 'CAMERA' },
  { id: 'particles', label: 'PARTICLES' },
  { id: 'glow', label: 'GLOW' },
  { id: 'impact', label: 'IMPACT' },
];

const m = (src, dst, amt = 1) => ({ src, dst, amt });

export const PRESETS = {
  pulse: {
    id: 'pulse', name: 'PULSE', blurb: 'Bass drives scale. The object breathes with every kick.',
    camera: 'float', particles: 'orbit', material: 'chrome', palette: 'electric', bg: 'void',
    mapping: [m('bass', 'scale', 1), m('mid', 'rotation', 0.5), m('high', 'particles', 0.6), m('energy', 'glow', 0.7), m('beat', 'impact', 0.8)],
  },
  explode: {
    id: 'explode', name: 'EXPLODE', blurb: 'Every strong beat throws a burst of particles off the letters.',
    camera: 'push', particles: 'explode', material: 'neon', palette: 'sunset', bg: 'smoke',
    mapping: [m('bass', 'scale', 0.5), m('mid', 'distortion', 0.3), m('high', 'particles', 1), m('energy', 'glow', 0.8), m('beat', 'impact', 1)],
  },
  flow: {
    id: 'flow', name: 'FLOW', blurb: 'Sound bends the composition like liquid. Continuous, never still.',
    camera: 'float', particles: 'flow', material: 'liquid', palette: 'cosmic', bg: 'aurora',
    mapping: [m('bass', 'distortion', 1), m('mid', 'rotation', 0.5), m('high', 'particles', 0.6), m('energy', 'camera', 0.6), m('beat', 'impact', 0.4)],
  },
  shatter: {
    id: 'shatter', name: 'SHATTER', blurb: 'Hits break the object into shards. Between beats it rebuilds itself.',
    camera: 'push', particles: 'explode', material: 'glass', palette: 'ice', bg: 'studio',
    mapping: [m('bass', 'scale', 0.5), m('mid', 'rotation', 0.3), m('high', 'particles', 0.7), m('energy', 'glow', 0.6), m('beat', 'impact', 1)],
  },
  orbit: {
    id: 'orbit', name: 'ORBIT', blurb: 'Audio sets the orbital speed of a swarm circling the object.',
    camera: 'orbit', particles: 'orbit', material: 'chrome', palette: 'cosmic', bg: 'void',
    mapping: [m('bass', 'scale', 0.4), m('mid', 'rotation', 0.8), m('high', 'particles', 0.8), m('energy', 'particles', 0.7), m('beat', 'impact', 0.6)],
  },
  glitch: {
    id: 'glitch', name: 'GLITCH', blurb: 'Highs tear the signal apart. Beats fire digital glitch bursts.',
    camera: 'handheld', particles: 'form', material: 'pixel', palette: 'electric', bg: 'grid',
    mapping: [m('bass', 'scale', 0.4), m('mid', 'position', 0.4), m('high', 'distortion', 1), m('energy', 'glow', 0.6), m('beat', 'impact', 1)],
  },
  breath: {
    id: 'breath', name: 'BREATH', blurb: 'The whole scene inhales and exhales with the energy of the track. Slow, cinematic.',
    camera: 'float', particles: 'flow', material: 'organic', palette: 'sunset', bg: 'aurora',
    mapping: [m('energy', 'scale', 1), m('energy', 'glow', 0.9), m('bass', 'camera', 0.5), m('mid', 'distortion', 0.3), m('beat', 'impact', 0.2)],
  },
  impact: {
    id: 'impact', name: 'IMPACT', blurb: 'Only real transients hit: shake, punch, blur, particles and a burst of light.',
    camera: 'push', particles: 'explode', material: 'chrome', palette: 'mono', bg: 'studio',
    mapping: [m('bass', 'camera', 0.8), m('mid', 'rotation', 0.2), m('high', 'particles', 0.5), m('energy', 'glow', 0.7), m('beat', 'impact', 1)],
  },
};

export const PRESET_LIST = Object.values(PRESETS);
export const PRESET_IDS = Object.keys(PRESETS);

export const PARTICLE_BEHAVIORS = [
  { id: 'auto', label: 'AUTO' },
  { id: 'explode', label: 'EXPLODE' },
  { id: 'orbit', label: 'ORBIT' },
  { id: 'attract', label: 'ATTRACT' },
  { id: 'repel', label: 'REPEL' },
  { id: 'flow', label: 'FLOW' },
  { id: 'form', label: 'FORM TEXT' },
  { id: 'dissolve', label: 'DISSOLVE' },
];

export const CAMERA_MODES = [
  { id: 'auto', label: 'AUTO' },
  { id: 'float', label: 'FLOAT' },
  { id: 'push', label: 'PUSH' },
  { id: 'orbit', label: 'ORBIT' },
  { id: 'handheld', label: 'HANDHELD' },
  { id: 'static', label: 'STATIC' },
];

export const BACKGROUNDS = [
  { id: 'void', label: 'VOID', index: 0 },
  { id: 'aurora', label: 'AURORA', index: 1 },
  { id: 'grid', label: 'GRID', index: 2 },
  { id: 'studio', label: 'STUDIO', index: 3 },
  { id: 'smoke', label: 'SMOKE', index: 4 },
];

export const MATERIALS = {
  chrome:   { id: 'chrome',   name: 'CHROME',   index: 0, bevel: 1.15, bump: 4.2, hint: 'Liquid metal, studio reflections' },
  glass:    { id: 'glass',    name: 'GLASS',    index: 1, bevel: 1.5,  bump: 4.6, hint: 'Refraction with dispersion' },
  liquid:   { id: 'liquid',   name: 'LIQUID',   index: 2, bevel: 1.3,  bump: 4.0, hint: 'Mercury that flows with the sound' },
  particle: { id: 'particle', name: 'PARTICLE', index: 3, bevel: 1.1,  bump: 3.0, hint: 'Built from thousands of particles' },
  neon:     { id: 'neon',     name: 'NEON',     index: 4, bevel: 1.0,  bump: 3.0, hint: 'Glowing tube edges' },
  paper:    { id: 'paper',    name: 'PAPER',    index: 5, bevel: 0.9,  bump: 2.0, hint: 'Layered cut paper, flat graphic' },
  pixel:    { id: 'pixel',    name: 'PIXEL',    index: 6, bevel: 1.2,  bump: 3.0, hint: '8-bit blocks and dithering' },
  organic:  { id: 'organic',  name: 'ORGANIC',  index: 7, bevel: 1.8,  bump: 3.0, hint: 'Soft, breathing tissue' },
};
export const MATERIAL_LIST = Object.values(MATERIALS);
export const MATERIAL_IDS = Object.keys(MATERIALS);

/** Which preset / material pairings look designed. Used by SURPRISE ME and REMIX. */
export const CURATED = [
  { preset: 'impact', material: 'chrome', palette: 'mono', bg: 'studio', particles: 'explode', camera: 'push' },
  { preset: 'impact', material: 'chrome', palette: 'electric', bg: 'void', particles: 'explode', camera: 'push' },
  { preset: 'pulse', material: 'chrome', palette: 'ice', bg: 'void', particles: 'orbit', camera: 'float' },
  { preset: 'pulse', material: 'paper', palette: 'sunset', bg: 'smoke', particles: 'orbit', camera: 'float' },
  { preset: 'pulse', material: 'organic', palette: 'sunset', bg: 'aurora', particles: 'flow', camera: 'float' },
  { preset: 'explode', material: 'neon', palette: 'sunset', bg: 'smoke', particles: 'explode', camera: 'push' },
  { preset: 'explode', material: 'particle', palette: 'cosmic', bg: 'void', particles: 'form', camera: 'push' },
  { preset: 'explode', material: 'neon', palette: 'electric', bg: 'grid', particles: 'explode', camera: 'handheld' },
  { preset: 'flow', material: 'liquid', palette: 'cosmic', bg: 'aurora', particles: 'flow', camera: 'float' },
  { preset: 'flow', material: 'liquid', palette: 'ice', bg: 'smoke', particles: 'flow', camera: 'orbit' },
  { preset: 'flow', material: 'organic', palette: 'void', bg: 'smoke', particles: 'flow', camera: 'float' },
  { preset: 'shatter', material: 'glass', palette: 'ice', bg: 'studio', particles: 'explode', camera: 'push' },
  { preset: 'shatter', material: 'chrome', palette: 'electric', bg: 'grid', particles: 'explode', camera: 'push' },
  { preset: 'shatter', material: 'paper', palette: 'mono', bg: 'studio', particles: 'explode', camera: 'handheld' },
  { preset: 'orbit', material: 'chrome', palette: 'cosmic', bg: 'void', particles: 'orbit', camera: 'orbit' },
  { preset: 'orbit', material: 'particle', palette: 'ice', bg: 'void', particles: 'orbit', camera: 'orbit' },
  { preset: 'orbit', material: 'glass', palette: 'sunset', bg: 'aurora', particles: 'orbit', camera: 'orbit' },
  { preset: 'glitch', material: 'pixel', palette: 'electric', bg: 'grid', particles: 'form', camera: 'handheld' },
  { preset: 'glitch', material: 'chrome', palette: 'mono', bg: 'void', particles: 'form', camera: 'handheld' },
  { preset: 'glitch', material: 'neon', palette: 'cosmic', bg: 'grid', particles: 'form', camera: 'handheld' },
  { preset: 'breath', material: 'organic', palette: 'sunset', bg: 'aurora', particles: 'flow', camera: 'float' },
  { preset: 'breath', material: 'glass', palette: 'ice', bg: 'void', particles: 'flow', camera: 'float' },
  { preset: 'breath', material: 'particle', palette: 'void', bg: 'void', particles: 'dissolve', camera: 'float' },
];

export function cloneMapping(list) { return list.map((x) => ({ ...x })); }
