// BREATH — the entire scene expands and contracts with the energy of the track. Slow and cinematic.
import { Follower } from '../engine/physics.js';
export default {
  id: 'breath',
  init(S) { S.e = new Follower(0.5, 1.2, 0); },
  update(c) {
    const { P, S, acc, s, dt, t } = c;
    const E = S.e.update(s.energy, dt);
    P.scaleT = 0.94 + 0.16 * acc.scale * Math.min(1.2, 0.35 + E);
    P.scaleK = 34; P.scaleC = 9;
    P.bend = 0.05 + 0.35 * E;
    P.warp = 0.01 + 0.03 * E + 0.05 * acc.distortion;
    P.warpSpeed = 0.14 + 0.35 * E;
    P.camPush = acc.camera + 0.7 * E;
    P.breath = E;
    P.vignette = 0.75 + 0.2 * (1 - E);
    P.glow = 0.55 + 0.9 * acc.glow * (0.4 + E);
    P.rotT[1] += 0.18 * Math.sin(t * 0.3);
    P.pFlow = 1.1; P.pLife = 0.28; P.pEmit = 14 + 70 * acc.particles + 40 * E; P.pDamp = 0.8; P.pSize = 2.2;
    if (c.hit) c.spr.scale.kick(0.8 * c.hitS);
  },
};
