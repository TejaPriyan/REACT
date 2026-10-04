import { useStore, appStore } from '../store.js';
import { useAudio } from '../hooks/useAudio.js';
import { runExport, videoSupport } from '../utils/export.js';
import { FRAMES, SIZES } from '../utils/frames.js';
import { Choice, Section } from './ui.jsx';

const FORMATS = [{ id: 'video', label: 'VIDEO' }, { id: 'gif', label: 'GIF' }, { id: 'png', label: 'PNG' }, { id: 'frame', label: 'FRAME' }];
const BLURB = {
  video: 'Records the picture and your music together, in real time. Keep this tab open while it runs.',
  gif: 'A silent loop built beat by beat from the analysis. Up to 15 seconds.',
  png: 'The current frame, at full export resolution.',
  frame: 'REACT finds the strongest moment in your track and renders that frame.',
};

export function ExportPanel() {
  const o = useStore(appStore, (s) => s.exportOpts);
  const frame = useStore(appStore, (s) => s.frame);
  const a = useAudio();
  const set = (patch) => appStore.set({ exportOpts: { ...o, ...patch } });
  const sup = videoSupport();
  const timed = o.format === 'video' || o.format === 'gif';
  const needsAudio = (o.format === 'video' || o.format === 'gif') && !a.loaded;
  const blocked = (o.format === 'video' && !sup.ok) || needsAudio;
  const [w, h] = SIZES[o.format === 'frame' ? 'image' : o.format === 'png' ? 'image' : o.format][frame][o.quality];
  const lengths = [5, 10, 15, 30].map((n) => ({ id: n, label: `${n} s`, hint: o.format === 'gif' && n > 15 ? 'GIFs are limited to 15 seconds' : '' }));
  const dur = o.format === 'gif' ? Math.min(o.duration, 15) : o.duration;
  const go = () => runExport({ ...o, duration: dur });
  const CTA = { video: '● START RECORDING', gif: 'BUILD GIF', png: 'EXPORT PNG', frame: 'CAPTURE BEST FRAME' }[o.format];
  return (
    <Section title="RECORD">
      <div className="field"><span>FORMAT</span>
        <Choice label="Export format" options={FORMATS} value={o.format} onChange={(v) => set({ format: v })} />
      </div>
      <div className="field"><span>RATIO</span>
        <Choice label="Frame ratio" options={FRAMES} value={frame} onChange={(v) => appStore.set({ frame: v })} />
      </div>
      {timed && (
        <>
          <div className="field"><span>LENGTH</span>
            <Choice label="Length in seconds" options={lengths.filter((l) => !(o.format === 'gif' && l.id > 15))} value={dur} onChange={(v) => set({ duration: Number(v) })} />
          </div>
          <div className="field"><span>START AT</span>
            <Choice label="Start position" options={[{ id: 'best', label: 'BEST MOMENT', hint: 'The most dynamic stretch of the track' }, { id: 'playhead', label: 'PLAYHEAD' }, { id: 'start', label: 'BEGINNING' }]}
              value={o.startFrom} onChange={(v) => set({ startFrom: v })} />
          </div>
        </>
      )}
      <div className="field"><span>QUALITY</span>
        <Choice label="Export quality" options={[{ id: 'standard', label: 'STANDARD' }, { id: 'high', label: 'HIGH' }]} value={o.quality} onChange={(v) => set({ quality: v })} />
        <small className="res">{w} × {h}</small>
      </div>
      <p className="help">{BLURB[o.format]}</p>
      {o.format === 'video' && !sup.ok && (
        <p className="help warn">Video recording needs MediaRecorder and canvas capture, which this browser doesn't have. Use a recent Chrome, Edge, Firefox or Safari. PNG, FRAME and GIF still work here.</p>
      )}
      {o.format === 'video' && sup.ok && !/mp4/.test(sup.mime) && (
        <p className="help">This browser records WebM. Most players and editors open it, but some social apps want MP4.</p>
      )}
      {needsAudio && <p className="help warn">Add a sound first. REACT builds this export from your track.</p>}
      <button type="button" className="btn primary wide big rec" disabled={blocked} onClick={go}>{CTA}</button>
    </Section>
  );
}
