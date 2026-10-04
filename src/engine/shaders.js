// All GLSL lives here. WebGL2 / GLSL ES 3.00.
// Pipeline: BG → object (shard mesh, uber-material) → GPU particles → bloom → composite/grade.

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

export const COMMON = `
#define PI 3.14159265359
#define TAU 6.28318530718
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y);
}
float fbm2(vec2 p){
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; }
  return s;
}
float n3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = h31(i), b = h31(i + vec3(1., 0., 0.)), c = h31(i + vec3(0., 1., 0.)), d = h31(i + vec3(1., 1., 0.));
  float e = h31(i + vec3(0., 0., 1.)), g = h31(i + vec3(1., 0., 1.)), h = h31(i + vec3(0., 1., 1.)), k = h31(i + vec3(1., 1., 1.));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
vec3 curl3(vec3 p){
  const float e = .35;
  vec3 dx = vec3(e, 0., 0.), dy = vec3(0., e, 0.), dz = vec3(0., 0., e);
  float x1 = n3(p + dy + vec3(11.3, 0., 0.)), x2 = n3(p - dy + vec3(11.3, 0., 0.));
  float y1 = n3(p + dz + vec3(0., 27.7, 0.)), y2 = n3(p - dz + vec3(0., 27.7, 0.));
  float z1 = n3(p + dx + vec3(0., 0., 5.9)),  z2 = n3(p - dx + vec3(0., 0., 5.9));
  float a1 = n3(p + dz + vec3(11.3, 0., 0.)), a2 = n3(p - dz + vec3(11.3, 0., 0.));
  float b1 = n3(p + dx + vec3(0., 27.7, 0.)), b2 = n3(p - dx + vec3(0., 27.7, 0.));
  float c1 = n3(p + dy + vec3(0., 0., 5.9)),  c2 = n3(p - dy + vec3(0., 0., 5.9));
  return vec3(c1 - c2 - (y1 - y2), a1 - a2 - (z1 - z2), b1 - b2 - (x1 - x2)) / (2. * e);
}
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
`;

