import React, { FunctionComponent } from 'react';
import styled, { css, keyframes } from 'styled-components';

import { DesignItem, DesignLook, Slot } from '../../../../models/player-design';
import { RepeatState } from '../../../api/spotify-api';
import { AsciiItem } from './ascii-items';
import { PlayerActions, PlayerData } from './models';
import { REVEALED, SONG_IN_S, SPRING } from './motion';

const ACTIVE_COLOR = '#1ed760';
// the original player's colors
const RETRO_GREEN = '#3ecf8e';
const RETRO_PINK = '#e57be6';
// warm, like a turntable's lights
const VINYL_AMBER = '#ffc46b';
const IDLE_COLOR = 'rgba(255, 255, 255, 0.85)';

// The halftone look: everything in the ink, with a halo of the paper so it stands out from the dots of the art
const INKED = '.is-inked &';
const PAPER_HALO = '0 0 2px var(--paper), 0 0 5px var(--paper)';
const inkShare = (percent: number): string => `color-mix(in srgb, var(--ink) ${percent}%, transparent)`;

// The full NCS look: the song floats in a hazy cloud that blooms out when the controls show, its title sharpening
// out of the haze, and drifts slowly while it's there
const CLOUD_IN_S = 0.9;
const cloudDrift = keyframes`
  from {
    transform: translate(-3%, 2%);
  }
  to {
    transform: translate(3%, -2%);
  }
`;

const cloud = (size: string): ReturnType<typeof css> => css`
  position: relative;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: ${size};
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(ellipse 50% 50% at 32% 55%, rgba(10, 10, 16, 0.72), transparent 72%),
      radial-gradient(ellipse 45% 55% at 68% 45%, rgba(10, 10, 16, 0.68), transparent 72%),
      radial-gradient(ellipse 64% 64% at 50% 50%, rgba(10, 10, 16, 0.66), transparent 80%);
    filter: blur(14px);
    scale: 0.6;
    opacity: 0;
    pointer-events: none;
    transition: scale ${CLOUD_IN_S}s cubic-bezier(0.2, 0.8, 0.2, 1), filter ${CLOUD_IN_S}s ease-out,
      opacity ${CLOUD_IN_S * 0.6}s ease-out;
    /* drifts only while it's in sight, unseen it would still keep the player redrawing */
    animation: ${cloudDrift} 7s ease-in-out infinite alternate paused;
  }

  #visible-ui:hover &::before,
  .is-revealed &::before,
  .is-staying &::before {
    filter: blur(5px);
    scale: 1;
    opacity: 1;
    animation-play-state: running;
  }
`;

// the letters draw together as the title comes out of the haze
const sharpening = css`
  filter: blur(3px);
  letter-spacing: 0.22em;
  transition: filter ${CLOUD_IN_S}s ease-out, letter-spacing ${CLOUD_IN_S}s cubic-bezier(0.2, 0.8, 0.2, 1);

  #visible-ui:hover &,
  .is-revealed &,
  .is-staying & {
    filter: none;
    letter-spacing: normal;
  }
`;

const DESKTOP_HAZE = '0 0 2px rgba(0, 0, 0, 0.7), 0 0 8px rgba(0, 0, 0, 0.55)';

// The pulse look: a glow in the color of the beat, as strong as the beat. NCS's controls beat along with its circle.
const PULSING = '.is-pulsing &';
const NCS = '.is-ncs &';
const pulseGlow = (base: number, extra: number): string =>
  `0 0 calc(${base}px + var(--pulse, 0) * ${extra}px) var(--pulse-color, transparent)`;

interface IconButtonProps {
  isActive?: boolean;
  iconScale?: number;
  activeColor?: string;
  hoverColor?: string;
  isRetro?: boolean;
}

