// EXPLODE — every strong beat throws a burst of particles off the object.
import { env } from './common.js';
export default {
  id: 'explode',
  update(c) {
    const { P, S, acc, hit, hitS, dt } = c;
    P.scaleT = 1 + 0.1 * acc.scale;
    if (hit) {
      c.spr.scale.kick(2.6 * hitS);
      P.bStr = 5 + 3.4 * hitS;
      P.bFrac = 0.5 + 0.3 * Math.min(1, hitS);
      S.flash = 1;
      c.cam.hit(0.35 * hitS, 0.4);
    }
    P.flash = 0.5 * env(S, 'flash', dt, 0.14);
    P.warp = 0.02 * acc.distortion;
    P.pEmit = 12 + 150 * acc.particles;
    P.pFlow = 1.5; P.pDamp = 1.1; P.pLife = 0.42;
    P.glow += 0.35 * S.flash;
  },
};
