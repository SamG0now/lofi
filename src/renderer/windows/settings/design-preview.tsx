import { noop } from 'lodash';
import React, { CSSProperties, forwardRef, useCallback, useMemo, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import styled from 'styled-components';

import { MACOS, MAX_CORNER_RADIUS } from '../../../constants';
import {
  CIRCLE_LOOKS,
  CIRCLE_MIN_HAZE,
  DesignLook,
  INKED_LOOKS,
  PlayerDesign,
  PULSE_LOOKS,
} from '../../../models/player-design';
import { Settings, VisualizationType } from '../../../models/settings';
import { RepeatState } from '../../api/spotify-api';
import { Bars } from '../../app/bars';
import { CoverArt, getArtStyle, usePulse } from '../../app/cover/art';
import { flatText, LayoutEditor, LayoutStyle, PlayerActions, PlayerData, PlayerLayout } from '../../app/cover/layout';
import { Visualizer } from '../../app/cover/visualizer';
import { getEdgeStyles } from '../../app/edge-haze';
import { rgbToHex } from '../../colors';
import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { useSettings } from '../../contexts/settings.context';
import { useAccentColor } from '../../hooks/use-accent-color';
import { useCoverPalette } from '../../hooks/use-cover-palette';
import { useHalftoneColors } from '../../hooks/use-halftone-colors';

const INERT_ACTIONS: PlayerActions = {
  onSettings: noop,
  onClose: noop,
  onAbout: noop,
  onVisualizationCycle: noop,
  onVisualizationToggle: noop,
  onLike: noop,
  onRepeat: noop,
  onMute: noop,
  onSkip: noop,
  onPlayPause: noop,
  onSeek: noop,
};

// shown this many pixels across or less, a preview is a miniature
const MINIATURE_SIZE = 100;

const SAMPLE_ARTIST = 'Lofi Beats';
const SAMPLE_ALBUM = 'Late Night Tapes';

const SAMPLE_DATA: PlayerData = {
  title: 'Sunset Drive',
  subtitle: `${SAMPLE_ARTIST} — ${SAMPLE_ALBUM}`,
  progress: 83000,
  duration: 201000,
  isPlaying: true,
  isLiked: true,
  volume: 70,
  repeatState: RepeatState.Off,
  canControlPlayback: true,
  isVisualizing: true,
};

const Box = styled.div`
  position: relative;
  flex-shrink: 0;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.22));
`;

// The player at its real size, scaled to fit, so its text and icons have the same proportions
const Screen = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  transform-origin: top left;
  background: linear-gradient(135deg, #1f1f1f 0%, #2d2d2d 100%);
  font-family: 'Inter UI', sans-serif;
  user-select: none;
  ${flatText}
`;

const ArtBox = styled.div`
  position: absolute;
  inset: 0;
  transition: filter 0.2s, transform 0.2s;
`;

const PREVIEW_SETTINGS = [
  'width',
  'height',
  'cornerRadius',
  'isEdgeHazeEnabled',
  'edgeHaze',
  'barColor',
  'barThickness',
  'isCoverCenteredHorizontally',
  'isCoverCenteredVertically',
  'isAlwaysShowTrackInfo',
  'showTrackInfoTemporarilyInSeconds',
  'isHalftoneColorFromCover',
  'halftoneColor',
  'isTextShadowEnabled',
  'accentSource',
  'accentColor',
  'controlScale',
  'fontStyle',
  'backdropStrength',
  'artZoom',
  'artBrightness',
  'artSaturation',
  'artBlur',
  'isAlwaysShowControls',
  'isAlbumShown',
  'isAlwaysShowSongProgress',
  'isProgressAroundWindow',
  'isProgressBarHazy',
  'visualizationType',
  'visualizationId',
  'visualizerOpacity',
  'ncsZoom',
] as const;

type PreviewSettings = Pick<Settings, (typeof PREVIEW_SETTINGS)[number]>;

interface Props {
  design: PlayerDesign;
  // fits the player into this box, unless it's given a scale
  maxWidth?: number;
  maxHeight?: number;
  scale?: number;
  isRevealed: boolean;
  // the song stays on the player while the controls are hidden, as it does for a while after it changes
  isShowingTrackInfo?: boolean;
  // everything the player shows, also the idle progress bar and the visualization, for the editor
  isDetailed?: boolean;
  editor?: LayoutEditor;
  style?: CSSProperties;
}

/** The player as it looks with the settings being edited, playing the current song if there is one. */
export const DesignPreview = forwardRef<HTMLDivElement, Props>(
  (
    { design, maxWidth, maxHeight, scale: fixedScale, isRevealed, isShowingTrackInfo, isDetailed, editor, style },
    ref
  ) => {
    const { state: liveSettings } = useSettings();
    const { state: playing } = useCurrentlyPlaying();
    const watched = useWatch<Settings, typeof PREVIEW_SETTINGS>({ name: PREVIEW_SETTINGS });
    const settings = useMemo(
      () => Object.fromEntries(PREVIEW_SETTINGS.map((name, index) => [name, watched[index]])) as PreviewSettings,
      [watched]
    );
    const width = settings.width || liveSettings.width;
    const height = settings.height || liveSettings.height;

    const coverUrl = playing.cover || undefined;
    const { ink, paper } = useHalftoneColors(coverUrl, settings.isHalftoneColorFromCover, settings.halftoneColor);
    const accent = useAccentColor(coverUrl, settings.accentSource, settings.accentColor);
    // a record spins and the pulse beats along with the song, or with a steady beat while nothing plays
    const isPlaying = playing.id ? playing.isPlaying : true;

    const screenRef = useRef<HTMLDivElement>(null);
    const setScreen = useCallback(
      (element: HTMLDivElement | null) => {
        screenRef.current = element;
        if (typeof ref === 'function') {
          ref(element);
        } else if (ref) {
          // eslint-disable-next-line no-param-reassign
          ref.current = element;
        }
      },
      [ref]
    );
    const isPulseLook = PULSE_LOOKS.includes(design.look);
    const palette = useCoverPalette(isPulseLook ? coverUrl : undefined);
    const pulseColors = useMemo(() => palette.map(rgbToHex), [palette]);
    const isShown = isRevealed || settings.isAlwaysShowControls;
    const isTrackInfoShown = settings.isAlwaysShowTrackInfo || !!isShowingTrackInfo;
    const scale = fixedScale ?? Math.min(maxWidth / width, maxHeight / height);
    // as small as the designs to pick from, the controls' glow can't be made out: they keep still, rather than all
    // of them being styled again every frame
    const isMiniature = Math.min(width, height) * scale <= MINIATURE_SIZE;
    const artRef = useRef<HTMLDivElement>(null);
    usePulse(
      { player: screenRef, art: design.look === DesignLook.Pulse ? artRef : undefined },
      {
        isActive: isPulseLook && isPlaying,
        isDemo: !playing.isPlaying,
        colors: pulseColors,
        areControlsShown: (isShown || isTrackInfoShown) && !isMiniature,
      }
    );

    // The controls keep clear of the hazy edges and rounded corners the same way as on the player. The haze itself is
    // left out: its mask is made of tiles whose seams show once the preview is scaled.
    const isCircle = CIRCLE_LOOKS.includes(design.look);
    const { cornerRadius, isEdgeHazeEnabled, edgeHaze } = settings;
    const haze = isEdgeHazeEnabled ? edgeHaze : 0;
    const edgeStyle = useMemo(() => {
      const size = { width, height };
      if (isCircle) {
        // round, fading into the desk around it the way the player fades into the desktop
        const fade = Math.max(haze, CIRCLE_MIN_HAZE);
        const { windowStyle } = getEdgeStyles(size, MAX_CORNER_RADIUS, fade);
        const variables = Object.fromEntries(Object.entries(windowStyle).filter(([key]) => key.startsWith('--')));
        return {
          ...variables,
          background: 'transparent',
          WebkitMaskImage: `radial-gradient(closest-side, #000 calc(100% - ${fade}px), transparent)`,
        } as CSSProperties;
      }
      const { windowStyle } = getEdgeStyles(size, cornerRadius, haze);
      const variables = Object.fromEntries(Object.entries(windowStyle).filter(([key]) => key.startsWith('--')));
      return { ...variables, borderRadius: variables['--corner-radius'] ?? 0 } as CSSProperties;
    }, [cornerRadius, haze, height, isCircle, width]);

    const data: PlayerData = playing.id
      ? {
          ...SAMPLE_DATA,
          title: playing.track,
          subtitle: [playing.artist, settings.isAlbumShown && playing.album].filter(Boolean).join(' — '),
          progress: playing.progress,
          duration: playing.duration,
          isLiked: !!playing.isLiked,
          volume: playing.volume,
          repeatState: playing.repeatState ?? RepeatState.Off,
        }
      : { ...SAMPLE_DATA, subtitle: settings.isAlbumShown ? SAMPLE_DATA.subtitle : SAMPLE_ARTIST };

    const layoutStyle: LayoutStyle = useMemo(
      () => ({
        accent,
        controlScale: settings.controlScale,
        fontStyle: settings.fontStyle,
        backdropStrength: settings.backdropStrength,
      }),
      [accent, settings.backdropStrength, settings.controlScale, settings.fontStyle]
    );
    const placement = {
      isCenteredX: settings.isCoverCenteredHorizontally,
      isCenteredY: settings.isCoverCenteredVertically,
    };
    const isPaused =
      !!playing.id && !playing.isPlaying && design.look !== DesignLook.Vinyl && design.look !== DesignLook.Ncs;
    const artStyle = getArtStyle(
      {
        zoom: settings.artZoom,
        brightness: settings.artBrightness,
        saturation: settings.artSaturation,
        blur: settings.artBlur,
      },
      placement,
      isPaused
    );

    const isVisualizing =
      !MACOS && settings.visualizationType === VisualizationType.Small && design.look !== DesignLook.Ncs;

    return (
      <Box style={{ width: width * scale, height: height * scale, ...style }}>
        <Screen
          ref={setScreen}
          className={settings.isTextShadowEnabled ? undefined : 'no-text-shadow'}
          style={{ width, height, transform: `scale(${scale})`, ...edgeStyle }}>
          <ArtBox ref={artRef} style={artStyle}>
            <CoverArt
              look={design.look}
              coverUrl={coverUrl}
              ink={ink}
              paper={paper}
              isPlaying={isPlaying}
              isDemo={!playing.isPlaying}
              ncsZoom={settings.ncsZoom}
              {...placement}
            />
          </ArtBox>
          {isDetailed && isVisualizing && (
            <Visualizer
              visualizationId={settings.visualizationId}
              visualizerOpacity={settings.visualizerOpacity}
              ncsZoom={settings.ncsZoom}
              coverUrl={coverUrl}
            />
          )}
          {isDetailed && (
            <Bars
              barThickness={settings.barThickness}
              barColor={INKED_LOOKS.includes(design.look) ? ink : settings.barColor}
              alwaysShowProgress={settings.isAlwaysShowSongProgress && !isShown}
              isAroundWindow={settings.isProgressAroundWindow}
              isHazy={settings.isProgressBarHazy}
              cornerRadius={isCircle ? MAX_CORNER_RADIUS : cornerRadius}
              haze={isCircle ? Math.max(haze, CIRCLE_MIN_HAZE) : haze}
              size={{ width, height }}
              share={data.duration ? data.progress / data.duration : 0}
            />
          )}
          <PlayerLayout
            design={design}
            data={data}
            actions={INERT_ACTIONS}
            barColor={settings.barColor}
            barThickness={settings.barThickness}
            ink={ink}
            paper={paper}
            isTrackInfoEnabled={settings.isAlwaysShowTrackInfo || settings.showTrackInfoTemporarilyInSeconds > 0}
            isShowingTrackInfo={isTrackInfoShown}
            isRevealed={isShown}
            editor={editor}
            layoutStyle={layoutStyle}
          />
        </Screen>
      </Box>
    );
  }
);
