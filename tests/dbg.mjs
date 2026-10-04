import { launch, attachLogs, BASE } from './util.mjs';
const b = await launch();
const p = await b.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
attachLogs(p);
await p.goto(BASE); await p.waitForTimeout(600);
await p.click('text=CREATE VISUAL'); await p.waitForTimeout(1600);
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.click('.panel-x'); await p.click('.tabs button:has-text("OBJECT")'); await p.fill('#obj-text', 'TEJA PRIYAN'); await p.click('.panel-x');
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => {
  const h0 = window.__studio, e0 = h0.engine; e0.setConfig({ material: 'paper' }); e0.setQuality('performance'); e0.renderScale = 1; e0.applySize(true);
  return 1; })));
console.log(JSON.stringify(await p.evaluate(() => {
  const h = window.__studio, e = h.engine, a = window.__audio; h.pause();
  e.driver.reset(); let prev = 1.4;
  for (let i = 1; i <= 100; i++) { const pos = 1.4 + 1.6 * i / 100; e.update(1 / 60, a.featuresAt(pos, prev)); prev = pos; }
  e.render();
  const cv = document.createElement('canvas'); cv.width = e.W; cv.height = e.H; const g = cv.getContext('2d'); g.drawImage(e.canvas, 0, 0);
  const d = g.getImageData(0, 0, e.W, e.H).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < e.H; y++) for (let x = 0; x < e.W; x++) { const o = (y * e.W + x) * 4; if (d[o] + d[o + 1] + d[o + 2] > 300) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const bbox = [x0 / e.W, x1 / e.W, y0 / e.H, y1 / e.H];
  const c = e.camera;
  return { bbox, W: e.W, H: e.H, css: e.css, lay: e.lay, content: e.obj.content, aspect: e.obj.aspect, P: { scale: e.driver.P.scale, posZ: e.driver.P.posZ, rotY: e.driver.P.rotY }, cam: Object.fromEntries(Object.entries(c).filter(([k, v]) => typeof v === 'number')), canvasClient: [e.canvas.clientWidth, e.canvas.clientHeight], frame: (() => { const r = document.querySelector('.frame').getBoundingClientRect(); return [r.width, r.height]; })() };
})));
await b.close();
