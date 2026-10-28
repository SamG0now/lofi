import React, { FunctionComponent } from 'react';
import styled, { keyframes } from 'styled-components';

import { DesignItem, Slot } from '../../../../models/player-design';
import { RepeatState } from '../../../api/spotify-api';
import { PlayerActions, PlayerData } from './models';
import { REVEALED } from './motion';

// The ASCII look: a terminal in the player's ink. Buttons are typed out, picking one inverts it like a selection.

const PAPER_HALO = '0 0 2px var(--paper), 0 0 5px var(--paper)';
const faint = 'color-mix(in srgb, var(--ink) 45%, transparent)';

const blink = keyframes`
  50% {
    opacity: 0;
  }
`;

const TextButton = styled.button<{ isOff?: boolean; textScale?: number }>`
  padding: 2px 3px;
  border: none;
  border-radius: 2px;
  background: none;
  color: ${({ isOff }) => (isOff ? faint : 'var(--ink)')};
  font: inherit;
  font-size: ${({ textScale }) => textScale ?? 1}em;
  font-weight: 700;
  line-height: 1.15;
  white-space: pre;
  text-shadow: ${PAPER_HALO};
  cursor: pointer;

  &:hover {
    background-color: var(--ink);
    color: var(--paper);
    text-shadow: none;
  }

  &:active {
    transform: translateY(1px);
  }

  .is-narrow .is-crowded & {
    padding: 1px;
  }
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 0.15em;
`;

const Text = styled.div`
  color: var(--ink);
  font-weight: 700;
  white-space: pre;
  text-shadow: ${PAPER_HALO};
  cursor: default;
`;

// blinks only while it's in sight, unseen it would still keep the player redrawing
const Cursor = styled.span`
  animation: ${blink} 1.1s step-end infinite paused;

  ${REVEALED} {
    animation-play-state: running;
  }
`;

const Grip = styled(Text)`
  color: ${faint};
  letter-spacing: -0.05em;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

const ellipsis = `
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Info = styled.div<{ side: Slot }>`
  flex: 1 1 auto;
  min-width: 0;
  text-align: ${({ side }) => side};
  text-shadow: ${PAPER_HALO};
`;

const Title = styled.div`
  ${ellipsis}
  color: var(--ink);
  font-weight: 700;
  font-size: 115%;
`;

const Subtitle = styled.div`
  ${ellipsis}
  margin-top: 2px;
  color: color-mix(in srgb, var(--ink) 75%, transparent);
`;

const Message = styled.div`
  ${ellipsis}
  margin-top: 2px;
  color: #ffd166;

  .is-short & {
    display: none;
  }
`;

// [#####-----], the hashes as far as the song has played
const Progress = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.4em;
  min-width: 8em;
  max-width: 82%;
  color: var(--ink);
  font-size: 90%;
  font-variant-numeric: tabular-nums;
  text-shadow: ${PAPER_HALO};
`;

const Bar = styled.div<{ canSeek: boolean }>`
  display: flex;
  flex: 1;
  min-width: 0;
  white-space: pre;
  cursor: ${({ canSeek }) => (canSeek ? 'pointer' : 'default')};

  span {
    overflow: hidden;
  }

  span:nth-child(2) {
    flex: none;
  }

  span:nth-child(3) {
    flex: 1;
    color: ${faint};
  }
