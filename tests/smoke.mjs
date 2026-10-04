// Landing → studio smoke test with screenshots. usage: node tests/smoke.mjs [outDir] [w h]
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const out = process.argv[2] || '/tmp/claude-0/-home-claude/0cc182bc-31af-5fb8-8ae2-3c9b936e0fb9/scratchpad/shots';
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE);
await p.waitForTimeout(4500);
await p.screenshot({ path: `${out}/01-landing.png`, timeout: 90000 });
console.log('landing errors', await p.evaluate(() => window.__errors));
await p.click('text=CREATE VISUAL');
await p.waitForTimeout(2600);
await p.screenshot({ path: `${out}/02-studio.png`, timeout: 90000 });
console.log('screen', await p.evaluate(() => document.querySelector('.app').dataset.screen));
console.log('logs', logs.slice(0, 12).join('\n'));
await b.close();
