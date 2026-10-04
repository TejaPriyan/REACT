import { PresetPanel } from './PresetPanel.jsx';
import { MappingPanel } from './MappingPanel.jsx';
import { KeyframePanel } from './KeyframePanel.jsx';

/** MOTION: how the picture responds to the sound. */
export function MotionPanel() {
  return (
    <>
      <PresetPanel />
      <MappingPanel />
      <KeyframePanel />
    </>
  );
}
