import '../../build/Release/black-magic.node';
import '../../icon.ico';
import '../../icon.png';
import '../../icon_liked.png';

import { spawn } from 'child_process';
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  HandlerDetails,
  ipcMain,
  IpcMainEvent,
  Menu,
  nativeImage,
  Rectangle,
  screen,
  session,
  shell,
  Tray,
} from 'electron';
import Store from 'electron-store';
import * as path from 'path';

import { version } from '../../version.generated';
import { ApplicationUrl, IpcMessage, LINUX, MACOS, MAX_SIDE_LENGTH, MIN_SIDE_LENGTH, WindowName } from '../constants';
import { MouseData } from '../models/ipc-messages.models';
import { DEFAULT_SETTINGS, Settings, VisualizationType } from '../models/settings';
import {
  getAboutWindowOptions,
  getOnboardingWindowOptions,
  getSettingsWindowOptions,
  setAlwaysOnTop,
  settingsSchema,
  showDevTool,
} from './main.utils';

const DEFAULT_SIZE = 220;
// Linux doesn't emit 'resized', consider a resize finished once no 'resize' happened for that long
const RESIZE_SETTLE_DELAY_IN_MS = 300;

app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendArgument('disable-gpu-vsync');
app.commandLine.appendSwitch('enable-transparent-visuals');

// Starts another Lofi, for this one to quit and hand over to. Not app.relaunch() on Linux: its helper runs from an
// AppImage's mount point, which disappears once this process exits
const launchAgain = (args: string[]): void => {
  if (LINUX) {
    spawn(process.env.APPIMAGE || process.execPath, args, { detached: true, stdio: 'inherit' }).unref();
  } else {
    app.relaunch({ args });
  }
};

// Native Wayland windows can't position themselves, follow the cursor or stay on top, run through XWayland.
// The platform is picked before this script runs, so it must be on the command line: the launch scripts and
// desktop entry pass it, anything else (e.g. starting the AppImage directly) gets relaunched with it.
const isNativeWayland = app.commandLine.getSwitchValue('ozone-platform') === 'wayland';
const isPlatformRequested = process.argv.some((arg) => arg.startsWith('--ozone-platform'));
const isRelaunchingWithX11 = LINUX && isNativeWayland && !isPlatformRequested && !!process.env.DISPLAY;
if (isRelaunchingWithX11) {
  launchAgain([...process.argv.slice(1), '--ozone-platform=x11']);
  app.exit(0);
}

if (process.env.NODE_ENV === 'development') {
  app.commandLine.appendSwitch('trace-warnings');
  app.commandLine.appendSwitch('enable-logging', '1');
}

Store.initRenderer();
const store = new Store({ clearInvalidConfig: true });
const storeSettings = store.get('settings') as Settings & { size?: number; visualizationScreenId?: number };

// The player used to be square with a single size, it now has a width and a height
if (storeSettings && storeSettings.width === undefined && typeof storeSettings.size === 'number') {
  storeSettings.width = storeSettings.size;
  storeSettings.height = storeSettings.size;
  delete storeSettings.size;
  store.set('settings', storeSettings);
}

// The fullscreen visualization (2) is gone, it shows over the cover instead
const FULLSCREEN_VISUALIZATION = 2;
if (storeSettings && (storeSettings.visualizationType as number) === FULLSCREEN_VISUALIZATION) {
  storeSettings.visualizationType = VisualizationType.Small;
  store.set('settings', storeSettings);
}
if (storeSettings && 'visualizationScreenId' in storeSettings) {
  delete storeSettings.visualizationScreenId;
  store.set('settings', storeSettings);
}

// Installs from before the setup guide only get it when they were never connected to Spotify
if (storeSettings && storeSettings.isOnboarded === undefined) {
  storeSettings.isOnboarded = !!storeSettings.spotifyClientId;
  store.set('settings', storeSettings);
}

let settings: Settings = DEFAULT_SETTINGS;
try {
  settingsSchema.parse(storeSettings);
  settings = storeSettings;
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`Invalid settings file: ${error}`);
}

if (settings.isUsingHardwareAcceleration === false) {
  app.disableHardwareAcceleration();
}

let mainWindow: BrowserWindow | null = null;
let mousePoller: NodeJS.Timeout;
let resizeTimeoutId: NodeJS.Timeout;
let initialBounds: Rectangle;
// where the player is being dragged to, the settings are told once it's let go of
let movedTo: Pick<Rectangle, 'x' | 'y'> | null = null;
let isAlwaysSquare = !!settings.isAlwaysSquare;

let tray: Tray = null;
Menu.setApplicationMenu(null);

// leave the lock to the relaunched instance
const isSingleInstance: boolean = isRelaunchingWithX11 || app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