const IconButton = styled.button<IconButtonProps>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ isActive, activeColor = ACTIVE_COLOR }) => (isActive ? activeColor : IDLE_COLOR)};
  font-size: ${({ iconScale }) => iconScale ?? 1.15}em;
  transition: transform 0.1s, color 0.1s;
  ${({ isRetro }) =>
    isRetro &&
    css`
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    `}

  &:hover {
    color: ${({ isActive, activeColor = ACTIVE_COLOR, hoverColor = 'white' }) => (isActive ? activeColor : hoverColor)};
    transform: scale(1.12);
  }

  &:active {
    transform: scale(0.95);
  }

  /* switched off, a button only shows faintly */
  ${INKED} {
    color: ${({ isActive }) => (isActive === false ? inkShare(55) : 'var(--ink)')};
    text-shadow: ${PAPER_HALO};
  }

  ${PULSING} {
    text-shadow: ${pulseGlow(2, 14)};
  }

  /* over the desktop, a little haze of its own keeps it readable on light wallpapers */
  ${NCS} {
    text-shadow: ${pulseGlow(2, 14)}, ${DESKTOP_HAZE};
  }

  ${INKED}:hover {
    color: var(--ink);
  }

  /* the buttons move closer together in narrow players, where a row is full of them */
  .is-narrow .is-crowded & {
    padding: 2px;
  }
`;

// The original player's round buttons: a dark ring around a colored icon
const RingButton = styled.button<{ ringSize: number; iconSize: number; iconColor: string }>`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: ${({ ringSize }) => ringSize}em;
  height: ${({ ringSize }) => ringSize}em;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.3);
  color: ${({ iconColor }) => iconColor};
  font-size: inherit;
  cursor: pointer;
  transition: transform 0.1s, background-color 0.1s, border-color 0.1s;

  i {
    font-size: ${({ iconSize }) => iconSize}em;
  }

  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
    background-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.06);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const Group = styled.div<{ spacing: number }>`
  display: flex;
  align-items: center;
  gap: ${({ spacing }) => spacing}em;

  /* the playback buttons bump with the beat */
  ${PULSING}, ${NCS} {
    transform: scale(calc(1 + var(--pulse, 0) * 0.1));
  }
`;

// Repeating the song shows a 1 on the corner of the icon, ringed so it stands out from the arrow below it
const RepeatOne = styled.span<{ badgeColor: string }>`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35em;
  height: 1.35em;
  border-radius: 999px;
  background-color: ${({ badgeColor }) => badgeColor};
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55);
  color: black;
  font-size: 0.55em;
  font-weight: 800;
  line-height: 1;
  text-shadow: none;

  ${INKED} {
    background-color: var(--ink);
    box-shadow: 0 0 0 1.5px var(--paper);
    color: var(--paper);
  }
`;

// Spotify's order: the whole playlist or album, then only the song, then off again
const REPEAT_TITLES: Record<RepeatState, string> = {
  [RepeatState.Off]: 'Enable repeat',
  [RepeatState.Context]: 'Enable repeat one',
  [RepeatState.Track]: 'Disable repeat',
};

// The whole player moves the window, the grip shows where to grab it. The pill is drawn by a pseudo-element so
// pressing anywhere on the handle targets the draggable element itself. It keeps its shape and grows with the player.
const Grip = styled.div`
  position: relative;
  width: calc(20cqmin * var(--item-scale, 1));
  height: 1.8em;
  cursor: grab;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    height: max(3px, calc(2.5cqmin * var(--item-scale, 1)));
    border-radius: 999px;
    background-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: background-color 0.1s;
  }

  &:hover::before {
    background-color: white;
  }

  .is-inked &::before {
    background-color: var(--ink);
    box-shadow: 0 0 0 1px var(--paper);
  }

  .is-pulsing &::before {
    box-shadow: ${pulseGlow(2, 10)};
  }

  .is-ncs &::before {
    box-shadow: ${pulseGlow(2, 10)}, 0 0 2px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 0, 0, 0.5);
  }

  &:active {
    cursor: grabbing;
  }
`;

// The wordmark of the original player, a shimmer runs through it when the controls show
const Logo = styled.div`
  padding: 0 0.35em;
  font-size: 1.05em;
  background-image: linear-gradient(90deg, white 25%, #f871fd 35%, #9771ef, #7e6a99 65%, white 85%);
  background-position: right center;
  background-size: 600% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  cursor: default;

  b {
    font-weight: 700;
  }

  ${REVEALED} {
    background-position: left center;
    transition: background-position 2s ease-out;
  }

  ${INKED} {
    background-image: none;
    -webkit-text-fill-color: var(--ink);
    filter: drop-shadow(0 0 2px var(--paper));
  }

  .no-text-shadow & {
    filter: none;
  }
`;

