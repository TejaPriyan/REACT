// Result → REMIX → result again, NEW VISUAL, and sign-off overlay check.
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
const logs = attachLogs(p);
await p.goto(BASE); await p.waitForTimeout(600);
await p.click('text=CREATE VISUAL'); await p.waitForTimeout(1600);
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.click('.panel-x');
await p.click('.tabs button:has-text("OBJECT")'); await p.fill('#obj-text', 'TEJA PRIYAN'); await p.click('.panel-x');
// sign-off overlay look
await p.waitForTimeout(1500);
await p.evaluate(() => { const h = window.__studio, e = h.engine; h.pause(); e.autoScale = false; e.renderScale = 0.7; e.applySize(true); e.sig.alpha = 1; e.sig.fade = 0.75; for (let i = 0; i < 30; i++) e.update(1 / 60, window.__audio.featuresAt(8 + i / 60, 8 + (i - 1) / 60)); e.render(); });
await (await p.$('.frame')).screenshot({ path: `${out}/signoff.png`, timeout: 90000 });
await p.evaluate(() => { const h = window.__studio, e = h.engine; e.sig.alpha = 0; e.sig.fade = 0; h.resume(); });
// export a quick FRAME, then remix
await p.click('.rec-btn'); await p.click('[aria-label="Export format"] button:has-text("FRAME")');
await p.click('.rec'); await p.waitForSelector('.result', { timeout: 120000 });
const name1 = await p.textContent('.rs-facts div:first-child dd');
const look1 = await p.evaluate(() => `${window.__studio.engine.cfg.preset}/${window.__studio.engine.cfg.material}`);
await p.click('.btn:has-text("REMIX")');
await p.waitForSelector('.rendering', { timeout: 20000 });
await p.waitForSelector('.result', { timeout: 120000 });
const look2 = await p.evaluate(() => `${window.__studio.engine.cfg.preset}/${window.__studio.engine.cfg.material}`);
const name2 = await p.textContent('.rs-facts div:first-child dd');
console.log('REMIX', look1, '→', look2, '|', name1, '→', name2, '| audio kept:', await p.evaluate(() => window.__audio.loaded));
await p.screenshot({ path: `${out}/result2.png`, timeout: 90000 });
await p.click('.btn:has-text("NEW VISUAL")'); await p.waitForSelector('.studio:not([hidden])'); await p.waitForTimeout(1500);
console.log('NEW VISUAL → audio cleared:', await p.evaluate(() => !window.__audio.loaded), 'screen:', await p.locator('.app').getAttribute('data-screen'));
console.log('errors', await p.evaluate(() => window.__errors), logs.filter((l) => !/ERR_FAILED/.test(l)).slice(0, 6).join('\n'));
await b.close();
