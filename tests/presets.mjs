// Look-dev matrix: every preset (with its signature material/palette) at given track times, offline-stepped.
// usage: node tests/presets.mjs outDir '{"times":[4,15.9],"w":1000,"h":760,"scale":0.6}'
import { launch, attachLogs, BASE } from './util.mjs';
import { PRESET_LIST } from '../src/engine/presets.js';
import fs from 'node:fs';
const [dir, json = '{}'] = process.argv.slice(2);
const o = { times: [4, 15.9], w: 1000, h: 760, scale: 0.6, lead: 3, text: 'TEJA PRIYAN', only: null, ...JSON.parse(json) };
fs.mkdirSync(dir, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE); await p.waitForTimeout(600);
await p.click('text=CREATE VISUAL'); await p.waitForTimeout(1600);
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.click('.panel-x');
await p.click('.tabs button:has-text("OBJECT")'); await p.fill('#obj-text', o.text); await p.click('.panel-x');
await p.waitForTimeout(1500);
await p.evaluate((sc) => { const h = window.__studio, e = h.engine; h.pause(); e.autoScale = false; e.renderScale = +sc; e.applySize(true); }, o.scale);
for (const pr of PRESET_LIST.filter((x) => !o.only || o.only.includes(x.id))) {
  for (const t of o.times) {
    await p.evaluate(({ pr, t, lead }) => {
      const e = window.__studio.engine, a = window.__audio;
      e.setConfig({ preset: pr.id, material: pr.material, palette: pr.palette, background: pr.bg, particles: 'auto', camera: 'auto', mapping: pr.mapping.map((m) => ({ ...m })), intensity: 1 });
      e.driver.reset(); let prev = Math.max(0, t - lead); const N = Math.round(lead * 60);
      for (let i = 1; i <= N; i++) { const pos = Math.max(0, t - lead) + (lead * i) / N; e.update(1 / 60, a.featuresAt(pos, prev)); prev = pos; }
      e.render();
    }, { pr, t, lead: o.lead });
    await (await p.$('.frame')).screenshot({ path: `${dir}/${pr.id}-${String(t).replace('.', '_')}.png`, timeout: 90000 });
  }
}
console.log('done', await p.evaluate(() => window.__errors), logs.filter((l) => !/ERR_FAILED/.test(l)).slice(0, 8).join('\n'));
await b.close();
