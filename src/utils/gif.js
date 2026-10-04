// A small, dependency-free GIF89a encoder: global palette (median cut over all frames),
// ordered dithering, LZW. Runs in the browser, yields to the UI between frames.

function medianCut(hist, maxColors) {
  // hist: Uint32Array(32768) of 5-5-5 colour counts
  const px = [];
  for (let i = 0; i < 32768; i++) if (hist[i]) px.push(i);
  if (!px.length) return [[0, 0, 0]];
  const r = (c) => (c >> 10) & 31, g = (c) => (c >> 5) & 31, b = (c) => c & 31;
  let boxes = [{ items: px }];
  const stat = (box) => {
    let rmin = 31, rmax = 0, gmin = 31, gmax = 0, bmin = 31, bmax = 0, n = 0;
    for (const c of box.items) {
      const R = r(c), G = g(c), B = b(c);
      if (R < rmin) rmin = R; if (R > rmax) rmax = R;
      if (G < gmin) gmin = G; if (G > gmax) gmax = G;
      if (B < bmin) bmin = B; if (B > bmax) bmax = B;
      n += hist[c];
    }
    // perceptual-ish weights so dark gradients (glows) get more palette entries
    const dr = (rmax - rmin) * 0.9, dg = (gmax - gmin) * 1.2, db = (bmax - bmin) * 0.7;
    box.n = n; box.axis = dg >= dr && dg >= db ? 1 : dr >= db ? 0 : 2; box.range = Math.max(dr, dg, db);
  };
  stat(boxes[0]);
  while (boxes.length < maxColors) {
    let bi = -1, best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i];
      if (bx.items.length > 1 && bx.range * Math.sqrt(bx.n) > best) { best = bx.range * Math.sqrt(bx.n); bi = i; }
    }
    if (bi < 0) break;
    const bx = boxes[bi];
    const f = bx.axis === 0 ? r : bx.axis === 1 ? g : b;
    bx.items.sort((p, q) => f(p) - f(q));
    let half = bx.n / 2, acc = 0, cut = 1;
    for (let i = 0; i < bx.items.length - 1; i++) { acc += hist[bx.items[i]]; if (acc >= half) { cut = i + 1; break; } cut = i + 1; }
    const a = { items: bx.items.slice(0, cut) }, c = { items: bx.items.slice(cut) };
    stat(a); stat(c);
    boxes.splice(bi, 1, a, c);
  }
  return boxes.map((bx) => {
    let R = 0, G = 0, B = 0, n = 0;
    for (const c of bx.items) { const w = hist[c]; R += r(c) * w; G += g(c) * w; B += b(c) * w; n += w; }
    n = n || 1;
    const e = (v) => Math.max(0, Math.min(255, Math.round((v / n) * 8 + 4)));
    return [e(R), e(G), e(B)];
  });
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function buildLookup(palette) {
  const lut = new Uint8Array(32768);
  for (let c = 0; c < 32768; c++) {
    const R = ((c >> 10) & 31) * 8 + 4, G = ((c >> 5) & 31) * 8 + 4, B = (c & 31) * 8 + 4;
    let best = 0, bd = 1e9;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dr = R - p[0], dg = G - p[1], db = B - p[2];
      const d = dr * dr * 0.9 + dg * dg * 1.3 + db * db * 0.6;
      if (d < bd) { bd = d; best = i; }
    }
    lut[c] = best;
  }
  return lut;
}

function lzw(indices, minCode, out) {
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1;
  const table = new Int16Array(1 << 20);
  let cur = 0, shift = 0;
  const bytes = [];
  const emit = (code) => {
    cur |= code << shift; shift += size;
    while (shift >= 8) { bytes.push(cur & 255); cur >>>= 8; shift -= 8; }
  };
  emit(clear);
  let ib = indices[0];
  for (let i = 1, n = indices.length; i < n; i++) {
    const k = indices[i];
    const key = (ib << 8) | k;
    const code = table[key];
    if (code === 0) {
      emit(ib);
      if (next === 4096) { emit(clear); next = eoi + 1; size = minCode + 1; table.fill(0); }
      else { if (next >= (1 << size)) size++; table[key] = next++; }
      ib = k;
    } else ib = code;
  }
  emit(ib); emit(eoi);
  if (shift > 0) bytes.push(cur & 255);
  out.push(minCode);
  for (let i = 0; i < bytes.length; i += 255) {
    const len = Math.min(255, bytes.length - i);
    out.push(len);
    for (let j = 0; j < len; j++) out.push(bytes[i + j]);
  }
  out.push(0);
}

/**
 * frames: array of Uint8ClampedArray RGBA (W×H). Returns a Blob (image/gif).
 * onProgress(0..1) is called while encoding; the UI thread is released between frames.
 */
export async function encodeGif(frames, W, H, { delay = 7, onProgress, shouldCancel } = {}) {
  const hist = new Uint32Array(32768);
  const stride = Math.max(1, Math.floor((W * H) / 9000));
  for (const f of frames) {
    for (let p = 0; p < W * H; p += stride) {
      const o = p * 4;
      hist[((f[o] >> 3) << 10) | ((f[o + 1] >> 3) << 5) | (f[o + 2] >> 3)]++;
    }
  }
  const palette = medianCut(hist, 256);
  const lut = buildLookup(palette);
  const out = [];
  const w16 = (v) => { out.push(v & 255, (v >> 8) & 255); };
  out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
  w16(W); w16(H);
  out.push(0xf7, 0, 0);                                  // global colour table, 256 entries
  for (let i = 0; i < 256; i++) { const p = palette[i] || [0, 0, 0]; out.push(p[0], p[1], p[2]); }
  out.push(0x21, 0xff, 0x0b, ...'NETSCAPE2.0'.split('').map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0); // loop forever
  const idx = new Uint8Array(W * H);
  for (let fi = 0; fi < frames.length; fi++) {
    const f = frames[fi];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const d = (BAYER[((y & 3) << 2) | (x & 3)] - 7.5) * 0.85;
        const r = Math.max(0, Math.min(255, f[o] + d)), g = Math.max(0, Math.min(255, f[o + 1] + d)), b = Math.max(0, Math.min(255, f[o + 2] + d));
        idx[y * W + x] = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      }
    }
    out.push(0x21, 0xf9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0);   // graphic control: no disposal, delay
    out.push(0x2c); w16(0); w16(0); w16(W); w16(H); out.push(0);
    lzw(idx, 8, out);
    onProgress && onProgress((fi + 1) / frames.length);
    await new Promise((r) => setTimeout(r, 0));
    if (shouldCancel && shouldCancel()) return null;
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
