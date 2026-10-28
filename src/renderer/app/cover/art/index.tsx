import React, { CSSProperties, FunctionComponent } from 'react';
import styled from 'styled-components';

import { DesignLook } from '../../../../models/player-design';
import { AsciiArt } from './ascii';
import { Placement } from './canvas';
import { HalftoneArt } from './halftone';
import { getCoverBackground, Inks } from './models';
import { NcsArt } from './ncs';
import { PulseArt } from './pulse';
import { VinylArt } from './vinyl';

export { getCoverBackground, SAMPLE_COVER } from './models';
export { usePulse } from './pulse';

// How the album art is adjusted, in percent and the blur in pixels
export interface ArtAdjustments {
  zoom: number;
  brightness: number;
  saturation: number;
  blur: number;
}

/** Styles for what holds the art: adjusted, zoomed in towards where it's kept, and faded out while paused. */
export const getArtStyle = (
  { zoom, brightness, saturation, blur }: ArtAdjustments,
  { isCenteredX, isCenteredY }: Placement,
  isPaused: boolean
): CSSProperties => {
  const filters = [
    brightness !== 100 && `brightness(${brightness / 100})`,
    saturation !== 100 && `saturate(${saturation / 100})`,
    blur > 0 && `blur(${blur}px)`,
    isPaused && 'blur(2px) grayscale(50%)',
  ].filter(Boolean);
  // a blurred edge turns see-through, the art grows a little to keep it out of sight
  const scale = (zoom / 100) * (1 + blur / 100) * (isPaused ? 1.05 : 1);
  return {
    filter: filters.join(' ') || 'none',
    transform: scale === 1 ? 'none' : `scale(${Number(scale.toFixed(4))})`,
    transformOrigin: `${isCenteredX ? 'center' : 'left'} ${isCenteredY ? 'center' : 'top'}`,
  };
};

const Plain = styled.div`
  position: absolute;
  inset: 0;
  background-size: cover;
`;

interface Props extends Inks, Placement {
  look: DesignLook;
  coverUrl?: string;
  isPlaying: boolean;
  // the music the art follows is a steady beat, for the preview in the settings
  isDemo?: boolean;
  // how big NCS's circle is drawn, in percent
  ncsZoom?: number;
}

/** The album art the way the design's look shows it. */
export const CoverArt: FunctionComponent<Props> = ({
  look,
  coverUrl,
  ink,
  paper,
  isCenteredX,
  isCenteredY,
  isPlaying,
  isDemo = false,
  ncsZoom = 100,
}) => {
  const placement = { isCenteredX, isCenteredY };
  switch (look) {
    case DesignLook.Halftone:
      return <HalftoneArt coverUrl={coverUrl} ink={ink} paper={paper} {...placement} />;
    case DesignLook.Ascii:
      return <AsciiArt coverUrl={coverUrl} ink={ink} paper={paper} {...placement} />;
    case DesignLook.Vinyl:
      return <VinylArt coverUrl={coverUrl} isPlaying={isPlaying} />;
    case DesignLook.Pulse:
      return <PulseArt coverUrl={coverUrl} {...placement} />;
    case DesignLook.Ncs:
      return <NcsArt coverUrl={coverUrl} isDemo={isDemo} zoom={ncsZoom} />;
    default:
      return (
        <Plain
          className="draggable"
          style={{
            backgroundImage: getCoverBackground(coverUrl),
            backgroundPosition: `${isCenteredX ? 'center' : 'left'} ${isCenteredY ? 'center' : 'top'}`,
          }}
        />
      );
  }
};
