// usage: node tests/shot.mjs "?query" out.png [width height waitMs]
import { launch, attachLogs, BASE } from './util.mjs';
const [q = '', out = '/tmp/shot.png', w = '900', h = '1200', wait = '2500'] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE + q);
await p.waitForTimeout(+wait);
const info = await p.evaluate(() => ({ frames: window.__frames, errors: window.__errors }));
await p.screenshot({ path: out });
console.log(JSON.stringify(info), logs.slice(0, 8).join('\n'));
await b.close();
