// Turns "an object" (text / logo / image / video) into GPU-ready data:
//   • an albedo canvas (colour + alpha),
//   • a signed-distance field in *stroke units* (so bevels, neon glow and liquid wobble scale with the type),
//   • sample points on the shape for the particle system.
//
// Everything is CPU-side, one-off work that happens when the object changes (never per frame).

export const FONTS = {
  display:   { label: 'DISPLAY',   family: '"Syne", "Arial Black", "Helvetica Neue", Arial, sans-serif', def: 800 },
  condensed: { label: 'CONDENSED', family: '"Anton", Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif', def: 400 },
  wide:      { label: 'WIDE',      family: '"Unbounded", "Arial Black", Verdana, sans-serif', def: 800 },
  grotesk:   { label: 'GROTESK',   family: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif', def: 700 },
  serif:     { label: 'EDITORIAL', family: '"Playfair Display", Georgia, "Times New Roman", serif', def: 900 },
  mono:      { label: 'MONO',      family: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace', def: 500 },
};

export const SDF_RANGE = 16; // stored value = signedDistanceInUnits / SDF_RANGE, clamped to [-1, 1]

export function registerCustomFont(fontId, name, family, defWeight = 700) {
  FONTS[fontId] = { label: name.toUpperCase().slice(0, 14), family, def: defWeight, custom: true };
  return FONTS[fontId];
}

export async function loadFontFile(file) {
  if (!file) return null;
  const ab = await file.arrayBuffer();
  const cleanName = (file.name || 'Custom Font').replace(/\.[^/.]+$/, '').slice(0, 14);
  const family = `UserFont_${Date.now()}`;
  const face = new FontFace(family, ab);
  await face.load();
  document.fonts.add(face);
  const fontId = `custom_${Date.now()}`;
  registerCustomFont(fontId, cleanName, `"${family}", sans-serif`, 700);
  return { id: fontId, label: cleanName.toUpperCase(), family };
}

export function ensureFont(fontKey, weight) {
  const f = FONTS[fontKey] || FONTS.display;
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const t = new Promise((r) => setTimeout(r, 1200));
  return Promise.race([document.fonts.load(`${weight} 80px ${f.family}`, 'ABC abc 123'), t]).catch(() => {});
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

function alphaBounds(canvas) {
  const w = canvas.width, h = canvas.height;
  const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  return { x0, y0, x1, y1 };
}

// ───────────────────────────── text ─────────────────────────────
/** True when the real web font is available (otherwise a system fallback is used and gets synthetic weight). */
function fontReady(font, weight) {
  try {
    const first = font.family.split(',')[0].trim();
    return !document.fonts || document.fonts.check(`${weight} 40px ${first}`, 'ABC');
  } catch { return true; }
}

export function rasterizeText(o, frameAspect = 1) {
  const font = FONTS[o.font] || FONTS.display;
  let text = (o.text ?? '').toString();
  if (!text.trim()) text = ' ';
  let lines = text.split('\n');
  // Portrait frames: stack words so the typography stays big (a real motion-design move).
  if (o.stack !== false && lines.length === 1 && frameAspect < 0.85) {
    const words = text.trim().split(/\s+/);
    if (words.length > 1 && words.length <= 4) lines = words;
  }
  const fontPx = 320;
  const weight = o.weight || font.def;
  const spacing = (o.spacing || 0) * fontPx;
  const lineStep = fontPx * (o.lineHeight ?? 0.95);
  // fallback fonts are thinner than the display faces this tool is designed around: add weight so the shapes stay bold
  const bold = fontReady(font, weight) ? 0 : fontPx * (weight >= 700 ? 0.04 : weight >= 500 ? 0.022 : 0.01);

  const probe = makeCanvas(8, 8).getContext('2d');
  probe.font = `${weight} ${fontPx}px ${font.family}`;
  const measure = (line) => {
    const m = probe.measureText(line);
    return m.width + spacing * Math.max(0, [...line].length - 1) + bold * 2;
  };
  const widths = lines.map(measure);
  const maxW = Math.max(...widths, 1);
  const blockH = (lines.length - 1) * lineStep + fontPx * 1.1;

  // Draw with a big margin first, then crop to real glyph bounds so fitting is exact.
  const margin = fontPx * 0.6;
  const work = makeCanvas(maxW + margin * 2, blockH + margin * 2);
  const ctx = work.getContext('2d', { willReadFrequently: true });
  ctx.font = `${weight} ${fontPx}px ${font.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.lineWidth = bold * 2;
  const put = (str, x, y) => { if (bold) ctx.strokeText(str, x, y); ctx.fillText(str, x, y); };
  const align = o.align || 'center';
  lines.forEach((line, i) => {
    const y = margin + fontPx * 0.86 + i * lineStep;
    const lw = widths[i];
    const x0 = (align === 'left' ? margin : align === 'right' ? margin + maxW - lw : margin + (maxW - lw) / 2) + bold;
    if (Math.abs(spacing) < 0.01) {
      put(line, x0, y);
    } else {
      const chars = [...line];
      for (let k = 0; k < chars.length; k++) {
        const prefix = chars.slice(0, k).join('');
        const x = x0 + (k ? ctx.measureText(prefix).width : 0) + spacing * k;
        put(chars[k], x, y);
      }
    }
  });

  const b = alphaBounds(work);
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const pad = 0.07 * bw + 0.55 * bh;
  let W = bw + pad * 2, H = bh + pad * 2;
  const s = Math.min(1, 2048 / Math.max(W, H));
  const out = makeCanvas(W * s, H * s);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(work, b.x0, b.y0, bw, bh, pad * s, pad * s, bw * s, bh * s);
  return {
    kind: 'text',
    canvas: out,
    aspect: out.width / out.height,
    content: { u0: (pad * s) / out.width, u1: 1 - (pad * s) / out.width, v0: (pad * s) / out.height, v1: 1 - (pad * s) / out.height },
    useAlbedo: 0,
    crisp: 1,
    lines: lines.length,
  };
}

// ───────────────────────────── image / logo ─────────────────────────────
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function rasterizeImage(url, {
  isSvg = false,
  text = '',
  fontKey = 'display',
  weight = 800,
  textPos = 'bottom',
  textColor = '#ffffff',
} = {}) {
  const img = await loadImage(url);
  let nw = img.naturalWidth || 1024, nh = img.naturalHeight || 1024;
  if (isSvg && (!img.naturalWidth || !img.naturalHeight)) { nw = 1024; nh = 1024; }
  const target = isSvg ? 1600 : 1800;
  const sc = target / Math.max(nw, nh);
  const dw = Math.round(nw * (isSvg ? sc : Math.min(1, sc))), dh = Math.round(nh * (isSvg ? sc : Math.min(1, sc)));

  // alpha probe → logo vs photo
  const probe = makeCanvas(64, 64);
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, 0, 0, 64, 64);
  const pd = pctx.getImageData(0, 0, 64, 64).data;
  let transparent = 0;
  for (let i = 3; i < pd.length; i += 4) if (pd[i] < 240) transparent++;
  const isLogo = transparent / (64 * 64) > 0.03;

  const fontDef = FONTS[fontKey] || FONTS.display;
  const cleanText = (text || '').trim();
  const hasText = cleanText.length > 0;
  const lines = hasText ? cleanText.split('\n') : [];
  const fontPx = Math.round(Math.min(dw, dh) * (lines.length > 2 ? 0.09 : 0.13));
  const lineStep = Math.round(fontPx * 1.15);
  const textH = lines.length * lineStep;
  const isBelow = hasText && textPos === 'below';
  const extraH = isBelow ? textH + Math.round(fontPx * 0.8) : 0;

  const pad = Math.round(Math.max(dw, dh) * 0.09);
  const cv = makeCanvas(dw + pad * 2, dh + extraH + pad * 2);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';

  if (isLogo) {
    ctx.drawImage(img, pad, pad, dw, dh);
  } else {
    ctx.save();
    roundRect(ctx, pad, pad, dw, dh, Math.min(dw, dh) * 0.025);
    ctx.clip();
    ctx.drawImage(img, pad, pad, dw, dh);
    ctx.restore();
  }

  // Draw overlay or below text
  if (hasText) {
    ctx.save();
    ctx.font = `${weight} ${fontPx}px ${fontDef.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let textStartY;
    if (isBelow) {
      textStartY = pad + dh + fontPx * 0.8;
    } else if (textPos === 'top') {
      textStartY = pad + fontPx * 0.9;
      if (!isLogo) {
        const scrim = ctx.createLinearGradient(0, pad, 0, pad + textH + fontPx * 1.2);
        scrim.addColorStop(0, 'rgba(0,0,0,0.85)');
        scrim.addColorStop(0.7, 'rgba(0,0,0,0.4)');
        scrim.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = scrim;
        ctx.fillRect(pad, pad, dw, textH + fontPx * 1.2);
      }
    } else if (textPos === 'center') {
      textStartY = pad + (dh - textH) / 2 + fontPx * 0.5;
      if (!isLogo) {
        const scrim = ctx.createRadialGradient(pad + dw / 2, pad + dh / 2, fontPx, pad + dw / 2, pad + dh / 2, Math.max(dw, dh) * 0.55);
        scrim.addColorStop(0, 'rgba(0,0,0,0.75)');
        scrim.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = scrim;
        ctx.fillRect(pad, pad, dw, dh);
      }
    } else { // 'bottom'
      textStartY = pad + dh - textH - fontPx * 0.25;
      if (!isLogo) {
        const scrim = ctx.createLinearGradient(0, pad + dh - textH - fontPx * 1.4, 0, pad + dh);
        scrim.addColorStop(0, 'rgba(0,0,0,0)');
        scrim.addColorStop(0.3, 'rgba(0,0,0,0.5)');
        scrim.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = scrim;
        ctx.fillRect(pad, pad + dh - textH - fontPx * 1.4, dw, textH + fontPx * 1.4);
      }
    }

    lines.forEach((line, idx) => {
      const y = textStartY + idx * lineStep;
      const x = pad + dw / 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.lineWidth = Math.max(3, fontPx * 0.08);
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, y);

      ctx.fillStyle = textColor || '#ffffff';
      ctx.fillText(line, x, y);
    });
    ctx.restore();
  }

  let content;
  if (isLogo || hasText) {
    const b = alphaBounds(cv);
    content = { u0: b.x0 / cv.width, u1: (b.x1 + 1) / cv.width, v0: b.y0 / cv.height, v1: (b.y1 + 1) / cv.height };
  } else {
    content = { u0: pad / cv.width, u1: 1 - pad / cv.width, v0: pad / cv.height, v1: 1 - pad / cv.height };
  }
  return { kind: isLogo ? 'logo' : 'image', canvas: cv, aspect: cv.width / cv.height, content, useAlbedo: 1, crisp: 1 };
}

// ───────────────────────────── video ─────────────────────────────
export async function rasterizeVideo(url) {
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  await new Promise((res, rej) => {
    video.onloadeddata = res;
    video.onerror = () => rej(new Error('This browser cannot play that video file.'));
    setTimeout(() => rej(new Error('Video took too long to load.')), 12000);
  });
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  const sc = 1400 / Math.max(vw, vh);
  const dw = Math.round(vw * Math.min(1, sc)), dh = Math.round(vh * Math.min(1, sc));
  const pad = Math.round(Math.max(dw, dh) * 0.09);
  const cv = makeCanvas(dw + pad * 2, dh + pad * 2);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  roundRect(ctx, pad, pad, dw, dh, Math.min(dw, dh) * 0.025);
  ctx.fill();
  const W = cv.width, H = cv.height;
  try { await video.play(); } catch { /* muted autoplay is normally allowed */ }
  return {
    kind: 'video',
    canvas: cv, // mask only
    video,
    aspect: W / H,
    content: { u0: pad / W, u1: 1 - pad / W, v0: pad / H, v1: 1 - pad / H },
    useAlbedo: 1,
    crisp: 0,
    live: true,
    // sampling the raw video texture: albUv = (uv - offset) * scale
    albXform: [W / dw, H / dh, pad / W, pad / H],
  };
}

// ───────────────────────────── SDF ─────────────────────────────
const INF = 1e20;

function edt1d(grid, offset, stride, length, f, v, z) {
  v[0] = 0; z[0] = -INF; z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k], qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
function edt(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), v = new Uint16Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
}

/** Signed distance (positive inside) in *stroke units*, packed to [-1,1] for an R16F texture. */
export function computeSDF(canvas, maxW = 1280) {
  const sw = Math.min(maxW, canvas.width);
  const sh = Math.max(2, Math.round((sw * canvas.height) / canvas.width));
  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);
  const N = sw * sh;
  const outer = new Float64Array(N), inner = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = data[i * 4 + 3] / 255;
    outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
    inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
  }
  edt(outer, sw, sh);
  edt(inner, sw, sh);
  const signed = new Float32Array(N);
  let insideCount = 0;
  for (let i = 0; i < N; i++) {
    const d = Math.sqrt(inner[i]) - Math.sqrt(outer[i]);
    signed[i] = d;
    if (d > 0) insideCount++;
  }
  // robust stroke half-width: 85th percentile of interior distances, capped
  const interior = new Float32Array(insideCount);
  for (let i = 0, k = 0; i < N; i++) if (signed[i] > 0) interior[k++] = signed[i];
  interior.sort();
  const p85 = insideCount ? interior[Math.floor(insideCount * 0.85)] : 6;
  const unit = Math.max(3, Math.min(p85, 0.0125 * sw));
  const packed = new Float32Array(N);
  const insideIdx = new Uint32Array(insideCount);
  let edgeCount = 0;
  for (let i = 0, k = 0; i < N; i++) {
    const su = signed[i] / unit;
    packed[i] = Math.max(-1, Math.min(1, su / SDF_RANGE));
    if (signed[i] > 0) { insideIdx[k++] = i; if (su < 1.4) edgeCount++; }
  }
  const edgeIdx = new Uint32Array(edgeCount);
  for (let j = 0, k = 0; j < insideCount; j++) { const i = insideIdx[j]; if (signed[i] / unit < 1.4) edgeIdx[k++] = i; }
  return { data: packed, w: sw, h: sh, unit, insideIdx, edgeIdx, signed };
}

