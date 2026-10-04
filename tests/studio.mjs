// Drive the real UI: landing → studio → demo track → play → screenshots.
// usage: node tests/studio.mjs outDir w h [seekSeconds] [extra JS to evaluate after play]
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const [out, W = '900', H = '700', seek = '33', extra = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE);
await p.waitForTimeout(1500);
await p.evaluate(() => { window.__landing.engine.autoScale = false; window.__landing.engine.renderScale = 0.5; window.__landing.engine.applySize(); });
await p.click('text=CREATE VISUAL');
await p.waitForTimeout(2000);
await p.evaluate(() => { const e = window.__studio.engine; e.autoScale = false; e.renderScale = 0.5; e.applySize(); });
await p.screenshot({ path: `${out}/a-empty.png`, timeout: 90000 });
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
console.log('analysis', await p.evaluate(() => { const a = window.__audio.analysis; return { bpm: a.bpm, beats: a.beats.length, drops: a.drops, dur: a.duration, ms: Math.round(a.analyzeMs), conf: a.beatConfidence }; }));
await p.evaluate((s) => { window.__audio.seek(+s); window.__audio.play(); }, seek);
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/b-playing.png`, timeout: 90000 });
if (extra) { console.log('extra', JSON.stringify(await p.evaluate(extra))); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/c-extra.png`, timeout: 90000 }); }
console.log('errors', await p.evaluate(() => window.__errors), logs.slice(0, 10).join('\n'));
await b.close();
