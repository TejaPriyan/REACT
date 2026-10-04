import { useRef } from 'react';
import { useStore, appStore, app, FONTS, loadFontFile } from '../store.js';
import { Slider, Choice, Section, Upload } from './ui.jsx';

export const KINDS = [
  { id: 'text', label: 'TEXT' }, { id: 'logo', label: 'LOGO' }, { id: 'image', label: 'IMAGE' }, { id: 'video', label: 'VIDEO' },
];
const ACCEPT = {
  logo: '.png,.svg,image/png,image/svg+xml',
  image: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  video: '.mp4,.webm,.m4v,video/mp4,video/webm',
};
const NOUN = { logo: 'LOGO', image: 'IMAGE', video: 'VIDEO' };
const HELP = { logo: 'PNG or SVG. Transparent backgrounds work best.', image: 'JPG, PNG or WEBP.', video: 'MP4 or WebM. It plays inside the composition and is captured in your recording.' };
const WEIGHTS = { display: [500, 700, 800], condensed: [400], wide: [300, 500, 800], grotesk: [300, 500, 700], serif: [500, 700, 900], mono: [300, 500] };

/** Route any dropped/picked file to the right object kind. Returns true if it was usable. */
export function loadObjectFile(file, kind) {
  if (!file) return false;
  const name = file.name || '';

  // Check if dropped file is a custom font (.ttf, .otf, .woff, .woff2)
  if (/\.(ttf|otf|woff2?)$/i.test(name)) {
    loadFontFile(file).then((res) => {
      if (res) {
        const customFonts = appStore.get().customFonts || [];
        appStore.set({ customFonts: [...customFonts, res] });
        app.setObject({ kind: 'text', font: res.id, weight: 700 });
        app.toast(`CUSTOM FONT LOADED: ${res.label}`);
      }
    }).catch((err) => {
      console.error(err);
      app.toast('Failed to load font file');
    });
    return true;
  }

  const isVideo = /^video\//.test(file.type) || /\.(mp4|webm|m4v|mov)$/i.test(name);
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(name);
  const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|webp|svg|gif)$/i.test(name);
  if (!isVideo && !isImg) return false;
  const prev = appStore.get().object.fileUrl;
  if (prev) setTimeout(() => URL.revokeObjectURL(prev), 4000);
  const k = isVideo ? 'video' : kind === 'logo' || (isSvg && kind !== 'image') ? 'logo' : kind === 'image' ? 'image' : /png/.test(file.type) && kind !== 'image' ? 'logo' : 'image';
  app.setObject({ kind: k, fileUrl: URL.createObjectURL(file), fileName: name, fileType: file.type });
  return true;
}

