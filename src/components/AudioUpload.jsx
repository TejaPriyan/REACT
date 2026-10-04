import { useRef, useState } from 'react';
import { useAudio, loadAudioFile, loadDemoTrack } from '../hooks/useAudio.js';
import { AUDIO_ACCEPT, formatTime } from '../utils/audio.js';
import { Slider, Section, Upload, Volume, Mute } from './ui.jsx';

/** The big "DROP YOUR SOUND" moment — shown on the canvas until a sound is loaded. */
export function DropHero({ dragging }) {
  const input = useRef(null);
  const a = useAudio();
  const { loaded, analyzing } = a;
  const [busy, setBusy] = useState(false);
  if (loaded && !analyzing) return null;
  const demo = async () => { setBusy(true); await loadDemoTrack(); setBusy(false); };
  return (
    <div className={`drophero ${dragging ? 'drag' : ''}`} data-ui>
      <div className="drophero-in">
        <p className="dh-title">{analyzing || busy ? 'READING YOUR SOUND' : 'DROP YOUR SOUND'}</p>
        <div className="dh-actions">
          <button type="button" className="btn primary" onClick={() => input.current && input.current.click()} disabled={analyzing || busy}>
            <Upload size={16} /> CHOOSE AUDIO
          </button>
          <button type="button" className="btn ghost" onClick={demo} disabled={analyzing || busy}>TRY THE DEMO TRACK</button>
          <button type="button" className="btn ghost" onClick={() => a.audio.startMic()} disabled={analyzing || busy}>
            🎙 LIVE MIC
          </button>
        </div>
        <p className="dh-note">MP3, WAV, OGG or M4A. Your media stays in your browser.</p>
        <input ref={input} type="file" accept={AUDIO_ACCEPT} hidden onChange={(e) => { loadAudioFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export function AudioPanel() {
  const a = useAudio();
  const input = useRef(null);
  const pickFile = () => input.current && input.current.click();
  return (
    <>
      <Section title="AUDIO">
        {!a.loaded ? (
          <div className="dz">
            <button type="button" className="btn primary wide" onClick={pickFile}><Upload size={16} /> CHOOSE AUDIO</button>
            <button type="button" className="btn ghost wide" onClick={loadDemoTrack}>TRY THE DEMO TRACK</button>
            <button type="button" className="btn ghost wide" onClick={() => a.audio.startMic()}>🎙 LIVE MIC / LINE-IN</button>
            <p className="help">Or drop a file anywhere on the canvas. MP3, WAV, OGG, M4A.</p>
          </div>
        ) : a.micActive ? (
          <div className="audio-card">
            <div className="ac-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ff3366', boxShadow: '0 0 8px #ff3366' }} />
              LIVE MICROPHONE / LINE-IN
            </div>
            <dl className="facts">
              <div><dt>MODE</dt><dd>REALTIME</dd></div>
              <div><dt>REACTIVITY</dt><dd>LIVE</dd></div>
              <div><dt>BEATS</dt><dd>DETECTING</dd></div>
              <div><dt>LATENCY</dt><dd>LOW</dd></div>
            </dl>
            <p className="help">Audio is analyzed live with adaptive automatic gain control. Visuals react to your voice or instrument.</p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => a.audio.stopMic()}>STOP MIC</button>
              <button type="button" className="btn ghost" onClick={pickFile}>USE FILE</button>
            </div>
          </div>
        ) : (
          <div className="audio-card">
            <div className="ac-name" title={a.name}>{a.name}</div>
            <dl className="facts">
              <div><dt>LENGTH</dt><dd>{formatTime(a.duration)}</dd></div>
              <div><dt>TEMPO</dt><dd>{a.analyzing ? '…' : a.bpm ? `${Math.round(a.bpm)} BPM` : '—'}</dd></div>
              <div><dt>BEATS</dt><dd>{a.analyzing ? '…' : a.beats.length}</dd></div>
              <div><dt>DROPS</dt><dd>{a.analyzing ? '…' : a.drops.length}</dd></div>
            </dl>
            {a.analyzing && (
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.progress * 100)}>
                <i style={{ width: `${Math.round(a.progress * 100)}%` }} /><span>ANALYZING {Math.round(a.progress * 100)}%</span>
              </div>
            )}
            {a.error && <p className="help warn">{a.error}</p>}
            <div className="row">
              <button type="button" className="btn ghost" onClick={pickFile}>REPLACE</button>
              <button type="button" className="btn ghost" onClick={() => a.audio.clear()}>REMOVE</button>
              <button type="button" className="btn ghost" onClick={() => a.audio.startMic()}>🎙 MIC</button>
            </div>
          </div>
        )}
        <input ref={input} type="file" accept={AUDIO_ACCEPT} hidden onChange={(e) => { loadAudioFile(e.target.files[0]); e.target.value = ''; }} />
      </Section>
      <Section title="LEVEL">
        <div className="vol">
          <button type="button" className="icon" aria-label={a.muted ? 'Unmute' : 'Mute'} aria-pressed={a.muted} onClick={() => a.audio.setMuted(!a.muted)}>
            {a.muted ? <Mute /> : <Volume />}
          </button>
          <Slider label="VOLUME" value={a.muted ? 0 : a.volume} min={0} max={1} step={0.01}
            onChange={(v) => { if (a.muted) a.audio.setMuted(false); a.audio.setVolume(v); }} format={(v) => `${Math.round(v * 100)}`} />
        </div>
        <p className="help">Recordings always capture the track at full level, whatever your volume is.</p>
      </Section>
    </>
  );
}
