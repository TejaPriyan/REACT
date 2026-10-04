// PULSE — bass drives scale. The object breathes with every kick; springs give overshoot & follow-through.
import { env } from './common.js';
export default {
  id: 'pulse',
  update(c) {
    const { P, S, acc, s, t, hit, hitS, dt } = c;
    P.scaleT = 1 + 0.2 * acc.scale;
    if (hit) { c.spr.scale.kick(3.6 * hitS); S.flash = 1; c.P.bStr = 1.7; c.P.bFrac = 0.16; }
    P.rotT[1] += acc.rotation * 0.4 * Math.sin(t * 1.1);
    P.rotT[0] += acc.rotation * 0.16 * Math.sin(t * 0.83 + 1);
    P.rotT[2] += acc.rotation * 0.05 * Math.sin(t * 0.6);
    P.bend = 0.05 + 0.25 * acc.distortion + 0.05 * s.bass;
    P.warp = 0.03 * acc.distortion;
    P.flash = 0.3 * env(S, 'flash', dt, 0.12);
    P.pFlow = 0.5; P.pLife = 0.7;
  },
};
