/* eslint-disable no-console */
import { ipcRenderer } from 'electron';
import { clamp } from 'lodash';
import React, { FunctionComponent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IpcMessage } from '../../../../constants';
import { PlayerDesign } from '../../../../models/player-design';
import { DEFAULT_SETTINGS, VisualizationType } from '../../../../models/settings';
import { AccountType, RepeatState, SpotifyApiInstance } from '../../../api/spotify-api';
import { useCurrentlyPlaying } from '../../../contexts/currently-playing.context';
import { LayoutStyle, PlayerActions, PlayerData, PlayerLayout } from '../layout';

const UNMUTE_VOLUME = 50;
const PROGRESS_TICK_IN_MS = 500;

// Spotify's order: the whole playlist or album, then only the song, then off again
const NEXT_REPEAT_STATE: Record<RepeatState, RepeatState> = {
  [RepeatState.Off]: RepeatState.Context,
  [RepeatState.Context]: RepeatState.Track,
  [RepeatState.Track]: RepeatState.Off,
};

const moveSongProgress = async (isForward: boolean, distInSec: number): Promise<void> => {
  const currentlyPlaying = await SpotifyApiInstance.getCurrentlyPlaying();
  if (!currentlyPlaying) {
    return;
  }
  const currentProgress = Number(currentlyPlaying.progress_ms);
  const distInMs = distInSec * 1000;
  await SpotifyApiInstance.seek(isForward ? currentProgress + distInMs : currentProgress - distInMs);
};

