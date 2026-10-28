import { cloneDeep } from 'lodash';

import { version } from '../../version.generated';
import { DesignPreset, MODERN_DESIGN, PlayerDesign } from './player-design';

// Saved as numbers, 2 was the fullscreen visualization which no longer exists
export enum VisualizationType {
  None,
  Small,
}

// Where the color of what's switched on comes from: each look's own, the album art's main color, or the user's
export enum AccentSource {
  Look = 'look',
  Cover = 'cover',
  Own = 'own',
}

// The typeface of the song and the controls, the ASCII look always types in monospace
export enum FontStyle {
  Inter = 'inter',
  System = 'system',
  Serif = 'serif',
  Mono = 'mono',
  Condensed = 'condensed',
}

// How the settings window looks: light, dark, or like the desktop
export enum Appearance {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export interface Settings {
  version: string;
  // the setup guide was finished or put away, it opens on the first start and again after a factory reset
  isOnboarded: boolean;
  isDebug: boolean;
  isUsingHardwareAcceleration: boolean;
  // the most frames a second the visualizations and the moving looks draw, 0 for every frame of the screen
  maxFrameRate: number;
  spotifyClientId: string;
  accessToken: string;
  refreshToken: string;
  visualizationId: number;
  visualizationType: VisualizationType;
  visualizerOpacity: number;
  // how big NCS's circle is drawn, in percent, as the Full NCS look and as a visualization
  ncsZoom: number;
  isAlwaysOnTop: boolean;
  isVisibleInTaskbar: boolean;
  x: number;
  y: number;
  isAlwaysShowTrackInfo: boolean;
  isAlwaysShowSongProgress: boolean;
  showTrackInfoTemporarilyInSeconds: number;
  barThickness: number;
  barColor: string;
  width: number;
  height: number;
  // the player stays 1:1, whichever way it's resized
  isAlwaysSquare: boolean;
  volumeIncrement: number;
  skipSongDelay: number;
  showFreemiumWarning: boolean;
  cornerRadius: number;
  isEdgeHazeEnabled: boolean;
  edgeHaze: number;
  isCoverCenteredHorizontally: boolean;
  isCoverCenteredVertically: boolean;
  trackInfoRefreshTimeInSeconds: number;
  design: DesignPreset;
  // kept while a built-in design is picked, to come back to
  customDesign: PlayerDesign;
  // the ink of the looks printed in one color, halftone and ASCII: the album art's main color, or this one
  isHalftoneColorFromCover: boolean;
  halftoneColor: string;
  // the progress bar while the controls are hidden: along the bottom or all the way around, crisp or melting into
  // the hazy edges
  isProgressAroundWindow: boolean;
  isProgressBarHazy: boolean;
  // behind the song and the icons, for reading them on light album art
  isTextShadowEnabled: boolean;
  // switched on buttons and the progress, the looks printed in one ink keep to it
  accentSource: AccentSource;
  accentColor: string;
  // of the song and the controls, in percent of the size that follows the player's
  controlScale: number;
  fontStyle: FontStyle;
  // how much the backdrop dims and blurs the art behind the controls, in percent of the design's
  backdropStrength: number;
  // the album art, in percent and the blur in pixels
  artZoom: number;
  artBrightness: number;
  artSaturation: number;
  artBlur: number;
  // the controls stay on the player instead of showing on hover
  isAlwaysShowControls: boolean;
  // after the artist, under the song's title
  isAlbumShown: boolean;
  appearance: Appearance;
}

export const DEFAULT_SETTINGS: Settings = {
  version,
  isOnboarded: false,
  x: -1,
  y: -1,
  width: 220,
  height: 220,
  isAlwaysSquare: false,
  isDebug: false,
  isUsingHardwareAcceleration: true,
  maxFrameRate: 100,
  spotifyClientId: '',
  accessToken: '',
  refreshToken: '',
  visualizationId: 0,
  visualizationType: VisualizationType.None,
  visualizerOpacity: 100,
  ncsZoom: 100,
  isAlwaysOnTop: true,
  isVisibleInTaskbar: true,
  isAlwaysShowTrackInfo: false,
  showTrackInfoTemporarilyInSeconds: 0,
  isAlwaysShowSongProgress: false,
  barThickness: 2,
  barColor: '#74C999',
  volumeIncrement: 5,
  skipSongDelay: 15,
  showFreemiumWarning: true,
  cornerRadius: 13,
  isEdgeHazeEnabled: false,
  edgeHaze: 20,
  isCoverCenteredHorizontally: true,
  isCoverCenteredVertically: true,
  trackInfoRefreshTimeInSeconds: 1,
  design: DesignPreset.Modern,
  customDesign: cloneDeep(MODERN_DESIGN),
  isHalftoneColorFromCover: true,
  halftoneColor: '#ff6fb1',
  isProgressAroundWindow: false,
  isProgressBarHazy: false,
  isTextShadowEnabled: true,
  accentSource: AccentSource.Cover,
  accentColor: '#1ed760',
  controlScale: 100,
  fontStyle: FontStyle.Inter,
  backdropStrength: 100,
  artZoom: 100,
  artBrightness: 100,
  artSaturation: 100,
  artBlur: 0,
  isAlwaysShowControls: false,
  isAlbumShown: true,
  appearance: Appearance.System,
};
