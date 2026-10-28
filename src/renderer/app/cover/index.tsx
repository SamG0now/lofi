/* eslint-disable no-console */
import { ipcRenderer } from 'electron';
import { clamp } from 'lodash';
import React, { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { IpcMessage, MAX_CORNER_RADIUS } from '../../../constants';
import {
  CIRCLE_LOOKS,
  CIRCLE_MIN_HAZE,
  DesignLook,
  INKED_LOOKS,
  PULSE_LOOKS,
  resolveDesign,
} from '../../../models/player-design';
import { Settings, VisualizationType } from '../../../models/settings';
import { AccountType, PREMIUM_REQUIRED_REASON, SpotifyApiError, SpotifyApiInstance } from '../../api/spotify-api';
import { rgbToHex } from '../../colors';
import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { useAccentColor } from '../../hooks/use-accent-color';
import { useCoverPalette } from '../../hooks/use-cover-palette';
import { useHalftoneColors } from '../../hooks/use-halftone-colors';
import { useHover } from '../../hooks/use-hover';
import { CurrentlyPlayingActions, CurrentlyPlayingType } from '../../reducers/currently-playing.reducer';
import { Bars } from '../bars';
import { CoverArt, getArtStyle, usePulse } from './art';
import { DesignedControls } from './designed-controls';
import { LayoutStyle } from './layout';
import Menu from './menu';
import { Visualizer } from './visualizer';
import { Waiting } from './waiting';

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE = ONE_SECOND_IN_MS * 60;
// Liked state rarely changes outside of Lofi, poll it less often to stay within Spotify's rate limits
const TRACK_LIKED_REFRESH_FACTOR = 10;

const TRUNCATE_REGEX = /(.*?)\s[-(•].*/g;
const truncateText = (text: string): string => text?.replace(TRUNCATE_REGEX, '$1');
// the looks that show the art as it is, the others draw it their own way
const PLAIN_ART_LOOKS = [DesignLook.Modern, DesignLook.Retro];

// The art is square, the window may not be: it either crops the art evenly on both sides or keeps it to the top left
const CoverContent = styled.div<{ isCenteredX: boolean; isCenteredY: boolean }>`
  background-size: cover;
  background-position: ${({ isCenteredX }) => (isCenteredX ? 'center' : 'left')}
    ${({ isCenteredY }) => (isCenteredY ? 'center' : 'top')};
  position: relative;
  transition: 0.2s;
  display: flex;
`;

interface Props {
  settings: Settings;
  message: string;
  onVisualizationChange: () => void;
  onVisualizationCycle: (isPrevious: boolean) => void;
}

export const Cover: FunctionComponent<Props> = ({ settings, message, onVisualizationChange, onVisualizationCycle }) => {
  const { state, dispatch } = useCurrentlyPlaying();

  const {
    barThickness,
    barColor,
    isAlwaysShowSongProgress,
    isAlwaysShowTrackInfo,
    showTrackInfoTemporarilyInSeconds,
    skipSongDelay,
    volumeIncrement,
    visualizationId,
    visualizationType,
    visualizerOpacity,
    ncsZoom,
    trackInfoRefreshTimeInSeconds,
    isCoverCenteredHorizontally,
    isCoverCenteredVertically,
    design: designPreset,
    customDesign,
    isHalftoneColorFromCover,
    halftoneColor,
    isProgressAroundWindow,
    isProgressBarHazy,
    cornerRadius,
    isEdgeHazeEnabled,
    edgeHaze,
    accentSource,
    accentColor,
    controlScale,
    fontStyle,
    backdropStrength,
    artZoom,
    artBrightness,
    artSaturation,
    artBlur,
    isAlwaysShowControls,
    isAlbumShown,
  } = useMemo(() => settings, [settings]);
  const design = useMemo(() => resolveDesign(designPreset, customDesign), [customDesign, designPreset]);

  const [currentSongId, setCurrentSongId] = useState('');
  const [isShowingNewSong, setIsShowingNewSong] = useState(false);
  const [errorToDisplay, setErrorToDisplay] = useState('');
  const isChangingVolume = useRef(false);

  useEffect(() => setErrorToDisplay(message), [message]);

  const artist = useMemo(() => truncateText(state.artist), [state.artist]);
  const songTitle = useMemo(() => truncateText(state.track), [state.track]);
  const subtitle = useMemo(
    () => [artist, isAlbumShown && truncateText(state.album)].filter(Boolean).join(' — '),
    [artist, isAlbumShown, state.album]
  );

  const handleError = useCallback(
    (error: Error): void => {
      console.error(error);
      setErrorToDisplay(error.message);

      // Spotify no longer tells Development Mode apps whether an account is premium, find out on first use instead
      const isPremiumRequired = error instanceof SpotifyApiError && error.reason === PREMIUM_REQUIRED_REASON;
      if (isPremiumRequired && state.userProfile && state.userProfile.accountType !== AccountType.Free) {
        dispatch({
          type: CurrentlyPlayingActions.SetUserProfile,
          payload: { ...state.userProfile, accountType: AccountType.Free },
        });
      }
    },
    [dispatch, state.userProfile]
  );

  const handlePlaybackChanged = useCallback(async (): Promise<void> => {
    try {
      const currentlyPlaying = await SpotifyApiInstance.getCurrentlyPlaying();
      if (!currentlyPlaying) {
        return;
      }

      dispatch({ type: CurrentlyPlayingActions.SetCurrentlyPlaying, payload: currentlyPlaying });
      setErrorToDisplay('');
    } catch (error) {
      console.error(error);
      setErrorToDisplay((error as Error).message);
    }
  }, [dispatch]);

  const refreshTrackLiked = useCallback(async (): Promise<void> => {
    if ((state.type === CurrentlyPlayingType.Track || state.type === CurrentlyPlayingType.Episode) && state.uri) {
      try {
        const isTrackLiked = await SpotifyApiInstance.isTrackLiked(state.uri);
        if (state.isLiked !== isTrackLiked) {
          ipcRenderer.send(IpcMessage.TrackLiked, isTrackLiked);
        }
        dispatch({ type: CurrentlyPlayingActions.SetTrackLiked, payload: isTrackLiked });
      } catch (error) {
        handleError(error as Error);
      }
    }
  }, [dispatch, handleError, state.isLiked, state.type, state.uri]);

  useEffect(() => {
    (async () => {
      if (state.isPlaying && state.id !== currentSongId) {
        setCurrentSongId(state.id);
        console.log(`New song '${songTitle}' by '${artist}.`);
        await refreshTrackLiked();
      }
    })();
  }, [artist, currentSongId, refreshTrackLiked, songTitle, state.id, state.isPlaying]);

  // The song stays on the player for a while after it changed, also after the duration is changed in the settings
  useEffect(() => {
    if (!state.id || !showTrackInfoTemporarilyInSeconds) {
      return undefined;
    }

    setIsShowingNewSong(true);
    const timeoutId = setTimeout(
      () => setIsShowingNewSong(false),
      showTrackInfoTemporarilyInSeconds * ONE_SECOND_IN_MS
    );
    return () => clearTimeout(timeoutId);
  }, [state.id, showTrackInfoTemporarilyInSeconds]);

  const keepAlive = useCallback(async (): Promise<void> => {
    if (state.isPlaying || !state.userProfile || state.userProfile.accountType === AccountType.Free) {
      return;
    }

    try {
      const currentlyPlaying = await SpotifyApiInstance.getCurrentlyPlaying();
      if (currentlyPlaying && !currentlyPlaying.is_playing) {
        await SpotifyApiInstance.seek(state.progress);
      }
    } catch (error) {
      handleError(error as Error);
    }
  }, [handleError, state.isPlaying, state.progress, state.userProfile]);

  const changeVolume = useCallback(
    async (newVolume: number): Promise<void> => {
      // Touchpads fire wheel events in bursts, drop them while a change is in flight to avoid rate limiting
      if (newVolume === undefined || isChangingVolume.current || state.userProfile?.accountType === AccountType.Free) {
        return;
      }

      isChangingVolume.current = true;
      try {
        await SpotifyApiInstance.setVolume(newVolume);
        await handlePlaybackChanged();

        console.log(`Volume set to ${newVolume}`);
      } catch (error) {
        handleError(error as Error);
      } finally {
        isChangingVolume.current = false;
      }
    },
    [handleError, handlePlaybackChanged, state.userProfile?.accountType]
  );

  const handleTrackLiked = useCallback(() => {
    refreshTrackLiked();
  }, [refreshTrackLiked]);

  const onMouseWheel = useCallback(
    async ({ deltaY }: WheelEvent): Promise<void> => {
      const direction = Math.sign(deltaY);
      const newVolume = clamp(state.volume - direction * volumeIncrement, 0, 100);
      try {
        // TODO use a state variable to buffer the volume change
        if (newVolume !== state.volume) {
          changeVolume(newVolume);
        }
      } catch (error) {
        throw new Error(`Update volume error: ${error}`);
      }
    },
    [changeVolume, state.volume, volumeIncrement]
  );

  useEffect(() => {
    document.getElementById('visible-ui').addEventListener('wheel', onMouseWheel);
    return () => {
      document.getElementById('visible-ui').removeEventListener('wheel', onMouseWheel);
    };
  }, [onMouseWheel]);

  useEffect(() => {
    const listeningToIntervalId = setInterval(handlePlaybackChanged, trackInfoRefreshTimeInSeconds * ONE_SECOND_IN_MS);

    return () => {
      if (listeningToIntervalId) {
        clearInterval(listeningToIntervalId);
      }
    };
  }, [handlePlaybackChanged, trackInfoRefreshTimeInSeconds]);

  useEffect(() => {
    const refreshTrackLikedIntervalId = setInterval(
      refreshTrackLiked,
      TRACK_LIKED_REFRESH_FACTOR * trackInfoRefreshTimeInSeconds * ONE_SECOND_IN_MS
    );
    return () => {
      if (refreshTrackLikedIntervalId) {
        clearInterval(refreshTrackLikedIntervalId);
      }
    };
  }, [refreshTrackLiked, trackInfoRefreshTimeInSeconds]);

  useEffect(() => {
    const keepAliveIntervalId = setInterval(keepAlive, ONE_MINUTE);
    return () => {
      if (keepAliveIntervalId) {
        clearInterval(keepAliveIntervalId);
      }
    };
  }, [keepAlive]);

  const coverUrl = useMemo(() => state.cover, [state.cover]);
  const hasPlainArt = PLAIN_ART_LOOKS.includes(design.look);
  const isCircle = CIRCLE_LOOKS.includes(design.look);
  const haze = isEdgeHazeEnabled ? edgeHaze : 0;
  const isInked = INKED_LOOKS.includes(design.look);
  const { ink, paper } = useHalftoneColors(coverUrl, isHalftoneColorFromCover, halftoneColor);

  // the pulse and NCS looks follow the music, lit up in the cover's colors
  const isPulseLook = PULSE_LOOKS.includes(design.look);
  const isPulsing = isPulseLook && state.isPlaying;
  const palette = useCoverPalette(isPulseLook ? coverUrl : undefined);
  const pulseColors = useMemo(() => palette.map(rgbToHex), [palette]);
  const rootRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const isTrackInfoEnabled = isAlwaysShowTrackInfo || showTrackInfoTemporarilyInSeconds > 0;
  const isShowingTrackInfo = isAlwaysShowTrackInfo || (isTrackInfoEnabled && isShowingNewSong);
  // hovering the player shows the controls
  const { isHovering, props: hoverProps } = useHover();
  usePulse(
    // NCS's circle has its own beat
    { player: rootRef, art: design.look === DesignLook.Pulse ? artRef : undefined },
    {
      isActive: isPulsing,
      isDemo: false,
      colors: pulseColors,
      areControlsShown: isAlwaysShowControls || isHovering || isShowingTrackInfo,
    }
  );

  const accent = useAccentColor(coverUrl, accentSource, accentColor);
  const layoutStyle: LayoutStyle = useMemo(
    () => ({ accent, controlScale, fontStyle, backdropStrength }),
    [accent, backdropStrength, controlScale, fontStyle]
  );
  // a paused record shows by itself: it stops and the tonearm lifts
  const isPaused = !state.isPlaying && design.look !== DesignLook.Vinyl && design.look !== DesignLook.Ncs;
  const artStyle = getArtStyle(
    { zoom: artZoom, brightness: artBrightness, saturation: artSaturation, blur: artBlur },
    { isCenteredX: isCoverCenteredHorizontally, isCenteredY: isCoverCenteredVertically },
    isPaused
  );

  return (
    <div ref={rootRef} className="transparent" {...hoverProps}>
      {state.id ? (
        <>
          <CoverContent
            ref={artRef}
            className="full"
            isCenteredX={isCoverCenteredHorizontally}
            isCenteredY={isCoverCenteredVertically}
            style={coverUrl && hasPlainArt ? { ...artStyle, backgroundImage: `url(${coverUrl})` } : artStyle}>
            {!hasPlainArt && (
              <CoverArt
                look={design.look}
                coverUrl={coverUrl}
                ink={ink}
                paper={paper}
                isCenteredX={isCoverCenteredHorizontally}
                isCenteredY={isCoverCenteredVertically}
                isPlaying={state.isPlaying}
                ncsZoom={ncsZoom}
              />
            )}
          </CoverContent>
          {/* NCS's circle is a visualization already */}
          {visualizationType === VisualizationType.Small && design.look !== DesignLook.Ncs && (
            <Visualizer
              visualizationId={visualizationId}
              visualizerOpacity={visualizerOpacity}
              ncsZoom={ncsZoom}
              coverUrl={coverUrl}
            />
          )}
          <Bars
            barThickness={barThickness}
            barColor={isInked ? ink : barColor}
            // with the controls always there, there's no idle player for it to show on
            alwaysShowProgress={isAlwaysShowSongProgress && !isAlwaysShowControls}
            isAroundWindow={isProgressAroundWindow}
            isHazy={isProgressBarHazy}
            cornerRadius={isCircle ? MAX_CORNER_RADIUS : cornerRadius}
            haze={isCircle ? Math.max(haze, CIRCLE_MIN_HAZE) : haze}
          />
          <DesignedControls
            design={design}
            barColor={barColor}
            barThickness={barThickness}
            ink={ink}
            paper={paper}
            layoutStyle={layoutStyle}
            isAlwaysRevealed={isAlwaysShowControls}
            isHovered={isHovering}
            title={songTitle}
            subtitle={subtitle}
            message={errorToDisplay || message}
            isTrackInfoEnabled={isTrackInfoEnabled}
            isShowingTrackInfo={isShowingTrackInfo}
            skipSongDelay={skipSongDelay}
            visualizationType={visualizationType}
            onVisualizationChange={onVisualizationChange}
            onVisualizationCycle={onVisualizationCycle}
            onVolumeChange={changeVolume}
            onTrackLiked={handleTrackLiked}
            onPlaybackChanged={handlePlaybackChanged}
            onError={handleError}
          />
        </>
      ) : (
        <>
          <Menu />
          <Waiting />
        </>
      )}
    </div>
  );
};
