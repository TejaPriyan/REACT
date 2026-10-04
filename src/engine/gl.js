// Thin WebGL2 helpers: context, programs (with uniform caching), textures, framebuffers.

export function createContext(canvas, { preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: preserve,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

export function capabilities(gl) {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
  return {
    renderer,
    software: /swiftshader|llvmpipe|software|basic render/i.test(renderer),
    floatRT: !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float'),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
}

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const lines = src.split('\n').map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n');
    console.error(`[gl] ${label || ''} shader compile error:\n${log}\n${lines}`);
    throw new Error(`Shader compile failed (${label}): ${log}`);
  }
  return sh;
}

export class Program {
  constructor(gl, vs, fs, { varyings = null, label = '' } = {}) {
    this.gl = gl;
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, label + ':vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, label + ':fs'));
    if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      console.error(`[gl] ${label} link error: ${log}`);
      throw new Error(`Program link failed (${label}): ${log}`);
    }
    this.p = p;
    this.loc = new Map();
    this.label = label;
  }
  use() { this.gl.useProgram(this.p); return this; }
  u(name) {
    let l = this.loc.get(name);
    if (l === undefined) { l = this.gl.getUniformLocation(this.p, name); this.loc.set(name, l); }
    return l;
  }
  attrib(name) { return this.gl.getAttribLocation(this.p, name); }
  f(name, v) { const l = this.u(name); if (l) this.gl.uniform1f(l, v); return this; }
  i(name, v) { const l = this.u(name); if (l) this.gl.uniform1i(l, v); return this; }
  v2(name, x, y) { const l = this.u(name); if (l) this.gl.uniform2f(l, x, y); return this; }
  v3(name, x, y, z) { const l = this.u(name); if (l) this.gl.uniform3f(l, x, y, z); return this; }
  v3a(name, a) { const l = this.u(name); if (l) this.gl.uniform3f(l, a[0], a[1], a[2]); return this; }
  v4(name, x, y, z, w) { const l = this.u(name); if (l) this.gl.uniform4f(l, x, y, z, w); return this; }
  m4(name, m) { const l = this.u(name); if (l) this.gl.uniformMatrix4fv(l, false, m); return this; }
  m3(name, m) { const l = this.u(name); if (l) this.gl.uniformMatrix3fv(l, false, m); return this; }
  tex(name, unit, texture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const l = this.u(name);
    if (l) gl.uniform1i(l, unit);
    return this;
  }
}

export function createTexture(gl, { w = 1, h = 1, internal, format, type, data = null, filter = 'linear', wrap = 'clamp', mips = false, flipY = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  internal = internal || gl.RGBA8;
  format = format || gl.RGBA;
  type = type || gl.UNSIGNED_BYTE;
  if (data && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, format, type, data); // canvas / image / video
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  }
  const min = mips ? gl.LINEAR_MIPMAP_LINEAR : filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === 'nearest' ? gl.NEAREST : gl.LINEAR);
  const wr = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  return t;
}

export function updateTexture(gl, tex, source, { flipY = true, mips = false } = {}) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

export function createFBO(gl, w, h, { float = true } = {}) {
  w = Math.max(2, Math.round(w));
  h = Math.max(2, Math.round(h));
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok && float) { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); return createFBO(gl, w, h, { float: false }); }
  return { fbo, tex, w, h, float };
}

export function deleteFBO(gl, f) {
  if (!f) return;
  gl.deleteFramebuffer(f.fbo);
  gl.deleteTexture(f.tex);
}

export function createBuffer(gl, data, usage) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
  return b;
}