export const FULLSCREEN_VS = `${HEAD}
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

// ───────────────────────────── background ─────────────────────────────
export const BG_FS = `${HEAD}${COMMON}
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
uniform float uTime, uStyle, uEnergy, uBass, uMid, uHigh, uFlash, uBreath, uCamZ;
uniform vec3 uBg, uC0, uC1, uC2;
uniform vec3 uCursor;   // uv.xy, glow strength
uniform vec2 uCam;      // parallax offset
void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - .5) * vec2(asp, 1.) * 2.;
  p += uCam * .12;
  float t = uTime;
  vec3 col = uBg;
  float r = length(p);
  float e = uEnergy;

  if (uStyle < .5) {                       // VOID — near black, breathing halo
    float halo = exp(-r * r * 1.6);
    col += uC0 * halo * (.045 + .10 * e + .05 * uBass);
    col += uC2 * exp(-pow(length(p * vec2(.55, 1.6) - vec2(0., -.55)), 2.) * 2.4) * (.02 + .05 * e);
    col += (fbm2(p * 1.6 + t * .03) - .5) * .018;
  } else if (uStyle < 1.5) {               // AURORA — slow ribbons
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      float y = p.y + .34 * sin(p.x * (1.2 + fi * .35) + t * (.11 + fi * .05) + fi * 2.1) + (fbm2(p * vec2(1.1, .8) + vec2(t * .04, fi * 9.)) - .5) * .8 - (fi - 1.) * .32;
      float rib = exp(-y * y * (5. + 3. * fi));
      vec3 c = fi < .5 ? uC0 : (fi < 1.5 ? uC2 : uC1);
      col += c * rib * (.10 + .20 * e + .10 * uMid) * (1. - .35 * fi);
    }
    col += uC0 * exp(-r * r * 2.) * .03;
  } else if (uStyle < 2.5) {               // GRID — synthwave-free perspective floor
    float hz = -.12;
    float sky = smoothstep(hz, .9, p.y);
    col += mix(uC2, uC0, .5) * .05 * (1. - sky) * exp(-abs(p.y - hz) * 4.);
    col += uC1 * exp(-pow(length(p - vec2(0., hz + .18)), 2.) * 5.) * (.05 + .1 * e);
    if (p.y < hz) {
      float z = 1. / (hz - p.y + .015);
      float sp = t * (.25 + e * 1.6);
      vec2 g = vec2(p.x * z * .9, z + sp);
      vec2 gl = abs(fract(g) - .5);
      float lw = .05 + .05 * uBass + z * .004;
      float line = smoothstep(.5 - lw, .5, max(gl.x, gl.y));
      float fade = exp(-z * .09);
      col += mix(uC0, uC2, .4) * line * fade * (.22 + .35 * e);
    }
  } else if (uStyle < 3.5) {               // STUDIO — spotlight cyclorama
    float spot = exp(-pow(length(p * vec2(.75, 1.)), 2.) * 1.15);
    col += mix(uC2, uC1, .35) * spot * (.10 + .10 * e);
    float floorLine = smoothstep(.04, -.04, p.y + .62);
    col += uC0 * floorLine * .045 * (1. + uBass);
    col *= 1. - .35 * smoothstep(.5, 1.7, r);
  } else {                                 // SMOKE — drifting fog
    vec2 q = p * .9;
    float f = fbm2(q + vec2(t * .05, -t * .03) + fbm2(q * 1.7 - t * .04) * 1.4);
    f = smoothstep(.25, .85, f);
    col += mix(uC2, uC0, f) * f * (.10 + .16 * e);
    col += uC1 * exp(-r * r * 2.2) * .03;
  }

  // cursor light
  vec2 cp = (uv - uCursor.xy) * vec2(asp, 1.);
  col += mix(uC1, uC0, .35) * exp(-dot(cp, cp) * 7.) * uCursor.z * .30;
  // beat flash + breathing vignette
  col += uC0 * uFlash * .14 * exp(-r * r * .8);
  col *= 1. - smoothstep(.55, 1.9, r) * (.55 - .15 * uBreath);
  col += (h21(gl_FragCoord.xy + fract(t) * 91.) - .5) * .006;
  o = vec4(max(col, 0.), 1.);
}`;

// ───────────────────────────── object mesh ─────────────────────────────
export const MESH_VS = `${HEAD}
in vec2 aUv;
in vec2 aCen;
in vec3 aRnd;
uniform mat4 uViewProj, uModel;
uniform vec2 uSize;
uniform float uShatter, uTime, uBend, uLayerGap, uLayers, uTumble;
uniform vec3 uImpact;    // uv.xy, strength
out vec2 vUv;
out float vShard;
out vec3 vWorld;
out float vLayer;
out float vShatter;
void main(){
  vec2 p = (aUv - .5) * uSize;
  vec2 c = (aCen - .5) * uSize;
  vec3 pos = vec3(p, 0.);
  vShard = aRnd.x;
  float layer = float(gl_InstanceID);
  vLayer = layer;
  if (uShatter > 1e-4) {
    vec2 ip = (uImpact.xy - .5) * uSize;
    vec2 dir = c - ip;
    float dl = length(dir) + 1e-3;
    dir /= dl;
    float sp = mix(.25, 1.25, aRnd.x) * uShatter * (.55 + .5 * uImpact.z);
    vec3 d = normalize(vec3(dir + (aRnd.yz - .5) * .9, (aRnd.z - .3) * 1.3)) * sp * uSize.y * .75;
    d.xy += vec2(0., -uShatter * uShatter * .18 * uSize.y * (aRnd.y + .2));   // late gravity for weight
    float ang = uShatter * (aRnd.y - .5) * 10. * uTumble;
    float ca = cos(ang), sa = sin(ang);
    vec2 rel = p - c;
    rel = vec2(ca * rel.x - sa * rel.y, sa * rel.x + ca * rel.y);
    float flip = cos(uShatter * (aRnd.z - .5) * 12. * uTumble);  // fake out-of-plane tumble
    rel.x *= mix(1., flip, .6);
    pos = vec3(c + rel + d.xy, d.z);
  }
  pos.z += layer * uLayerGap;
  pos.xy += layer * vec2(.022, -.03) * uSize.y * step(1.5, uLayers);
  // gentle vertical bend (FLOW / BREATH)
  pos.z += sin(pos.x * 2.1 / max(uSize.y, .1) + uTime * .9) * uBend * uSize.y * .12;
  pos.z += cos(pos.y * 3.0 / max(uSize.y, .1) + uTime * .7) * uBend * uSize.y * .06;
  vec4 w = uModel * vec4(pos, 1.);
  vWorld = w.xyz;
  vUv = aUv;
  vShatter = uShatter;
  gl_Position = uViewProj * w;
}`;

export const MESH_FS = `${HEAD}${COMMON}
in vec2 vUv;
in float vShard;
in vec3 vWorld;
in float vLayer;
in float vShatter;
out vec4 o;
uniform sampler2D uSdf, uAlbedo, uBg;
uniform vec4 uAlbXform;   // albedo uv = (uv - zw) * xy
uniform vec2 uRes, uSize, uSdfTexel;
uniform float uSdfRange, uBevel, uBump, uCrisp, uUseAlbedo;
uniform float uMat, uTime, uOpacity, uBrightness;
uniform float uBass, uMid, uHigh, uEnergy, uBeat, uFlash;
uniform float uWarp, uWarpSpeed, uGlitch, uPixel, uEnvRot, uFlavor, uLayers;
uniform vec3 uC0, uC1, uC2, uBgCol, uEnvLow, uEnvHigh;
uniform vec3 uCam, uLightPos;
uniform mat3 uNormalMat;
uniform vec3 uCursor;