`;

// enough characters for the widest player, the bar shows as many as fit
const BAR_CHARACTERS = 160;

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const getVolumeText = (volume: number): string => {
  if (!volume) {
    return '<x';
  }
  return volume < 50 ? '<)' : '<))';
};

const REPEAT_TITLES: Record<RepeatState, string> = {
  [RepeatState.Off]: 'Enable repeat',
  [RepeatState.Context]: 'Enable repeat one',
  [RepeatState.Track]: 'Disable repeat',
};

interface Props {
  item: DesignItem;
  slot: Slot;
  data: PlayerData;
  actions: PlayerActions;
}

export const AsciiItem: FunctionComponent<Props> = ({ item, slot, data, actions }) => {
  switch (item) {
    case DesignItem.Settings:
      return (
        <TextButton type="button" title="Settings" onClick={actions.onSettings}>
          [=]
        </TextButton>
      );

    case DesignItem.Visualizations:
      return (
        <TextButton
          type="button"
          title="Next visualization (right-click for the previous one)"
          onClick={actions.onVisualizationCycle}
          onContextMenu={actions.onVisualizationCycle}>
          [~]
        </TextButton>
      );

    case DesignItem.Logo:
      return (
        <Text className="draggable">
          lofi<Cursor className="draggable">_</Cursor>
        </Text>
      );

    case DesignItem.DragHandle:
      return (
        <Grip className="draggable" title="Drag to move">
          ======
        </Grip>
      );

    case DesignItem.Close:
      return (
        <TextButton type="button" title="Close" onClick={actions.onClose}>
          [x]
        </TextButton>
      );

    case DesignItem.About:
      return (
        <TextButton type="button" title="About Lofi" onClick={actions.onAbout}>
          [?]
        </TextButton>
      );

    case DesignItem.TrackInfo:
      return (
        <Info className="draggable" side={slot}>
          <Title className="draggable" title={data.title}>
            {`> ${data.title}`}
          </Title>
          {data.subtitle && (
            <Subtitle className="draggable" title={data.subtitle}>
              {`  ${data.subtitle}`}
            </Subtitle>
          )}
          {data.message && (
            <Message className="draggable" title={data.message}>
              {`! ${data.message}`}
            </Message>
          )}
        </Info>
      );

    case DesignItem.Progress: {
      const share = data.duration ? Math.min(1, data.progress / data.duration) : 0;
      return (
        <Progress className="draggable">
          <span className="draggable">{formatTime(data.progress)}</span>
          <Bar canSeek={data.canControlPlayback} onClick={actions.onSeek}>
            <span>[</span>
            <span style={{ width: `calc((100% - 2ch) * ${share.toFixed(4)})` }}>{'#'.repeat(BAR_CHARACTERS)}</span>
            <span>{'-'.repeat(BAR_CHARACTERS)}</span>
            <span>]</span>
          </Bar>
          <span className="draggable">-{formatTime(data.duration - data.progress)}</span>
        </Progress>
      );
    }

    case DesignItem.Like:
      return (
        <TextButton
          type="button"
          title={data.isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          isOff={!data.isLiked}
          onClick={actions.onLike}>
          {'<3'}
        </TextButton>
      );

    case DesignItem.Repeat:
      return (
        <TextButton
          type="button"
          title={REPEAT_TITLES[data.repeatState] ?? REPEAT_TITLES[RepeatState.Off]}
          isOff={data.repeatState === RepeatState.Off}
          onClick={actions.onRepeat}>
          {data.repeatState === RepeatState.Track ? '[r1]' : '[r]'}
        </TextButton>
      );

    case DesignItem.Playback:
      return (
        <Group className="draggable">
          <TextButton type="button" title="Previous" onClick={(event) => actions.onSkip(false, event)}>
            {'|<'}
          </TextButton>
          <TextButton
            type="button"
            title={data.isPlaying ? 'Pause' : 'Play'}
            textScale={1.4}
            onClick={actions.onPlayPause}>
            {data.isPlaying ? '||' : '>'}
          </TextButton>
          <TextButton type="button" title="Next" onClick={(event) => actions.onSkip(true, event)}>
            {'>|'}
          </TextButton>
        </Group>
      );

    case DesignItem.Volume:
      return (
        <TextButton type="button" title={`Volume ${data.volume}%`} onClick={actions.onMute}>
          {getVolumeText(data.volume)}
        </TextButton>
      );

    case DesignItem.Visualizer:
      return (
        <TextButton
          type="button"
          title={data.isVisualizing ? 'Hide visualization' : 'Show visualization'}
          isOff={!data.isVisualizing}
          onClick={actions.onVisualizationToggle}>
          /\/
        </TextButton>
      );

    default:
      return null;
  }
};