const icon = nativeImage.createFromPath(`${__dirname}/icon.png`).resize({ height: 16 });
const iconTrackLiked = nativeImage.createFromPath(`${__dirname}/icon_liked.png`).resize({ height: 16 });

const MAIN_WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  x: settings?.x ?? -1,
  y: settings?.y ?? -1,
  height: settings.height ?? DEFAULT_SIZE,
  width: settings.width ?? DEFAULT_SIZE,
  minHeight: MIN_SIDE_LENGTH,
  minWidth: MIN_SIDE_LENGTH,
  maxHeight: MAX_SIDE_LENGTH,
  maxWidth: MAX_SIDE_LENGTH,
  movable: false,
  frame: false,
  resizable: true,
  maximizable: false,
  minimizable: true,
  transparent: true,
  hasShadow: false,
  skipTaskbar: !settings?.isVisibleInTaskbar,
  focusable: !!settings?.isVisibleInTaskbar,
  title: 'Lofi',
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
    // nothing to type but a Spotify client ID, the spellchecker would only download and load its dictionaries
    spellcheck: false,
  },
  backgroundColor: 'rgba(0,0,0,0)',
  roundedCorners: false,
  // Windows and macOS use the executable's icon
  ...(LINUX && { icon: path.join(__dirname, 'icon.png') }),
};