const float CHROME = 0., GLASS = 1., LIQUID = 2., PARTICLE = 3., NEON = 4., PAPER = 5., PIXEL = 6., ORGANIC = 7.;

float asp(){ return uSize.x / uSize.y; }
vec4 albS(vec2 uv){ return texture(uAlbedo, (uv - uAlbXform.zw) * uAlbXform.xy); }

vec2 warpUv(vec2 uv){
  float t = uTime * uWarpSpeed;
  vec2 d = vec2(0.);
  if (uWarp > 1e-4) {
    vec2 p = uv * vec2(asp(), 1.) * 3.2;
    vec2 w = vec2(fbm2(p + vec2(0., t)), fbm2(p + vec2(5.2, 1.3) - vec2(t, 0.))) - .5;
    d += w * uWarp;
    d += vec2(sin(uv.y * 9. + t * 2.6), cos(uv.x * 7. - t * 2.1)) * uWarp * .12;
  }
  if (uGlitch > 1e-3) {
    float tick = floor(uTime * 16.);
    float rows = mix(22., 64., h11(tick * 1.7));
    float row = floor(uv.y * rows);
    float on = step(1. - uGlitch * .5, h21(vec2(row, tick)));
    d.x += on * (h21(vec2(row + .5, tick)) - .5) * .22 * uGlitch;
    float blockRow = floor(uv.y * 6.);
    float bl = step(1. - uGlitch * .28, h21(vec2(blockRow, tick + 9.)));
    d.x += bl * (h21(vec2(blockRow, tick + 3.)) - .5) * .12 * uGlitch;
  }
  vec2 cd = (uv - uCursor.xy) * vec2(asp(), 1.);
  float cf = exp(-dot(cd, cd) * 40.);
  d += -normalize(cd + 1e-4) * cf * uCursor.z * .035 * vec2(1. / asp(), 1.);
  return uv + d;
}

float sdAt(vec2 uv){ return texture(uSdf, uv).r * uSdfRange; }
float heightAt(vec2 uv){
  float s = sdAt(uv);
  float t = clamp(s / uBevel, 0., 1.);
  return sqrt(1. - (1. - t) * (1. - t));
}
vec3 normalAt(vec2 uv, float bump){
  vec2 e = uSdfTexel * 1.4;
  float hx = heightAt(uv + vec2(e.x, 0.)) - heightAt(uv - vec2(e.x, 0.));
  float hy = heightAt(uv + vec2(0., e.y)) - heightAt(uv - vec2(0., e.y));
  return normalize(vec3(-hx * bump, -hy * bump, 1.));
}

// A tiny "studio": gradient dome, horizon, soft boxes. Values are HDR so bloom can catch highlights.
vec3 env(vec3 d){
  float c = cos(uEnvRot), s = sin(uEnvRot);
  d = normalize(vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z));
  float y = d.y;
  vec3 sky = mix(uEnvLow * 2.5 + uC2 * .05, uEnvHigh, smoothstep(-.05, .95, y));
  vec3 flr = mix(uEnvLow * .6, uEnvLow * 2.5 + uC2 * .07, smoothstep(-1., -.05, y));
  vec3 col = mix(flr, sky, smoothstep(-.04, .05, y));
  col += uEnvHigh * .9 * exp(-abs(y) * 26.);
  float az = atan(d.x, d.z);
  float s1 = smoothstep(.20, .09, abs(az - .75)) * smoothstep(-.35, .15, y) * smoothstep(.97, .55, y);
  float s2 = smoothstep(.12, .04, abs(az + 1.15)) * smoothstep(-.25, .25, y);
  float s3 = smoothstep(.10, .03, abs(az - 2.4)) * smoothstep(-.1, .4, y);
  float top = smoothstep(.72, .93, y);
  col += vec3(1.) * s1 * 4.2 + uC0 * s2 * 3.2 + vec3(1., .96, .9) * s3 * 2.2 + vec3(1., .98, .95) * top * 2.6;
  return col;
}

