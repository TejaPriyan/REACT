// Deterministic look-dev: drive the real studio, step the engine offline from the analysis, screenshot the frame.
// usage: node tests/scene.mjs outPrefix '{"w":1100,"h":760,"scale":1,"text":"TEJA PRIYAN","cfg":{"preset":"impact"},"times":[3,14.9,15.6],"frame":"9:16"}'
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const [prefix, json = '{}'] = process.argv.slice(2);
const o = { w: 1100, h: 760, scale: 1, text: 'TEJA PRIYAN', cfg: {}, times: [3, 14.9, 15.6], lead: 1.6, ...JSON.parse(json) };
fs.mkdirSync(prefix.replace(/\/[^/]*$/, ''), { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE);
await p.waitForTimeout(600);
await p.click('text=CREATE VISUAL');
await p.waitForTimeout(1600);
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.click('.panel-x');
if (o.text !== null) {
  await p.click('.tabs button:has-text("OBJECT")');
  await p.fill('#obj-text', o.text);
  await p.click('.panel-x');
}
if (o.frame) { await p.click('.tabs button:has-text("STYLE")'); await p.click(`.choice button:has-text("${o.frame}")`); await p.click('.panel-x'); }
await p.waitForTimeout(1500);
await p.evaluate(({ sc, cfg }) => {
  const h = window.__studio, e = h.engine;
  h.pause(); e.autoScale = false; e.renderScale = +sc; e.applySize(true);
  e.setConfig({ ...cfg });
}, { sc: o.scale, cfg: o.cfg });
await p.waitForTimeout(800);
for (const t of o.times) {
  await p.evaluate(({ t, lead }) => {
    const e = window.__studio.engine, a = window.__audio;
    e.driver.reset(); e.camera.reset && e.camera.reset();
    let prev = Math.max(0, t - lead); const N = Math.round(lead * 60);
    for (let i = 1; i <= N; i++) { const pos = Math.max(0, t - lead) + (lead * i) / N; e.update(1 / 60, a.featuresAt(pos, prev)); prev = pos; }
    e.render();
  }, { t, lead: o.lead });
  const el = await p.$('.frame');
  await el.screenshot({ path: `${prefix}-${String(t).replace('.', '_')}.png`, timeout: 90000 });
}
console.log('done', await p.evaluate(() => window.__errors), logs.filter((l) => !/ERR_FAILED/.test(l)).slice(0, 8).join('\n'));
await b.close();