const createMainWindow = (): void => {
  mainWindow = new BrowserWindow(MAIN_WINDOW_OPTIONS);

  mainWindow.setVisibleOnAllWorkspaces(true);

  mainWindow.loadURL(`file://${path.join(__dirname, './index.html')}`);

  showDevTool(mainWindow, !!settings?.isDebug);

  ipcMain.on(IpcMessage.WindowMoving, (_: IpcMainEvent, { mouseX, mouseY }: MouseData) => {
    const { x, y } = screen.getCursorScreenPoint();

    const bounds: Partial<Rectangle> = {
      x: x - mouseX,
      y: y - mouseY,
    };

    // Bounds increase even when set to the same value, this is a quirk of the setBounds function
    // We must keep the bounds constant to keep the window where it should be
    // See: https://github.com/dvx/lofi/issues/118
    if (!initialBounds) {
      initialBounds = mainWindow.getBounds();
    } else {
      bounds.width = initialBounds.width;
      bounds.height = initialBounds.height;
    }

    // Use setBounds instead of setPosition
    // See: https://github.com/electron/electron/issues/9477#issuecomment-406833003
    mainWindow.setBounds(bounds);
    movedTo = { x: bounds.x, y: bounds.y };
  });

  // Every frame of the drag, the player would be drawn again and its settings written to disk
  ipcMain.on(IpcMessage.WindowMoved, (_: IpcMainEvent) => {
    initialBounds = null;
    if (movedTo) {
      mainWindow.webContents.send(IpcMessage.WindowMoved, movedTo);
      movedTo = null;
    }
  });

  // the window manager keeps a square player square while it's resized
  mainWindow.setAspectRatio(isAlwaysSquare ? 1 : 0);
  let [lastWidth] = mainWindow.getSize();

  const handleResized = (): void => {
    let [width, height] = mainWindow.getSize();
    // in case the window manager ignored the aspect ratio, the side that was dragged decides
    if (isAlwaysSquare && width !== height) {
      const side = width !== lastWidth ? width : height;
      mainWindow.setSize(side, side);
      [width, height] = [side, side];
    }
    lastWidth = width;
    mainWindow.webContents.send(IpcMessage.WindowResized, { width, height });
  };

  mainWindow.on('resize', () => {
    if (LINUX) {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(handleResized, RESIZE_SETTLE_DELAY_IN_MS);
    }
  });

  mainWindow.on('resized', handleResized);

  ipcMain.on(
    IpcMessage.SettingsChanged,
    (
      _: IpcMainEvent,
      { x, y, width, height, isAlwaysOnTop, isDebug, isVisibleInTaskbar, isAlwaysSquare: isSquare }: Settings
    ) => {
      setAlwaysOnTop({ window: mainWindow, isAlwaysOnTop });
      mainWindow.setSkipTaskbar(!isVisibleInTaskbar);
      showDevTool(mainWindow, isDebug);

      isAlwaysSquare = !!isSquare;
      mainWindow.setAspectRatio(isAlwaysSquare ? 1 : 0);
      mainWindow.setBounds({ x, y, width, height });
      if (x === -1 && y === -1) {
        mainWindow.center();
      }
    }
  );

  ipcMain.on(IpcMessage.CloseApp, () => {
    clearTimeout(mousePoller);
    app.quit();
  });

  ipcMain.on(IpcMessage.OpenLink, (_: IpcMainEvent, url: ApplicationUrl) => {
    if (!Object.values(ApplicationUrl).includes(url)) {
      // eslint-disable-next-line no-console
      console.error(`Invalid url ${url}`);
      return;
    }
    shell.openExternal(url);
  });

  ipcMain.on(IpcMessage.ShowAbout, (_: IpcMainEvent) => {
    mainWindow.webContents.send(IpcMessage.ShowAbout);
  });

  ipcMain.on(IpcMessage.ShowSettings, (_: IpcMainEvent) => {
    mainWindow.webContents.send(IpcMessage.ShowSettings);
  });

  ipcMain.on(IpcMessage.ShowOnboarding, (_: IpcMainEvent) => {
    mainWindow.webContents.send(IpcMessage.ShowOnboarding);
  });

  // Erases everything Lofi keeps, its settings and whatever its windows stored, then starts it like a new install
  ipcMain.on(IpcMessage.FactoryReset, async (_: IpcMainEvent) => {
    clearTimeout(mousePoller);
    try {
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Could not clear the stored data: ${error}`);
    }
    // last, so nothing the windows save in the meantime comes back
    store.clear();
    app.releaseSingleInstanceLock();
    launchAgain(process.argv.slice(1));
    app.exit(0);
  });

  ipcMain.on(IpcMessage.TrackLiked, (_: IpcMainEvent, isTrackLiked: boolean) => {
    if (tray) {
      tray.setImage(isTrackLiked ? iconTrackLiked : icon);
    }
  });

  const windowOpenHandler = (
    details: HandlerDetails
  ): { action: 'allow' | 'deny'; overrideBrowserWindowOptions?: BrowserWindowConstructorOptions } => {
    switch (details.frameName) {
      case WindowName.About: {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: getAboutWindowOptions(),
        };
      }

      case WindowName.Settings: {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: getSettingsWindowOptions(),
        };
      }

      case WindowName.Onboarding: {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: getOnboardingWindowOptions(),
        };
      }

      case WindowName.Auth: {
        shell.openExternal(details.url);
        break;
      }

      default: {
        throw new Error(`Invalid frame name: ${details.frameName}`);
      }
    }

    return { action: 'deny' };
  };

  mainWindow.webContents.on('did-create-window', (childWindow, { frameName }) => {
    switch (frameName) {
      case WindowName.About: {
        if (MACOS) {
          childWindow.setWindowButtonVisibility(false);
        }
        childWindow.center();
        break;
      }

      case WindowName.Settings: {
        childWindow.webContents.setWindowOpenHandler(windowOpenHandler);
        if (MACOS) {
          childWindow.setWindowButtonVisibility(false);
        }
        childWindow.center();
        break;
      }

      case WindowName.Onboarding: {
        childWindow.webContents.setWindowOpenHandler(windowOpenHandler);
        if (MACOS) {
          childWindow.setWindowButtonVisibility(false);
        }
        // as high as the player, which it's opened after, so it's over it
        setAlwaysOnTop({ window: childWindow, isAlwaysOnTop: true });
        childWindow.center();
        break;
      }

      default: {
        break;
      }
    }

    showDevTool(childWindow, settings.isDebug);
  });

  mainWindow.webContents.setWindowOpenHandler(windowOpenHandler);
};

app.on('ready', () => {
  if (settings?.version === null || settings.version !== String(version)) {
    // Settings from other versions are discarded, except for the user's own Spotify app and the setup being done
    const { spotifyClientId = '', isOnboarded = false } = settings ?? DEFAULT_SETTINGS;
    store.clear();
    settings = { ...DEFAULT_SETTINGS, spotifyClientId, isOnboarded };
    store.set('settings', settings);
  }

  createMainWindow();

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `lofi v${version}`,
      enabled: false,
      icon,
    },
    { type: 'separator' },
    {
      label: 'Settings',
      type: 'normal',
      click: () => {
        mainWindow.webContents.send(IpcMessage.ShowSettings);
      },
    },
    {
      label: 'About',
      type: 'normal',
      click: () => {
        mainWindow.webContents.send(IpcMessage.ShowAbout);
      },
    },
    {
      label: 'Exit',
      type: 'normal',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`lofi v${version}`);

  mainWindow.once('ready-to-show', () => {
    const displays = screen.getAllDisplays();
    const isAppVisible = displays.reduce(
      (isOutOfScreen, { workArea: { x: areaX, y: areaY, width, height } }) =>
        isOutOfScreen ||
        (settings.x >= areaX && settings.y >= areaY && settings.x < width + areaX && settings.y < height + areaY),
      false
    );

    if (!isAppVisible || (settings.x === -1 && settings.y === -1)) {
      mainWindow.center();
    }

    setAlwaysOnTop({ window: mainWindow, isAlwaysOnTop: settings.isAlwaysOnTop });

    mainWindow.webContents.send(IpcMessage.WindowReady);
  });
});

app.on('activate', () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (MACOS && mainWindow === null) {
    createMainWindow();
  }
});
