import { createStyles, MantineColor, Text } from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import React, { FunctionComponent } from 'react';

import { MACOS, MAX_SKIP_SONG_DELAY, MIN_SKIP_SONG_DELAY } from '../../../constants';
import { Appearance } from '../../../models/settings';
import { useSetting } from './design-controls';
import { SettingsGroup, SettingsSection, SliderField, SwitchField, useSectionColor } from './fields';
import { getAccentText, getPalette } from './palette';

const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: Appearance.Light, label: 'Light' },
  { value: Appearance.Dark, label: 'Dark' },
  { value: Appearance.System, label: 'System' },
];

interface SketchColors {
  window: string;
  sidebar: string;
  card: string;
  line: string;
}

const LIGHT_SKETCH: SketchColors = { window: '#f5f5f7', sidebar: '#e4ebf7', card: '#ffffff', line: '#d6d6dc' };
const DARK_SKETCH: SketchColors = { window: '#1c1c1e', sidebar: '#25262b', card: '#2f2f32', line: '#4a4a4e' };

const SKETCH_WIDTH = 88;
const SKETCH_HEIGHT = 58;

// The settings window in miniature: a sidebar with its picked section, and cards with a switch
const WindowSketch: FunctionComponent<{ colors: SketchColors; accent: string }> = ({
  colors: { window, sidebar, card, line },
  accent,
}) => (
  <>
    <rect width={SKETCH_WIDTH} height={SKETCH_HEIGHT} fill={window} />
    <rect width={26} height={SKETCH_HEIGHT} fill={sidebar} />
    <circle cx={6} cy={6} r={1.8} fill="#ff5f57" />
    <circle cx={11} cy={6} r={1.8} fill="#febc2e" />
    <circle cx={16} cy={6} r={1.8} fill="#28c840" />
    <rect x={4} y={13} width={18} height={4.5} rx={2.25} fill={accent} />
    <rect x={5} y={22} width={14} height={2.5} rx={1.25} fill={line} />
    <rect x={5} y={28} width={11} height={2.5} rx={1.25} fill={line} />
    <rect x={5} y={34} width={15} height={2.5} rx={1.25} fill={line} />
    <rect x={32} y={10} width={50} height={20} rx={3} fill={card} />
    <rect x={36} y={15} width={22} height={2.5} rx={1.25} fill={line} />
    <rect x={36} y={21} width={28} height={2.5} rx={1.25} fill={line} />
    <rect x={70} y={14} width={8} height={5} rx={2.5} fill={accent} />
    <rect x={32} y={34} width={50} height={16} rx={3} fill={card} />
    <rect x={36} y={39} width={26} height={2.5} rx={1.25} fill={line} />
    <rect x={36} y={44} width={18} height={2.5} rx={1.25} fill={line} />
  </>
);

const useStyles = createStyles((theme, color: MantineColor) => {
  const palette = getPalette(theme);
  return {
    options: {
      display: 'flex',
      gap: 18,
    },
    option: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      padding: 0,
      border: 'none',
      background: 'none',
      color: palette.text,
      fontFamily: 'inherit',
      fontSize: 12,
      cursor: 'pointer',

      '&:focus': {
        outline: 'none',
      },
      '&:focus-visible svg': {
        boxShadow: `0 0 0 3px ${theme.fn.rgba(theme.colors[color][6], 0.4)}`,
      },
    },
    sketch: {
      display: 'block',
      borderRadius: 8,
      boxShadow: `0 0 0 1px ${palette.cardBorder}, 0 1px 3px rgba(0, 0, 0, 0.12)`,
      transition: 'box-shadow 0.15s',
    },
    sketchActive: {
      boxShadow: `0 0 0 2px ${palette.card}, 0 0 0 4px ${theme.colors[color][6]}`,
    },
    labelActive: {
      color: getAccentText(theme, color),
      fontWeight: 600,
    },
  };
});

/** Light, dark, or whichever the desktop is in, like the appearances of macOS. */
const AppearancePicker: FunctionComponent = () => {
  const color = useSectionColor();
  const { classes, cx, theme } = useStyles(color);
  const [appearance, setAppearance] = useSetting('appearance');
  const systemScheme = useColorScheme(undefined, { getInitialValueInEffect: false });
  const accent = theme.colors[color][6];

  return (
    <div>
      <div className={classes.options} role="radiogroup" aria-label="Appearance">
        {APPEARANCES.map(({ value, label }) => {
          const isActive = value === appearance;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={classes.option}
              onClick={() => setAppearance(value)}>
              <svg
                className={cx(classes.sketch, isActive && classes.sketchActive)}
                width={SKETCH_WIDTH}
                height={SKETCH_HEIGHT}
                viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}
                aria-hidden>
                <WindowSketch colors={value === Appearance.Dark ? DARK_SKETCH : LIGHT_SKETCH} accent={accent} />
                {/* half light, half dark */}
                {value === Appearance.System && (
                  <>
                    <clipPath id="appearance-dark-half">
                      <rect x={SKETCH_WIDTH / 2} width={SKETCH_WIDTH / 2} height={SKETCH_HEIGHT} />
                    </clipPath>
                    <g clipPath="url(#appearance-dark-half)">
                      <WindowSketch colors={DARK_SKETCH} accent={accent} />
                    </g>
                  </>
                )}
              </svg>
              <span className={cx(isActive && classes.labelActive)}>{label}</span>
            </button>
          );
        })}
      </div>
      <Text size="xs" color="dimmed" mt="sm">
        System matches your desktop, which is {systemScheme} right now. Only the settings window changes, the player
        keeps its design.
      </Text>
    </div>
  );
};

export const GeneralSettings: FunctionComponent = () => (
  <SettingsSection description="How Lofi sits on your desktop and controls Spotify. Everything about how the player looks is in Design.">
    <SettingsGroup title="Appearance">
      <AppearancePicker />
    </SettingsGroup>

    <SettingsGroup title="Window">
      <SwitchField name="isAlwaysOnTop" label="Always on top" description="Keep Lofi above other windows" />
      <SwitchField name="isVisibleInTaskbar" label="Show in taskbar" description="List Lofi with your open windows" />
    </SettingsGroup>

    <SettingsGroup title="Playback">
      <SliderField
        name="volumeIncrement"
        label="Volume step"
        description="Change per scroll step over the player"
        min={2}
        max={100}
        step={2}
        format={(value) => `${value}%`}
      />
      <SliderField
        name="skipSongDelay"
        label="Seek length"
        description={`${MACOS ? '⌘' : 'Ctrl'}-click previous or next to seek instead of skipping`}
        min={MIN_SKIP_SONG_DELAY}
        max={MAX_SKIP_SONG_DELAY}
        step={5}
        format={(value) => `${value}s`}
      />
      <SwitchField
        name="showFreemiumWarning"
        label="Free account warning"
        description="Explain why playback controls are hidden without Spotify Premium"
      />
    </SettingsGroup>
  </SettingsSection>
);
