import React, { FunctionComponent, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

import { visualizations } from '../../../../visualizations';
import { ncs } from '../../../../visualizations/ncs';
import { systemAudio } from '../../../../visualizations/system-audio';
import { startVisualization, VisualizationHandle } from '../../../../visualizations/visualization';
import { useCoverPalette } from '../../../hooks/use-cover-palette';

const NAME_SHOWN_IN_S = 1.6;

const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transition: opacity 0.5s;
`;

const showBriefly = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
  12% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  75% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
`;

// Says which visualization it is when it's turned on or changed
const Name = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  max-width: 80%;
  padding: 0.3em 0.8em;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  color: white;
  font-size: clamp(10px, min(4.5vw, 7vh), 13px);
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
  opacity: 0;
  animation: ${showBriefly} ${NAME_SHOWN_IN_S}s ease-out;
`;

interface Props {
  visualizationId: number;
  visualizerOpacity: number;
  // how big NCS's circle is drawn, in percent
  ncsZoom: number;
  coverUrl?: string;
}

export const Visualizer: FunctionComponent<Props> = ({ visualizationId, visualizerOpacity, ncsZoom, coverUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<VisualizationHandle | null>(null);
  const palette = useCoverPalette(coverUrl);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const visualization = visualizations[visualizationId] ?? visualizations[0];

  // a stopped canvas can't be drawn on again, each visualization gets its own (see the key below)
  useEffect(() => {
    const handle = startVisualization(canvasRef.current, visualization, systemAudio, paletteRef.current);
    handleRef.current = handle;
    return () => {
      handle?.stop();
      handleRef.current = null;
    };
  }, [visualization]);

  useEffect(() => {
    handleRef.current?.setPalette(palette);
  }, [palette]);

  // a new visualization starts without the cover, it's given it again
  useEffect(() => {
    handleRef.current?.setCover(coverUrl);
  }, [coverUrl, visualization]);

  useEffect(() => {
    handleRef.current?.setZoom(visualization === ncs ? ncsZoom / 100 : 1);
  }, [ncsZoom, visualization]);

  return (
    <>
      <Canvas key={visualization.name} ref={canvasRef} style={{ opacity: visualizerOpacity / 100 }} />
      <Name key={`${visualization.name}-name`}>{visualization.name}</Name>
    </>
  );
};
