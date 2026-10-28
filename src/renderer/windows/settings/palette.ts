import { MantineColor, MantineTheme } from '@mantine/core';

/** The settings window's own colors, besides the ones Mantine's components bring: macOS-like, light or dark. */
export interface Palette {
  text: string;
  // dimmed text and icons, text a little less so, and the text under the pointer
  muted: string;
  secondary: string;
  strong: string;
  // disabled text
  faint: string;
  window: string;
  sidebar: string;
  // between the parts of the window, and under the pointer over its lists
  hairline: string;
  hover: string;
  search: string;
  // the white cards settings are grouped in, with lines between their rows
  card: string;
  cardBorder: string;
  cardShadow: string;
  separator: string;
  inspector: string;
  // a segmented control's track, and the segment that's picked
  track: string;
  raised: string;
  raisedShadow: string;
  // text fields drawn by hand, and buttons and chips
  field: string;
  fieldBorder: string;
  button: string;
  buttonBorder: string;
  buttonHover: string;
  // the cells of the direction pad
  well: string;
  wellHover: string;
  toggleOff: string;
  sliderTrack: string;
  thumb: string;
  thumbActive: string;
  // the outline of a color swatch, which has to show against the card
  swatchEdge: string;
  // the desk the player is designed on, dotted like a canvas
  desk: string;
  deskDots: string;
  // a label floating over the desk, and the dashed tray under it
  pill: string;
  dashed: string;
  banner: string;
}

const LIGHT = (theme: MantineTheme): Palette => ({
  text: '#1d1d1f',
  muted: theme.colors.gray[6],
  secondary: theme.colors.gray[7],
  strong: theme.colors.gray[8],
  faint: theme.colors.gray[4],
  window: '#f5f5f7',
  sidebar: 'linear-gradient(165deg, #e6f0ff 0%, #f3e9ff 45%, #ffe9f1 75%, #fff4e5 100%)',
  hairline: 'rgba(0, 0, 0, 0.07)',
  hover: 'rgba(0, 0, 0, 0.05)',
  search: 'rgba(255, 255, 255, 0.6)',
  card: theme.white,
  cardBorder: 'rgba(0, 0, 0, 0.07)',
  cardShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  separator: '#ececf0',
  inspector: '#fafafc',
  track: '#e9e9ee',
  raised: theme.white,
  raisedShadow: '0 1px 2px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
  field: theme.white,
  fieldBorder: 'rgba(0, 0, 0, 0.12)',
  button: theme.white,
  buttonBorder: 'rgba(0, 0, 0, 0.1)',
  buttonHover: '#f5f5f7',
  well: '#f1f1f4',
  wellHover: '#e4e4ea',
  toggleOff: '#dcdce2',
  sliderTrack: theme.colors.gray[2],
  thumb: '#ffffff',
  thumbActive: '#f5f5f7',
  swatchEdge: 'rgba(0, 0, 0, 0.15)',
  desk: 'linear-gradient(160deg, #e0ecff 0%, #fbe7f3 55%, #fff1dc 100%)',
  deskDots: 'rgba(60, 60, 90, 0.12)',
  pill: 'rgba(255, 255, 255, 0.75)',
  dashed: 'rgba(0, 0, 0, 0.12)',
  banner: '#fff8e6',
});

const DARK = (theme: MantineTheme): Palette => ({
  text: '#f2f2f7',
  muted: theme.colors.dark[2],
  secondary: theme.colors.dark[1],
  strong: theme.colors.dark[0],
  faint: theme.colors.dark[3],
  window: '#1c1c1e',
  sidebar: 'linear-gradient(165deg, #1f242c 0%, #23222a 45%, #282226 75%, #28251f 100%)',
  hairline: 'rgba(255, 255, 255, 0.08)',
  hover: 'rgba(255, 255, 255, 0.07)',
  search: 'rgba(0, 0, 0, 0.25)',
  card: '#2a2a2d',
  cardBorder: 'rgba(255, 255, 255, 0.07)',
  cardShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
  separator: 'rgba(255, 255, 255, 0.07)',
  inspector: '#202022',
  track: 'rgba(255, 255, 255, 0.08)',
  raised: '#56565a',
  raisedShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
  field: '#1f1f21',
  fieldBorder: 'rgba(255, 255, 255, 0.12)',
  button: '#323235',
  buttonBorder: 'rgba(255, 255, 255, 0.1)',
  buttonHover: '#3c3c40',
  well: '#38383b',
  wellHover: '#444448',
  toggleOff: '#48484c',
  sliderTrack: '#48484c',
  thumb: '#ececee',
  thumbActive: '#d1d1d6',
  swatchEdge: 'rgba(255, 255, 255, 0.2)',
  desk: 'linear-gradient(160deg, #1d2532 0%, #29222b 55%, #2c271f 100%)',
  deskDots: 'rgba(255, 255, 255, 0.07)',
  pill: 'rgba(28, 28, 30, 0.75)',
  dashed: 'rgba(255, 255, 255, 0.14)',
  banner: 'rgba(253, 126, 20, 0.12)',
});

export const getPalette = (theme: MantineTheme): Palette => (theme.colorScheme === 'dark' ? DARK : LIGHT)(theme);

/** The section's color for text and icons: a lighter shade on dark backgrounds, to stand out as much. */
export const getAccentText = (theme: MantineTheme, color: MantineColor): string =>
  theme.colors[color][theme.colorScheme === 'dark' ? 4 : 6];
