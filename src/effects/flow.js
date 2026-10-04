// FLOW — audio controls fluid movement; the composition continuously bends.
import { env } from './common.js';
export default {
  id: 'flow',
  update(c) {
    const { P, S, acc, s, t, hit, hitS, dt } = c;
    S.ripple = (S.ripple || 0);
    if (hit) { S.ripple = Math.min(1.4, S.ripple + 0.9 * hitS); c.spr.scale.kick(1.6 * hitS); }
    env(S, 'ripple', dt, 0.35);
    P.scaleT = 1 + 0.06 * acc.scale;
    P.warp = 0.014 + 0.11 * acc.distortion + 0.035 * s.energy + 0.05 * S.ripple;
    P.warpSpeed = 0.22 + 0.9 * s.energy + 0.5 * acc.distortion;
    P.bend = 0.12 + 0.4 * s.energy + 0.3 * acc.distortion;
    P.rotT[1] += 0.3 * Math.sin(t * 0.5) * (0.4 + acc.rotation);
    P.pFlow = 1.1 + 1.9 * acc.particles; P.pFlowScale = 1.3; P.pSwirl = 0.9 * s.energy;
    P.pEmit = 26 + 90 * acc.particles + 40 * s.energy; P.pLife = 0.3; P.pDamp = 1.5;
  },
};
