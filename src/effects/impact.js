// IMPACT — only strong transients hit, and when they do: shake, punch, radial blur, particles, light.
import { clamp } from '../engine/math.js';
import { env } from './common.js';
export default {
  id: 'impact',
  update(c) {
    const { P, S, acc, hit, hitS, dt } = c;
    if (hit) {
      if (hitS >= 0.55) {
        const k = clamp(hitS, 0.55, 1.4);
        c.cam.hit(k, 1);
        c.spr.scale.kick(3.6 * k);
        S.blur = 1; S.light = 1; S.ca = 1;
        P.bStr = 6 + 3 * k; P.bFrac = 0.55;
      } else {
        c.spr.scale.kick(1.6 * hitS);        // weaker transients: a micro pulse only
        S.light = Math.max(S.light || 0, 0.25);
      }
    }
    const blur = env(S, 'blur', dt, 0.09);
    const light = env(S, 'light', dt, 0.16);
    const ca = env(S, 'ca', dt, 0.12);
    P.scaleT = 1 + 0.03 * acc.scale;
    P.radial = 0.2 * blur;
    P.flash = 0.15 * light;
    P.glow += 0.2 * light;
    P.ca += 0.008 * ca;
    P.exposure = 1;
    P.pEmit = 8 + 60 * acc.particles; P.pFlow = 1.2; P.pDamp = 1.3; P.pLife = 0.5;
  },
};
