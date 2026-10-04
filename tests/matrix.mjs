// usage: node tests/matrix.mjs materials|presets|bgs outdir [text] [t]
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const [kind = 'materials', outdir = '/tmp/matrix', text = 'REACT', t = '21.3'] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const lists = {
  materials: ['chrome', 'glass', 'liquid', 'particle', 'neon', 'paper', 'pixel', 'organic'].map((m) => `mat=${m}`),
  presets: ['pulse', 'explode', 'flow', 'shatter', 'orbit', 'glitch', 'breath', 'impact'].map((m) => `preset=${m}`),
  bgs: ['void', 'aurora', 'grid', 'studio', 'smoke'].map((m) => `bg=${m}`),
};
const b = await launch();
const logs = [];
let i = 0;
for (const q of lists[kind]) {
  const p = await b.newPage({ viewport: { width: 540, height: 540 }, deviceScaleFactor: 1 });
  attachLogs(p, logs);
  await p.goto(`${BASE}?q=performance&fixed=1&text=${encodeURIComponent(text)}&t=${t}&${q}`);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${outdir}/${String(i++).padStart(2, '0')}_${q.split('=')[1]}.png` });
  const e = await p.evaluate(() => window.__errors);
  if (e && e.length) logs.push(q + ' ' + e.join('|'));
  await p.close();
}
console.log(logs.filter((l) => !/ERR_TUNNEL|404/.test(l)).join('\n') || 'no errors');
await b.close();