export function ObjectPanel() {
  const o = useStore(appStore, (s) => s.object);
  const textBrightness = useStore(appStore, (s) => s.textBrightness ?? 0.85);
  const customFonts = useStore(appStore, (s) => s.customFonts || []);
  const input = useRef(null);
  const fontInput = useRef(null);
  const set = app.setObject;
  const weights = WEIGHTS[o.font] || [400, 700];
  const kindChange = (k) => set({ kind: k });

  const handleFontUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const res = await loadFontFile(file);
      if (res) {
        appStore.set({ customFonts: [...customFonts, res] });
        set({ font: res.id, weight: 700 });
        app.toast(`CUSTOM FONT LOADED: ${res.label}`);
      }
    } catch (err) {
      console.error(err);
      app.toast('Failed to load custom font');
    }
    e.target.value = '';
  };

  return (
    <>
      <Section title="OBJECT">
        <Choice label="Object type" options={KINDS} value={o.kind} onChange={kindChange} />
        {o.kind === 'text' ? (
          <>
            <label className="field" htmlFor="obj-text">
              <span>TEXT</span>
              <textarea id="obj-text" rows={2} maxLength={64} value={o.text} placeholder="TYPE SOMETHING" spellCheck={false}
                onChange={(e) => set({ text: e.target.value })} />
            </label>
            <div className="field"><span>FONT</span>
              <Choice label="Font" className="wrap" value={o.font}
                options={Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label }))}
                onChange={(id) => set({ font: id, weight: (WEIGHTS[id] || [400, 700]).includes(o.weight) ? o.weight : (FONTS[id].def || 700) })} />
              <button type="button" className="btn ghost wide" style={{ marginTop: '8px' }} onClick={() => fontInput.current && fontInput.current.click()}>
                <Upload size={14} /> UPLOAD CUSTOM FONT (.TTF, .OTF, .WOFF2)
              </button>
              <input ref={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={handleFontUpload} />
            </div>
            {weights.length > 1 && (
              <div className="field"><span>WEIGHT</span>
                <Choice label="Weight" value={o.weight} options={weights.map((w) => ({ id: w, label: String(w) }))} onChange={(w) => set({ weight: Number(w) })} />
              </div>
            )}
            <Slider label="SIZE" value={o.size} min={0.5} max={1.5} step={0.01} onChange={(v) => set({ size: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="BRIGHTNESS" value={textBrightness} min={0.2} max={1.8} step={0.05} onChange={(v) => appStore.set({ textBrightness: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="LETTER SPACING" value={o.spacing} min={-0.04} max={0.4} step={0.005} onChange={(v) => set({ spacing: v })} format={(v) => v.toFixed(2)} />
            <Slider label="LINE HEIGHT" value={o.lineHeight} min={0.7} max={1.5} step={0.01} onChange={(v) => set({ lineHeight: v })} format={(v) => v.toFixed(2)} />
            <div className="field"><span>ALIGN</span>
              <Choice label="Alignment" value={o.align} options={[{ id: 'left', label: 'LEFT' }, { id: 'center', label: 'CENTER' }, { id: 'right', label: 'RIGHT' }]} onChange={(v) => set({ align: v })} />
            </div>
          </>
        ) : (
          <div className="dz">
            {o.fileUrl && (
              <div className="file-chip" title={o.fileName}>
                {o.kind !== 'video' && <img src={o.fileUrl} alt="" />}
                <span>{o.fileName || NOUN[o.kind]}</span>
              </div>
            )}
            <button type="button" className="btn primary wide" onClick={() => input.current && input.current.click()}>
              <Upload size={16} /> {o.fileUrl ? `REPLACE ${NOUN[o.kind]}` : `ADD ${NOUN[o.kind]}`}
            </button>
            <p className="help">{HELP[o.kind]} You can also drop it onto the canvas.</p>
            <input ref={input} type="file" accept={ACCEPT[o.kind]} hidden onChange={(e) => { loadObjectFile(e.target.files[0], o.kind); e.target.value = ''; }} />
            {o.fileUrl && (
              <>
                <label className="field" htmlFor="obj-overlay-text" style={{ marginTop: '12px' }}>
                  <span>TEXT ON {NOUN[o.kind]} (OPTIONAL)</span>
                  <textarea
                    id="obj-overlay-text"
                    rows={2}
                    maxLength={64}
                    value={o.overlayText || ''}
                    placeholder={`ADD TEXT TO ${NOUN[o.kind]}...`}
                    spellCheck={false}
                    onChange={(e) => set({ overlayText: e.target.value })}
                  />
                </label>
                {o.overlayText && o.overlayText.trim() && (
                  <>
                    <div className="field">
                      <span>TEXT POSITION</span>
                      <Choice
                        label="Text position"
                        value={o.textPos || 'bottom'}
                        options={[
                          { id: 'bottom', label: 'BOTTOM' },
                          { id: 'below', label: 'BELOW' },
                          { id: 'center', label: 'CENTER' },
                          { id: 'top', label: 'TOP' },
                        ]}
                        onChange={(v) => set({ textPos: v })}
                      />
                    </div>
                    <div className="field">
                      <span>FONT</span>
                      <Choice
                        label="Font"
                        className="wrap"
                        value={o.font}
                        options={Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label }))}
                        onChange={(id) => set({ font: id, weight: (WEIGHTS[id] || [400, 700]).includes(o.weight) ? o.weight : (FONTS[id].def || 700) })}
                      />
                    </div>
                    {weights.length > 1 && (
                      <div className="field">
                        <span>WEIGHT</span>
                        <Choice
                          label="Weight"
                          value={o.weight}
                          options={weights.map((w) => ({ id: w, label: String(w) }))}
                          onChange={(w) => set({ weight: Number(w) })}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <Slider label="SIZE" value={o.size} min={0.5} max={1.5} step={0.01} onChange={(v) => set({ size: v })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="BRIGHTNESS" value={textBrightness} min={0.2} max={1.8} step={0.05} onChange={(v) => appStore.set({ textBrightness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          </div>
        )}
      </Section>
    </>
  );
}
