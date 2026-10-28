import { platform } from 'os';

export const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

export const WINDOWS = platform() === 'win32';
export const LINUX = platform() === 'linux';
export const MACOS = platform() === 'darwin';

export const MIN_SIDE_LENGTH = 115;
export const MAX_SIDE_LENGTH = 1440;
export const MAX_BAR_THICKNESS = 20;
// half the shorter side: a square player becomes a circle
export const MAX_CORNER_RADIUS = 50;
export const MIN_EDGE_HAZE = 4;
export const MAX_EDGE_HAZE = 48;

// the player's look beyond its design, in percent unless they say otherwise
export const MIN_CONTROL_SCALE = 70;
export const MAX_CONTROL_SCALE = 160;
export const MAX_BACKDROP_STRENGTH = 200;
export const MAX_ART_ZOOM = 200;
export const MIN_ART_BRIGHTNESS = 40;
export const MAX_ART_BRIGHTNESS = 160;
export const MAX_ART_SATURATION = 200;
export const MAX_ART_BLUR_IN_PX = 12;
export const MIN_NCS_ZOOM = 50;
export const MAX_NCS_ZOOM = 160;

export const MIN_SKIP_SONG_DELAY = 5;
export const MAX_SKIP_SONG_DELAY = 60;

export enum WindowTitle {
  About = 'About Lofi',
  Onboarding = 'Welcome to Lofi',
  Settings = 'Lofi Settings',
}

export enum WindowName {
  About = 'about',
  Auth = 'auth',
  Onboarding = 'onboarding',
  Settings = 'settings',
}

export enum IpcMessage {
  CloseApp = 'closeApp',
  FactoryReset = 'factoryReset',
  OpenLink = 'openLink',
  SettingsChanged = 'settingsChanged',
  ShowAbout = 'showAbout',
  ShowOnboarding = 'showOnboarding',
  ShowSettings = 'showSettings',
  TrackLiked = 'trackLiked',
  WindowMoved = 'windowMoved',
  WindowMoving = 'windowMoving',
  WindowReady = 'windowReady',
  WindowResized = 'windowResized',
}

export enum ApplicationUrl {
  Home = 'https://www.lofi.rocks/',
  Help = 'https://www.lofi.rocks/help',
  Discord = 'https://discord.gg/YuH9UJk',
  GitHub = 'https://github.com/dvx/lofi',
  SpotifyDashboard = 'https://developer.spotify.com/dashboard',
}
