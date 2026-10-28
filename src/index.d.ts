declare module '*.gif';
declare module '*.ico';
declare module '*.icns';
declare module '*.png';
declare module '*.svg';

declare module '*volume.node' {
  const value: {
    /** The highest peak since the last call, from 0 to 1 */
    volume: () => number;
    /**
     * Fills the array with up to 4096 of the latest samples, oldest first, and returns how many were captured so far.
     * Only Linux captures samples, elsewhere it returns 0.
     */
    waveform: (target: Float32Array) => number;
  };
  export = value;
}

declare module '*black-magic.node';
