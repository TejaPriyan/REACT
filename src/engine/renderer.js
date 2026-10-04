// REACT render engine (raw WebGL2).
//
//   pass 1  background  ─▶ scene FBO (HDR half-float)
//   pass 2  (glass only) copy scene ─▶ refraction source
//   pass 3  object: a shard mesh with an uber-material shader, SDF-driven bevels & reflections
//   pass 4  GPU particles (transform-feedback sim, additive POINTS)
//   pass 5  bloom (threshold → down chain → up chain)
//   pass 6  composite: chromatic aberration, radial blur, glitch, grade, grain, sign-off → canvas
//
// Everything that changes every frame lives here, not in React state.

import {
  createContext, capabilities, Program, createTexture, updateTexture, createFBO, deleteFBO, createBuffer,
} from './gl.js';
import {
  FULLSCREEN_VS, BG_FS, MESH_VS, MESH_FS, BLOOM_DOWN_FS, BLOOM_UP_FS, COMPOSITE_FS, COPY_FS,
} from './shaders.js';
import { ParticleSystem } from './particles.js';
import { CinematicCamera, CAMERA_DISTANCE, CAMERA_FOV } from './camera.js';
import { Driver } from './driver.js';
import { PALETTES, resolvePalette } from './palettes.js';
import { MATERIALS, BACKGROUNDS, PRESETS, cloneMapping } from './presets.js';
import { mat4, unprojectToPlane, clamp, damp } from './math.js';
import { sampleHomes, SDF_RANGE, renderSignature } from './sampler.js';
import { createFeatures } from '../audio/features.js';

export const QUALITY = {
  high: { label: 'HIGH QUALITY', dpr: 2, particles: 200000, bloom: 5, cells: 1500 },
  balanced: { label: 'BALANCED', dpr: 1.5, particles: 100000, bloom: 4, cells: 1000 },
  performance: { label: 'PERFORMANCE', dpr: 1, particles: 40000, bloom: 3, cells: 650 },
};

export function defaultConfig() {
  const p = PRESETS.impact;
  return {
    preset: 'impact', material: 'chrome', palette: 'electric', background: 'void',
    particles: 'auto', camera: 'auto', intensity: 1, size: 1,
    mapping: cloneMapping(p.mapping), keyframes: [], reduceMotion: false,
    quality: 'balanced',
  };
}

