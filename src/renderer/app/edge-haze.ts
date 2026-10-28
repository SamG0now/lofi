import { clamp } from 'lodash';
import { CSSProperties } from 'react';

import { Size } from '../models';

// The player's edges fade out to fully transparent and grow hazier on the way: increasingly blurred and misty.
// Every effect depends only on the distance to the edge, so it's the same along all sides and around the corners.

// a rounded corner holds the haze, so it's at least as round as the haze is wide
const BLUR_BAND_FACTOR = 1.6;
// stacked blurs, each stronger and closer to the edge, look like a smooth haze rather than a blurred copy
const BLUR_LAYERS = [
  { band: 1, blur: 0.12 },
  { band: 0.6, blur: 0.25 },
  { band: 0.3, blur: 0.5 },
];
const MAX_BLUR = 16;
const MIST_OPACITY = 0.12;
// controls sit at least this far into a rounded corner, about where its curve crosses the diagonal
const CORNER_INSET_FACTOR = 0.3;
// the top row hugs the top edge instead, further in from the sides where the curve leaves room for it
const TOP_CORNER_INSET_FACTOR_Y = 0.15;
const TOP_CORNER_INSET_FACTOR_X = 1 - Math.sqrt(1 - (1 - TOP_CORNER_INSET_FACTOR_Y) ** 2);

// smoothstep, sampled into gradient stops
const FADE_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const ease = (t: number): number => t * t * (3 - 2 * t);

const opacity = (alpha: number): string => alpha.toFixed(3);

/**
 * A mask of the rounded window whose alpha only depends on the distance to its edge: `alphaAt(0)` on the edge,
 * `alphaAt(1)` from `band` pixels inwards. The window is split into a center, four sides and four corners so that
 * each gets its own gradient, linear along the sides and radial in the corners.
 *
 * They're drawn in one SVG with crisp edges. As separate CSS mask layers, displays scaled to 125% or 150% put their
 * edges between pixels, which both sides only partly cover: hairlines across the player where they meet.
 */
const getDistanceMask = (
  { width, height }: Size,
  radius: number,
  band: number,
  alphaAt: (t: number) => number
): CSSProperties => {
  const r = radius;
  const innerWidth = width - 2 * r;
  const innerHeight = height - 2 * r;
  // along a side, from the edge inwards
  const sideStops = FADE_STEPS.map((t) => `<stop offset="${t}" stop-opacity="${opacity(alphaAt(t))}"/>`).join('');
  // from a corner's center outwards, the distance to the edge goes from the radius down to 0
  const cornerStops = [...FADE_STEPS]
    .reverse()
    .map((t) => `<stop offset="${r ? clamp((r - t * band) / r, 0, 1) : 0}" stop-opacity="${opacity(alphaAt(t))}"/>`)
    .join('');
  const side = (id: string, x1: number, y1: number, x2: number, y2: number): string =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${sideStops}</linearGradient>`;
  const corner = (id: string, cx: number, cy: number): string =>
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${cornerStops}</radialGradient>`;
  const rect = (x: number, y: number, w: number, h: number, fill: string): string =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fill}/>`;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`,
    ` preserveAspectRatio="none" shape-rendering="crispEdges"><defs>`,
    side('t', 0, 0, 0, band),
    side('b', 0, height, 0, height - band),
    side('l', 0, 0, band, 0),
    side('r', width, 0, width - band, 0),
    corner('tl', r, r),
    corner('tr', width - r, r),
    corner('bl', r, height - r),
    corner('br', width - r, height - r),
    '</defs>',
    rect(r, r, innerWidth, innerHeight, `fill-opacity="${opacity(alphaAt(1))}"`),
    rect(r, 0, innerWidth, r, 'fill="url(#t)"'),
    rect(r, height - r, innerWidth, r, 'fill="url(#b)"'),
    rect(0, r, r, innerHeight, 'fill="url(#l)"'),
    rect(width - r, r, r, innerHeight, 'fill="url(#r)"'),
    rect(0, 0, r, r, 'fill="url(#tl)"'),
    rect(width - r, 0, r, r, 'fill="url(#tr)"'),
    rect(0, height - r, r, r, 'fill="url(#bl)"'),
    rect(width - r, height - r, r, r, 'fill="url(#br)"'),
    '</svg>',
  ].join('');

  return {
    WebkitMaskImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    WebkitMaskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
  };
};

export interface EdgeStyles {
  // fades the whole player out towards its edges
  windowStyle: CSSProperties;
  // layers above the cover art that blur and mist it towards the edges
  hazeLayers: CSSProperties[];
}

export interface EdgeGeometry {
  // of the player's corners, in pixels
  radius: number;
  // how far in from the edge the player fades out
  fadeBand: number;
  // how far in from the edge the haze blurs it
  blurBand: number;
}

/** The player's shape: how round it is and how far its edges fade, for what follows them. */
export const getEdgeGeometry = (size: Size, cornerRadius: number, haze: number): EdgeGeometry => {
  if (!cornerRadius && !haze) {
    return { radius: 0, fadeBand: 0, blurBand: 0 };
  }

  const shortSide = Math.min(size.width, size.height);
  // a hard edge still gets a pixel of fade for anti-aliasing
  const fadeBand = Math.min(Math.max(haze, 1), shortSide / 4);
  const blurBand = Math.min(haze * BLUR_BAND_FACTOR, shortSide / 2);
  // rounding down at most: on an odd side, half of it rounded up would leave the straight parts a negative length
  const radius = Math.min(Math.round(Math.max((cornerRadius / 100) * shortSide, blurBand)), Math.floor(shortSide / 2));
  return { radius, fadeBand, blurBand };
};

export const getEdgeStyles = (size: Size, cornerRadius: number, haze: number): EdgeStyles => {
  if (!cornerRadius && !haze) {
    return { windowStyle: {}, hazeLayers: [] };
  }

  const { radius, fadeBand, blurBand } = getEdgeGeometry(size, cornerRadius, haze);
  const cornerInset = `${CORNER_INSET_FACTOR * radius}px`;

  const windowStyle: CSSProperties = {
    ...getDistanceMask(size, radius, fadeBand, ease),
    // the controls keep clear of the faded edges and rounded corners through these variables
    ['--edge-haze' as string]: `${haze}px`,
    ['--corner-inset-x' as string]: cornerInset,
    ['--corner-inset-y' as string]: cornerInset,
    ['--corner-inset-top-x' as string]: `${TOP_CORNER_INSET_FACTOR_X * radius}px`,
    ['--corner-inset-top-y' as string]: `${TOP_CORNER_INSET_FACTOR_Y * radius}px`,
    ['--corner-radius' as string]: `${radius}px`,
  };

  if (!haze) {
    return { windowStyle, hazeLayers: [] };
  }

  const hazeAt = (strength: number) => (t: number) => strength * (1 - ease(t));
  const hazeLayers: CSSProperties[] = [
    ...BLUR_LAYERS.map(({ band, blur }) => ({
      ...getDistanceMask(size, radius, blurBand * band, hazeAt(1)),
      backdropFilter: `blur(${Math.min(blurBand * blur, MAX_BLUR)}px)`,
    })),
    {
      ...getDistanceMask(size, radius, blurBand, hazeAt(MIST_OPACITY)),
      backgroundColor: 'white',
    },
  ];

  return { windowStyle, hazeLayers };
};
