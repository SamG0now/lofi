import { clamp } from 'lodash';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

// Album art redrawn on a canvas, as dots or characters: loading the cover, and reading how light it is anywhere

export const ArtCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
`;

// enough for going back and forth between a few songs
const MAX_CACHED_IMAGES = 10;
const images = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (url: string): Promise<HTMLImageElement> => {
  if (!images.has(url)) {
    if (images.size >= MAX_CACHED_IMAGES) {
      images.delete(images.keys().next().value);
    }
    const loading = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      // its pixels are read, Spotify's image server allows it
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load the cover ${url}`));
      image.src = url;
    });
    loading.catch(() => images.delete(url));
    images.set(url, loading);
  }
  return images.get(url);
};

/** The cover, once it's loaded: the previous one stays while the next one loads. Without a cover, null. */
export const useCoverImage = (coverUrl?: string): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!coverUrl) {
      setImage(null);
      return undefined;
    }
    let isCurrent = true;
    loadImage(coverUrl)
      .then((loaded) => isCurrent && setImage(loaded))
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        if (isCurrent) {
          setImage(null);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [coverUrl]);

  return image;
};

export interface Placement {
  isCenteredX: boolean;
  isCenteredY: boolean;
}

// Like the regular art: covers the player, either centered or kept to the top left. Without a cover, a sample one.
export const drawArt = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  width: number,
  height: number,
  { isCenteredX, isCenteredY }: Placement
): void => {
  if (!image) {
    const base = context.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, '#f472b6');
    base.addColorStop(0.55, '#fb923c');
    base.addColorStop(1, '#facc15');
    context.fillStyle = base;
    context.fillRect(0, 0, width, height);
    const shine = context.createRadialGradient(width * 0.28, height * 0.3, 0, width * 0.28, height * 0.3, width * 0.4);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = shine;
    context.fillRect(0, 0, width, height);
    const shade = context.createRadialGradient(
      width * 0.75,
      height * 0.75,
      0,
      width * 0.75,
      height * 0.75,
      width * 0.5
    );
    shade.addColorStop(0, 'rgba(20, 30, 90, 0.85)');
    shade.addColorStop(1, 'rgba(20, 30, 90, 0)');
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
    return;
  }

  const scale = Math.max(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  context.drawImage(
    image,
    isCenteredX ? (width - drawnWidth) / 2 : 0,
    isCenteredY ? (height - drawnHeight) / 2 : 0,
    drawnWidth,
    drawnHeight
  );
};

/** The art's lightness from 0 to 1 anywhere on the player, read from a copy of it with `density` pixels a pixel. */
export const sampleArt = (
  document: Document,
  image: HTMLImageElement | null,
  width: number,
  height: number,
  density: number,
  placement: Placement
): ((x: number, y: number) => number) => {
  const sampleWidth = Math.max(1, Math.ceil(width * density));
  const sampleHeight = Math.max(1, Math.ceil(height * density));
  const sampler = document.createElement('canvas');
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;
  const context = sampler.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.scale(sampleWidth / width, sampleHeight / height);
  drawArt(context, image, width, height, placement);

  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  } catch {
    // a cover from a server that doesn't allow reading it: an even mid tone
    return () => 0.5;
  }

  return (x, y) => {
    const column = clamp(Math.floor(x * density), 0, sampleWidth - 1);
    const row = clamp(Math.floor(y * density), 0, sampleHeight - 1);
    const offset = (row * sampleWidth + column) * 4;
    return (0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2]) / 255;
  };
};

/**
 * Sizes the canvas for the screen and returns its context, drawing in CSS pixels. Its layout size is used: the preview
 * in the settings is scaled down after drawing, like any other element. Nothing to draw on while it has no size.
 */
export const prepareCanvas = (
  canvas: HTMLCanvasElement
): { context: CanvasRenderingContext2D; width: number; height: number } | null => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) {
    return null;
  }
  const ratio = (canvas.ownerDocument.defaultView ?? window).devicePixelRatio || 1;
  Object.assign(canvas, { width: Math.round(width * ratio), height: Math.round(height * ratio) });
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
};
