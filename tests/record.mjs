// End-to-end: landing → studio → demo track → RECORD → result; saves the file and prints diagnostics.
// usage: node tests/record.mjs outDir [format video|gif|png|frame] [ratio] [seconds] [w h]
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const [out, format = 'video', ratio = '1:1', secs = '5', W = '1000', H = '760'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE);
await p.waitForTimeout(600);
await p.click('text=CREATE VISUAL');
await p.waitForTimeout(1600);
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.click('.panel-x');
await p.click('.tabs button:has-text("OBJECT")'); await p.fill('#obj-text', 'TEJA PRIYAN'); await p.click('.panel-x');
await p.click('.rec-btn');
await p.click(`[aria-label="Export format"] button:has-text("${format.toUpperCase()}")`);
await p.click(`[aria-label="Frame ratio"] button:has-text("${ratio}")`);
if (format === 'video' || format === 'gif') await p.click(`[aria-label="Length in seconds"] button:has-text("${secs} s")`);
await p.screenshot({ path: `${out}/export-panel.png`, timeout: 90000 });
const t0 = Date.now();
await p.click('.rec');
// sample the render screen once
await p.waitForSelector('.rendering', { timeout: 20000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/rendering.png`, timeout: 120000 }).catch((e) => console.log('shot fail', e.message));
await p.waitForSelector('.result', { timeout: 420000 });
console.log('export took s', ((Date.now() - t0) / 1000).toFixed(1));
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/result.png`, timeout: 120000 }).catch((e) => console.log('shot fail', e.message));
const info = await p.evaluate(async () => {
  const el = document.querySelector('.rs-media video, .rs-media img');
  const url = el.src; const blob = await (await fetch(url)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { type: blob.type, size: blob.size, b64: btoa(s), facts: [...document.querySelectorAll('.rs-facts div')].map((d) => d.textContent) };
});
const ext = /mp4/.test(info.type) ? 'mp4' : /webm/.test(info.type) ? 'webm' : /gif/.test(info.type) ? 'gif' : 'png';
fs.writeFileSync(`${out}/export.${ext}`, Buffer.from(info.b64, 'base64'));
console.log(JSON.stringify({ type: info.type, size: info.size, facts: info.facts }));
console.log('errors', await p.evaluate(() => window.__errors), logs.filter((l) => !/ERR_FAILED/.test(l)).slice(0, 10).join('\n'));
await b.close();