const ellipsis = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const songIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.6em);
  }
`;

// a new song slides in, which shows when it stays on the player
const Song = styled.div`
  animation: ${songIn} ${SONG_IN_S}s ${SPRING};
`;

const Title = styled.div`
  ${ellipsis}
  font-weight: 700;
  font-size: 125%;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);

  ${INKED} {
    color: var(--ink);
    text-shadow: ${PAPER_HALO};
  }

  ${PULSING}, ${NCS} {
    text-shadow: ${pulseGlow(4, 12)}, 0 1px 3px rgba(0, 0, 0, 0.5);
  }
`;

// always under the title, short players make room for it by tightening the rows
const Subtitle = styled.div`
  ${ellipsis}
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.7);

  .is-short & {
    margin-top: 1px;
  }

  ${INKED} {
    color: ${inkShare(80)};
    text-shadow: ${PAPER_HALO};
  }
`;

const Message = styled.div`
  ${ellipsis}
  margin-top: 2px;
  color: #ffd166;
  font-size: 90%;

  .is-short & {
    display: none;
  }
`;

// The song lines up with the side of the row it's on. The original player showed it in a dark box.
const Info = styled.div<{ side: Slot; isRetro: boolean; isClouded: boolean }>`
  min-width: 0;
  text-align: ${({ side }) => side};

  ${({ isClouded }) =>
    isClouded &&
    css`
      ${cloud('-60% -12%')}

      ${Title} {
        ${sharpening}
      }
    `}

  ${({ isRetro }) =>
    isRetro
      ? css`
          flex: 0 1 auto;
          padding: 0.4em 0.75em;
          border-radius: 3px;
          background-color: rgba(26, 27, 29, 0.92);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);

          ${Title} {
            font-size: 115%;
            text-shadow: none;
          }

          ${Subtitle} {
            color: #b8b8b8;
          }

          /* the box takes a row of its own, short players only keep the title */
          .is-short & {
            padding: 0.2em 0.6em;

            ${Subtitle} {
              display: none;
            }
          }
        `
      : css`
          flex: 1 1 auto;
        `}
`;

// Modern keeps the bar a little narrower than the row, under the song
const Progress = styled.div<{ isRetro: boolean; isClouded: boolean }>`
  ${({ isClouded }) => isClouded && cloud('-90% -10%')}
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 6em;
  max-width: ${({ isRetro }) => (isRetro ? 'none' : '76%')};
  font-size: 85%;
  color: rgba(255, 255, 255, 0.8);
  font-variant-numeric: tabular-nums;

  ${INKED} {
    color: var(--ink);
    text-shadow: ${PAPER_HALO};
  }
`;

const Time = styled.span`
  min-width: 2.5em;

  &:last-child {
    text-align: right;
  }
`;

const ProgressTrack = styled.div<{ canSeek: boolean; fillColor: string; seekColor: string }>`
  flex: 1;
  margin: 0 6px;
  padding: 5px 0;
  cursor: ${({ canSeek }) => (canSeek ? 'pointer' : 'default')};

  div {
    height: 4px;
    border-radius: 2px;
    background-color: rgba(255, 255, 255, 0.3);
    overflow: hidden;
  }

  span {
    display: block;
    height: 100%;
    border-radius: 2px;
    background-color: ${({ fillColor }) => fillColor};
  }

  &:hover span {
    background-color: ${({ canSeek, fillColor, seekColor }) => (canSeek ? seekColor : fillColor)};
  }

  ${INKED} div {
    background-color: ${inkShare(30)};
    box-shadow: 0 0 0 1px var(--paper);
  }

  ${INKED} span,
  ${INKED}:hover span {
    background-color: var(--ink);
  }

  ${PULSING} span,
  ${NCS} span {
    box-shadow: ${pulseGlow(2, 8)};
  }
