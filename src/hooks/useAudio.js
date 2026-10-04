import { useStore, app } from '../store.js';
import { audio, audioStore } from '../audio/audioState.js';
import { isAudioFile, synthDemoTrack } from '../utils/audio.js';

/** Audio UI state + transport actions. (Per-frame values are read straight from `audio`, never via React state.) */
export function useAudio() {
  const s = useStore(audioStore);
  return { ...s, audio };
}

export async function loadAudioFile(file) {
  if (!file) return false;
  if (!isAudioFile(file)) { app.toast('That is not an audio file. Use MP3, WAV, OGG or M4A.'); return false; }
  try {
    audioStore.set({ error: '' });
    await audio.loadFile(file);
    return true;
  } catch (e) {
    app.toast("Couldn't read that audio file. Try an MP3 or WAV.");
    return false;
  }
}

let demoPromise = null;
export async function loadDemoTrack() {
  try {
    audioStore.set({ loaded: true, name: 'DEMO TRACK', analyzing: true, progress: 0, ready: false, error: '' });
    demoPromise = demoPromise || synthDemoTrack();
    const buf = await demoPromise;
    await audio.loadBuffer(buf, 'DEMO TRACK — 124 BPM');
    return true;
  } catch (e) {
    console.error(e);
    audio.clear();
    app.toast("Couldn't build the demo track in this browser. Upload your own audio instead.");
    return false;
  }
}
