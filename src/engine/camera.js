// Cinematic camera. Not a "shake the screen on every beat" camera: it has intent.
//   quiet   → slow floating drift
//   bass    → gentle push
//   beat    → tiny, decaying trauma (only strong hits)
//   build   → gradual dolly-in
//   before a drop → an "inhale" (slight pull-back), then a rapid whip-in on the drop

import { mat4, clamp, lerp, DEG } from './math.js';
import { Spring, Trauma, noise1 } from './physics.js';

export const CAMERA_DISTANCE = 3.4;
export const CAMERA_FOV = 32 * DEG;

export class CinematicCamera {
  constructor() {
    this.view = mat4.create();
    this.proj = mat4.create();
    this.vp = mat4.create();
    this.invVP = mat4.create();
    this.pos = [0, 0, CAMERA_DISTANCE];
    this.dist = new Spring(CAMERA_DISTANCE, 55, 10.5);
    this.yaw = new Spring(0, 22, 7);
    this.pitch = new Spring(0, 22, 7);
    this.roll = new Spring(0, 40, 6);
    this.px = new Spring(0, 30, 8);
    this.py = new Spring(0, 30, 8);
    this.trauma = new Trauma();
    this.t = 0;
    this._eye = [0, 0, CAMERA_DISTANCE];
    this._at = [0, 0, 0];
    this._up = [0, 1, 0];
  }

  /** c: { mode, push, build, dropSoon, calm, energy, pointerX, pointerY, intensity, reduce } ; events via hit()/whip() */
  update(dt, aspect, c) {
    this.t += dt;
    const t = this.t;
    const I = c.intensity * (c.reduce ? 0.35 : 1);
    const mode = c.mode;
    const calmAmt = 0.35 + 0.65 * c.calm;

    let zTarget = CAMERA_DISTANCE;
    zTarget -= c.push * (mode === 'push' ? 0.34 : mode === 'static' ? 0.06 : 0.2) * I;
    zTarget -= c.build * 0.34 * I;
    zTarget += c.dropSoon * 0.28 * I;
    if (mode === 'push') zTarget -= c.energy * 0.12 * I;
    this.dist.update(zTarget, dt);

    // slow float — the camera is never perfectly still, but it is never busy either
    const drift = mode === 'static' ? 0.15 : 1;
    let fx = (Math.sin(t * 0.23) * 0.06 + Math.sin(t * 0.41 + 1.3) * 0.03) * drift * calmAmt;
    let fy = (Math.sin(t * 0.19 + 0.7) * 0.04 + Math.sin(t * 0.37) * 0.02) * drift * calmAmt;
    let fr = Math.sin(t * 0.17) * 0.012 * drift * calmAmt;

    let yawT = c.pointerX * 0.16 + fx * 0.6;
    let pitchT = -c.pointerY * 0.1 + fy * 0.5;
    if (mode === 'orbit') yawT += Math.sin(t * (0.16 + c.energy * 0.22)) * 0.42 * (0.4 + 0.6 * I);
    this.yaw.update(yawT, dt);
    this.pitch.update(pitchT, dt);
    this.px.update(fx * 0.5, dt);
    this.py.update(fy * 0.5, dt);
    this.roll.update(fr, dt);

    let tr = this.trauma.update(dt, mode === 'handheld' ? 2.2 : 1.7);
    if (mode === 'handheld') tr = Math.max(tr, 0.006 + 0.01 * c.energy);
    const shake = tr * I;
    const sx = this.trauma.sample(1) * 0.22 * shake;
    const sy = this.trauma.sample(2) * 0.22 * shake;
    const sr = this.trauma.sample(3) * 0.05 * shake;

    const d = this.dist.x;
    const yaw = this.yaw.x, pitch = this.pitch.x;
    const eye = this._eye;
    eye[0] = Math.sin(yaw) * Math.cos(pitch) * d + this.px.x + sx;
    eye[1] = Math.sin(pitch) * d + this.py.x + sy;
    eye[2] = Math.cos(yaw) * Math.cos(pitch) * d;
    const at = this._at;
    at[0] = this.px.x * 0.4;
    at[1] = this.py.x * 0.4;
    at[2] = 0;
    const roll = this.roll.x + sr;
    const up = this._up;
    up[0] = Math.sin(roll);
    up[1] = Math.cos(roll);
    up[2] = 0;
    this.pos[0] = eye[0]; this.pos[1] = eye[1]; this.pos[2] = eye[2];

    mat4.lookAt(this.view, eye, at, up);
    mat4.perspective(this.proj, CAMERA_FOV, aspect, 0.1, 60);
    mat4.multiply(this.vp, this.proj, this.view);
    mat4.invert(this.invVP, this.vp);
  }

  /** small, decaying shake — call only for strong hits */
  hit(strength = 1, kick = 1) {
    this.trauma.add(0.18 + 0.32 * clamp(strength, 0, 1.4), 0.75);
    this.dist.kick(-1.1 * clamp(strength, 0, 1.4) * kick);
  }
  /** the drop: rapid movement — whip in with a touch of roll */
  whip(strength = 1) {
    this.trauma.add(0.45 * strength, 0.85);
    this.dist.kick(-2.7 * strength);
    this.roll.kick((Math.random() < 0.5 ? -1 : 1) * 0.55 * strength);
    this.yaw.kick((Math.random() - 0.5) * 0.7 * strength);
  }
}