vec3 bayer(vec2 p){
  int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.));
  int i = x + y * 4;
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return vec3(m[i] / 16. - .5);
}

void main(){
  float mat = uMat;
  vec2 uv = warpUv(vUv);

  // pixel: snap to a coarse grid
  if (abs(mat - PIXEL) < .5) {
    vec2 g = vec2(asp() * uPixel, uPixel);
    uv = (floor(uv * g) + .5) / g;
  }

  float sd = sdAt(uv);
  // liquid / organic: wobble the contour itself
  float wob = 0.;
  if (abs(mat - LIQUID) < .5) {
    float t = uTime * (.55 + uWarpSpeed);
    wob = (fbm2(uv * vec2(asp(), 1.) * 7. + vec2(t, -t * .7)) - .5) * (.45 + 9. * uWarp + .5 * uBass);
    wob += sin(uv.x * 40. + t * 3.) * .05 * (1. + uHigh * 3.);
    sd += wob;
  } else if (abs(mat - ORGANIC) < .5) {
    float t = uTime * .45;
    wob = (fbm2(uv * vec2(asp(), 1.) * 4. + t) - .5) * (.6 + .6 * uBass);
    sd += wob;
  }
  float aa = fwidth(sd) * .85 + 1e-5;
  float covS = smoothstep(-aa, aa, sd);
  float covA = albS(uv).a;
  float crisp = uCrisp * (1. - clamp(abs(wob) * 2.5, 0., 1.));
  float cov = mix(covS, covA, crisp);
  if (abs(mat - PIXEL) < .5) cov = step(0., sd);

  vec4 albT = albS(uv);
  vec3 alb = mix(vec3(1.), albT.rgb, uUseAlbedo);

  // heights / normals (recomputed at the warped uv so warped surfaces shade correctly)
  float bump = uBump * (1. + .9 * uBass);
  vec3 N = normalAt(uv, bump);
  vec3 Nw = normalize(uNormalMat * N);
  vec3 V = normalize(uCam - vWorld);
  vec3 L = normalize(uLightPos - vWorld);
  float ndv = max(dot(Nw, V), 0.);
  float fres = pow(1. - ndv, 3.);
  float hgt = heightAt(uv);
  vec3 R = reflect(-V, Nw);

  vec3 col = vec3(0.);
  float alpha = cov;

  if (abs(mat - CHROME) < .5) {
    vec3 refl = env(R);
    vec3 tint = mix(vec3(.9, .93, 1.), uC1, .12);
    col = refl * tint * (.72 + .9 * fres);
    col += pow(max(dot(R, L), 0.), 70.) * mix(uC0, vec3(1.), .5) * 1.5;
    col += uC0 * fres * .35 * (1. + uHigh * 2.);
    col = mix(col, col * alb * 1.25, uUseAlbedo * .55);
    col *= .85 + .15 * smoothstep(0., .4, hgt);
  } else if (abs(mat - GLASS) < .5) {
    vec2 suv = gl_FragCoord.xy / uRes;
    float edge = 1. - smoothstep(0., uBevel * 1.4, sd);
    vec2 off = N.xy * (.035 + .05 * edge) * (1. + uBass * .8);
    float disp = .012 + .01 * uHigh;
    vec3 bgc;
    bgc.r = texture(uBg, suv + off * (1. + disp * 6.)).r;
    bgc.g = texture(uBg, suv + off).g;
    bgc.b = texture(uBg, suv + off * (1. - disp * 6.)).b;
    vec3 tint = mix(vec3(1.), mix(uC1, uC2, .5), .3);
    vec3 refr = bgc * tint * 1.25 + uC0 * .02;
    vec3 refl = env(R) * .85;
    col = mix(refr, refl, clamp(fres * .85 + .06, 0., 1.));
    col += pow(max(dot(R, L), 0.), 90.) * vec3(1.) * 1.8;
    col += edge * mix(uC0, vec3(1.), .5) * .55 * (1. + uMid);
    col = mix(col, col * alb * 1.4, uUseAlbedo * .6);
    alpha = cov * (.62 + .38 * clamp(edge + fres, 0., 1.));
  } else if (abs(mat - LIQUID) < .5) {
    vec3 refl = env(R * vec3(1., 1., 1.) + vec3(0., 0., 0.));
    float ir = dot(Nw, V) * 3.2 + hgt * 2. + uTime * .12 + uMid;
    vec3 irid = .5 + .5 * cos(TAU * (vec3(0., .33, .67) + ir));
    irid = mix(irid, mix(uC0, uC2, .5 + .5 * sin(ir * 2.)), .55);
    col = refl * mix(vec3(1.), irid, .75) * (.95 + .9 * fres) * 1.3 + irid * .14;
    col += pow(max(dot(R, L), 0.), 60.) * 1.4;
    col = mix(col, col * alb * 1.3, uUseAlbedo * .7);
  } else if (abs(mat - NEON) < .5) {
    float a = abs(sd);
    float flick = 1. - uHigh * .18 * (h11(floor(uTime * 40.)) - .5);
    float core = exp(-a / .16);
    float mid = exp(-a / .75);
    float glow = exp(-a / 3.0);
    vec3 tube = mix(uC0, uC1, .3 + .3 * sin(uv.x * 6. + uTime * .8));
    col = mix(vec3(1.), tube, .32) * core * 1.1 + tube * mid * 1.25 + mix(uC0, uC2, .5) * glow * (.12 + .25 * uBeat + .18 * uEnergy);
    // second contour, slightly inside, gives that double-tube look
    float a2 = abs(sd - 1.7);
    col += mix(uC2, uC0, .5) * exp(-a2 / .2) * .55 * step(0., sd);
    col += tube * .03 * step(0., sd);
    col *= flick;
    if (uUseAlbedo > .5) {
      // edge-detect photos / video for outlines
      vec2 e = uSdfTexel * 2.;
      float l0 = luma(albS(uv).rgb);
      float gx = luma(albS(uv + vec2(e.x, 0.)).rgb) - luma(albS(uv - vec2(e.x, 0.)).rgb);
      float gy = luma(albS(uv + vec2(0., e.y)).rgb) - luma(albS(uv - vec2(0., e.y)).rgb);
      float edge = smoothstep(.04, .3, length(vec2(gx, gy)));
      col += mix(uC0, uC1, l0) * edge * 3.2 * step(0., sd) + albT.rgb * .05 * step(0., sd);
    }
    alpha = clamp(max(core, max(mid, glow * .8)) + step(0., sd) * .1, 0., 1.);
    alpha = clamp(alpha + luma(col) * .3, 0., 1.);
    col *= .9;
  } else if (abs(mat - PAPER) < .5) {
    float ly = vLayer;
    vec3 lc = ly < .5 ? uC2 : (ly < 1.5 ? uC0 : uC1);
    if (uLayers < 1.5) lc = mix(uC1, vec3(1.), .1);
    vec3 base = mix(lc, alb, uUseAlbedo * .92) * (ly > 1.5 ? .8 : .72);
    float lit = .82 + .28 * dot(normalize(vec3(-.4, .6, .7)), N);
    float grain = (n2(uv * vec2(asp(), 1.) * 620.) - .5) * .09 + (n2(uv * 90.) - .5) * .03;
    float rim = smoothstep(0., .5, sd) * (1. - smoothstep(.5, 1.3, sd));
    col = base * lit * (1. + grain) + rim * .07;
    // soft shadow halo onto whatever is beneath
    float sh = (1. - cov) * exp(-max(-sd, 0.) / 1.6) * .62;
    col = col * cov;
    alpha = cov + sh * (1. - cov);
    col += vec3(0.);
  } else if (abs(mat - PIXEL) < .5) {
    float band = floor(hgt * 4.) / 4.;
    float gradx = fract(uv.x * 1.2 + uTime * .05);
    vec3 base = mix(uC0, uC2, smoothstep(0., 1., uv.x));
    base = mix(base, uC1, band * .65);
    base = mix(base, alb, uUseAlbedo * .95);
    vec3 dith = bayer(gl_FragCoord.xy * .5) * .16;
    col = floor((base + dith) * 5. + .5) / 5. * (.85 + .3 * uBeat);
    col *= .8 + .2 * step(.35, fract(hgt * 8.));
  } else if (abs(mat - ORGANIC) < .5) {
    float wrap = pow(clamp(dot(N, L) * .5 + .5, 0., 1.), 1.7);
    vec3 base = mix(uC0, uC2, smoothstep(.15, 1., hgt) * .55 + .25 * uv.x);
    base = mix(base, alb, uUseAlbedo * .85);
    vec3 sss = mix(uC2, uC0, .5) * pow(1. - ndv, 2.2) * 1.1;
    col = base * (.28 + 1.05 * wrap) + sss + pow(max(dot(R, L), 0.), 22.) * .28;
    alpha = cov * (.86 + .14 * hgt);
  } else { // PARTICLE — mesh is only a very faint ghost
    col = mix(uC0, uC1, .5) * .06;
    alpha = cov * .12;
  }

  col *= uBrightness;
  col += uC0 * uFlash * .18 * cov;                       // beat flash rides on the object
  if (vShatter > .02) col *= 1. + vShatter * .5 * (vShard - .3);   // shards catch light differently
  alpha *= uOpacity;
  if (alpha < .002) discard;
  o = vec4(col * alpha, alpha);   // premultiplied
}`;

// ───────────────────────────── particles (GPU sim via transform feedback) ─────────────────────────────
export const PSIM_VS = `${HEAD}${COMMON}
in vec4 aPL;      // xyz position, life
in vec4 aVS;      // xyz velocity, seed
in vec4 aHome;    // uv.xy, z, role
uniform float uDt, uTime, uMode;              // 0 = constructed (springs to shape), 1 = emitter (born on demand)
uniform mat4 uModel;
uniform vec2 uSize;
uniform float uSpring, uDamp, uFlow, uFlowScale, uOrbit, uOrbitMix, uOrbitR, uEmit, uLifeDecay, uBurstFrac, uSwirl, uPull, uPush;
uniform vec4 uCursor;     // xyz world, signed strength (+attract / -repel)
uniform float uCursorR;
uniform vec4 uBurst;      // xyz world centre, strength (0 = none)
out vec4 vPL;
out vec4 vVS;

