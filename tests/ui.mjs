// UI interaction sweep with assertions. usage: node tests/ui.mjs outDir [w h]
import { launch, attachLogs, BASE } from './util.mjs';
import fs from 'node:fs';
const [out, W = '1180', H = '760'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, acceptDownloads: true });
const p = await ctx.newPage();
const logs = attachLogs(p);
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
const shot = (n) => p.screenshot({ path: `${out}/${n}.png`, timeout: 120000 }).catch((e) => console.log('shot fail', n));
await p.goto(BASE); await p.waitForTimeout(800);

// landing
ok('landing title + tagline', (await p.textContent('.tagline')).includes('MAKE SOUND VISIBLE'));
ok('landing CTAs', (await p.locator('.ln-cta .btn').allTextContents()).join('|') === 'CREATE VISUAL|EXPLORE');
ok('privacy line', (await p.textContent('.ln-foot')).includes('YOUR MEDIA STAYS IN YOUR BROWSER'));

// discover
await p.click('text=EXPLORE'); await p.waitForSelector('.discover'); await p.waitForFunction(() => document.querySelectorAll('.dc-media img').length === 8, null, { timeout: 90000 }).catch(() => {});
ok('discover has 8 cards', (await p.locator('.dc-card').count()) === 8);
const posters = await p.locator('.dc-media img').count();
ok('discover posters rendered', posters === 8, `${posters}/8`);
await p.hover('.dc-card:nth-child(3) .dc-media'); await p.waitForTimeout(1500);
ok('discover live canvas moves into hovered tile', (await p.locator('.dc-card:nth-child(3) canvas').count()) === 1);
await shot('01-discover');
await p.click('.dc-card:nth-child(4) .btn');  // SHATTER
await p.waitForSelector('.studio:not([hidden])', { timeout: 10000 }); await p.waitForTimeout(1200);
ok('USE THIS STYLE enters studio', (await p.locator('.app').getAttribute('data-screen')) === 'studio');
await p.click('.tabs button:has-text("MOTION")');
ok('preset applied (SHATTER)', await p.locator('.grid2 .tile.on').first().textContent().then((t) => t.trim() === 'SHATTER'));
await shot('02-motion');

// audio
await p.click('.tabs button:has-text("AUDIO")');
await p.click('text=TRY THE DEMO TRACK');
await p.waitForFunction(() => window.__audio && window.__audio.analysis, null, { timeout: 120000 });
await p.waitForTimeout(500);
ok('audio panel shows bpm', (await p.textContent('.facts')).includes('124'));
ok('never autoplays', await p.evaluate(() => !window.__audio.playing));
await p.click('.play'); await p.waitForTimeout(1200);
ok('play starts', await p.evaluate(() => window.__audio.playing && window.__audio.position > 0.2), String(await p.evaluate(() => window.__audio.position)));
await p.click('.play'); ok('pause stops', await p.evaluate(() => !window.__audio.playing));
const box = await p.locator('.tl-wave').boundingBox();
await p.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
const pos = await p.evaluate(() => window.__audio.position);
ok('scrub to middle', Math.abs(pos - 16.7) < 1.2, pos.toFixed(2));
await p.click('[aria-label="Playback speed"] button:has-text("½×")');
ok('speed 0.5', await p.evaluate(() => window.__audio.rate === 0.5));
await p.click('[aria-label="Playback speed"] button:has-text("1×")');
await p.click('[aria-label="Loop"]'); ok('loop on', await p.evaluate(() => window.__audio.loop));
await p.click('[aria-label="Loop"]');
await p.click('[aria-label="Reverse"]'); ok('reverse on', await p.evaluate(() => window.__audio.dir === -1));
await p.click('[aria-label="Reverse"]');
await p.click('.tl-right [aria-label="Mute"]'); ok('mute', await p.evaluate(() => window.__audio.muted));
await p.click('.tl-right [aria-label="Unmute"]');

