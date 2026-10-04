// SHATTER — hits break the object into shards; the shards re-assemble before the next beat.
import { clamp, smoothstep } from '../engine/math.js';
export default {
  id: 'shatter',
  update(c) {
    const { P, S, acc, f, hit, hitS, dt } = c;
    S.time = (S.time ?? 9) + dt;
    S.str = S.str ?? 0;
    if (hit && hitS > 0.3) {
      S.time = 0; S.str = clamp(hitS, 0.4, 1.4);
      S.u = 0.25 + Math.random() * 0.5; S.v = 0.3 + Math.random() * 0.4;
      P.bStr = 3.4; P.bFrac = 0.34;
      c.cam.hit(0.55 * S.str, 0.5);
      c.spr.scale.kick(-1.2 * S.str);
    }
    const period = f.bpm > 0 ? 60 / f.bpm : 0.5;
    const recon = clamp(period * 0.9, 0.34, 1.05);
    const attack = 0.06, hold = 0.06;
    let e;
    if (S.time < attack) e = 1 - Math.pow(1 - S.time / attack, 3);          // fast ease-out
    else if (S.time < attack + hold) e = 1;
    else { const u = clamp((S.time - attack - hold) / recon, 0, 1); e = 1 - u * u * (3 - 2 * u); }
    P.shatter = e * (0.55 + 0.45 * Math.min(1, S.str)) * (0.7 + 0.3 * c.I);
    P.impactU = S.u ?? 0.5; P.impactV = S.v ?? 0.5; P.impactS = S.str;
    P.scaleT = 1 + 0.05 * acc.scale;
    P.tumble = 1;
    P.pEmit = 6 + 90 * acc.particles + 200 * e;
    P.pFlow = 1.0; P.pLife = 0.6; P.flash = 0.18 * e;
    P.glow += 0.3 * e;
  },
};