void main(){
  vec3 pos = aPL.xyz;
  float life = aPL.w;
  vec3 vel = aVS.xyz;
  float seed = aVS.w;
  float r1 = fract(seed * 13.7), r2 = fract(seed * 97.3), r3 = fract(seed * 331.1);
  vec3 home = (uModel * vec4((aHome.xy - .5) * uSize, aHome.z, 1.)).xyz;
  vec3 ctr = uModel[3].xyz;
  bool emitter = uMode > .5;
  bool orb = aHome.w < uOrbitMix;
  bool burstMe = uBurst.w > 0. && fract(seed * 53.9 + .37) < uBurstFrac;

  if (emitter && life <= 0.) {
    float wake = h11(seed * 191.7 + uTime * 3.31 + 7.);
    if (wake < uEmit * uDt || burstMe) {
      life = 1.;
      pos = home;
      vel = vec3(0.);
    } else {
      vPL = vec4(home, 0.);
      vVS = vec4(0., 0., 0., seed);
      return;
    }
  }

  vec3 acc = vec3(0.);
  if (!emitter && !orb) acc += (home - pos) * uSpring;
  if (!emitter && orb) {
    // ring around the object: tilted per-particle orbit plane, radius pulled toward a shell
    vec3 rel = pos - ctr;
    float rl = length(rel) + 1e-4;
    vec3 axis = normalize(vec3(sin(seed * 41.), cos(seed * 23.) * .55 + .25, 1.));
    vec3 tang = normalize(cross(axis, rel) + 1e-5);
    float targetR = uOrbitR * (.75 + .9 * r1) + .10 * sin(seed * 60. + uTime);
    acc += tang * uOrbit * (.6 + .8 * r2);
    acc += -rel / rl * (rl - targetR) * (uSpring * .22);
  }
  if (uPull > 0. && emitter) acc += (home - pos) * uPull;
  if (uPush > 0.) { vec3 rr = pos - ctr; acc += rr / (length(rr) + .05) * uPush; }
  if (uFlow > 0.) acc += curl3(pos * uFlowScale + vec3(0., 0., uTime * .11)) * uFlow;
  if (uSwirl > 0. && !orb) {
    vec3 rel = pos - ctr;
    acc += vec3(-rel.y, rel.x, 0.) * uSwirl;
  }
  // cursor / touch force
  vec3 dc = uCursor.xyz - pos;
  float dist = length(dc);
  float fall = exp(-dist * dist / (uCursorR * uCursorR));
  acc += dc / (dist + 1e-3) * uCursor.w * fall * 3.2;

  if (burstMe) {
    vec3 dir = pos - uBurst.xyz + (vec3(r1, r2, r3) - .5) * .9;
    dir = normalize(dir + vec3(0., 0., .35 * (r3 - .4)));
    vel += dir * uBurst.w * (.35 + 1.1 * r2);
  }

  vel += acc * uDt;
  vel *= exp(-uDamp * uDt * (orb ? .35 : 1.));
  pos += vel * uDt;

  if (emitter) {
    life -= uDt * uLifeDecay * mix(.55, 1.7, r2);
    if (life <= 0.) { life = 0.; pos = home; vel = vec3(0.); }
  } else {
    life = 1.;
  }
  vPL = vec4(pos, life);
  vVS = vec4(vel, seed);
}`;

export const PSIM_FS = `${HEAD}
out vec4 o;
void main(){ o = vec4(0.); }`;

export const PDRAW_VS = `${HEAD}${COMMON}
in vec4 aPL;
in vec4 aVS;
in vec4 aHome;
uniform mat4 uViewProj;
uniform float uPointSize, uDensity, uMode, uPxScale, uTime, uUseAlbedo, uBrightness, uHighJitter;
uniform vec3 uC0, uC1, uC2;
uniform sampler2D uAlbedo;
uniform vec4 uAlbXform;
out vec3 vCol;
out float vA;
void main(){
  float seed = aVS.w;
  float keepR = fract(seed * 3.117 + .5);
  float life = aPL.w;
  float alive = uMode > .5 ? smoothstep(0., .18, life) * (.25 + .75 * life) : 1.;
  float keep = step(keepR, uDensity) * step(.002, alive);
  vec4 clip = uViewProj * vec4(aPL.xyz, 1.);
  float speed = length(aVS.xyz);
  float r = fract(seed * 17.3);
  vec3 col = mix(uC0, uC1, r);
  col = mix(col, uC2, smoothstep(.4, 3., speed) * .65);
  if (uUseAlbedo > .5) col = mix(col, texture(uAlbedo, (aHome.xy - uAlbXform.zw) * uAlbXform.xy).rgb * 1.2, .85);
  float tw = 1. + uHighJitter * (h11(seed * 91. + floor(uTime * 24.)) - .5) * 1.2;
  float size = uPointSize * (.55 + fract(seed * 91.7)) * (1. + speed * .12) * tw;
  gl_PointSize = clamp(size * uPxScale / max(clip.w, .1), 1., 46.) * keep;
  vCol = col * uBrightness;
  vA = alive;
  gl_Position = mix(vec4(2., 2., 2., 1.), clip, keep);
}`;

export const PDRAW_FS = `${HEAD}
in vec3 vCol;
in float vA;
uniform float uSquare, uIntensity;
out vec4 o;
void main(){
  vec2 c = gl_PointCoord - .5;
  float a;
  if (uSquare > .5) { a = .5; }
  else { float d = length(c) * 2.; a = smoothstep(1., 0., d); a *= a; }
  o = vec4(vCol * a * vA * uIntensity, a * vA);
}`;

// ───────────────────────────── bloom + composite ─────────────────────────────
export const BLOOM_DOWN_FS = `${HEAD}
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold, uFirst;
vec3 s(vec2 off){ return texture(uTex, vUv + off * uTexel).rgb; }
void main(){
  vec3 c = (s(vec2(-1., -1.)) + s(vec2(1., -1.)) + s(vec2(-1., 1.)) + s(vec2(1., 1.))) * .25 * .5
         + (s(vec2(-2., 0.)) + s(vec2(2., 0.)) + s(vec2(0., 2.)) + s(vec2(0., -2.))) * .0625 * .5
         + s(vec2(0.)) * .25 * .5 + (s(vec2(-2., -2.)) + s(vec2(2., -2.)) + s(vec2(-2., 2.)) + s(vec2(2., 2.))) * .03125 * .5;
  c *= 2.;
  if (uFirst > .5) {
    float l = max(c.r, max(c.g, c.b));
    float k = max(l - uThreshold, 0.);
    c *= k / max(l, 1e-4);
    c = min(c, vec3(3.0));
  }
  o = vec4(c, 1.);
}`;

export const BLOOM_UP_FS = `${HEAD}
in vec2 vUv;
out vec4 o;
uniform sampler2D uLow, uHigh;
uniform vec2 uTexel;       // texel of the low-res texture
uniform float uScatter;
void main(){
  vec3 up = texture(uLow, vUv + uTexel * vec2(-1., -1.)).rgb + 2. * texture(uLow, vUv + uTexel * vec2(0., -1.)).rgb + texture(uLow, vUv + uTexel * vec2(1., -1.)).rgb
          + 2. * texture(uLow, vUv + uTexel * vec2(-1., 0.)).rgb + 4. * texture(uLow, vUv).rgb + 2. * texture(uLow, vUv + uTexel * vec2(1., 0.)).rgb
          + texture(uLow, vUv + uTexel * vec2(-1., 1.)).rgb + 2. * texture(uLow, vUv + uTexel * vec2(0., 1.)).rgb + texture(uLow, vUv + uTexel * vec2(1., 1.)).rgb;
  up /= 16.;
  o = vec4(texture(uHigh, vUv).rgb + up * uScatter, 1.);
}`;

export const COMPOSITE_FS = `${HEAD}${COMMON}
in vec2 vUv;
out vec4 o;
uniform sampler2D uScene, uBloom, uSig;
uniform vec2 uRes;
uniform float uTime, uBloomAmt, uExposure, uCA, uRadial, uGlitch, uFlash, uGrain, uVignette, uSigAlpha, uFade, uGrade, uPixelate;
uniform vec4 uSigRect;
uniform vec3 uC0, uC2, uBg;