`;

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const getVolumeIcon = (volume: number): string => {
  if (!volume) {
    return 'fa-volume-xmark';
  }
  return volume < 50 ? 'fa-volume-low' : 'fa-volume-high';
};

interface Props {
  item: DesignItem;
  look: DesignLook;
  slot: Slot;
  data: PlayerData;
  actions: PlayerActions;
  // what's switched on lights up in it instead of the look's own colors
  accent?: string;
}

const ACTIVE_COLORS: Partial<Record<DesignLook, string>> = {
  [DesignLook.Retro]: RETRO_GREEN,
  [DesignLook.Vinyl]: VINYL_AMBER,
};

export const ItemContent: FunctionComponent<Props> = ({ item, look, slot, data, actions, accent }) => {
  if (look === DesignLook.Ascii) {
    return <AsciiItem item={item} slot={slot} data={data} actions={actions} />;
  }

  const isRetro = look === DesignLook.Retro;
  const isClouded = look === DesignLook.Ncs;
  const activeColor = accent ?? ACTIVE_COLORS[look] ?? ACTIVE_COLOR;
  // the original player's green and pink, unless there's an accent of the user's
  const retroGreen = accent ?? RETRO_GREEN;
  const retroPink = accent ?? RETRO_PINK;
  // the original player's icons lit up in their own colors
  const hoverColor = (retroColor: string): string => (isRetro ? retroColor : 'white');

  switch (item) {
    case DesignItem.Settings:
      return (
        <IconButton
          type="button"
          title="Settings"
          iconScale={1}
          isRetro={isRetro}
          hoverColor={hoverColor('#979eff')}
          onClick={actions.onSettings}>
          <i className="fa-solid fa-gear" />
        </IconButton>
      );

    case DesignItem.Visualizations:
      return (
        <IconButton
          type="button"
          title="Next visualization (right-click for the previous one)"
          iconScale={0.9}
          isRetro={isRetro}
          hoverColor={hoverColor('#61eb9a')}
          onClick={actions.onVisualizationCycle}
          onContextMenu={actions.onVisualizationCycle}>
          <i className="fa-solid fa-palette" />
        </IconButton>
      );

    case DesignItem.Logo:
      return (
        <Logo className="draggable">
          <b className="draggable">lo</b>fi
        </Logo>
      );

    case DesignItem.DragHandle:
      return <Grip className="draggable" title="Drag to move" />;

    case DesignItem.Close:
      return (
        <IconButton
          type="button"
          title="Close"
          iconScale={1}
          isRetro={isRetro}
          hoverColor={hoverColor('#ff5858')}
          onClick={actions.onClose}>
          <i className={`fa-solid ${isRetro ? 'fa-circle-xmark' : 'fa-xmark'}`} />
        </IconButton>
      );

    case DesignItem.TrackInfo:
      return (
        <Info className="draggable" side={slot} isRetro={isRetro} isClouded={isClouded}>
          <Song key={`${data.title}\n${data.subtitle}`} className="draggable">
            <Title className="draggable" title={data.title}>
              {data.title}
            </Title>
            {data.subtitle && (
              <Subtitle className="draggable" title={data.subtitle}>
                {data.subtitle}
              </Subtitle>
            )}
          </Song>
          {data.message && (
            <Message className="draggable" title={data.message}>
              {data.message}
            </Message>
          )}
        </Info>
      );

    case DesignItem.Progress:
      return (
        <Progress className="draggable" isRetro={isRetro} isClouded={isClouded}>
          <Time className="draggable">{formatTime(data.progress)}</Time>
          <ProgressTrack
            canSeek={data.canControlPlayback}
            fillColor={isRetro ? retroGreen : 'white'}
            seekColor={activeColor}
            onClick={actions.onSeek}>
            <div>
              <span style={{ width: `${data.duration ? (data.progress / data.duration) * 100 : 0}%` }} />
            </div>
          </ProgressTrack>
          <Time className="draggable">-{formatTime(data.duration - data.progress)}</Time>
        </Progress>
      );

    case DesignItem.Like: {
      const title = data.isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs';
      const icon = <i className={`${data.isLiked ? 'fa-solid' : 'fa-regular'} fa-heart`} />;
      return isRetro ? (
        <RingButton
          type="button"
          title={title}
          ringSize={1.9}
          iconSize={0.8}
          iconColor={data.isLiked ? retroPink : IDLE_COLOR}
          onClick={actions.onLike}>
          {icon}
        </RingButton>
      ) : (
        <IconButton
          type="button"
          title={title}
          isActive={data.isLiked}
          activeColor={activeColor}
          onClick={actions.onLike}>
          {icon}
        </IconButton>
      );
    }

    case DesignItem.Repeat:
      return (
        <IconButton
          type="button"
          title={REPEAT_TITLES[data.repeatState] ?? REPEAT_TITLES[RepeatState.Off]}
          isActive={data.repeatState !== RepeatState.Off}
          activeColor={activeColor}
          isRetro={isRetro}
          onClick={actions.onRepeat}>
          <i className="fa-solid fa-repeat" />
          {data.repeatState === RepeatState.Track && <RepeatOne badgeColor={activeColor}>1</RepeatOne>}
        </IconButton>
      );

    case DesignItem.Playback: {
      const playIcon = <i className={`fa-solid ${data.isPlaying ? 'fa-pause' : 'fa-play'}`} />;
      const playTitle = data.isPlaying ? 'Pause' : 'Play';
      return isRetro ? (
        <Group className="draggable" spacing={0.25}>
          <RingButton
            type="button"
            title="Previous"
            ringSize={2.2}
            iconSize={0.8}
            iconColor={retroGreen}
            onClick={(event) => actions.onSkip(false, event)}>
            <i className="fa-solid fa-backward-step" />
          </RingButton>
          <RingButton
            type="button"
            title={playTitle}
            ringSize={2.6}
            iconSize={1.2}
            iconColor={retroGreen}
            onClick={actions.onPlayPause}>
            {playIcon}
          </RingButton>
          <RingButton
            type="button"
            title="Next"
            ringSize={2.2}
            iconSize={0.8}
            iconColor={retroGreen}
            onClick={(event) => actions.onSkip(true, event)}>
            <i className="fa-solid fa-forward-step" />
          </RingButton>
        </Group>
      ) : (
        <Group className="draggable" spacing={0.3}>
          <IconButton type="button" title="Previous" onClick={(event) => actions.onSkip(false, event)}>
            <i className="fa-solid fa-backward-step" />
          </IconButton>
          <IconButton type="button" title={playTitle} iconScale={1.7} onClick={actions.onPlayPause}>
            {playIcon}
          </IconButton>
          <IconButton type="button" title="Next" onClick={(event) => actions.onSkip(true, event)}>
            <i className="fa-solid fa-forward-step" />
          </IconButton>
        </Group>
      );
    }

    case DesignItem.Volume:
      return (
        <IconButton type="button" title={`Volume ${data.volume}%`} isRetro={isRetro} onClick={actions.onMute}>
          <i className={`fa-solid ${getVolumeIcon(data.volume)}`} />
        </IconButton>
      );

    case DesignItem.Visualizer:
      return (
        <IconButton
          type="button"
          title={data.isVisualizing ? 'Hide visualization' : 'Show visualization'}
          isActive={data.isVisualizing}
          activeColor={activeColor}
          iconScale={isRetro ? 1 : undefined}
          isRetro={isRetro}
          hoverColor={hoverColor('#61eb9a')}
          onClick={actions.onVisualizationToggle}>
          <i className={`fa-solid ${isRetro ? 'fa-expand' : 'fa-wave-square'}`} />
        </IconButton>
      );

    case DesignItem.About:
      return (
        <IconButton
          type="button"
          title="About Lofi"
          iconScale={1}
          isRetro={isRetro}
          hoverColor={hoverColor('#fadfa4')}
          onClick={actions.onAbout}>
          <i className="fa-solid fa-circle-question" />
        </IconButton>
      );

    default:
      return null;
  }
};
