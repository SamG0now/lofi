import { AudioAnalyzer } from './audio-analyzer';

type NativeCapture = typeof import('../../build/Release/volume.node');

// The capture is loaded the first time something reads the audio. Should it not load, e.g. an antivirus keeps it from
// loading on Windows, the visualizations get silence instead of the player not starting at all.
let capture: NativeCapture | null | undefined;

const getCapture = (): NativeCapture | null => {
  if (capture === undefined) {
    try {
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      capture = require('../../build/Release/volume.node');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`System audio unavailable: ${error}`);
      capture = null;
    }
  }
  return capture;
};

/** Whatever the speakers play */
export const systemAudio = new AudioAnalyzer(
  (target) => getCapture()?.waveform(target) ?? 0,
  () => getCapture()?.volume() ?? 0
);
