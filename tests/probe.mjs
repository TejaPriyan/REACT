import { launch, attachLogs, BASE } from './util.mjs';
const W = +(process.argv[2] || 960), H = +(process.argv[3] || 600);
const b = await launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE);
await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  const h = window.__landing; const e = h && h.engine;
  if (!e) return { err: 'no landing' };
  const t0 = performance.now(); let n = 0;
  await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 > 3000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  return { fps: n / 3, W: e.W, H: e.H, q: e.qualityId, scale: e.renderScale, software: e.caps.software, ms: e.stats.ms, errors: window.__errors };
});
console.log(JSON.stringify(r), logs.slice(0, 6).join('\n'));
await b.close();
