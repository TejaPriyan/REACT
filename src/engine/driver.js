// The Driver is the brain between "audio numbers" and "visual parameters".
//
//   features ──shape──▶ sources (BASS MID HIGH ENERGY BEAT)
//   sources ──mapping──▶ targets (SCALE ROTATION DISPLACE DISTORT CAMERA PARTICLES GLOW IMPACT)
//   targets ──preset effect + material + behaviour + keyframes──▶ P  (one flat object the renderer reads)
//
// Motion is never taken straight from the audio: it goes through springs / envelopes
// so there is anticipation, impact, follow-through and inertia.

import { Follower, Spring } from './physics.js';
import { clamp, smoothstep, lerp, damp, DEG } from './math.js';
import { PRESETS } from './presets.js';
import { sampleKeyframes } from './animation.js';
import { baseline, reform } from '../effects/common.js';
import { EFFECTS } from '../effects/index.js';
import { applyMaterial } from '../effects/liquid.js';

export function makeP() {
  return {
    scale: 1, scaleT: 1, scaleK: 150, scaleC: 12,
    rotT: [0, 0, 0], posT: [0, 0, 0],
    rotX: 0, rotY: 0, rotZ: 0, posX: 0, posY: 0, posZ: 0,
  };
}

const gate = (v) => smoothstep(0.05, 0.85, v);

export class Driver {
  constructor() {
    this.P = makeP();
    this.S = {};
    this.time = 0;
    this.fol = {
      bass: new Follower(0.012, 0.15), mid: new Follower(0.03, 0.2),
      high: new Follower(0.008, 0.09), energy: new Follower(0.12, 0.7),
    };
    this.beatEnv = 0;
    this.armed = true;
    this.lastHit = -1;
    this.spr = { scale: new Spring(1, 150, 12), px: new Spring(0, 90, 10), py: new Spring(0, 90, 10) };
    this.kf = {};
    this.s = { bass: 0, mid: 0, high: 0, energy: 0, beat: 0 };
    this.acc = { scale: 0, rotation: 0, position: 0, distortion: 0, camera: 0, particles: 0, glow: 0, impact: 0 };
    this._rk = 1;
    this._ci = 1;
    this._cam = null;
    // wrappers so effects can't accidentally over-drive in reduced-motion mode
    this.c = {
      dt: 0, t: 0, f: null, s: this.s, acc: this.acc, hit: false, hitS: 0, P: this.P, S: null, I: 1,
      spr: { scale: { kick: (v) => this.spr.scale.kick(v * this._rk) } },
      cam: { hit: (s, k) => this._cam && this._cam.hit(s * this._ci, k), whip: (s) => this._cam && this._cam.whip(s * this._ci) },
    };
  }

  reset() { this.S = {}; this.beatEnv = 0; this.armed = true; this.spr.scale.set(1); }

  update(dt, f, cfg, pointer, camera) {
    this.time += dt;
    this._cam = camera;
    const P = this.P, s = this.s, acc = this.acc;
    const reduce = !!cfg.reduceMotion;
    const I = clamp(cfg.intensity ?? 1, 0, 2) * (reduce ? 0.55 : 1);
    this._rk = reduce ? 0.35 : 1;
    this._ci = reduce ? 0.35 : 1;

    // 1 ── shape audio into sources
    s.bass = this.fol.bass.update(gate(f.bass), dt);
    s.mid = this.fol.mid.update(gate(f.mid), dt);
    s.high = this.fol.high.update(gate(f.high), dt);
    s.energy = this.fol.energy.update(clamp(f.energy, 0, 1), dt);
    this.beatEnv *= Math.pow(0.5, dt / 0.12);
    if (f.beat) this.beatEnv = Math.max(this.beatEnv, clamp(f.beatStrength || 1, 0.35, 1.4));
    s.beat = this.beatEnv;

    // 2 ── route sources to targets
    for (const k in acc) acc[k] = 0;
    let impactAmt = 0;
    for (const m of cfg.mapping) {
      const v = s[m.src];
      if (v === undefined || acc[m.dst] === undefined) continue;
      acc[m.dst] += m.amt * v * I;
      if (m.dst === 'impact') impactAmt += m.amt;
    }

    // 3 ── impact triggers: edge detection on the IMPACT signal
    let hit = false, hitS = 0;
    const sig = acc.impact;
    const thr = 0.26;
    if (sig > thr && this.armed && this.time - this.lastHit > 0.11) {
      hit = true; hitS = sig; this.lastHit = this.time; this.armed = false;
    }
    if (sig < thr * 0.55) this.armed = true;
    if (f.drop && impactAmt > 0) { hit = true; hitS = Math.max(hitS, 1.35 * Math.min(1.3, I)); camera && camera.whip(this._ci); }

    // 4 ── effect
    const c = this.c;
    c.dt = dt; c.t = this.time; c.f = f; c.hit = hit; c.hitS = hitS; c.I = I; c.cfg = cfg;
    const presetId = EFFECTS[cfg.preset] ? cfg.preset : 'pulse';
    const fx = EFFECTS[presetId];
    const S = this.S[presetId] || (this.S[presetId] = {});
    if (fx.init && !S._init) { fx.init(S); S._init = true; }
    c.S = S;
    baseline(c);
    fx.update(c);

    // 5 ── material flavour + particle behaviour
    const matId = cfg.material;
    const MS = this.S.__mat || (this.S.__mat = {});
    c.S = MS;
    applyMaterial(c, matId);
    c.S = this.S.__par || (this.S.__par = {});
    this.particleBehaviour(c, cfg.particles === 'auto' ? PRESETS[presetId].particles : cfg.particles, matId);

    // 6 ── keyframes (ride on top of audio)
    const kf = sampleKeyframes(cfg.keyframes, f.position || 0, this.kf);

    // 7 ── integrate
    this.spr.scale.k = P.scaleK; this.spr.scale.c = P.scaleC;
    P.scale = this.spr.scale.update(P.scaleT, dt) * kf.scale;
    const px = pointer ? pointer.x : 0, py = pointer ? pointer.y : 0;
    const pAmt = pointer && pointer.active ? 1 : 0;
    P.rotX = damp(P.rotX, P.rotT[0] - py * 0.2 * pAmt, 5, dt);
    P.rotY = damp(P.rotY, P.rotT[1] + px * 0.32 * pAmt, 5, dt);
    P.rotZ = damp(P.rotZ, P.rotT[2] + kf.rotation * DEG, 7, dt);
    P.posX = this.spr.px.update(P.posT[0] + 0.05 * acc.position * Math.sin(this.time * 2.3), dt);
    P.posY = this.spr.py.update(P.posT[1] + 0.5 * kf.position + 0.08 * acc.position * Math.sin(this.time * 1.9 + 1), dt);
    P.opacity *= kf.opacity;
    P.camPush += kf.camera;
    P.warp += kf.distortion * 0.12;
    P.glitch = clamp(P.glitch + (cfg.preset === 'glitch' ? kf.distortion : 0), 0, 1);
    P.pDensity = clamp(P.pDensity * kf.particles, 0, 1);
    P.pEmit *= kf.particles;

    if (reduce) {
      P.glitch *= 0.35; P.radial *= 0.25; P.flash *= 0.4; P.shatter *= 0.6; P.ca *= 0.5; P.bStr *= 0.6; P.warp *= 0.7; P.bend *= 0.6;
    }
    P.hit = hit; P.hitS = hitS;
    return P;
  }

