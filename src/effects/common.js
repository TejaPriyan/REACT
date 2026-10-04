// Shared building blocks for the reaction presets.
import { clamp, lerp, smoothstep } from '../engine/math.js';

/** Resets every driven parameter to a calm, alive-but-quiet baseline. Effects then override. */
export function baseline(c) {
  const { P, s, acc, f, t } = c;
  const calm = f.calm ?? 1 - s.energy;
  P.scaleT = 1; P.scaleK = 150; P.scaleC = 12;
  P.rotT[0] = 0.05 * Math.sin(t * 0.29) * (0.4 + 0.6 * calm);
  P.rotT[1] = 0.11 * Math.sin(t * 0.37) * (0.4 + 0.6 * calm);
  P.rotT[2] = 0.012 * Math.sin(t * 0.21);
  P.posT[0] = 0; P.posT[1] = 0; P.posT[2] = 0;
  P.warp = 0; P.warpSpeed = 0.22 + 0.5 * s.energy; P.bend = 0.03;
  P.shatter = 0; P.impactU = 0.5; P.impactV = 0.5; P.impactS = 1; P.tumble = 1;
  P.glitch = 0; P.pixel = 110;
  P.glow = 0.6 + 0.7 * acc.glow; P.brightness = 1; P.flash = 0;
  P.radial = 0; P.ca = 0.0012 + 0.0018 * acc.glow; P.vignette = 0.85; P.exposure = 1; P.breath = s.energy;
  P.opacity = 1; P.layers = 1; P.layerGap = 0.03;
  P.envRot = t * 0.07 + acc.rotation * 0.5 + f.phase * 0.0;
  P.camPush = acc.camera;
  // particles
  P.pMode = 1;
  P.pDensity = clamp(0.28 + 0.72 * acc.particles, 0, 1);
  P.pEmit = 8 + 80 * acc.particles;
  P.pSpring = 0; P.pDamp = 1.6;
  P.pFlow = 0.6; P.pFlowScale = 1.25;
  P.pOrbit = 0; P.pOrbitMix = 0; P.pOrbitR = 0.62; P.pSwirl = 0;
  P.pPull = 0; P.pPush = 0; P.pLife = 0.55;
  P.pSize = 2.5; P.pIntensity = 0.95; P.pSquare = 0; P.pJitter = acc.particles * 0.3;
  P.bStr = 0; P.bFrac = 0.4; P.bU = 0.5; P.bV = 0.5;
}

/**
 * Text-particle logic: on a hit the particles are thrown out (low spring, low drag), then the
 * spring ramps back so the word reconstructs. Returns {k, damp} for the particle sim.
 */
export function reform(c, S, { fly = 0.22, recon = 0.85, kMin = 0.3, kMax = 48, dMin = 1.05, dMax = 6.5 } = {}) {
  S.since = (S.since ?? 9) + c.dt;
  if (c.hit) S.since = 0;
  const calm = c.f.calm ?? 0.5;
  const speed = 1 + calm * 0.6;
  const u = smoothstep(fly, fly + recon / speed, S.since);
  const e = u * u * (3 - 2 * u);
  return { k: lerp(kMin, kMax, e), damp: lerp(dMin, dMax, e) };
}

/** Exponentially decaying envelope helper stored in the effect's state object. */
export function env(S, key, dt, halfLife) {
  S[key] = (S[key] || 0) * Math.pow(0.5, dt / halfLife);
  return S[key];
}
