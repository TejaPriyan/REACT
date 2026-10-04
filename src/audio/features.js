// The one shape every audio source (file analysis, live analyser, procedural rhythm) fills in.
// The engine never knows *where* the numbers came from.

export const SPECTRUM_BINS = 48;

export function createFeatures() {
  return {
    time: 0,          // seconds since the source started
    position: 0,      // playhead position within the track (seconds)
    playing: false,
    bass: 0, mid: 0, high: 0, rms: 0,   // 0..~1.2, normalised to the track
    energy: 0,        // slow loudness, 0..1
    beat: false,      // true on the frame a transient lands
    beatStrength: 0,  // 0..1.4 relative to recent transients
    bpm: 0,
    phase: 0,         // 0..1 position inside the current beat
    build: 0,         // 0..1: energy has been rising for a while
    dropSoon: 0,      // 0..1: a drop is arriving within ~0.5s (anticipation)
    drop: false,      // true on the frame a drop lands
    calm: 1,          // 1 = quiet passage, 0 = full-on
    spectrum: new Float32Array(SPECTRUM_BINS),
  };
}