const D = CAMERA_DISTANCE;

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.gl = createContext(canvas, { preserve: !!opts.preserve });
    this.caps = capabilities(this.gl);
    this.cfg = { ...defaultConfig(), ...(opts.config || {}) };
    this.qualityId = opts.quality || 'balanced';
    this.autoScale = opts.autoScale !== false;
    this.renderScale = 1;
    this.frameMs = 16;
    this.wallDt = 0;
    this.slowFor = 0;
    this.fastFor = 0;
    this.css = { w: canvas.clientWidth || 640, h: canvas.clientHeight || 360, dpr: 1 };
    this.fixed = null;
    this.W = 2; this.H = 2;
    this.time = 0;
    this.frameCount = 0;
    this.features = createFeatures();
    this.pointer = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, down: false, active: false, clicks: [], _px: 0, _py: 0, _init: false };
    this.driver = new Driver();
    this.camera = new CinematicCamera();
    this.sig = { alpha: 0, fade: 0 };
    this.obj = null;
    this.stats = { fps: 60, ms: 16 };
    this.lost = false;
    this.onEvent = null;
    this.afterRender = null;
    this._cw = [0, 0, 0];
    this.cursorW = [0, 0, 0];
    this.cursorUV = [0.5, 0.5];
    this.cursorGlow = 0;
    this.light = [0, 1, 2];
    this.model = mat4.create();
    this.nmat = new Float32Array(9);
    this._build();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this._build(); if (this.obj) this.setObject(this.obj, true); this.applySize(true); });
  }

  // ───────────────────────────── setup ─────────────────────────────
  _build() {
    const gl = this.gl;
    this.prog = {
      bg: new Program(gl, FULLSCREEN_VS, BG_FS, { label: 'bg' }),
      mesh: new Program(gl, MESH_VS, MESH_FS, { label: 'mesh' }),
      down: new Program(gl, FULLSCREEN_VS, BLOOM_DOWN_FS, { label: 'bloom-down' }),
      up: new Program(gl, FULLSCREEN_VS, BLOOM_UP_FS, { label: 'bloom-up' }),
      comp: new Program(gl, FULLSCREEN_VS, COMPOSITE_FS, { label: 'composite' }),
      copy: new Program(gl, FULLSCREEN_VS, COPY_FS, { label: 'copy' }),
    };
    this.emptyVAO = gl.createVertexArray();
    this.texAlbedo = createTexture(gl, { w: 1, h: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.texDummy = createTexture(gl, { w: 1, h: 1, data: new Uint8Array([0, 0, 0, 255]) });
    this.texSdf = createTexture(gl, { w: 1, h: 1, internal: gl.R16F, format: gl.RED, type: gl.FLOAT, data: new Float32Array([1]) });
    const sig = renderSignature();
    this.sigAspect = sig.aspect;
    this.texSig = createTexture(gl, { data: sig.canvas, flipY: true });
    this.fbo = { scene: null, bg: null, down: [], up: [] };
    const q = QUALITY[this.qualityId];
    this.particles = new ParticleSystem(gl, q.particles);
    this.mesh = null;
    this.applySize(true);
  }

  setQuality(id) {
    if (!QUALITY[id]) return;
    this.qualityId = id;
    const q = QUALITY[id];
    if (this.particles.count !== q.particles) {
      this.particles.alloc(q.particles);
      if (this.obj) this._sampleHomes();
    }
    if (this.obj) this._buildMesh();
    this.renderScale = 1;
    this.applySize(true);
  }

  setConfig(patch) {
    const prev = this.cfg;
    this.cfg = { ...prev, ...patch };
    if (patch.preset && patch.preset !== prev.preset) this.driver.reset();
  }

  // ───────────────────────────── sizing ─────────────────────────────
  setViewport(cssW, cssH, dpr = 1) {
    this.css = { w: Math.max(2, cssW), h: Math.max(2, cssH), dpr };
    this.applySize();
  }
  /** Lock the drawing buffer to an exact pixel size (export / recording). Pass null to unlock. */
  setFixedSize(w, h) {
    this.fixed = w && h ? { w, h } : null;
    this.applySize(true);
  }
  applySize(force = false) {
    let w, h;
    if (this.fixed) { w = this.fixed.w; h = this.fixed.h; }
    else {
      const q = QUALITY[this.qualityId];
      const dpr = Math.min(this.css.dpr, q.dpr) * this.renderScale;
      w = Math.round(this.css.w * dpr);
      h = Math.round(this.css.h * dpr);
    }
    w = clamp(w, 2, this.caps.maxTexture); h = clamp(h, 2, this.caps.maxTexture);
    if (!force && w === this.W && h === this.H) return;
    this.W = w; this.H = h;
    this.canvas.width = w; this.canvas.height = h;
    this._allocTargets();
  }
  _allocTargets() {
    const gl = this.gl;
    const F = this.fbo;
    deleteFBO(gl, F.scene); deleteFBO(gl, F.bg);
    F.down.forEach((f) => deleteFBO(gl, f)); F.up.forEach((f) => deleteFBO(gl, f));
    F.scene = createFBO(gl, this.W, this.H);
    F.bg = null;
    F.down = []; F.up = [];
    const levels = QUALITY[this.qualityId].bloom;
    let w = this.W >> 1, h = this.H >> 1;
    for (let i = 0; i < levels; i++) {
      F.down.push(createFBO(gl, Math.max(2, w), Math.max(2, h)));
      F.up.push(createFBO(gl, Math.max(2, w), Math.max(2, h)));
      w >>= 1; h >>= 1;
    }
  }

  // ───────────────────────────── object ─────────────────────────────
  /** obj comes from sampler.buildObject() (or rasterize* + buildObject) */
  setObject(obj, reupload = false) {
    const gl = this.gl;
    if (this.obj && this.obj !== obj && this.obj.video && this.obj.video !== obj.video) { try { this.obj.video.pause(); } catch { /* ignore */ } }
    this.obj = obj;
    // SDF → R16F, flipped so row 0 is the bottom (matches uv.y up)
    const { data, w, h } = obj.sdf;
    const flipped = new Float32Array(w * h);
    for (let y = 0; y < h; y++) flipped.set(data.subarray((h - 1 - y) * w, (h - y) * w), y * w);
    if (this.texSdf) gl.deleteTexture(this.texSdf);
    this.texSdf = createTexture(gl, { w, h, internal: gl.R16F, format: gl.RED, type: gl.FLOAT, data: flipped });
    if (this.texAlbedo) gl.deleteTexture(this.texAlbedo);
    if (obj.live) {
      this.texAlbedo = createTexture(gl, { w: 2, h: 2, data: new Uint8Array(16).fill(128) });
    } else {
      this.texAlbedo = createTexture(gl, { data: obj.canvas, flipY: true, mips: true });
      gl.bindTexture(gl.TEXTURE_2D, this.texAlbedo);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    this._buildMesh();
    this._sampleHomes();
    if (!reupload) this.driver.reset();
  }

  _sampleHomes() {
    if (!this.obj) return;
    const homes = sampleHomes(this.obj.sdf, this.particles.count, 11, 0.045);
    this.particles.setHomes(homes);
  }

  /** Jittered-grid triangle soup: every triangle is a "shard" with its own random & centroid. */
  _buildMesh() {
    const gl = this.gl;
    const aspect = this.obj ? this.obj.aspect : 1;
    const cells = QUALITY[this.qualityId].cells;
    const cols = clamp(Math.round(Math.sqrt(cells * aspect)), 8, 110);
    const rows = clamp(Math.round(cols / aspect), 6, 90);
    const pts = [];
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        const jx = edge ? 0 : (rnd() - 0.5) * 0.7, jy = edge ? 0 : (rnd() - 0.5) * 0.7;
        pts.push([(i + (i === 0 || i === cols ? 0 : jx)) / cols, (j + (j === 0 || j === rows ? 0 : jy)) / rows]);
      }
    }
    const tris = [];
    const at = (i, j) => pts[j * (cols + 1) + i];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
        if (rnd() < 0.5) { tris.push([a, b, c], [a, c, d]); } else { tris.push([a, b, d], [b, c, d]); }
      }
    }
    const n = tris.length * 3;
    const uv = new Float32Array(n * 2), cen = new Float32Array(n * 2), rn = new Float32Array(n * 3);
    tris.forEach((t, k) => {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const r = [rnd(), rnd(), rnd()];
      for (let v = 0; v < 3; v++) {
        const o = k * 3 + v;
        uv[o * 2] = t[v][0]; uv[o * 2 + 1] = t[v][1];
        cen[o * 2] = cx; cen[o * 2 + 1] = cy;
        rn[o * 3] = r[0]; rn[o * 3 + 1] = r[1]; rn[o * 3 + 2] = r[2];
      }
    });
    if (this.mesh) { gl.deleteVertexArray(this.mesh.vao); this.mesh.bufs.forEach((b) => gl.deleteBuffer(b)); }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const p = this.prog.mesh;
    const bufs = [];
    const attr = (name, data, size) => {
      const loc = p.attrib(name);
      const b = createBuffer(gl, data);
      bufs.push(b);
      if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
    };
    attr('aUv', uv, 2); attr('aCen', cen, 2); attr('aRnd', rn, 3);
    gl.bindVertexArray(null);
    this.mesh = { vao, bufs, count: n };
  }

  // ───────────────────────────── per-frame ─────────────────────────────
  _layout() {
    const A = this.W / this.H;
    const visH = 2 * D * Math.tan(CAMERA_FOV / 2), visW = visH * A;
    const o = this.obj;
    const c = o ? o.content : { u0: 0, u1: 1, v0: 0, v1: 1 };
    const asp = o ? o.aspect : 1;
    const cw = (c.u1 - c.u0) * asp, ch = c.v1 - c.v0;
    const size = this.cfg.size || 1;
    const fit = Math.min((visW * (A < 1 ? 0.7 : 0.8) * size) / cw, (visH * 0.7 * size) / ch);
    this.lay = {
      A, visW, visH, fit, aspect: asp,
      extent: Math.max(cw * fit, ch * fit),
      offX: ((c.u0 + c.u1) / 2 - 0.5) * asp, offY: -((c.v0 + c.v1) / 2 - 0.5),
    };
  }

  _processPointer(dt) {
    const p = this.pointer;
    if (!p._init) { p._px = p.x; p._py = p.y; p._init = true; }
    const dx = p.x - p._px, dy = p.y - p._py;
    p._px = p.x; p._py = p.y;
    const vx = dx / Math.max(dt, 1e-3), vy = dy / Math.max(dt, 1e-3);
    p.vx = damp(p.vx, vx, 14, dt); p.vy = damp(p.vy, vy, 14, dt);
    p.speed = Math.hypot(p.vx, p.vy);
  }

  update(dt, f) {
    dt = clamp(dt, 0, 0.05);
    if (f) this.features = f;
    f = this.features;
    this.time += dt;
    this.frameCount++;
    this._layout();
    const L = this.lay;
    const cfg = this.cfg;
    const preset = PRESETS[cfg.preset] || PRESETS.impact;
    this._processPointer(dt);

    const P = this.driver.update(dt, f, cfg, this.pointer, this.camera);

    // camera
    const camMode = cfg.camera === 'auto' ? preset.camera : cfg.camera;
    const pt = this.pointer;
    this.camera.update(dt, L.A, {
      mode: camMode, push: clamp(P.camPush, 0, 1.6), build: f.build || 0, dropSoon: f.dropSoon || 0,
      calm: f.calm ?? 1, energy: this.driver.s.energy,
      pointerX: pt.active ? pt.x : 0, pointerY: pt.active ? pt.y : 0,
      intensity: clamp(cfg.intensity, 0, 2), reduce: cfg.reduceMotion,
    });

    // model transform
    const S = L.fit * P.scale;
    this.offY = damp(this.offY || 0, cfg.offsetY || 0, 4.5, dt);
    const px = P.posX * L.visW * 0.5, py = (P.posY + this.offY) * L.visH * 0.5;
    mat4.compose(this.model, px - L.offX * S, py - L.offY * S, P.posZ, P.rotX, P.rotY, P.rotZ, S);
    mat4.normal3(this.nmat, this.model);

    // cursor → world / object uv
    unprojectToPlane(this._cw, this.camera.invVP, pt.x, pt.y, 0);
    this.cursorW[0] = this._cw[0]; this.cursorW[1] = this._cw[1];
    this.cursorUV[0] = (this._cw[0] - this.model[12]) / (S * L.aspect) + 0.5;
    this.cursorUV[1] = (this._cw[1] - this.model[13]) / S + 0.5;
    const glowT = pt.active ? clamp(0.35 + pt.speed * 0.5, 0, 1) : 0;
    this.cursorGlow = damp(this.cursorGlow, glowT, 4, dt);
    const lt = this.time;
    const lx = pt.active ? this._cw[0] : Math.sin(lt * 0.4) * 1.1 * (L.visW * 0.25);
    const ly = pt.active ? this._cw[1] : 0.7 + Math.cos(lt * 0.31) * 0.3;
    this.light[0] = damp(this.light[0], lx, 6, dt);
    this.light[1] = damp(this.light[1], ly, 6, dt);
    this.light[2] = 1.8;

    // clicks → bursts (handled below with particles)
    this._stepParticles(dt, P, L, S);
    this._adapt(dt);
  }

  _stepParticles(dt, P, L, S) {
    const ps = this.particles, sim = ps.sim, gl = this.gl;
    const wf = clamp(L.extent / 1.6, 0.35, 2.2);
    const pt = this.pointer;
    sim.use();
    sim.f('uDt', Math.min(dt, 1 / 30)).f('uTime', this.time).f('uMode', P.pMode);
    sim.m4('uModel', this.model).v2('uSize', L.aspect, 1);
    sim.f('uSpring', P.pSpring).f('uDamp', P.pDamp);
    sim.f('uFlow', P.pFlow * wf).f('uFlowScale', P.pFlowScale / wf);
    sim.f('uOrbit', P.pOrbit * wf).f('uOrbitMix', P.pOrbitMix).f('uOrbitR', P.pOrbitR * L.extent * 0.75);
    sim.f('uEmit', P.pEmit).f('uLifeDecay', P.pLife).f('uSwirl', P.pSwirl).f('uPull', P.pPull).f('uPush', P.pPush * wf);

    // burst: effect burst (from the object) or click burst (at the cursor)
    let bx = 0, by = 0, bz = 0, bs = 0, bf = P.bFrac;
    if (P.bStr > 0) {
      bx = this.model[12] + (P.bU - 0.5) * L.aspect * S;
      by = this.model[13] + (P.bV - 0.5) * S;
      bs = P.bStr * wf;
    }
    if (pt.clicks.length) {
      const c = pt.clicks.shift();
      bx = this._cw[0]; by = this._cw[1]; bs = Math.max(bs, 4.2 * wf); bf = Math.max(bf, 0.5);
      this.clickFlash = 1;
      pt.clicks.length = 0;
    }
    sim.v4('uBurst', bx, by, bz, bs).f('uBurstFrac', bf);

    // cursor force: fast movement → particles follow; slow → gentle; drag → strong pull
    const spd = clamp(pt.speed / 2.2, 0, 1);
    let cs = pt.active ? 0.2 + 1.1 * spd : 0;
    if (pt.down) cs = 2.4;
    sim.v4('uCursor', this._cw[0], this._cw[1], 0.15, cs * wf).f('uCursorR', 0.5 * wf + 0.15);
    ps.step(dt);
  }

  /** Adaptive resolution: judged on real wall-clock frame time, so slow machines settle quickly. */
  _adapt(dt) {
    if (this.fixed || !this.autoScale) return;
    const wall = this.wallDt || dt;
    if (wall > 0.6) return;                                   // tab was hidden / resumed — not a real measurement
    const ms = clamp(wall * 1000, 1, 600);
    this.frameMs += (ms - this.frameMs) * (ms > this.frameMs ? 0.25 : 0.06);
    this.stats.ms = this.frameMs; this.stats.fps = 1000 / this.frameMs;
    if (this.frameMs > 30) { this.slowFor += wall; this.fastFor = 0; }
    else if (this.frameMs < 15.5) { this.fastFor += wall; this.slowFor = 0; }
    else { this.slowFor = 0; this.fastFor = 0; }
    if (this.slowFor > 0.9 && this.renderScale > 0.4) {
      this.renderScale = Math.max(0.4, this.renderScale * (this.frameMs > 60 ? 0.7 : 0.85)); this.slowFor = 0; this.applySize();
      this.onEvent && this.onEvent({ type: 'scale', value: this.renderScale });
    } else if (this.fastFor > 6 && this.renderScale < 1) {
      this.renderScale = Math.min(1, this.renderScale * 1.12); this.fastFor = 0; this.applySize();
      this.onEvent && this.onEvent({ type: 'scale', value: this.renderScale });
    }
  }

  // ───────────────────────────── render ─────────────────────────────
  render() {
    if (this.lost) return;
    const gl = this.gl;
    const P = this.driver.P;
    const f = this.features;
    const cfg = this.cfg;
    const pal = resolvePalette(cfg.palette, cfg.customColors);
    const mat = MATERIALS[cfg.material] || MATERIALS.chrome;
    const bgDef = BACKGROUNDS.find((b) => b.id === cfg.background) || BACKGROUNDS[0];
    const s = this.driver.s;
    const L = this.lay;
    const o = this.obj;
    const W = this.W, H = this.H;
    const F = this.fbo;

    if (o && o.live && o.video && o.video.readyState >= 2) updateTexture(gl, this.texAlbedo, o.video, { flipY: true });

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.viewport(0, 0, W, H);

    // 1 ── background
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene.fbo);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVAO);
    const bg = this.prog.bg.use();
    bg.v2('uRes', W, H).f('uTime', this.time).f('uStyle', bgDef.index);
    bg.f('uEnergy', s.energy).f('uBass', s.bass).f('uMid', s.mid).f('uHigh', s.high).f('uFlash', P.flash + (this.clickFlash || 0) * 0.5).f('uBreath', P.breath);
    bg.v3a('uBg', pal.bg).v3a('uC0', pal.c0).v3a('uC1', pal.c1).v3a('uC2', pal.c2);
    bg.v3('uCursor', this.cursorUV[0], this.cursorUV[1], this.cursorGlow);
    bg.v2('uCam', this.camera.pos[0], this.camera.pos[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.clickFlash = (this.clickFlash || 0) * 0.9;

    // 2 ── glass needs the background as a refraction source
    const isGlass = mat.id === 'glass';
    if (isGlass) {
      if (!F.bg || F.bg.w !== W || F.bg.h !== H) { deleteFBO(gl, F.bg); F.bg = createFBO(gl, W, H); }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, F.scene.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, F.bg.fbo);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene.fbo);
    }

    // 3 ── object
    if (o && mat.id !== 'particle' && P.opacity > 0.003) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const m = this.prog.mesh.use();
      m.m4('uViewProj', this.camera.vp).m4('uModel', this.model).v2('uSize', L.aspect, 1);
      m.f('uShatter', P.shatter).f('uTime', this.time).f('uBend', P.bend).f('uLayerGap', P.layerGap * L.fit * 0.6).f('uLayers', P.layers).f('uTumble', P.tumble);
      m.v3('uImpact', P.impactU, P.impactV, P.impactS);
      m.tex('uSdf', 0, this.texSdf).tex('uAlbedo', 1, this.texAlbedo).tex('uBg', 2, isGlass ? F.bg.tex : this.texDummy);
      const xf = o.albXform || [1, 1, 0, 0];
      m.v4('uAlbXform', xf[0], xf[1], xf[2], xf[3]);
      m.v2('uRes', W, H).v2('uSdfTexel', 1 / o.sdf.w, 1 / o.sdf.h).f('uSdfRange', SDF_RANGE);
      m.f('uBevel', mat.bevel).f('uBump', mat.bump).f('uCrisp', o.crisp ? 1 : 0).f('uUseAlbedo', o.useAlbedo ? 1 : 0);
      m.f('uMat', mat.index).f('uOpacity', P.opacity).f('uBrightness', P.brightness * (cfg.textBrightness ?? 0.85));
      m.f('uBass', s.bass).f('uMid', s.mid).f('uHigh', s.high).f('uEnergy', s.energy).f('uBeat', s.beat).f('uFlash', P.flash);
      m.f('uWarp', P.warp).f('uWarpSpeed', P.warpSpeed).f('uGlitch', P.glitch).f('uPixel', P.pixel).f('uEnvRot', P.envRot).f('uFlavor', 0).f('uLayers', P.layers);
      m.v3a('uC0', pal.c0).v3a('uC1', pal.c1).v3a('uC2', pal.c2).v3a('uBgCol', pal.bg).v3a('uEnvLow', pal.envLow).v3a('uEnvHigh', pal.envHigh);
      m.v3a('uCam', this.camera.pos).v3a('uLightPos', this.light).m3('uNormalMat', this.nmat);
      m.v3('uCursor', this.cursorUV[0], this.cursorUV[1], clamp(this.pointer.speed / 2, 0, 1) * (this.pointer.active ? 1 : 0));
      gl.bindVertexArray(this.mesh.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.mesh.count, mat.id === 'paper' ? 3 : 1);
      gl.bindVertexArray(null);
    }

    // 4 ── particles (additive)
    if (o) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const d = this.particles.draw.use();
      d.m4('uViewProj', this.camera.vp);
      const pxScale = H / (2 * Math.tan(CAMERA_FOV / 2));
      const react = cfg.particleReactivity !== undefined ? cfg.particleReactivity : 1.0;
      const brightMult = cfg.textBrightness !== undefined ? cfg.textBrightness : 0.85;
      const pSizeMod = 1.0 + (0.35 * s.beat + 0.25 * s.bass) * react;
      d.f('uPointSize', P.pSize * 0.0036 * pSizeMod).f('uDensity', P.pDensity).f('uMode', P.pMode).f('uPxScale', pxScale * 1.0).f('uTime', this.time);
      const pBright = (0.75 + (0.35 * s.beat + 0.2 * s.energy) * react) * brightMult;
      d.f('uUseAlbedo', o.useAlbedo ? 1 : 0).f('uBrightness', pBright).f('uHighJitter', P.pJitter);
      const xf = o.albXform || [1, 1, 0, 0];
      d.v4('uAlbXform', xf[0], xf[1], xf[2], xf[3]);
      d.v3a('uC0', pal.c0).v3a('uC1', pal.c1).v3a('uC2', pal.c2);
      // Normalized intensity: when thousands of particles overlap on text (P.pMode === 0),
      // we must scale intensity down so they don't form a 300+ HDR white blinding bar!
      const baseIntensity = P.pMode === 0 ? 0.16 : 0.28;
      d.f('uSquare', P.pSquare).f('uIntensity', baseIntensity * P.pIntensity * (0.6 + 0.3 * s.high + 0.25 * s.beat * react) * brightMult * Math.pow(1e5 / this.particles.count, 0.6));
      d.tex('uAlbedo', 0, this.texAlbedo);
      this.particles.render();
    }
    gl.disable(gl.BLEND);

    // 5 ── bloom
    const levels = F.down.length;
    const bloomAmt = pal.bloom * clamp(P.glow, 0, 3) * (this.qualityId === 'performance' ? 0.9 : 1);
    let src = F.scene;
    const dn = this.prog.down.use();
    for (let i = 0; i < levels; i++) {
      const t = F.down[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      dn.tex('uTex', 0, src.tex).v2('uTexel', 1 / src.w, 1 / src.h).f('uThreshold', i === 0 ? 1.25 : 0).f('uFirst', i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = t;
    }
    const up = this.prog.up.use();
    let low = F.down[levels - 1];
    for (let i = levels - 2; i >= 0; i--) {
      const t = F.up[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      up.tex('uLow', 0, low.tex).tex('uHigh', 1, F.down[i].tex).v2('uTexel', 1 / low.w, 1 / low.h).f('uScatter', 0.62);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      low = t;
    }
    const bloomTex = levels > 1 ? F.up[0].tex : F.down[0].tex;

    // 6 ── composite to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const c = this.prog.comp.use();
    c.tex('uScene', 0, F.scene.tex).tex('uBloom', 1, bloomTex).tex('uSig', 2, this.texSig);
    const glowMult = cfg.glow !== undefined ? cfg.glow : 0.85;
    c.v2('uRes', W, H).f('uTime', this.time).f('uBloomAmt', bloomAmt * glowMult * 0.28).f('uExposure', P.exposure * (0.95 + 0.1 * pal.bloom));
    c.f('uCA', P.ca).f('uRadial', P.radial).f('uGlitch', P.glitch).f('uFlash', P.flash * 0.6 + (this.clickFlash || 0) * 0.15).f('uGrain', 0.028).f('uVignette', P.vignette);
    const sigW = W < H ? 0.8 : 0.52, sigH = (sigW * (W / H)) / this.sigAspect;
    c.v4('uSigRect', 0.5 - sigW / 2, 0.5 - sigH / 2, sigW, sigH).f('uSigAlpha', this.sig.alpha).f('uFade', this.sig.fade).f('uGrade', pal.grade);
    c.v3a('uC0', pal.c0).v3a('uC2', pal.c2).v3a('uBg', pal.bg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  frame(dt, f) {
    if (this.lost) return;
    this.update(dt, f);
    this.render();
    if (this.afterRender) this.afterRender(this);
  }

  /** Render right now and return a Blob of the canvas (PNG by default). */
  captureFrame(type = 'image/png', quality = 0.95) {
    this.render();
    return new Promise((res) => this.canvas.toBlob((b) => res(b), type, quality));
  }

  dispose() {
    const gl = this.gl;
    try {
      this.particles.dispose();
      Object.values(this.prog).forEach((p) => gl.deleteProgram(p.p));
      const F = this.fbo;
      [F.scene, F.bg, ...F.down, ...F.up].forEach((f) => deleteFBO(gl, f));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* ignore */ }
  }
}
