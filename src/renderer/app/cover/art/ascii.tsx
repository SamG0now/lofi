import { clamp } from 'lodash';
import React, { FunctionComponent, useLayoutEffect, useRef } from 'react';
import styled from 'styled-components';

import { getLuminance } from '../../../colors';
import { observeSize } from '../../../observe-size';
import { ArtCanvas, Placement, prepareCanvas, sampleArt, useCoverImage } from './canvas';
import { Inks } from './models';

// The album art typed out in characters, the fuller the character the brighter the art there on dark paper, or the
// darker on light paper
const RAMP = ' .:-=+*#%@';
export const MONOSPACE = "'DejaVu Sans Mono', 'Noto Sans Mono', Menlo, Consolas, monospace";
// rows of characters down the player's shorter side, never smaller than this many pixels
const ROWS_ACROSS = 30;
const MIN_FONT_SIZE = 6;
// the art is read at about two samples a character
const SAMPLES_PER_CHARACTER = 2;
// a little contrast: the faintest tones stay blank
const COVERAGE_FLOOR = 0.08;
const COVERAGE_GAIN = 1.15;

// The lines of an old screen over the characters
const Scanlines = styled.div<{ isOnDarkPaper: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: ${({ isOnDarkPaper }) =>
    isOnDarkPaper
      ? 'repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.45))'
      : 'repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 3px)'};
`;

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
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(width, height) / ROWS_ACROSS);
  context.font = `${fontSize}px ${MONOSPACE}`;
  const characterWidth = context.measureText('M').width;
  const lightnessAt = sampleArt(
    canvas.ownerDocument,
    image,
    width,
    height,
    SAMPLES_PER_CHARACTER / characterWidth,
    placement
  );
  const isOnDarkPaper = getLuminance(paper) < 0.5;

  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.fillStyle = ink;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const columns = Math.ceil(width / characterWidth);
  const rows = Math.ceil(height / fontSize);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (column + 0.5) * characterWidth;
      const y = (row + 0.5) * fontSize;
      const lightness = lightnessAt(x, y);
      const coverage = clamp(((isOnDarkPaper ? lightness : 1 - lightness) - COVERAGE_FLOOR) * COVERAGE_GAIN, 0, 1);
      const character = RAMP[Math.round(coverage * (RAMP.length - 1))];
      if (character !== ' ') {
        context.fillText(character, x, y);
      }
    }
  }
};

interface Props extends Inks, Placement {
  coverUrl?: string;
}

export const AsciiArt: FunctionComponent<Props> = ({ coverUrl, ink, paper, isCenteredX, isCenteredY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const image = useCoverImage(coverUrl);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const draw = (): void => print(canvas, image, { ink, paper }, { isCenteredX, isCenteredY });
    draw();
    // the characters come out wrong if the font arrives after the first drawing
    canvas.ownerDocument.fonts?.ready.then(draw);
    return observeSize([canvas], draw);
  }, [image, ink, paper, isCenteredX, isCenteredY]);

  return (
    <>
      <ArtCanvas ref={canvasRef} className="draggable" />
      <Scanlines className="draggable" isOnDarkPaper={getLuminance(paper) < 0.5} />
    </>
  );
};
