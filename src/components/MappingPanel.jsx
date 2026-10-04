import { useEffect, useRef, useState } from 'react';
import { useStore, appStore, app, SOURCES, TARGETS } from '../store.js';
import { studio } from '../engine/host.js';
import { Slider, Section } from './ui.jsx';

const SRC_H = 40, TGT_H = (SRC_H * SOURCES.length) / TARGETS.length, H = SRC_H * SOURCES.length;
const sy = (i) => (i + 0.5) * SRC_H;
const ty = (i) => (i + 0.5) * TGT_H;
const curve = (y0, y1) => `M0 ${y0} C 55 ${y0}, 45 ${y1}, 100 ${y1}`;

/**
 * Patch bay: sound sources on the left, visual targets on the right.
 * Drag from a source to a target (or arm a source and click targets) to connect / disconnect.
 */
export function MappingPanel() {
  const mapping = useStore(appStore, (s) => s.mapping);
  const [armed, setArmed] = useState(null);
  const [sel, setSel] = useState(null);       // { src, dst }
  const [drag, setDrag] = useState(null);     // { src, x, y }
  const bay = useRef(null);
  const meters = useRef({});
  const lines = useRef({});

  // live signal: node meters + line glow, written straight to the DOM
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const eng = studio.host && studio.host.engine;
      const s = eng && eng.driver.s;
      if (!s) return;
      for (const src of SOURCES) {
        const v = Math.min(1, s[src.id] || 0);
        const m = meters.current[src.id];
        if (m) m.style.transform = `scaleX(${v.toFixed(3)})`;
      }
      for (const k in lines.current) {
        const el = lines.current[k];
        if (!el) continue;
        const [src, , amt] = [el.dataset.src, el.dataset.dst, Number(el.dataset.amt)];
        const v = Math.min(1, (s[src] || 0) * amt);
        el.style.strokeOpacity = (0.35 + v * 0.65).toFixed(3);
        el.style.strokeWidth = (1.2 + v * 2.6).toFixed(2);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const has = (src, dst) => mapping.some((m) => m.src === src && m.dst === dst);
  const connect = (src, dst) => { app.toggleMapping(src, dst); setSel(has(src, dst) ? null : { src, dst }); };

  // drag state lives in a ref (handlers must see it immediately); `drag` state only drives the rubber-band line
  const dragRef = useRef(null);
  const onSrcDown = (e, src) => {
    if (e.button !== undefined && e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = bay.current.getBoundingClientRect();
    dragRef.current = { src, moved: false, sx: e.clientX, sy: e.clientY, r };
  };
  const onSrcMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) setDrag({ src: d.src, x: e.clientX - d.r.left, y: e.clientY - d.r.top, moved: true });
  };
  const onSrcUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const t = el && el.closest && el.closest('[data-target]');
    if (d.moved && t) { connect(d.src, t.dataset.target); setArmed(null); }
    else if (!d.moved) setArmed((cur) => (cur === d.src ? null : d.src));
    setDrag(null);
  };

  const selected = sel && mapping.find((m) => m.src === sel.src && m.dst === sel.dst);
  const srcLabel = (id) => SOURCES.find((s) => s.id === id).label;
  const tgtLabel = (id) => TARGETS.find((t) => t.id === id).label;

  return (
    <Section title="REACTION" aside="SOUND → MOTION">
      <div className="bay" ref={bay} style={{ height: H }}>
        <div className="bay-col src">
          {SOURCES.map((s) => (
            <button key={s.id} type="button" className={`node ${armed === s.id ? 'armed' : ''} ${mapping.some((m) => m.src === s.id) ? 'used' : ''}`}
              style={{ height: SRC_H }} aria-pressed={armed === s.id} title={s.hint}
              onPointerDown={(e) => onSrcDown(e, s.id)} onPointerMove={onSrcMove} onPointerUp={onSrcUp} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setArmed(armed === s.id ? null : s.id); } }}>
              <b>{s.label}</b>
              <span className="meter"><i ref={(el) => { meters.current[s.id] = el; }} /></span>
            </button>
          ))}
        </div>
        <svg className="bay-svg" style={{ height: H }} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {mapping.map((m) => {
            const si = SOURCES.findIndex((s) => s.id === m.src), ti = TARGETS.findIndex((t) => t.id === m.dst);
            if (si < 0 || ti < 0) return null;
            const key = `${m.src}>${m.dst}`;
            const on = sel && sel.src === m.src && sel.dst === m.dst;
            return (
              <g key={key}>
                <path d={curve(sy(si), ty(ti))} className={`wire ${on ? 'sel' : ''}`} vectorEffect="non-scaling-stroke"
                  ref={(el) => { lines.current[key] = el; }} data-src={m.src} data-dst={m.dst} data-amt={m.amt} />
                <path d={curve(sy(si), ty(ti))} className="wire-hit" vectorEffect="non-scaling-stroke" onClick={() => setSel({ src: m.src, dst: m.dst })} />
              </g>
            );
          })}
        </svg>
        {drag && drag.moved && (
          <svg className="bay-drag" width="100%" height={H} aria-hidden="true">
            <path d={`M ${96} ${sy(SOURCES.findIndex((s) => s.id === drag.src))} L ${drag.x} ${drag.y}`} />
          </svg>
        )}
        <div className="bay-col tgt">
          {TARGETS.map((t) => (
            <button key={t.id} type="button" data-target={t.id} className={`node ${mapping.some((m) => m.dst === t.id) ? 'used' : ''} ${armed && has(armed, t.id) ? 'linked' : ''}`}
              style={{ height: TGT_H }} disabled={false}
              onClick={() => { if (armed) connect(armed, t.id); }} aria-label={`${t.label}${armed ? `: ${has(armed, t.id) ? 'disconnect from' : 'connect to'} ${srcLabel(armed)}` : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="help">{armed ? `${srcLabel(armed)} is armed. Pick the targets it should drive.` : 'Drag from a sound to a motion, or tap a sound and then its targets.'}</p>
      {selected && (
        <div className="inspector">
          <div className="insp-head"><b>{srcLabel(selected.src)} → {tgtLabel(selected.dst)}</b>
            <button type="button" className="link" onClick={() => { app.toggleMapping(selected.src, selected.dst); setSel(null); }}>REMOVE</button>
          </div>
          <Slider label="AMOUNT" value={selected.amt} min={0} max={2} step={0.05} onChange={(v) => app.setMappingAmount(selected.src, selected.dst, v)} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      )}
    </Section>
  );
}
