import { clamp, noop } from 'lodash';
import React, { FunctionComponent, RefObject, useEffect, useRef } from 'react';
import styled from 'styled-components';

import { isDrawingFrame, requestDrawingFrame, toMainWindowTime } from '../../../../visualizations/frame-pacing';
import { systemAudio } from '../../../../visualizations/system-audio';
import { Placement } from './canvas';
import { getCoverBackground } from './models';

// The art bumps with each beat of the music, its colors light up the edges and the controls, the next one with every
// beat. Everything follows two variables set on the player each frame: --pulse from 0 to 1, and --pulse-color.
// Whatever is inside the player is styled again when they change, so they're only changed on it while its controls or
// the song are in sight. The art has its own.

// 120 beats a minute, for the preview in the settings while nothing plays
const DEMO_BEAT_INTERVAL_IN_S = 0.5;
const DEMO_BEAT_DECAY_IN_S = 0.16;
// how much of the pulse comes from the beats, the rest follows how loud the bass is
const BEAT_SHARE = 0.85;
const BASS_SHARE = 0.25;
// while nothing in sight follows the pulse, it looks this often whether something does again
const HIDDEN_CHECK_INTERVAL_IN_MS = 100;

// a little bigger than the player at rest, so its edges never show while it bumps
const Cover = styled.div`
  position: absolute;
  inset: 0;
  background-size: cover;
  transform: scale(calc(1.03 + var(--pulse, 0) * 0.06));
  filter: saturate(calc(1.05 + var(--pulse, 0) * 0.5)) brightness(calc(0.92 + var(--pulse, 0) * 0.18));
  will-change: transform, filter;
`;

const Glow = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 calc(12px + var(--pulse, 0) * 70px) calc(var(--pulse, 0) * 14px) var(--pulse-color, transparent);
  opacity: calc(0.3 + var(--pulse, 0) * 0.7);
`;

interface PulseTargets {
  // everything on the player, the controls and the song follow the pulse while they're in sight
  player: RefObject<HTMLElement>;
  // the art, which follows it all along, in the pulse look
  art?: RefObject<HTMLElement>;
}

interface PulseOptions {
  isActive: boolean;
  // a steady beat instead of the music
  isDemo: boolean;
  // the beats light them up one after the other
  colors: string[];
  // the controls or the song, they hold still while hidden
  areControlsShown: boolean;
}

// Sets the variables on the element, unless they already are
const createVariables = (element: HTMLElement): { set: (name: string, value: string) => void; clear: () => void } => {
  const values: Record<string, string> = {};
  return {
    set: (name, value) => {
      if (values[name] !== value) {
        values[name] = value;
        element.style.setProperty(name, value);
      }
    },
    clear: () => Object.keys(values).forEach((name) => element.style.removeProperty(name)),
  };
};

/** Sets the pulse of the music on the player and the art every frame, for everything inside them to follow. */
export const usePulse = (
  { player, art }: PulseTargets,
  { isActive, isDemo, colors, areControlsShown }: PulseOptions
): void => {
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const areControlsShownRef = useRef(areControlsShown);
  areControlsShownRef.current = areControlsShown;

  useEffect(() => {
    const playerElement = player.current;
    const artElement = art?.current;
    if (!playerElement || !isActive) {
      return undefined;
    }

    const view = playerElement.ownerDocument.defaultView ?? window;
    let cancelFrame: () => void = noop;
    let beats = 0;
    let lastBeatAge = Infinity;
    // the art has its own, styling the player again would also style all of its controls
    const playerVariables = createVariables(playerElement);
    const artVariables = artElement && createVariables(artElement);

    const beat = (time: number): void => {
      const isPlayerFollowing = areControlsShownRef.current;
      const isFollowed = isPlayerFollowing || !!artVariables;
      const isDrawing = isFollowed && isDrawingFrame(view, time);
      cancelFrame = isFollowed
        ? requestDrawingFrame(view, beat)
        : requestDrawingFrame(view, beat, { interval: HIDDEN_CHECK_INTERVAL_IN_MS, since: time });
      if (!isDrawing) {
        return;
      }
      // the frame's time on the main window's clock, the visualizations read the audio at the same time, so reading
      // it again in the same frame changes nothing
      const now = toMainWindowTime(view, time);
      let level: number;
      let beatAge: number;
      if (isDemo) {
        // in step with the steady beat of NCS's circle
        beatAge = (now / 1000) % DEMO_BEAT_INTERVAL_IN_S;
        const strength = Math.exp(-beatAge / DEMO_BEAT_DECAY_IN_S);
        level = strength * BEAT_SHARE + (0.3 + 0.4 * strength) * BASS_SHARE;
      } else {
        const frame = systemAudio.read(now);
        [beatAge] = frame.beatAges;
        level = frame.beat * BEAT_SHARE + frame.bass * BASS_SHARE;
      }
      // the time since the last beat starts over with a new one
      if (beatAge < lastBeatAge) {
        beats += 1;
      }
      lastBeatAge = beatAge;

      const palette = colorsRef.current;
      const pulse = clamp(level, 0, 1).toFixed(3);
      const color = palette[beats % palette.length];
      [isPlayerFollowing && playerVariables, artVariables].forEach((variables) => {
        if (variables) {
          variables.set('--pulse', pulse);
          variables.set('--pulse-color', color);
        }
      });
    };
    cancelFrame = requestDrawingFrame(view, beat);

    return () => {
      cancelFrame();
      playerVariables.clear();
      artVariables?.clear();
    };
  }, [art, isActive, isDemo, player]);
};

interface Props extends Placement {
  coverUrl?: string;
}

export const PulseArt: FunctionComponent<Props> = ({ coverUrl, isCenteredX, isCenteredY }) => (
  <>
    <Cover
      className="draggable"
      style={{
        backgroundImage: getCoverBackground(coverUrl),
        backgroundPosition: `${isCenteredX ? 'center' : 'left'} ${isCenteredY ? 'center' : 'top'}`,
      }}
    />
    <Glow className="draggable" />
  </>
);
