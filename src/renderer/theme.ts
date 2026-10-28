import { MantineThemeOverride } from '@mantine/core';

export const LOFI_THEME: MantineThemeOverride = {
  colorScheme: 'light',
  primaryColor: 'blue',
  // the system font on macOS, the bundled Inter elsewhere
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter UI', sans-serif",
  headings: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter UI', sans-serif" },
  defaultRadius: 'md',
  colors: {
    // Neutral grays like macOS's dark mode, Mantine's own are tinted blue: text, dimmed text, borders, inputs and the
    // window, from light to dark
    dark: [
      '#ececee',
      '#c7c7cc',
      '#98989d',
      '#7c7c80',
      '#4a4a4e',
      '#3a3a3d',
      '#2c2c2f',
      '#1c1c1e',
      '#161618',
      '#101011',
    ],
  },
};
