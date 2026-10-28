import React, { FunctionComponent, useEffect, useRef } from 'react';
import styled from 'styled-components';

import {
  AudioFrame,
  AudioSource,
  BEAT_HISTORY,
  SPECTRUM_BANDS,
  WAVEFORM_POINTS,
} from '../../../../visualizations/models';
import { ncsFull } from '../../../../visualizations/ncs';
import { systemAudio } from '../../../../visualizations/system-audio';
import { startVisualization, VisualizationHandle } from '../../../../visualizations/visualization';
import { useCoverPalette } from '../../../hooks/use-cover-palette';

// The whole player is NCS's circle: the album art spinning in the middle, the music around it, nothing else

const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

// 120 beats a minute over a made up spectrum, for the preview in the settings while nothing plays
const DEMO_BEAT_INTERVAL_IN_S = 0.5;
const DEMO_BEAT_DECAY_IN_S = 0.16;

const createDemoAudio = (): AudioSource => {
  const frame: AudioFrame = {
    level: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    beat: 0,
    beatAges: new Float32Array(BEAT_HISTORY),
    spectrum: new Float32Array(SPECTRUM_BANDS),
    peaks: new Float32Array(SPECTRUM_BANDS),
    waveform: new Float32Array(WAVEFORM_POINTS),
  };
  return {
    read: (timeInMs) => {
      const time = timeInMs / 1000;
      const age = time % DEMO_BEAT_INTERVAL_IN_S;
      const beat = Math.exp(-age / DEMO_BEAT_DECAY_IN_S);
      Object.assign(frame, { level: 0.55 + 0.2 * beat, bass: 0.45 + 0.4 * beat, mid: 0.45, treble: 0.35, beat });
      frame.beatAges.forEach((_, index) => {
        frame.beatAges[index] = age + index * DEMO_BEAT_INTERVAL_IN_S;
      });
      frame.spectrum.forEach((_, index) => {
        const wobble = 0.5 + 0.5 * Math.sin(index * 0.55 + time * 3.1);
        const value = Math.min(1, Math.exp(-index / 22) * (0.55 + 0.4 * beat) + 0.22 * wobble * (1 - index / 80));
        frame.spectrum[index] = value;
        frame.peaks[index] = Math.max(value, frame.peaks[index] - 0.01);
      });
      return frame;
    },
  };
};

interface Props {
  coverUrl?: string;
  // a steady beat instead of the music
  isDemo: boolean;
  // how big the circle is drawn, in percent
  zoom: number;
}

export const NcsArt: FunctionComponent<Props> = ({ coverUrl, isDemo, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<VisualizationHandle | null>(null);
  const palette = useCoverPalette(coverUrl);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const coverRef = useRef(coverUrl);
  coverRef.current = coverUrl;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // a stopped canvas can't be drawn on again, it gets a new one when it starts over (see the key below)
  useEffect(() => {
    const handle = startVisualization(
      canvasRef.current,
      ncsFull,
      isDemo ? createDemoAudio() : systemAudio,
      paletteRef.current
    );
    handle?.setCover(coverRef.current);
    handle?.setZoom(zoomRef.current / 100);
    handleRef.current = handle;
    return () => {
      handle?.stop();
      handleRef.current = null;
    };
  }, [isDemo]);

  useEffect(() => {
    handleRef.current?.setCover(coverUrl);
  }, [coverUrl]);

  useEffect(() => {
    handleRef.current?.setPalette(palette);
  }, [palette]);

  useEffect(() => {
    handleRef.current?.setZoom(zoom / 100);
  }, [zoom]);

  return <Canvas key={isDemo ? 'demo' : 'music'} ref={canvasRef} className="draggable" />;
};
