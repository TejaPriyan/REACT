// Material modifiers ("liquid" is the fluid one, but every material adds its own flavour on top of the preset).
import { clamp } from '../engine/math.js';

export const liquid = {
  apply(c) {
    const { P, acc, s } = c;
    P.warp = Math.max(P.warp, 0.02 + 0.07 * acc.distortion + 0.02 * s.energy);
    P.warpSpeed += 0.35;
    P.bend += 0.08;
  },
};

export function applyMaterial(c, id) {
  const { P, acc, s, S } = c;
  switch (id) {
    case 'liquid': liquid.apply(c); break;
    case 'organic': P.warp += 0.012 + 0.02 * acc.distortion; P.bend += 0.14; P.warpSpeed += 0.1; break;
    case 'paper': P.layers = 3; P.layerGap = 0.03 + 0.09 * s.bass + 0.03 * acc.scale; break;
    case 'neon': P.glow *= 1.35; P.brightness = 1 + 0.35 * s.beat; break;
    case 'glass': P.glow *= 0.9; break;
    case 'pixel': {
      S.pxEnv = Math.max((S.pxEnv || 0) * Math.pow(0.5, c.dt / 0.18), c.hit ? 1 : 0);
      P.pixel = clamp(P.pixel * (1 - 0.6 * S.pxEnv) - 20 * s.beat, 22, 140);
      break;
    }
    case 'particle': break;
    default: break;
  }
}
