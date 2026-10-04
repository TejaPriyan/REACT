import { useStore } from '../store.js';
import { audioStore } from '../audio/audioState.js';

/** Pre-scan status: progress, BPM, beat map, drops. */
export function useAudioAnalysis() {
  const analyzing = useStore(audioStore, (s) => s.analyzing);
  const progress = useStore(audioStore, (s) => s.progress);
  const ready = useStore(audioStore, (s) => s.ready);
  const bpm = useStore(audioStore, (s) => s.bpm);
  const beats = useStore(audioStore, (s) => s.beats);
  const drops = useStore(audioStore, (s) => s.drops);
  const peaks = useStore(audioStore, (s) => s.peaks);
  return { analyzing, progress, ready, bpm, beats, drops, peaks };
}
