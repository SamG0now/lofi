import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { z } from 'zod';

import {
  MAX_BAR_THICKNESS,
  MAX_EDGE_HAZE,
  MAX_SIDE_LENGTH,
  MAX_SKIP_SONG_DELAY,
  MIN_SIDE_LENGTH,
  MIN_SKIP_SONG_DELAY,
  WindowTitle,
} from '../constants';
import { VisualizationType } from '../models/settings';
import { visualizations } from '../visualizations';

export const getCommonWindowOptions = (): BrowserWindowConstructorOptions => ({
  frame: false,
  titleBarOverlay: false,
  titleBarStyle: 'hidden',
  roundedCorners: false,
  minimizable: false,
  maximizable: false,
  resizable: true,
  alwaysOnTop: true,
  fullscreenable: false,
  center: true,
  webPreferences: {
    // Child windows are rendered by the main window through portals, they must share its (unsandboxed) process
    sandbox: false,
    spellcheck: false,
  },
});

// room for the Design section's editor: the player and its inspector side by side. A window like any other, other
// windows can go over it while it stays open.
export const getSettingsWindowOptions = (): BrowserWindowConstructorOptions => ({
  ...getCommonWindowOptions(),
  alwaysOnTop: false,
  height: 740,
  minHeight: 600,
  width: 1080,
  minWidth: 920,
  roundedCorners: true,
  title: WindowTitle.Settings,
});

// A setup assistant: one size, above the player, which starts out in the middle of the screen too
export const getOnboardingWindowOptions = (): BrowserWindowConstructorOptions => ({
  ...getCommonWindowOptions(),
  height: 620,
  width: 820,
  resizable: false,
  roundedCorners: true,
  title: WindowTitle.Onboarding,
});

export const getAboutWindowOptions = (): BrowserWindowConstructorOptions => ({
  ...getCommonWindowOptions(),
  height: 540,
  width: 400,
  title: WindowTitle.About,
});

export const showDevTool = (window: BrowserWindow, isShow: boolean): void => {
  if (isShow) {
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.webContents.closeDevTools();
  }
};

export const setAlwaysOnTop = ({
  window,
  isAlwaysOnTop,
  level = 'screen-saver',
}: {
  window: BrowserWindow;
  isAlwaysOnTop: boolean;
  level?:
    | 'normal'
    | 'floating'
    | 'torn-off-menu'
    | 'modal-panel'
    | 'main-menu'
    | 'status'
    | 'pop-up-menu'
    | 'screen-saver';
  relativeLevel?: number;
}): void => window && window.setAlwaysOnTop(isAlwaysOnTop, level);

export const settingsSchema = z.object({
  x: z.number(),
  y: z.number(),
  visualizationId: z
    .number()
    .min(0)
    .max(visualizations.length - 1)
    .optional(),
  visualizationType: z.nativeEnum(VisualizationType).optional(),
  visualizerOpacity: z.number().min(1).max(100).optional(),
  barThickness: z.number().min(1).max(MAX_BAR_THICKNESS).optional(),
  width: z.number().min(MIN_SIDE_LENGTH).max(MAX_SIDE_LENGTH).optional(),
  height: z.number().min(MIN_SIDE_LENGTH).max(MAX_SIDE_LENGTH).optional(),
  isAlwaysSquare: z.boolean().optional(),
  isEdgeHazeEnabled: z.boolean().optional(),
  edgeHaze: z.number().min(0).max(MAX_EDGE_HAZE).optional(),
  volumeIncrement: z.number().min(1).max(100).optional(),
  skipSongDelay: z.number().min(MIN_SKIP_SONG_DELAY).max(MAX_SKIP_SONG_DELAY).optional(),
  maxFrameRate: z.number().min(0).optional(),
  spotifyClientId: z.string().optional(),
});