vec3 scene(vec2 uv, vec2 ca){
  return vec3(texture(uScene, uv + ca).r, texture(uScene, uv).g, texture(uScene, uv - ca).b);
}
void main(){
  vec2 uv = vUv;
  vec2 p = uv - .5;
  float tick = floor(uTime * 18.);

  vec2 guv = uv;
  float band = 0.;
  if (uGlitch > 1e-3) {
    float rows = mix(12., 44., h11(tick * 3.1));
    float br = floor(uv.y * rows);
    float on = step(1. - uGlitch * .42, h21(vec2(br, tick + 1.3)));
    guv.x += on * (h21(vec2(br, tick + 7.7)) - .5) * .16 * uGlitch;
    float vr = floor(uv.x * 9.);
    float von = step(1. - uGlitch * .12, h21(vec2(vr, tick + 21.)));
    guv.y += von * (h21(vec2(vr, tick + 5.)) - .5) * .14 * uGlitch;
    band = on;
  }
  float ca = uCA + uGlitch * .006 + band * .01;
  vec2 dir = normalize(p + 1e-4) * ca * (.35 + length(p) * 2.2);

  vec3 col = vec3(0.);
  if (uRadial > 1e-3) {
    for (int i = 0; i < 10; i++) {
      float k = float(i) / 9.;
      col += scene(guv - p * uRadial * .22 * k, dir * (1. + k));
    }
    col /= 10.;
  } else {
    col = scene(guv, dir);
  }
  vec3 bl = texture(uBloom, guv).rgb;
  col += bl * uBloomAmt;

  // exposure + filmic shoulder (keeps hues as it rolls off to white)
  col *= uExposure;
  col = 1. - exp(-col * 1.35);
  col = mix(col, col * col * (3. - 2. * col), .35);           // gentle S-curve
  float l = luma(col);
  col = mix(vec3(l), col, 1. + uGrade * .35);

  col += uC0 * uFlash * .20;
  float vig = smoothstep(.95, .25, length(p * vec2(1., 1.08)));
  col *= mix(1., vig, uVignette);
  col += (h21(gl_FragCoord.xy + fract(uTime * 7.) * 131.) - .5) * uGrain;

  // fade the picture to black first, then lay the sign-off on top so the end card stays fully legible
  col *= 1. - uFade;
  // sign-off overlay (drawn inside the canvas so it is captured by recording)
  if (uSigAlpha > 1e-3) {
    vec2 suv = (uv - uSigRect.xy) / uSigRect.zw;
    if (suv.x > 0. && suv.x < 1. && suv.y > 0. && suv.y < 1.) {
      vec4 s = texture(uSig, suv);
      col = mix(col, s.rgb, s.a * uSigAlpha);
    }
  }
  o = vec4(clamp(col, 0., 1.), 1.);
}`;

export const COPY_FS = `${HEAD}
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
void main(){ o = vec4(texture(uTex, vUv).rgb, 1.); }`;