interface Props {
  design: PlayerDesign;
  barColor: string;
  barThickness: number;
  // of the halftone look
  ink: string;
  paper: string;
  layoutStyle: LayoutStyle;
  // the controls stay on the player instead of showing on hover
  isAlwaysRevealed: boolean;
  isHovered: boolean;
  title: string;
  subtitle: string;
  message?: string;
  // the song is kept on the player while the controls are hidden
  isTrackInfoEnabled: boolean;
  isShowingTrackInfo: boolean;
  skipSongDelay: number;
  visualizationType: VisualizationType;
  onVisualizationChange: () => void;
  onVisualizationCycle: (isPrevious: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackChanged: () => void;
  onTrackLiked: () => void;
  onError: (error: Error) => void;
}

/** The player's controls, laid out by the design. */
export const DesignedControls: FunctionComponent<Props> = ({
  design,
  barColor,
  barThickness,
  ink,
  paper,
  layoutStyle,
  isAlwaysRevealed,
  isHovered,
  title,
  subtitle,
  message,
  isTrackInfoEnabled,
  isShowingTrackInfo,
  skipSongDelay = DEFAULT_SETTINGS.skipSongDelay,
  visualizationType,
  onVisualizationChange,
  onVisualizationCycle,
  onVolumeChange,
  onPlaybackChanged,
  onTrackLiked,
  onError,
}) => {
  const { state } = useCurrentlyPlaying();
  const unmuteVolume = useRef(UNMUTE_VOLUME);
  const [progressSyncedAt, setProgressSyncedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  // Spotify is only polled every few seconds, advance the progress locally in between
  useEffect(() => {
    setProgressSyncedAt(Date.now());
  }, [state.progress, state.isPlaying]);

  // only while the controls show it, otherwise the player would be laid out again for nothing
  const isProgressShown = isAlwaysRevealed || isHovered;
  useEffect(() => {
    if (!state.isPlaying || !isProgressShown) {
      return undefined;
    }
    setNow(Date.now());
    const intervalId = setInterval(() => setNow(Date.now()), PROGRESS_TICK_IN_MS);
    return () => clearInterval(intervalId);
  }, [isProgressShown, state.isPlaying]);

  const progress = state.isPlaying
    ? Math.min(state.duration, state.progress + Math.max(0, now - progressSyncedAt))
    : state.progress;
  const canControlPlayback = !!state.userProfile && state.userProfile.accountType !== AccountType.Free;

  const handlePlayPause = useCallback(async (): Promise<void> => {
    try {
      await SpotifyApiInstance.play(state.isPlaying);
      onPlaybackChanged();
      console.log(`Playback changed: ${state.isPlaying ? 'playing' : 'pause'}.`);
    } catch (error) {
      onError(error as Error);
    }
  }, [onError, onPlaybackChanged, state.isPlaying]);

  const handleSkip = useCallback(
    async (isForward: boolean, event: MouseEvent): Promise<void> => {
      try {
        const isMove = event.ctrlKey || event.metaKey;
        if (isMove) {
          await moveSongProgress(isForward, skipSongDelay);
        } else {
          await SpotifyApiInstance.skip(isForward);
        }
        onPlaybackChanged();
        console.log(`Playback changed: skipped ${isMove ? `${skipSongDelay} seconds` : 'song'}.`);
      } catch (error) {
        onError(error as Error);
      }
    },
    [onError, onPlaybackChanged, skipSongDelay]
  );

  const handleSeek = useCallback(
    async (event: MouseEvent<HTMLDivElement>): Promise<void> => {
      if (!canControlPlayback || !state.duration) {
        return;
      }
      const { left, width } = event.currentTarget.getBoundingClientRect();
      const ratio = clamp((event.clientX - left) / width, 0, 1);
      try {
        await SpotifyApiInstance.seek(ratio * state.duration);
        onPlaybackChanged();
      } catch (error) {
        onError(error as Error);
      }
    },
    [canControlPlayback, onError, onPlaybackChanged, state.duration]
  );

  const handleMute = useCallback(() => {
    if (state.volume > 0) {
      unmuteVolume.current = state.volume;
      onVolumeChange(0);
    } else {
      onVolumeChange(unmuteVolume.current);
    }
  }, [onVolumeChange, state.volume]);

  const handleLike = useCallback(async (): Promise<void> => {
    try {
      await SpotifyApiInstance.like(!!state.isLiked, state.uri);
      onTrackLiked();
      console.log(`Song ${state.isLiked ? 'unliked 💔' : 'liked 💜'}.`);
    } catch (error) {
      onError(error as Error);
    }
  }, [onError, onTrackLiked, state.isLiked, state.uri]);

  const handleRepeat = useCallback(async (): Promise<void> => {
    const next = NEXT_REPEAT_STATE[state.repeatState] ?? RepeatState.Context;
    try {
      await SpotifyApiInstance.setRepeat(next);
      onPlaybackChanged();
      console.log(`Repeat changed: ${next}.`);
    } catch (error) {
      onError(error as Error);
    }
  }, [onError, onPlaybackChanged, state.repeatState]);

  const handleVisualizationCycle = useCallback(
    (event: MouseEvent): void => {
      event.preventDefault();
      onVisualizationCycle(event.type === 'contextmenu');
    },
    [onVisualizationCycle]
  );

  const actions: PlayerActions = useMemo(
    () => ({
      onSettings: () => ipcRenderer.send(IpcMessage.ShowSettings),
      onClose: () => ipcRenderer.send(IpcMessage.CloseApp),
      onAbout: () => ipcRenderer.send(IpcMessage.ShowAbout),
      onVisualizationCycle: handleVisualizationCycle,
      onVisualizationToggle: onVisualizationChange,
      onLike: handleLike,
      onRepeat: handleRepeat,
      onMute: handleMute,
      onSkip: handleSkip,
      onPlayPause: handlePlayPause,
      onSeek: handleSeek,
    }),
    [
      handleLike,
      handleMute,
      handlePlayPause,
      handleRepeat,
      handleSeek,
      handleSkip,
      handleVisualizationCycle,
      onVisualizationChange,
    ]
  );

  const data: PlayerData = {
    title,
    subtitle,
    message,
    progress,
    duration: state.duration,
    isPlaying: state.isPlaying,
    isLiked: !!state.isLiked,
    volume: state.volume,
    repeatState: state.repeatState ?? RepeatState.Off,
    canControlPlayback,
    isVisualizing: visualizationType !== VisualizationType.None,
  };

  return (
    <PlayerLayout
      design={design}
      data={data}
      actions={actions}
      barColor={barColor}
      barThickness={barThickness}
      ink={ink}
      paper={paper}
      isTrackInfoEnabled={isTrackInfoEnabled}
      isShowingTrackInfo={isShowingTrackInfo}
      isRevealed={isAlwaysRevealed}
      layoutStyle={layoutStyle}
    />
  );
};
