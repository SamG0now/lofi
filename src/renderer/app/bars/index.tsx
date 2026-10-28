import { clamp } from 'lodash';
import React, { FunctionComponent, useMemo } from 'react';
import styled, { css } from 'styled-components';

import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { useWindowSize } from '../../hooks/use-window-size';
import { Size } from '../../models';
import { getEdgeGeometry } from '../edge-haze';

// A thin progress bar for when the player controls are hidden, they have their own. It runs along the bottom, or all
// the way around the player from the middle of the top. The player fades out towards its edges, so the bar keeps
// clear of that, unless it's hazy: then it glows a little way into the edges, under their haze, which blurs and
// mists it like the art there.
const HAZY_INSET_SHARE = 0.75;
// the progress is only polled every second or so, the bar glides from one to the next
const GLIDE_IN_S = 1;
const PATH_LENGTH = 1000;

// the edge haze is drawn at 3: a hazy bar goes under it
const layer = css<{ isShown: boolean; isUnderHaze: boolean }>`
  position: absolute;
  z-index: ${({ isUnderHaze }) => (isUnderHaze ? 2 : 4)};
  pointer-events: none;
  opacity: ${({ isShown }) => (isShown ? 1 : 0)};
`;

const Bottom = styled.div<{ isShown: boolean; isUnderHaze: boolean }>`
  ${layer}
  transition: opacity 0.3s, width ${GLIDE_IN_S}s linear;
`;

const Around = styled.svg<{ isShown: boolean; isUnderHaze: boolean }>`
  ${layer}
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  transition: opacity 0.3s;

  path {
    transition: stroke-dasharray ${GLIDE_IN_S}s linear;
  }
`;

const round = (value: number): number => Math.round(value * 100) / 100;

/** The player's outline `inset` pixels in from its edge, clockwise from the middle of the top. */
const getOutline = (width: number, height: number, inset: number, cornerRadius: number): string => {
  const left = round(inset);
  const top = round(inset);
  const right = round(width - inset);
  const bottom = round(height - inset);
  // the same curve as the player's corner, only smaller
  const r = round(clamp(cornerRadius - inset, 0, Math.min(right - left, bottom - top) / 2));
  return [
    `M ${round(width / 2)} ${top}`,
    `H ${round(right - r)}`,
    `A ${r} ${r} 0 0 1 ${right} ${round(top + r)}`,
    `V ${round(bottom - r)}`,
    `A ${r} ${r} 0 0 1 ${round(right - r)} ${bottom}`,
    `H ${round(left + r)}`,
    `A ${r} ${r} 0 0 1 ${left} ${round(bottom - r)}`,
    `V ${round(top + r)}`,
    `A ${r} ${r} 0 0 1 ${round(left + r)} ${top}`,
    'Z',
  ].join(' ');
};

interface Props {
  barThickness: number;
  barColor: string;
  alwaysShowProgress: boolean;
  isAroundWindow: boolean;
  isHazy: boolean;
  // the player's shape, which the bar follows
  cornerRadius: number;
  haze: number;
  // the player's size and how far the song is, for the preview in the settings
  size?: Size;
  share?: number;
}

export const Bars: FunctionComponent<Props> = ({
  barColor,
  barThickness,
  alwaysShowProgress,
  isAroundWindow,
  isHazy,
  cornerRadius,
  haze,
  size: previewSize,
  share: previewShare,
}) => {
  const { state } = useCurrentlyPlaying();
  const windowSize = useWindowSize();
  const size = previewSize ?? windowSize;
  const { radius, fadeBand } = useMemo(() => getEdgeGeometry(size, cornerRadius, haze), [cornerRadius, haze, size]);

  const songShare = state.duration ? clamp(state.progress / state.duration, 0, 1) : 0;
  const share = previewShare ?? songShare;
  const inset = isHazy ? fadeBand * HAZY_INSET_SHARE : fadeBand;
  const isUnderHaze = isHazy && haze > 0;
  // without a haze to blur it, a hazy bar blurs itself
  let glow: string;
  if (isHazy) {
    const halo = `drop-shadow(0 0 ${2 + barThickness}px ${barColor}) drop-shadow(0 0 ${
      5 + barThickness * 2
    }px ${barColor})`;
    glow = isUnderHaze ? halo : `blur(${round(barThickness * 0.6 + 0.5)}px) ${halo}`;
  }

  if (isAroundWindow) {
    return (
      <Around
        className="bar draggable"
        isShown={alwaysShowProgress}
        isUnderHaze={isUnderHaze}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ filter: glow }}>
        <path
          d={getOutline(size.width, size.height, inset + barThickness / 2, radius)}
          pathLength={PATH_LENGTH}
          fill="none"
          stroke={barColor}
          strokeWidth={barThickness}
          // a round end shows as a dot before the song has started
          strokeLinecap={share ? 'round' : 'butt'}
          strokeDasharray={`${round(share * PATH_LENGTH)} ${PATH_LENGTH}`}
        />
      </Around>
    );
  }

  return (
    <Bottom
      className="bar draggable"
      isShown={alwaysShowProgress}
      isUnderHaze={isUnderHaze}
      style={{
        left: inset,
        bottom: inset,
        width: `calc((100% - ${round(2 * inset)}px) * ${round(share * 10000) / 10000})`,
        height: barThickness,
        backgroundColor: barColor,
        filter: glow,
      }}
    />
  );
};
