import { useEffect } from 'react';

/**
 * Cursor / touch as a force. Writes into engine.pointer (a plain object — no React state):
 *   position, velocity, speed, down (drag), clicks (energy bursts).
 * `global` listens on window (landing hero, where UI sits on top of the canvas).
 */
export function useInteraction(areaRef, engineRef, { global = false } = {}) {
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const target = global ? window : el;
    const canvasRect = () => {
      const c = el.querySelector('canvas');
      return (c || el).getBoundingClientRect();
    };
    const set = (e) => {
      const eng = engineRef.current;
      if (!eng) return null;
      const r = canvasRect();
      const p = eng.pointer;
      p.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      p.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      return p;
    };
    const inside = (e) => { const r = canvasRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    let touchTimer = 0;
    const move = (e) => { const p = set(e); if (p) p.active = global ? true : inside(e) || p.down; };
    const down = (e) => {
      if (!global && e.target.closest && e.target.closest('[data-ui]')) return;
      const p = set(e);
      if (!p) return;
      p.active = true; p.down = true; p.clicks.push(performance.now());
      clearTimeout(touchTimer);
    };
    const up = (e) => {
      const p = engineRef.current && engineRef.current.pointer;
      if (!p) return;
      p.down = false;
      if (e.pointerType === 'touch') { clearTimeout(touchTimer); touchTimer = setTimeout(() => { p.active = false; }, 350); }
    };
    const leave = () => { const p = engineRef.current && engineRef.current.pointer; if (p && !p.down) p.active = false; };
    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    el.addEventListener('pointerleave', leave, { passive: true });
    if (global) document.addEventListener('mouseleave', leave);
    return () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      if (global) document.removeEventListener('mouseleave', leave);
      clearTimeout(touchTimer);
    };
  }, [areaRef, engineRef, global]);
}
