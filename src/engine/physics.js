// Motion primitives. Everything that should *feel* physical goes through these
// (anticipation, overshoot, follow-through, inertia) rather than raw audio values.

import { clamp } from './math.js';

/** Damped spring — semi-implicit Euler with sub-stepping so big dt spikes stay stable. */
export class Spring {
  constructor(value = 0, stiffness = 140, damping = 13) {
    this.x = value;
    this.v = 0;
    this.k = stiffness;
    this.c = damping;
  }
  update(target, dt) {
    let left = Math.min(dt, 0.1);
    const h = 1 / 240;
    while (left > 1e-6) {
      const s = Math.min(h, left);
      this.v += (this.k * (target - this.x) - this.c * this.v) * s;
      this.x += this.v * s;
      left -= s;
    }
    return this.x;
  }
  kick(velocity) { this.v += velocity; }
  set(x) { this.x = x; this.v = 0; }
}

/** Asymmetric envelope follower: separate attack / release times (seconds). */
export class Follower {
  constructor(attack = 0.02, release = 0.2, value = 0) {
    this.attack = attack;
    this.release = release;
    this.x = value;
  }
  update(target, dt) {
    const tau = target > this.x ? this.attack : this.release;
    const a = tau <= 1e-4 ? 1 : 1 - Math.exp(-dt / tau);
    this.x += (target - this.x) * a;
    return this.x;
  }
  set(x) { this.x = x; }
}

/** Fast decaying pulse: jump to a value, decay exponentially (half-life in seconds). */
export class Pulse {
  constructor(halfLife = 0.18) { this.x = 0; this.hl = halfLife; }
  hit(v = 1) { this.x = Math.max(this.x, v); }
  add(v) { this.x += v; }
  update(dt) { this.x *= Math.pow(0.5, dt / this.hl); if (this.x < 1e-4) this.x = 0; return this.x; }
}

/** Smooth 1D value noise (-1..1), cheap and continuous — for camera drift & shake. */
const perm = new Float32Array(512);
for (let i = 0; i < 512; i++) perm[i] = Math.sin(i * 127.1 + 311.7) * 43758.5453 % 1;
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = perm[i & 511], b = perm[(i + 1) & 511];
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u; // perm is already in (-1, 1)
}

/** Trauma-style shake (Squirrel Eiserloh): amplitude = trauma², smooth noise, decays linearly. */
export class Trauma {
  constructor() { this.t = 0; this.time = 0; }
  add(v, cap = 1) { this.t = Math.min(cap, this.t + v); }
  update(dt, decay = 1.6) {
    this.t = Math.max(0, this.t - decay * dt);
    this.time += dt;
    return this.t * this.t;
  }
  sample(seed, freq = 22) { return noise1(this.time * freq + seed * 100.3); }
}

/** Rolling stats used for adaptive normalisation of live audio. */
export class Running {
  constructor(decay = 0.9985, floor = 0.05) { this.max = floor; this.decay = decay; this.floor = floor; }
  push(v) { this.max = Math.max(this.floor, v > this.max ? v : this.max * this.decay); return clamp(v / this.max, 0, 1.4); }
}
