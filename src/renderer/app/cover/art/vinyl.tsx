import React, { FunctionComponent, useEffect, useRef } from 'react';
import styled from 'styled-components';

import { isDrawingFrame, requestDrawingFrame } from '../../../../visualizations/frame-pacing';
import { getCoverBackground } from './models';

// A record on a turntable: the album art is its label, the room around it a blurred copy of the art. It spins while
// the music plays, speeding up and slowing down like a real one, and the tonearm lifts off when it stops.

// half a real LP's 33⅓ rpm, calm enough for a player that's always in sight
const SPIN_DEGREES_PER_S = 100;
// how long speeding up and slowing down take, about a third of the way each this long
const SPIN_EASE_IN_S = 0.6;
const STOPPED_DEGREES_PER_S = 0.5;
const DISC_SIZE = 'min(94cqw, 94cqh)';
// the tonearm's angles on the record and lifted off beside it, around its pivot in the deck's top right corner
const ARM_PLAYING_DEG = 12;
const ARM_RESTING_DEG = -14;
const ARM_PIVOT = { x: 91, y: 9 };

const Turntable = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  container-type: size;
  background-color: #16161a;
`;

const Room = styled.div`
  position: absolute;
  inset: -15%;
  background-size: cover;
  background-position: center;
  filter: blur(18px) brightness(0.5) saturate(1.3);
`;

const Deck = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${DISC_SIZE};
  height: ${DISC_SIZE};
  transform: translate(-50%, -50%);
`;

// Fine grooves all over, darker gaps between the songs, and the album art as the label
const Disc = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(
      circle,
      transparent 0 52%,
      rgba(0, 0, 0, 0.55) 52.5% 53.2%,
      transparent 53.7% 68%,
      rgba(0, 0, 0, 0.55) 68.5% 69.2%,
      transparent 69.7% 84%,
      rgba(0, 0, 0, 0.55) 84.5% 85.2%,
      transparent 85.7%
    ),
    repeating-radial-gradient(circle, #141416 0 1.4px, #232327 1.9px, #141416 2.6px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 6px 18px rgba(0, 0, 0, 0.55);
  will-change: transform;
`;

const Label = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 38%;
  height: 38%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);

  /* the spindle through the middle */
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 9%;
    height: 9%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #e4e4e7, #71717a 60%, #3f3f46);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  }
`;

// Light catching the grooves, it stays put while the record turns under it
const Sheen = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 20deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.11) 35deg,
    transparent 70deg 180deg,
    rgba(255, 255, 255, 0.07) 215deg,
    transparent 250deg
  );
  -webkit-mask-image: radial-gradient(circle, transparent 0 19.5%, #000 20%);
  pointer-events: none;
`;

const Arm = styled.svg`
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));

  g {
    transform-box: view-box;
    transform-origin: ${ARM_PIVOT.x}px ${ARM_PIVOT.y}px;
    transition: transform 0.9s cubic-bezier(0.3, 0.7, 0.3, 1);
  }
`;

interface Props {
  coverUrl?: string;
  isPlaying: boolean;
}

export const VinylArt: FunctionComponent<Props> = ({ coverUrl, isPlaying }) => {
  const discRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const spin = useRef({ angle: 0, speed: 0, cancelFrame: null as (() => void) | null });

  // Turns the record frame by frame while it spins, it stops by itself once it has slowed down
  useEffect(() => {
    const disc = discRef.current;
    const state = spin.current;
    if (!isPlaying || state.cancelFrame) {
      return;
    }
    const view = disc.ownerDocument.defaultView ?? window;
    let lastTime: number | null = null;
    const turn = (time: number): void => {
      if (!isDrawingFrame(view, time)) {
        state.cancelFrame = requestDrawingFrame(view, turn);
        return;
      }
      const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const target = isPlayingRef.current ? SPIN_DEGREES_PER_S : 0;
      state.speed += (target - state.speed) * (1 - Math.exp(-dt / SPIN_EASE_IN_S));
      state.angle = (state.angle + state.speed * dt) % 360;
      disc.style.transform = `rotate(${state.angle.toFixed(2)}deg)`;
      if (!target && state.speed < STOPPED_DEGREES_PER_S) {
        state.speed = 0;
        state.cancelFrame = null;
        return;
      }
      state.cancelFrame = requestDrawingFrame(view, turn);
    };
    state.cancelFrame = requestDrawingFrame(view, turn);
  }, [isPlaying]);

  useEffect(
    () => () => {
      const state = spin.current;
      state.cancelFrame?.();
      state.cancelFrame = null;
    },
    []
  );

  const background = getCoverBackground(coverUrl);

  return (
    <Turntable className="draggable">
      <Room className="draggable" style={{ backgroundImage: background }} />
      <Deck className="draggable">
        <Disc ref={discRef} className="draggable">
          <Label className="draggable" style={{ backgroundImage: background }} />
        </Disc>
        <Sheen className="draggable" />
        <Arm viewBox="0 0 100 100" aria-hidden>
          <g style={{ transform: `rotate(${isPlaying ? ARM_PLAYING_DEG : ARM_RESTING_DEG}deg)` }}>
            <line x1={91} y1={9} x2={91} y2={60} stroke="#d4d4d8" strokeWidth={1.6} strokeLinecap="round" />
            <line x1={91} y1={60} x2={86} y2={67} stroke="#d4d4d8" strokeWidth={1.6} strokeLinecap="round" />
            <rect x={83} y={64.5} width={5.5} height={4} rx={0.8} fill="#a1a1aa" transform="rotate(-35 86 67)" />
          </g>
          <circle cx={ARM_PIVOT.x} cy={ARM_PIVOT.y} r={4.6} fill="#3f3f46" stroke="#71717a" strokeWidth={0.8} />
          <circle cx={ARM_PIVOT.x} cy={ARM_PIVOT.y} r={1.7} fill="#d4d4d8" />
        </Arm>
      </Deck>
    </Turntable>
  );
};
