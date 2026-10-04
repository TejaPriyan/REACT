import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
export const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
export async function launch(extra = []) {
  return chromium.launch({
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--enable-features=WebCodecs', ...extra],
  });
}
export function attachLogs(page, out = []) {
  // Google Fonts is progressive enhancement and the sandbox blocks it; fail fast instead of hanging on load.
  page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') out.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', (e) => out.push(`[pageerror] ${e.message}`));
  return out;
}
