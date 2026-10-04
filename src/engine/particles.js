// GPU particle system. State lives in two ping-ponged buffer pairs updated with
// transform feedback (no CPU per-particle work). Rendering is one instanced-style POINTS draw.
//
//   aPL   = position.xyz, life
//   aVS   = velocity.xyz, seed
//   aHome = uv.xy on the object, height, role   (static)
//
// Modes: constructed (particles spring to the shape — "text particle mode") and
//        emitter     (particles are born on the shape by beats / high frequencies, then flow & fade).

import { Program, createBuffer } from './gl.js';
import { PSIM_VS, PSIM_FS, PDRAW_VS, PDRAW_FS } from './shaders.js';

export class ParticleSystem {
  constructor(gl, count) {
    this.gl = gl;
    this.sim = new Program(gl, PSIM_VS, PSIM_FS, { varyings: ['vPL', 'vVS'], label: 'particle-sim' });
    this.draw = new Program(gl, PDRAW_VS, PDRAW_FS, { label: 'particle-draw' });
    this.count = 0;
    this.cur = 0;
    this.alloc(count);
  }

  alloc(count) {
    const gl = this.gl;
    this.dispose(true);
    this.count = count;
    const pl = new Float32Array(count * 4);
    const vs = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      // scattered start so the shape *assembles* on load
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), r = 1.2 + Math.random() * 2.4;
      pl[i * 4] = Math.sin(ph) * Math.cos(th) * r;
      pl[i * 4 + 1] = Math.sin(ph) * Math.sin(th) * r * 0.7;
      pl[i * 4 + 2] = Math.cos(ph) * r - 0.5;
      pl[i * 4 + 3] = 0;
      vs[i * 4 + 3] = (i + 0.5) / count * 0.9 + Math.random() * 0.1; // seed in (0,1); also drives density gating
    }
    // shuffle seeds so density gating isn't correlated with buffer index
    for (let i = count - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const a = vs[i * 4 + 3]; vs[i * 4 + 3] = vs[j * 4 + 3]; vs[j * 4 + 3] = a;
    }
    this.pl = [createBuffer(gl, pl, gl.DYNAMIC_COPY), createBuffer(gl, pl, gl.DYNAMIC_COPY)];
    this.vs = [createBuffer(gl, vs, gl.DYNAMIC_COPY), createBuffer(gl, vs, gl.DYNAMIC_COPY)];
    const home = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { home[i * 4] = Math.random(); home[i * 4 + 1] = Math.random(); home[i * 4 + 3] = Math.random(); }
    this.home = createBuffer(gl, home, gl.DYNAMIC_DRAW);

    this.simVAO = [0, 1].map((i) => this.makeVAO(this.sim, i));
    this.drawVAO = [0, 1].map((i) => this.makeVAO(this.draw, i));
    this.tf = [0, 1].map((i) => {
      const t = gl.createTransformFeedback();
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, t);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.pl[1 - i]);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.vs[1 - i]);
      return t;
    });
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    this.cur = 0;
  }

  makeVAO(prog, i) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bind = (name, buf) => {
      const loc = prog.attrib(name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    };
    bind('aPL', this.pl[i]);
    bind('aVS', this.vs[i]);
    bind('aHome', this.home);
    gl.bindVertexArray(null);
    return vao;
  }

  /** Float32Array(count*4): uv.x, uv.y, height, role */
  setHomes(data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.home);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  step(dt) {
    const gl = this.gl;
    gl.bindVertexArray(this.simVAO[this.cur]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf[this.cur]);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    this.cur = 1 - this.cur;
  }

  render() {
    const gl = this.gl;
    gl.bindVertexArray(this.drawVAO[this.cur]);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
  }

  dispose(keepPrograms = false) {
    const gl = this.gl;
    if (this.pl) {
      this.pl.forEach((b) => gl.deleteBuffer(b));
      this.vs.forEach((b) => gl.deleteBuffer(b));
      gl.deleteBuffer(this.home);
      this.simVAO.forEach((v) => gl.deleteVertexArray(v));
      this.drawVAO.forEach((v) => gl.deleteVertexArray(v));
      this.tf.forEach((t) => gl.deleteTransformFeedback(t));
      this.pl = null;
    }
    if (!keepPrograms) { gl.deleteProgram(this.sim.p); gl.deleteProgram(this.draw.p); }
  }
}
