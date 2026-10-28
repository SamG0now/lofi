import { clamp } from 'lodash';

import { Rgb } from '../visualizations/models';

// Colors as hex strings for settings and styles, as channels from 0 to 1 for math, like the visualizations' palettes

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX_COLOR.test(value);

export const hexToRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;

export const rgbToHex = (rgb: Rgb): string =>
  `#${rgb
    .map((channel) =>
      Math.round(clamp(channel, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;

/** Hue, saturation and value, all from 0 to 1 */
export const rgbToHsv = ([r, g, b]: Rgb): Rgb => {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta > 0) {
    if (max === r) {
      hue = ((g - b) / delta + 6) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
  }
  return [hue / 6, max > 0 ? delta / max : 0, max];
};

export const hsvToRgb = ([hue, saturation, value]: Rgb): Rgb => {
  const channel = (n: number): number => {
    const k = (n + hue * 6) % 6;
    return value - value * saturation * clamp(Math.min(k, 4 - k), 0, 1);
  };
  return [channel(5), channel(3), channel(1)];
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex).map((channel) => Math.round(channel * 255));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// relative luminance, as in the WCAG contrast ratio
export const getLuminance = (hex: string): number => {
  const linear = (channel: number): number =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getContrast = (first: string, second: string): number => {
  const [lighter, darker] = [getLuminance(first), getLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

const DARK_PAPER = '#141416';
// warm, like newsprint
const LIGHT_PAPER = '#f4efe6';

/** A halftone prints on dark paper with a light ink and on light paper with a dark one, so it always shows */
export const getPaperColor = (ink: string): string =>
  getContrast(ink, DARK_PAPER) >= getContrast(ink, LIGHT_PAPER) ? DARK_PAPER : LIGHT_PAPER;
