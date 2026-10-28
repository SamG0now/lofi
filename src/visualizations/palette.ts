import { clamp } from 'lodash';

import { Palette, Rgb } from './models';

const SAMPLE_SIZE = 32;
const HUE_BUCKETS = 24;
// picked colors are at least this many buckets (15° each) apart
const MIN_HUE_DISTANCE = 2;
// a hue needs this much of the cover's vivid weight to count
const MIN_BUCKET_SHARE = 0.04;
// hues added around the main one when the cover has fewer colors
const ANALOGOUS_HUE_SHIFT = 0.1;

const fromHex = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;

/** Pink, blue and mint, for when there's no cover or it has no colors */
export const DEFAULT_PALETTE: Palette = [fromHex('#ff6fb1'), fromHex('#6f8dff'), fromHex('#4fe0c3')];

const toHsv = ([r, g, b]: Rgb): Rgb => {
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

const fromHsv = ([hue, saturation, value]: Rgb): Rgb => {
  const channel = (n: number): number => {
    const k = (n + hue * 6) % 6;
    return value - value * saturation * clamp(Math.min(k, 4 - k), 0, 1);
  };
  return [channel(5), channel(3), channel(1)];
};

// glowing on top of the cover, colors look best bright and saturated
const vivid = (color: Rgb): Rgb => {
  const [hue, saturation, value] = toHsv(color);
  return fromHsv([hue, clamp(saturation * 1.2, 0.5, 0.9), clamp(value * 1.3, 0.85, 1)]);
};

const shiftHue = (color: Rgb, shift: number): Rgb => {
  const [hue, saturation, value] = toHsv(color);
  return fromHsv([(hue + shift + 1) % 1, saturation, value]);
};

export const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    // the cover is drawn on a canvas to read its pixels, Spotify's image server allows it
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load the cover ${url}`));
    image.src = url;
  });

/** The cover's main colors, the most prominent vivid hues first */
const extractPalette = async (url: string): Promise<Palette> => {
  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const buckets = Array.from({ length: HUE_BUCKETS }, (_, index) => ({ index, weight: 0, color: [0, 0, 0] as Rgb }));
  let totalWeight = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const color: Rgb = [data[offset] / 255, data[offset + 1] / 255, data[offset + 2] / 255];
    const [hue, saturation, value] = toHsv(color);
    // grays, near blacks and near whites don't make for a palette
    if (saturation > 0.2 && value > 0.15) {
      const weight = saturation * saturation * value;
      const bucket = buckets[Math.floor(hue * HUE_BUCKETS) % HUE_BUCKETS];
      bucket.weight += weight;
      bucket.color = bucket.color.map((channel, i) => channel + color[i] * weight) as Rgb;
      totalWeight += weight;
    }
  }

  const picked: typeof buckets = [];
  [...buckets]
    .sort((a, b) => b.weight - a.weight)
    .forEach((bucket) => {
      const distanceTo = ({ index }: { index: number }): number => {
        const distance = Math.abs(index - bucket.index);
        return Math.min(distance, HUE_BUCKETS - distance);
      };
      const isDistinct = picked.every((other) => distanceTo(other) >= MIN_HUE_DISTANCE);
      if (picked.length < 3 && isDistinct && bucket.weight >= MIN_BUCKET_SHARE * totalWeight && totalWeight > 0) {
        picked.push(bucket);
      }
    });

  if (!picked.length) {
    return DEFAULT_PALETTE;
  }

  const colors = picked.map(({ weight, color }) => vivid(color.map((channel) => channel / weight) as Rgb));
  const [main] = colors;
  // covers with one or two colors get neighboring hues of the main one
  const filled = [...colors, shiftHue(main, ANALOGOUS_HUE_SHIFT), shiftHue(main, -ANALOGOUS_HUE_SHIFT)];
  return filled.slice(0, 3) as Palette;
};

// enough for going back and forth between a few songs
const MAX_CACHED_PALETTES = 20;
const palettes = new Map<string, Promise<Palette>>();

export const getCoverPalette = (url?: string): Promise<Palette> => {
  if (!url) {
    return Promise.resolve(DEFAULT_PALETTE);
  }

  if (!palettes.has(url)) {
    if (palettes.size >= MAX_CACHED_PALETTES) {
      palettes.delete(palettes.keys().next().value);
    }
    palettes.set(
      url,
      extractPalette(url).catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        palettes.delete(url);
        return DEFAULT_PALETTE;
      })
    );
  }
  return palettes.get(url);
};
