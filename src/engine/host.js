// EngineHost — owns a canvas, an Engine, and the requestAnimationFrame loop.
// React never touches per-frame state: components create a host, push config in, and read nothing back per frame.

import { Engine } from './renderer.js';

export const studio = { host: null };   // the studio's host, reachable by the exporter

export class EngineHost {
  constructor(parent, { quality = 'balanced', config = {}, source = null, autoScale = true, className = '' } = {}) {
    this.parent = parent;
    this.canvas = document.createElement('canvas');
    this.canvas.className = `gl ${className}`.trim();
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.canvas);
    this.engine = new Engine(this.canvas, { quality, config, autoScale });
    this.source = source;           // (dt) => features
    this.paused = false;
    this.disposed = false;
    this.last = performance.now();
    this.onFrame = null;
    this.time = 0;
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.resize();
    this._onVis = () => { this.last = performance.now(); };
    document.addEventListener('visibilitychange', this._onVis);
  }

  resize() {
    if (this.disposed) return;
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.engine.setViewport(r.width, r.height, window.devicePixelRatio || 1);
  }

  _loop(now) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const wall = Math.max(0.0005, (now - this.last) / 1000);
    const dt = Math.min(0.05, wall);
    this.last = now;
    this.engine.wallDt = wall;   // unclamped: the adaptive-resolution logic needs real frame times
    if (this.paused) return;
    const f = this.source ? this.source(dt) : undefined;
    this.engine.frame(dt, f);
    this.time += dt;
    if (this.onFrame) this.onFrame(dt, this.engine);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  config(patch) { this.engine.setConfig(patch); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this.engine.dispose();
    this.canvas.remove();
    if (studio.host === this) studio.host = null;
  }
}
