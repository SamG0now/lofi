import { createStyles, MantineColor } from '@mantine/core';
import React, { CSSProperties, FunctionComponent, ReactNode, useCallback, useState } from 'react';
import { FieldPath, useFormContext, useWatch } from 'react-hook-form';

import { Settings } from '../../../models/settings';
import { ColorGraph } from './color-graph';
import { RangeInput, useSectionColor } from './fields';
import { getAccentText, getPalette } from './palette';

// The controls of the Design section's inspector: compact rows in white cards, like the inspectors of macOS apps

type SettingName = keyof Settings;

/** A setting being edited and how to change it, for controls that aren't form fields of their own. */
export const useSetting = <K extends SettingName>(name: K): [Settings[K], (value: Settings[K]) => void] => {
  const { control, setValue } = useFormContext<Settings>();
  const value = useWatch({ control, name: name as FieldPath<Settings> }) as Settings[K];
  const change = useCallback(
    (next: Settings[K]) => setValue(name as FieldPath<Settings>, next as never, { shouldDirty: true }),
    [name, setValue]
  );
  return [value, change];
};

const useStyles = createStyles((theme, color: MantineColor) => {
  const accent = getAccentText(theme, color);
  const palette = getPalette(theme);
  return {
    group: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    groupHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 18,
      padding: '0 2px',
    },
    groupTitle: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: palette.muted,
    },
    groupAction: {
      padding: 0,
      border: 'none',
      background: 'none',
      color: accent,
      fontFamily: 'inherit',
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',

      '&:disabled': {
        color: palette.faint,
        cursor: 'default',
      },
    },
    card: {
      backgroundColor: palette.card,
      borderRadius: 10,
      border: `1px solid ${palette.cardBorder}`,
      boxShadow: palette.cardShadow,

      '& > *': {
        padding: '9px 12px',
      },
      '& > * + *': {
        borderTop: `1px solid ${palette.separator}`,
      },
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: 24,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      fontSize: 13,
      lineHeight: 1.35,
      color: palette.text,
    },
    description: {
      marginTop: 1,
      fontSize: 11,
      lineHeight: 1.35,
      color: palette.muted,
    },
    value: {
      flexShrink: 0,
      fontSize: 12,
      color: palette.muted,
      fontVariantNumeric: 'tabular-nums',
    },
    disabled: {
      opacity: 0.45,
      pointerEvents: 'none',
    },
    segmented: {
      display: 'flex',
      padding: 2,
      borderRadius: 8,
      backgroundColor: palette.track,
    },
    segment: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      minWidth: 0,
      padding: '4px 6px',
      border: 'none',
      borderRadius: 6,
      background: 'none',
      color: palette.secondary,
      fontFamily: 'inherit',
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      cursor: 'pointer',

      '& i': {
        fontSize: 11,
      },
    },
    segmentActive: {
      backgroundColor: palette.raised,
      color: palette.text,
      boxShadow: palette.raisedShadow,

      '& i': {
        color: accent,
      },
    },
    swatches: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 7,
    },
    swatch: {
      width: 20,
      height: 20,
      padding: 0,
      border: 'none',
      borderRadius: '50%',
      boxShadow: `inset 0 0 0 1px ${palette.swatchEdge}`,
      cursor: 'pointer',
      transition: 'transform 0.1s',

      '&:hover': {
        transform: 'scale(1.12)',
      },
    },
    customSwatch: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'conic-gradient(#ff5f57, #febc2e, #28c840, #38bdf8, #a78bfa, #ff5f57)',
      color: 'white',
      fontSize: 9,
      textShadow: '0 0 2px rgba(0, 0, 0, 0.6)',
    },
  };
});

const usePanelStyles = (): ReturnType<typeof useStyles> => useStyles(useSectionColor());

