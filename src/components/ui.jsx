import { useId } from 'react';

// ───────────── icons (inline, 1.6px strokes, currentColor) ─────────────
const I = ({ children, size = 18, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
export const Play = (p) => <I {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></I>;
export const Pause = (p) => <I {...p}><path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" fill="currentColor" stroke="none" /></I>;
export const Loop = (p) => <I {...p}><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></I>;
export const Reverse = (p) => <I {...p}><path d="M11 6l-6 6 6 6" /><path d="M19 6l-6 6 6 6" /></I>;
export const Volume = (p) => <I {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></I>;
export const Mute = (p) => <I {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></I>;
export const Close = (p) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const Sparkle = (p) => <I {...p}><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" fill="currentColor" stroke="none" /></I>;
export const Cinema = (p) => <I {...p}><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></I>;
export const Upload = (p) => <I {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></I>;
export const Download = (p) => <I {...p}><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></I>;
export const Share = (p) => <I {...p}><path d="M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></I>;
export const Trash = (p) => <I {...p}><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></I>;
export const Diamond = (p) => <I {...p}><path d="M12 3l8 9-8 9-8-9z" fill="currentColor" stroke="none" /></I>;

// ───────────── primitives ─────────────
export function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, format, disabled }) {
  const id = useId();
  const shown = format ? format(value) : value;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{shown}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        style={{ '--p': `${pct}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** A row of mutually exclusive choices (radio semantics). */
export function Choice({ options, value, onChange, label, className = '' }) {
  return (
    <div className={`choice ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const id = typeof o === 'string' ? o : o.id;
        const text = typeof o === 'string' ? o : o.label;
        const on = id === value;
        return (
          <button key={id} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} title={o.hint}
            onClick={() => onChange(id)}>{text}</button>
        );
      })}
    </div>
  );
}

export function Section({ title, aside, children }) {
  return (
    <section className="sec">
      <header><h3>{title}</h3>{aside && <span className="aside">{aside}</span>}</header>
      {children}
    </section>
  );
}

export function Switch({ label, checked, onChange, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="sw-track"><span className="sw-knob" /></span>
      <span className="sw-label">{label}{hint && <small>{hint}</small>}</span>
    </button>
  );
}