  particleBehaviour(c, beh, mat) {
    const { P, S, acc, s, hit, hitS, cfg } = c;
    const react = cfg && cfg.particleReactivity !== undefined ? cfg.particleReactivity : 1.0;
    const isPart = mat === 'particle';
    let constructed = isPart || P.pMode === 0;

    // Dynamic music reactivity on particles (bursts on beat/bass, turbulence on energy):
    const musicPulse = (s.beat * 0.75 + s.bass * 0.55) * react;
    if (musicPulse > 0.12) {
      P.pPush = Math.max(P.pPush, musicPulse * 2.8);
    }
    if ((hit || s.beat > 0.52) && react > 0.05) {
      P.bStr = Math.max(P.bStr, (2.2 + 3.2 * Math.max(hitS, s.beat)) * react);
      P.bFrac = Math.max(P.bFrac, 0.3 * react);
    }
    P.pFlow = (P.pFlow || 0.6) + (0.5 * s.energy + 0.9 * s.bass) * react;
    P.pJitter = Math.max(P.pJitter, (0.25 * s.high + 0.15 * s.beat) * react);
    P.pEmit = (P.pEmit || 8) * (0.8 + 0.8 * s.energy * react);

    switch (beh) {
      case 'explode':
        P.pFlow = Math.max(P.pFlow, 1.4);
        if (hit) { P.bStr = Math.max(P.bStr, 5 + 3 * hitS); P.bFrac = Math.max(P.bFrac, 0.55); }
        break;
      case 'orbit':
        constructed = true;
        P.pOrbitMix = Math.max(P.pOrbitMix, isPart ? 0.6 : 0.8);
        P.pOrbit = Math.max(P.pOrbit, 0.9 + 3.2 * acc.particles + 2 * s.energy);
        P.pSpring = Math.max(P.pSpring, 22); P.pDamp = Math.max(P.pDamp, 2.4);
        break;
      case 'attract':
        P.pPull = 5 + 9 * s.energy; P.pFlow = Math.max(P.pFlow, 1.1);
        if (constructed) { P.pSpring = 18; P.pDamp = 3.2; }
        break;
      case 'repel':
        P.pPush = 2.2 + 4.5 * s.energy; P.pPull = 0.7;
        if (constructed) { P.pSpring = 6; P.pDamp = 2.2; }
        break;
      case 'flow':
        P.pFlow = Math.max(P.pFlow, 1.4 + 1.8 * acc.particles); P.pSwirl = Math.max(P.pSwirl, 0.5);
        if (constructed && P.pOrbitMix === 0) { P.pSpring = 7; P.pDamp = 1.9; }
        break;
      case 'form': {
        constructed = true;
        if (P.pOrbitMix === 0) { const r = reform(c, S, { fly: 0.2, recon: 0.7 }); P.pSpring = r.k; P.pDamp = r.damp; }
        break;
      }
      case 'dissolve': {
        constructed = true;
        const e = clamp(s.energy * 1.25, 0, 1);
        P.pSpring = lerp(42, 1.5, e * e); P.pDamp = lerp(6, 1.4, e); P.pFlow = 1 + 3.2 * e;
        break;
      }
      default: break;
    }
    if (constructed) {
      P.pMode = 0;
      if (P.pSpring < 0.01 && P.pOrbitMix < 0.01) { const r = reform(c, S, { fly: 0.22, recon: 0.85 }); P.pSpring = r.k; P.pDamp = r.damp; }
      if (isPart) { P.pDensity = clamp(0.9 + 0.1 * acc.particles, 0, 1); P.pSize = Math.min(P.pSize, 1.5); P.pIntensity = 0.5 + 0.15 * s.high; }
      else P.pIntensity *= 0.6;
    }
  }
}
