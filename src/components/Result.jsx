import { useEffect, useRef } from 'react';
import { useStore, appStore, app } from '../store.js';
import { audio } from '../audio/audioState.js';
import { runExport } from '../utils/export.js';
import { Download, Share } from './ui.jsx';

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Result() {
  const r = useStore(appStore, (s) => s.result);
  const video = useRef(null);
  const [ar] = [r ? r.w / r.h : 9 / 16];

  // MediaRecorder WebM has no duration in its header: nudge the element so it computes one and seeking works.
  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    const fix = () => {
      if (v.duration === Infinity) {
        v.currentTime = 1e7;
        const back = () => { v.removeEventListener('timeupdate', back); v.currentTime = 0; v.play().catch(() => {}); };
        v.addEventListener('timeupdate', back);
      }
    };
    v.addEventListener('loadedmetadata', fix);
    return () => v.removeEventListener('loadedmetadata', fix);
  }, [r]);

  if (!r) return null;

  const share = async () => {
    try {
      const file = new File([r.blob], r.filename, { type: r.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Made with REACT', text: 'Made with REACT — make sound visible.' });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = r.url; a.download = r.filename; a.click();
    app.toast("This browser can't share files directly, so the file was saved instead.");
  };

  const remix = () => {
    app.remix();
    const s = appStore.get();
    app.toast(`REMIX: ${s.material.toUpperCase()} + ${s.preset.toUpperCase()}`);
    runExport(s.exportOpts);
  };
  const again = () => app.go('studio', { after: () => app.newVisual(audio) });
  const back = () => appStore.set({ screen: 'studio' });

  return (
    <main className="result">
      <div className="rs-head">
        <h1><span>YOUR SOUND.</span><span className="out">YOUR MOTION.</span></h1>
      </div>
      <div className="rs-media" style={{ '--ar': r.w / r.h, '--arn': ar }}>
        {r.kind === 'video' ? (
          <video ref={video} src={r.url} controls loop autoPlay muted playsInline preload="auto" aria-label="Your recording" />
        ) : (
          <img src={r.url} alt="Your export" />
        )}
      </div>
      <div className="rs-side">
        <div className="rs-actions">
          <a className="btn primary big" href={r.url} download={r.filename}><Download size={18} /> DOWNLOAD</a>
          <button type="button" className="btn ghost big" onClick={remix}>REMIX</button>
          <button type="button" className="btn ghost big" onClick={again}>NEW VISUAL</button>
          <button type="button" className="btn ghost big" onClick={share}><Share size={16} /> SHARE</button>
        </div>
        <dl className="rs-facts">
          <div><dt>FILE</dt><dd title={r.filename}>{r.filename}</dd></div>
          <div><dt>SIZE</dt><dd>{fmtSize(r.size)}</dd></div>
          <div><dt>FRAME</dt><dd>{r.w} × {r.h}</dd></div>
          {r.duration > 0 && <div><dt>LENGTH</dt><dd>{r.duration.toFixed(1)} s</dd></div>}
        </dl>
        {r.note && <p className={`help ${r.warn ? 'warn' : ''}`}>{r.note}</p>}
        <p className="rs-private">Made on your device. Your media never left it.</p>
        <button type="button" className="link" onClick={back}>BACK TO THE STUDIO</button>
      </div>
      <footer className="rs-foot">CREATED WITH REACT</footer>
    </main>
  );
}
