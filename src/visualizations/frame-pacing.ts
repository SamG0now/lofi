import { mean } from 'lodash';

import { DEFAULT_SETTINGS } from '../models/settings';

// Animations drawn frame by frame keep to the frame rate limit in the settings. They skip the screen's frames evenly,
// as few as keep them under it: at most 100 frames a second, 144Hz draws every other frame, 60Hz to 100Hz every one.
// Any smoother is hard to see on a small player, and costs as much again, the whole window being redrawn.
const toFrameInterval = (maxFrameRate: number): number => (maxFrameRate > 0 ? 1000 / maxFrameRate : 0);
let minFrameInterval = toFrameInterval(DEFAULT_SETTINGS.maxFrameRate);
// an interval within this share of a whole number of frames is that many frames
const INTERVAL_TOLERANCE = 0.04;
const FRAMES_MEASURED = 8;
// the time between two frames, compared to the screen's: from a faster screen, or spanning a skipped frame
const FASTER_SCREEN_SHARE = 0.75;
const SKIPPED_FRAME_SHARE = 1.5;
const FRAME_INTERVAL_SMOOTHING = 0.1;

interface Pacing {
  // the latest frame seen
  time: number;
  // the screen's, the average time between two frames next to each other
  frameInterval: number;
  // the latest frame decided on and whether it's drawn, and the latest one that's drawn
  decidedTime: number;
  isDrawn: boolean;
  lastDrawnTime: number;
}

interface FrameOptions {
  // an animation may wait longer between its frames than the window's others, since its latest one
  interval?: number;
  since?: number;
}

const pacings = new WeakMap<Window, Pacing>();

// Intervals are counted in the screen's frames, as few as last the interval, so that frames coming a little early or
// late make no difference
const getFramesApart = (interval: number, frameInterval: number): number =>
  Math.ceil((interval / frameInterval) * (1 - INTERVAL_TOLERANCE));

// how long after a drawn frame the next one is, give or take half a frame
const getSpacing = (interval: number, frameInterval: number): number =>
  (getFramesApart(interval, frameInterval) - 0.5) * frameInterval;

const getPacing = (view: Window): Pacing => {
  let pacing = pacings.get(view);
  if (!pacing) {
    pacing = { time: -Infinity, frameInterval: Infinity, decidedTime: NaN, isDrawn: false, lastDrawnTime: -Infinity };
    pacings.set(view, pacing);
  }
  return pacing;
};

/**
 * Whether an animation in the window draws in the frame of `time`, its requestAnimationFrame time. All of a window's
 * animations draw in the same frames, so that it's redrawn as rarely as they draw.
 */
export const isDrawingFrame = (view: Window, time: number, { interval = 0, since }: FrameOptions = {}): boolean => {
  const pacing = getPacing(view);
  if (time > pacing.time) {
    const gap = time - pacing.time;
    // Longer ones skipped frames, a much shorter one is from a faster screen. Their average is closer to the screen's
    // than the shortest, which comes early by however much frames are off.
    if (gap < pacing.frameInterval * FASTER_SCREEN_SHARE) {
      pacing.frameInterval = gap;
    } else if (gap < pacing.frameInterval * SKIPPED_FRAME_SHARE) {
      pacing.frameInterval += (gap - pacing.frameInterval) * FRAME_INTERVAL_SMOOTHING;
    }
    pacing.time = time;
  }
  if (since !== undefined && time - since < getSpacing(interval, pacing.frameInterval)) {
    return false;
  }
  if (time !== pacing.decidedTime) {
    pacing.decidedTime = time;
    pacing.isDrawn = time - pacing.lastDrawnTime >= getSpacing(minFrameInterval, pacing.frameInterval);
    if (pacing.isDrawn) {
      pacing.lastDrawnTime = time;
    }
  }
  return pacing.isDrawn;
};

/**
 * Calls back in the window's first frame that may be drawn in, like requestAnimationFrame. Being woken up for nothing
 * costs about as much as drawing, most frames before a long wait are slept through. Returns how to cancel it.
 */
export const requestDrawingFrame = (
  view: Window,
  callback: (time: number) => void,
  { interval = minFrameInterval, since }: FrameOptions = {}
): (() => void) => {
  const { lastDrawnTime, frameInterval } = getPacing(view);
  let frameId = 0;
  let timeoutId: number | undefined;
  // A frame asked for after it has started is called back right away. So it wakes up halfway through the frame
  // before the one it draws in, whichever way the timer is off: it's called back in that frame, skips it and asks for
  // the next one. Unless there's no frame before that one to sleep through.
  const drawnTime =
    (since ?? lastDrawnTime) + getFramesApart(Math.max(interval, minFrameInterval), frameInterval) * frameInterval;
  const untilDrawn = drawnTime - view.performance.now();
  if (untilDrawn > 2.5 * frameInterval) {
    timeoutId = view.setTimeout(() => {
      frameId = view.requestAnimationFrame(callback);
    }, untilDrawn - 0.5 * frameInterval);
  } else {
    frameId = view.requestAnimationFrame(callback);
  }
  return () => {
    view.clearTimeout(timeoutId);
    view.cancelAnimationFrame(frameId);
  };
};

/** Every animation draws at most this many frames a second from now on, 0 for every frame of the screen. */
export const setMaxFrameRate = (maxFrameRate: number): void => {
  minFrameInterval = toFrameInterval(maxFrameRate);
};

/** How many of the screen's frames are drawn with the limit, every one or every second, third and so on. */
export const getFramesDrawnEvery = (maxFrameRate: number, frameInterval: number): number =>
  Math.max(1, getFramesApart(toFrameInterval(maxFrameRate), frameInterval));

/** The time between the frames of the screen the window is on, on average over a few of them. */
export const measureFrameInterval = (view: Window): Promise<number> =>
  new Promise((resolve) => {
    const times: number[] = [];
    const measure = (time: number): void => {
      times.push(time);
      if (times.length <= FRAMES_MEASURED) {
        view.requestAnimationFrame(measure);
        return;
      }
      // a frame that was missed would count double
      const intervals = times.slice(1).map((frameTime, index) => frameTime - times[index]);
      const shortest = Math.min(...intervals);
      resolve(mean(intervals.filter((interval) => interval < shortest * 1.5)));
    };
    view.requestAnimationFrame(measure);
  });

/** The time of a frame in `view` on the main window's clock, which the audio is read on. */
export const toMainWindowTime = (view: Window, time: number): number =>
  time + view.performance.timeOrigin - performance.timeOrigin;