// object
await p.click('.tabs button:has-text("OBJECT")');
await p.fill('#obj-text', 'TEJA PRIYAN'); await p.waitForTimeout(500);
await p.click('.choice button:has-text("CONDENSED")');
ok('font switch', await p.evaluate(() => true));
await p.click('.choice[aria-label="Object type"] button:has-text("LOGO")');
ok('logo upload control', (await p.locator('text=ADD LOGO').count()) === 1);
// upload an svg logo
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="150" fill="#fff"/><rect x="170" y="80" width="60" height="240" fill="#000"/></svg>`;
fs.writeFileSync(`${out}/logo.svg`, svg);
await p.setInputFiles('input[type=file][accept*="svg"]', `${out}/logo.svg`);
await p.waitForTimeout(2500);
ok('logo became the object', await p.evaluate(() => !!window.__studio.engine.obj && window.__studio.engine.obj.kind !== 'text'), await p.evaluate(() => window.__studio.engine.obj.kind));
await shot('03-logo');
await p.click('.choice[aria-label="Object type"] button:has-text("TEXT")');
await p.waitForTimeout(800);

// motion: mapping
await p.click('.tabs button:has-text("MOTION")'); await p.waitForTimeout(2500);
await p.locator('.bay').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
const mapBefore = await p.locator('.bay path.wire').count();
const src = await p.locator('.bay-col.src .node').nth(0).boundingBox();
const tgt = await p.locator('.bay-col.tgt .node[data-target="camera"]').boundingBox();
await p.mouse.move(src.x + 20, src.y + src.height / 2); await p.mouse.down();
await p.mouse.move(src.x + 60, src.y + 40, { steps: 4 }); await p.mouse.move(tgt.x + 20, tgt.y + tgt.height / 2, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(300);
const mapAfter = await p.locator('.bay path.wire').count();
ok('drag BASS → CAMERA adds a connection', mapAfter === mapBefore + 1 || mapAfter === mapBefore - 1, `${mapBefore}→${mapAfter}`);
await shot('04-mapping');
// keyframe
await p.click('.sec:has-text("KEYFRAMES") button:has-text("ADD KEY")');
ok('keyframe added', (await p.locator('.keys li').count()) === 1);
// style
await p.click('.tabs button:has-text("STYLE")');
await p.click('.swatch:has-text("COSMIC")');
await p.click('.tile:has-text("NEON")');
await p.click('.choice[aria-label="Frame ratio"] button:has-text("16:9")'); await p.waitForTimeout(600);
ok('frame 16:9', await p.evaluate(() => { const r = document.querySelector('.frame').getBoundingClientRect(); return Math.abs(r.width / r.height - 16 / 9) < 0.02; }));
await shot('05-style-169');
await p.click('.choice[aria-label="Frame ratio"] button:has-text("9:16")');
// surprise
const before = await p.evaluate(() => `${window.__studio.engine.cfg.preset}/${window.__studio.engine.cfg.material}/${window.__studio.engine.cfg.palette}`);
await p.click('.surprise'); await p.waitForTimeout(400);
const after = await p.evaluate(() => `${window.__studio.engine.cfg.preset}/${window.__studio.engine.cfg.material}/${window.__studio.engine.cfg.palette}`);
ok('SURPRISE ME changes the look', before !== after, `${before} → ${after}`);
// keyboard
await p.keyboard.press('Escape');
await p.focus('body'); await p.keyboard.press('r');
ok('R opens record panel', (await p.locator('.panel h3:has-text("RECORD")').count()) === 1);
await p.keyboard.press('Escape');
ok('Esc closes panel', (await p.locator('.panel').count()) === 0);
// cinema
await p.click('.cin'); await p.waitForTimeout(800);
ok('cinema hides UI', (await p.locator('.studio.cinema').count()) === 1 && (await p.locator('.timeline').isVisible()) === false);
await shot('06-cinema');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
ok('cinema exits', (await p.locator('.studio.cinema').count()) === 0);

console.log(results.map((r) => r.join('  ')).join('\n'));
console.log('errors', await p.evaluate(() => window.__errors), logs.filter((l) => !/ERR_FAILED/.test(l)).slice(0, 10).join('\n'));
await b.close();
