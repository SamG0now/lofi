export const SPECTRUM_BANDS = 64;
export const WAVEFORM_POINTS = 256;
export const BEAT_HISTORY = 4;

/** What the music sounds like right now, every level goes from 0 (silent) to 1 */
export interface AudioFrame {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** 1 on a beat, fading towards 0 until the next one */
  beat: number;
  /** seconds since each of the last beats, the most recent first */
  beatAges: Float32Array;
  /** SPECTRUM_BANDS bands from low to high */
  spectrum: Float32Array;
  /** the bands' recent highs, falling slowly */
  peaks: Float32Array;
  /** WAVEFORM_POINTS samples from -1 to 1 */
  waveform: Float32Array;
}

export interface AudioSource {
  read: (timeInMs: number) => AudioFrame;
}

/** Colors from 0 to 1 */
export type Rgb = [number, number, number];

export type Palette = [Rgb, Rgb, Rgb];

export interface Visualization {
  name: string;
  /** GLSL defining `vec4 visualize()`, see visualization.ts for what it can use */
  shader: string;
}
