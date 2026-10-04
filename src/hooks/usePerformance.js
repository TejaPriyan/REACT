import { useStore, appStore, app } from '../store.js';
import { detectQuality } from '../utils/performance.js';
import { QUALITY } from '../engine/renderer.js';

/** Quality tier (HIGH QUALITY / BALANCED / PERFORMANCE). Auto-selected from the device until the user picks one. */
export function usePerformance() {
  const quality = useStore(appStore, (s) => s.quality);
  const auto = useStore(appStore, (s) => s.qualityAuto);
  return {
    quality, auto, levels: QUALITY,
    set: (q) => appStore.set({ quality: q, qualityAuto: false }),
    resolveAuto: (caps) => { if (appStore.get().qualityAuto) { const q = detectQuality(caps); appStore.set({ quality: q }); return q; } return appStore.get().quality; },
  };
}
export { app };
