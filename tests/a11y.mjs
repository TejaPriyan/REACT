import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
const p = await ctx.newPage(); const logs = attachLogs(p);
const res = [];
const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}  ${x}`);
await p.goto(BASE); await p.waitForTimeout(1200);
ok('reduced motion → calm motion on', await p.evaluate(() => document.documentElement.dataset.reduce === '1'));
// landing keyboard traversal
const seen = [];
for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); seen.push(await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return `${a.textContent.trim().slice(0, 14)}|${cs.outlineStyle}|${cs.outlineWidth}`; })); }
ok('landing tab order reaches controls with visible focus ring', seen.some((s) => s.startsWith('CREATE VISUAL') && s.includes('solid')), JSON.stringify(seen));
await p.keyboard.press('Tab'); // past explore
const focusInfo = await p.evaluate(() => { const el = document.querySelector('.ln-cta .btn.primary') || [...document.querySelectorAll('button')].find((b) => /CREATE VISUAL/.test(b.textContent)); if (el) el.focus(); return el ? el.className : 'none'; });
await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelector('.app')?.dataset.screen === 'studio', null, { timeout: 45000 }).catch(async () => { res.push('FAIL  Enter on CREATE VISUAL did not enter studio  ' + focusInfo + ' screen=' + await p.evaluate(() => document.querySelector('.app')?.dataset.screen)); });
await p.waitForTimeout(2500);
// studio: number keys open tabs, space toggles transport only with audio
await p.focus('body');
await p.keyboard.press('3'); ok('key 3 opens MOTION', (await p.locator('.panel h3').first().textContent()).trim() === 'PRESET');
await p.keyboard.press('1'); ok('key 1 opens AUDIO', (await p.locator('.panel h3').first().textContent()).trim() === 'AUDIO');
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.focus('body'); await p.keyboard.press('Space'); await p.waitForTimeout(600);
ok('space plays', await p.evaluate(() => window.__audio.playing));
await p.keyboard.press('Space'); ok('space pauses', await p.evaluate(() => !window.__audio.playing));
// timeline keyboard
await p.focus('.tl-wave'); const before = await p.evaluate(() => window.__audio.position); await p.keyboard.press('ArrowRight'); const after = await p.evaluate(() => window.__audio.position);
ok('timeline arrow keys seek', after > before + 1.5, `${before.toFixed(1)}→${after.toFixed(1)}`);
// aria
ok('tabs expose aria-expanded', (await p.locator('.tabs button[aria-expanded]').count()) === 4);
ok('every radio group is labelled', (await p.locator('[role=radiogroup]').count()) >= 1 && (await p.locator('[role=radiogroup]:not([aria-label])').count()) === 0);
ok('canvas hidden from AT', (await p.locator('canvas[aria-hidden=true]').count()) >= 1);
const names = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title).length);
ok('no unlabeled icon buttons', names === 0, String(names));
// sign-off end card look
await p.evaluate(() => { const h = window.__studio, e = h.engine; h.pause(); e.autoScale = false; e.renderScale = 0.8; e.applySize(true); e.sig.alpha = 1; e.sig.fade = 0.92; for (let i = 0; i < 20; i++) e.update(1 / 60, window.__audio.featuresAt(8 + i / 60, 8 + (i - 1) / 60)); e.render(); });
await (await p.$('.frame')).screenshot({ path: `${out}/signoff.png`, timeout: 90000 });
console.log(res.join('\n'));
console.log('errors', await p.evaluate(() => window.__errors), logs.filter((l) => !/ERR_FAILED/.test(l)).slice(0, 6).join('\n'));
await b.close();
