import { useEffect } from 'react';
import { appStore } from '../store.js';
import { Close } from './ui.jsx';

export function About() {
  const close = () => appStore.set({ overlay: null });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="discover about-overlay" role="dialog" aria-modal="true" aria-label="About REACT and Teja Priyan">
      <header className="dc-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="favicon.png" alt="Teja Priyan TP Logo" style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 0 16px rgba(0,229,255,0.25)' }} />
          <div>
            <h2 style={{ fontSize: '18px', letterSpacing: '0.12em', margin: 0 }}>REACT</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--ash)', letterSpacing: '0.08em' }}>AUDIO-REACTIVE 3D MOTION STUDIO</p>
          </div>
        </div>
        <button type="button" className="icon" aria-label="Close" onClick={close} autoFocus><Close /></button>
      </header>

      <div className="about-content" style={{ padding: '24px 32px 40px', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="about-creator-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: '6px', padding: '20px 24px' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'var(--accent, #00e5ff)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>CREATOR & ARCHITECT</span>
          <h3 style={{ fontSize: '22px', letterSpacing: '0.06em', margin: '0 0 8px', color: 'var(--ink)' }}>Teja Priyan</h3>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--ash)', margin: 0 }}>
            Conceived, designed, and engineered as an uncompromising, client-side motion graphics engine. Built to give musicians, producers, designers, and visual artists real-time control over 3D typography, particle dynamics, and audio-driven cinematic rendering — accessible worldwide at <a href="https://reactsound.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #00e5ff)', textDecoration: 'none' }}>reactsound.vercel.app</a>.
          </p>
          <div style={{ marginTop: "14px" }}><a href="https://www.buymeacoffee.com/TejaPriyan" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#FFDD00", color: "#000", padding: "8px 16px", borderRadius: "999px", fontWeight: "bold", textDecoration: "none", fontSize: "13px" }}><span>🍕</span><span>Buy me a pizza</span></a></div>
        </div>

        <div className="about-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '4px', padding: '16px' }}>
            <h4 style={{ fontSize: '11px', letterSpacing: '0.14em', margin: '0 0 6px', color: 'var(--ink)' }}>100% CLIENT-SIDE</h4>
            <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--ash)', margin: 0 }}>
              Audio analysis and WebGL rendering run completely inside your local browser. No cloud upload, no telemetry, no subscription fees.
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '4px', padding: '16px' }}>
            <h4 style={{ fontSize: '11px', letterSpacing: '0.14em', margin: '0 0 6px', color: 'var(--ink)' }}>PROCEDURAL SHADERS</h4>
            <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--ash)', margin: 0 }}>
              Chrome, Glass, Liquid, Neon, Paper, Pixel, and Organic procedural materials with multi-tap HDR bloom, dispersion, and chromatic aberration.
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '4px', padding: '16px' }}>
            <h4 style={{ fontSize: '11px', letterSpacing: '0.14em', margin: '0 0 6px', color: 'var(--ink)' }}>CUSTOM TYPOGRAPHY & ART</h4>
            <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--ash)', margin: 0 }}>
              Upload any custom font (.ttf, .otf, .woff2) or drop images/logos with customizable multi-position text overlays.
            </p>
          </div>
        </div>

        <div className="about-legal" style={{ borderTop: '1px solid var(--line)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.08em', color: 'var(--ash)' }}>
              © 2026 <strong>Teja Priyan</strong>. All Rights Reserved.
            </span>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <a href="https://reactsound.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--accent, #00e5ff)', textDecoration: 'none' }}>
                LIVE STUDIO ↗
              </a>
              <a href="https://github.com/TejaPriyan/REACT" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--ash)', textDecoration: 'none' }}>
                GITHUB REPOSITORY ↗
              </a>
            </div>
          </div>
          <p style={{ fontSize: '10.5px', color: 'var(--ash)', opacity: 0.8, margin: 0, lineHeight: 1.4 }}>
            Proprietary source code. Unauthorized reproduction, copying, distribution, decompilation, or commercial reuse without written permission is strictly prohibited.
          </p>
          <div style={{ marginTop: "14px" }}><a href="https://www.buymeacoffee.com/TejaPriyan" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#FFDD00", color: "#000", padding: "8px 16px", borderRadius: "999px", fontWeight: "bold", textDecoration: "none", fontSize: "13px" }}><span>🍕</span><span>Buy me a pizza</span></a></div>
        </div>
      </div>
    </div>
  );
}
