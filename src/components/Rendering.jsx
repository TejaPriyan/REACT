import { useStore, appStore } from '../store.js';
import { STAGES, cancelExport } from '../utils/export.js';

/** The cinematic render screen. It sits over the studio, whose canvas is the thing being recorded. */
export function Rendering() {
  const r = useStore(appStore, (s) => s.render);
  const done = r.stage >= STAGES.length;
  const pct = Math.round((done ? 1 : r.progress) * 100);
  return (
    <div className={`rendering ${done ? 'done' : ''}`} role="status" aria-live="polite">
      <div className="rd-text">
        {done ? (
          <h2 className="rd-ready">YOUR VISUAL<br />IS READY.</h2>
        ) : (
          <>
            <p className="rd-kicker">RENDERING</p>
            <ol className="rd-stages">
              {STAGES.map((s, i) => (
                <li key={s} className={i < r.stage ? 'past' : i === r.stage ? 'now' : ''} aria-current={i === r.stage ? 'step' : undefined}>
                  <span>{s}</span>
                  {i === r.stage && <i className="rd-bar" style={{ transform: `scaleX(${Math.max(0.02, r.progress)})` }} />}
                </li>
              ))}
            </ol>
            <p className="rd-note"><b>{pct}%</b><span>{r.note}</span></p>
            <button type="button" className="btn ghost" onClick={cancelExport}>CANCEL</button>
          </>
        )}
      </div>
    </div>
  );
}
