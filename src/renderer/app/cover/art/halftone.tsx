import { clamp } from 'lodash';
import React, { FunctionComponent, useLayoutEffect, useRef } from 'react';

import { getLuminance } from '../../../colors';
import { observeSize } from '../../../observe-size';
import { ArtCanvas, Placement, prepareCanvas, sampleArt, useCoverImage } from './canvas';
import { Inks } from './models';

// The album art printed as a halftone: a screen of dots at the classic 45°, each as large as the art is bright where
// it sits on dark paper, or as dark on light paper
const SCREEN_ANGLE = Math.PI / 4;
// cells across the player's shorter side, never smaller than this many pixels
const CELLS_ACROSS = 42;
const MIN_CELL = 4;
// the art is read at about two samples a cell
const SAMPLES_PER_CELL = 2;
// a dot this full touches its neighbors, the screen closes up in the brightest (or darkest) parts
const MAX_COVERAGE_RADIUS = Math.SQRT1_2 * 1.04;
// a little contrast: the faintest tones leave no dot at all
const COVERAGE_FLOOR = 0.06;
const COVERAGE_GAIN = 1.12;

const print = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  { ink, paper }: Inks,
  placement: Placement
): void => {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { context, width, height } = prepared;
  const cell = Math.max(MIN_CELL, Math.min(width, height) / CELLS_ACROSS);
  const lightnessAt = sampleArt(canvas.ownerDocument, image, width, height, SAMPLES_PER_CELL / cell, placement);
  const isOnDarkPaper = getLuminance(paper) < 0.5;
  const maxRadius = cell * MAX_COVERAGE_RADIUS;

  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.fillStyle = ink;
  context.beginPath();

  // the screen is walked along its own rotated axes, over a square that covers the player whatever its shape
  const cos = Math.cos(SCREEN_ANGLE);
  const sin = Math.sin(SCREEN_ANGLE);
  const reach = Math.ceil(Math.hypot(width, height) / 2 / cell) * cell;
  for (let v = -reach; v <= reach; v += cell) {
    for (let u = -reach; u <= reach; u += cell) {
      const x = width / 2 + u * cos - v * sin;
      const y = height / 2 + u * sin + v * cos;
      if (x > -cell && y > -cell && x < width + cell && y < height + cell) {
        const lightness = lightnessAt(x, y);
        const coverage = clamp(((isOnDarkPaper ? lightness : 1 - lightness) - COVERAGE_FLOOR) * COVERAGE_GAIN, 0, 1);
        // the dot's area follows the tone
        const radius = maxRadius * Math.sqrt(coverage);
        if (radius > 0.25) {
          context.moveTo(x + radius, y);
          context.arc(x, y, radius, 0, Math.PI * 2);
        }
      }
    }
  }
  context.fill();
};

interface Props extends Inks, Placement {
  coverUrl?: string;
}

export const HalftoneArt: FunctionComponent<Props> = ({ coverUrl, ink, paper, isCenteredX, isCenteredY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const image = useCoverImage(coverUrl);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const draw = (): void => print(canvas, image, { ink, paper }, { isCenteredX, isCenteredY });
    draw();
    return observeSize([canvas], draw);
  }, [image, ink, paper, isCenteredX, isCenteredY]);

  return <ArtCanvas ref={canvasRef} className="draggable" />;
};