/** Random points on the shape: uv (y up), pillow height, and a role random in [0,1). */
export function sampleHomes(sdfInfo, count, seed = 7, depth = 0.05, rect = null) {
  const out = new Float32Array(count * 4);
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const { w, h, insideIdx, edgeIdx, signed, unit } = sdfInfo;
  const has = insideIdx.length > 0;
  for (let i = 0; i < count; i++) {
    let u, v, z = 0;
    if (!has) { u = 0.5 + (rnd() - 0.5) * 0.4; v = 0.5 + (rnd() - 0.5) * 0.2; }
    else {
      const useEdge = edgeIdx.length > 0 && rnd() < 0.42;
      const idx = useEdge ? edgeIdx[(rnd() * edgeIdx.length) | 0] : insideIdx[(rnd() * insideIdx.length) | 0];
      const px = idx % w, py = (idx / w) | 0;
      u = (px + rnd()) / w;
      v = 1 - (py + rnd()) / h;
      const su = Math.max(0, signed[idx]) / unit;
      const t = Math.min(1, su / 1.4);
      z = Math.sqrt(1 - (1 - t) * (1 - t)) * depth * (0.7 + rnd() * 0.6);
    }
    out[i * 4] = u; out[i * 4 + 1] = v; out[i * 4 + 2] = z; out[i * 4 + 3] = rnd();
  }
  return out;
}

/** Full object build used by the engine. */
export function buildObject(raster) {
  const t0 = performance.now();
  const sdf = computeSDF(raster.canvas);
  return { ...raster, sdf, buildMs: performance.now() - t0 };
}

// ───────────────────────────── sign-off ─────────────────────────────
export function renderSignature(text = 'MADE WITH REACT') {
  const px = 64;
  const c = makeCanvas(1400, 160);
  const ctx = c.getContext('2d');
  ctx.font = `600 ${px * 0.95}px "Space Grotesk", "Inter", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const spacing = px * 0.34;
  const chars = [...text];
  const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width + spacing, -spacing);
  let x = (c.width - total) / 2;
  for (const ch of chars) { ctx.fillText(ch, x, c.height / 2); x += ctx.measureText(ch).width + spacing; }
  return { canvas: c, aspect: c.width / c.height };
}