interface GroupAction {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export const PanelGroup: FunctionComponent<{ title: string; action?: GroupAction }> = ({ title, action, children }) => {
  const { classes } = usePanelStyles();
  return (
    <section className={classes.group}>
      <div className={classes.groupHeader}>
        <span className={classes.groupTitle}>{title}</span>
        {action && (
          <button type="button" className={classes.groupAction} disabled={action.disabled} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <div className={classes.card}>{children}</div>
    </section>
  );
};

interface RowProps {
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** A label with its control on the right, or under it when it needs the room. */
export const PanelRow: FunctionComponent<RowProps & { below?: ReactNode }> = ({
  label,
  description,
  disabled,
  below,
  children,
}) => {
  const { classes, cx } = usePanelStyles();
  return (
    <div className={cx(disabled && classes.disabled)}>
      <div className={classes.row}>
        <div className={classes.rowText}>
          <div className={classes.label}>{label}</div>
          {description && <div className={classes.description}>{description}</div>}
        </div>
        {children}
      </div>
      {below}
    </div>
  );
};

const useToggleStyles = createStyles((theme, color: MantineColor) => ({
  toggle: {
    position: 'relative',
    flexShrink: 0,
    width: 32,
    height: 19,
    margin: 0,
    borderRadius: 999,
    backgroundColor: getPalette(theme).toggleOff,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    WebkitAppearance: 'none',

    '&::after': {
      content: '""',
      position: 'absolute',
      top: 2,
      left: 2,
      width: 15,
      height: 15,
      borderRadius: '50%',
      backgroundColor: theme.white,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
      transition: 'transform 0.15s',
    },
    '&:checked': {
      backgroundColor: theme.colors[color][6],
    },
    '&:checked::after': {
      transform: 'translateX(13px)',
    },
    '&:focus': {
      outline: 'none',
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 3px ${theme.colors[color][2]}`,
    },
  },
}));

// a native checkbox drawn as a switch, smaller than Mantine's to fit the rows
const Toggle: FunctionComponent<{
  label: string;
  color: MantineColor;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, color, checked, onChange }) => {
  const { classes } = useToggleStyles(color);
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      className={classes.toggle}
      checked={!!checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
};

interface SwitchProps extends RowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const PanelSwitch: FunctionComponent<SwitchProps> = ({ checked, onChange, ...row }) => {
  const color = useSectionColor();
  return (
    <PanelRow {...row}>
      <Toggle label={String(row.label)} color={color} checked={checked} onChange={onChange} />
    </PanelRow>
  );
};

interface SliderProps extends RowProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export const PanelSlider: FunctionComponent<SliderProps> = ({
  value,
  min,
  max,
  step,
  format = String,
  onChange,
  ...row
}) => {
  const { classes } = usePanelStyles();
  return (
    <PanelRow
      {...row}
      below={
        <RangeInput
          label={String(row.label)}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={row.disabled}
          onChange={onChange}
        />
      }>
      <span className={classes.value}>{format(value)}</span>
    </PanelRow>
  );
};

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  title?: string;
  style?: CSSProperties;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}

// macOS style segmented control, plain buttons: Mantine's measures itself, which isn't reliable in this window
export const Segmented = <T extends string>({ label, value, options, onChange }: SegmentedProps<T>): JSX.Element => {
  const { classes, cx } = usePanelStyles();
  return (
    <div className={classes.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          className={cx(classes.segment, option.value === value && classes.segmentActive)}
          style={option.style}
          onClick={() => onChange(option.value)}>
          {option.icon && <i className={option.icon} />}
          {option.label}
        </button>
      ))}
    </div>
  );
};

// bright colors for the dark album art they usually sit on, and white
const SWATCHES = ['#1ed760', '#ff6fb1', '#ff8a3d', '#ffd23f', '#4fe0c3', '#38bdf8', '#a78bfa', '#ffffff'];

interface ColorChoiceProps {
  label: string;
  value: string;
  swatches?: string[];
  onChange: (color: string) => void;
}

/** A few colors to pick from, and a graph for any other. */
export const ColorChoice: FunctionComponent<ColorChoiceProps> = ({ label, value, swatches = SWATCHES, onChange }) => {
  const { classes, theme } = usePanelStyles();
  const accent = theme.colors[useSectionColor()][6];
  const current = String(value).toLowerCase();
  const isOwn = !swatches.includes(current);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const ring = { boxShadow: `0 0 0 2px ${getPalette(theme).card}, 0 0 0 3.5px ${accent}` };

  return (
    <div>
      <div className={classes.swatches}>
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            title={swatch}
            aria-label={`${label} ${swatch}`}
            className={classes.swatch}
            style={{ backgroundColor: swatch, ...(swatch === current && ring) }}
            onClick={() => onChange(swatch)}
          />
        ))}
        <button
          type="button"
          title="Any color"
          aria-label={`${label}, any color`}
          aria-expanded={isGraphOpen}
          className={`${classes.swatch} ${classes.customSwatch}`}
          style={isOwn ? { background: value, ...ring } : undefined}
          onClick={() => setIsGraphOpen(!isGraphOpen)}>
          <i className={`fa-solid ${isGraphOpen ? 'fa-chevron-up' : 'fa-plus'}`} />
        </button>
      </div>
      {isGraphOpen && <ColorGraph label={label} value={value} onChange={onChange} />}
    </div>
  );
};
