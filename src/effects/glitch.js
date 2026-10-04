// GLITCH — highs control digital distortion; beats fire glitch bursts (time-stuttered, not smooth).
import { clamp } from '../engine/math.js';
export default {
  id: 'glitch',
  update(c) {
    const { P, S, acc, hit, hitS, dt, t } = c;
    S.burst = (S.burst || 0);
    if (hit) { S.burst = 1; S.seed = Math.random(); c.spr.scale.kick(2.2 * hitS); c.cam.hit(0.3 * hitS, 0.3); }
    S.burst = Math.max(0, S.burst - dt / 0.16);
    // stutter: bursts flicker on/off in ~1/24s steps instead of fading smoothly
    const stutter = S.burst > 0 && (Math.floor(t * 24) % 3 !== 0) ? 1 : 0.35;
    const base = clamp(0.03 + 0.75 * acc.distortion, 0, 1);
    P.glitch = Math.max(base * 0.85, S.burst * stutter);
    P.scaleT = 1 + 0.06 * acc.scale + (S.burst > 0 ? (Math.floor(t * 30) % 2 ? 0.012 : -0.012) * S.burst : 0);
    P.posT[0] = S.burst > 0 ? ((Math.floor(t * 20) % 5) - 2) * 0.03 * S.burst : 0;
    P.ca = 0.002 + 0.012 * P.glitch;
    P.pSquare = 1; P.pLife = 0.9; P.pEmit = 20 + 260 * acc.particles * (0.4 + 0.6 * base); P.pSize = 2.1;
    P.pFlow = 0.4; P.pJitter = 1; P.pIntensity = 0.28;
    P.pixel = 110 - 70 * S.burst;
    P.flash = 0.22 * S.burst;
  },
};
