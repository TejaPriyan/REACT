// usage: node tests/crop.mjs out.png "<js run in studio before shot>" [w h scale waitMs]
import { launch, attachLogs, BASE } from './util.mjs';
const [out, js = '', W = '700', H = '600', scale = '1', wait = '3000'] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE);
await p.waitForTimeout(800);
await p.click('text=CREATE VISUAL');
await p.waitForTimeout(1800);
if (await p.$('.panel-x')) await p.click('.panel-x');
await p.waitForTimeout(400);
await p.evaluate((sc) => { const e = window.__studio.engine; e.autoScale = false; e.renderScale = +sc; e.applySize(); }, scale);
if (js) console.log(JSON.stringify(await p.evaluate(js)));
await p.waitForTimeout(+wait);
const el = await p.$('.frame');
await el.screenshot({ path: out, timeout: 90000 });
console.log('errors', await p.evaluate(() => window.__errors), logs.slice(0, 6).join('\n'));
await b.close();
