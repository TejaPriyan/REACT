// REACT build script — bundles src/ into dist/ with esbuild.
//   node build.mjs            production build (dist/index.html + dist/REACT.html single file)
//   node build.mjs --dev      unminified + inline sourcemaps
//   node build.mjs --watch    rebuild on change
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');
const watch = args.has('--watch');

// Prefer a normal `npm install` of esbuild; fall back to ESBUILD_PATH if specified.
let esbuild;
try {
  esbuild = require('esbuild');
} catch (e) {
  if (process.env.ESBUILD_PATH) {
    esbuild = require(process.env.ESBUILD_PATH);
  } else {
    throw new Error('esbuild is not installed. Please run `npm install` first.');
  }
}
// If react isn't installed locally, resolve it from NODE_PATH if available.
const nodePaths = [];
if (!fs.existsSync(path.join(root, 'node_modules', 'react')) && process.env.NODE_PATH) {
  nodePaths.push(process.env.NODE_PATH);
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

function writeHtml() {
  const tpl = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(dist, 'app.js'), 'utf8');
  const cssPath = path.join(dist, 'app.css');
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  fs.writeFileSync(path.join(dist, 'index.html'),
    tpl.replace('<!--CSS-->', '<link rel="stylesheet" href="app.css">')
       .replace('<!--JS-->', '<script src="app.js"></script>'));
  // Single self-contained file — opens by double click, no server needed.
  fs.writeFileSync(path.join(dist, 'REACT.html'),
    tpl.replace('<!--CSS-->', `<style>${css}</style>`)
       .replace('<!--JS-->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`));

  // Copy static SEO, favicon, and verification assets to dist
  const staticFiles = ['google2af4e1ed3191321d.html', 'robots.txt', 'sitemap.xml', 'favicon.png', 'favicon.ico', 'tp-logo.png'];
  for (const file of staticFiles) {
    const srcPath = path.join(root, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(dist, file));
    }
  }

  // Also duplicate to public/ for hosting providers expecting public as output directory
  const pub = path.join(root, 'public');
  fs.mkdirSync(pub, { recursive: true });
  const distFiles = fs.readdirSync(dist);
  for (const f of distFiles) {
    const src = path.join(dist, f);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(pub, f));
    }
  }
}

const options = {
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true,
  outfile: path.join(dist, 'app.js'),
  format: 'iife',
  target: ['es2020', 'chrome100', 'safari15', 'firefox100'],
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  jsx: 'automatic',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  nodePaths,
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
  logLevel: 'info',
  plugins: [{ name: 'html', setup(b) { b.onEnd(r => { if (!r.errors.length) { try { writeHtml(); } catch (e) { console.error(e); } } }); } }],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(options);
  const size = (f) => (fs.existsSync(path.join(dist, f)) ? (fs.statSync(path.join(dist, f)).size / 1024).toFixed(0) + ' KB' : 'n/a');
  console.log(`dist/REACT.html ${size('REACT.html')}  ·  app.js ${size('app.js')}  ·  app.css ${size('app.css')}`);
}
