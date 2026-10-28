import { createStyles, Group, MantineColor, NativeSelect, Switch, Text, TextInput } from '@mantine/core';
import React, { createContext, CSSProperties, forwardRef, FunctionComponent, ReactNode, useContext } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Settings } from '../../../models/settings';
import { getPalette } from './palette';

// Every section has its own accent color, used by its controls
export const SectionColorContext = createContext<MantineColor>('blue');

export const useSectionColor = (): MantineColor => useContext(SectionColorContext);

const useStyles = createStyles((theme) => {
  const palette = getPalette(theme);
  return {
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.lg,
    },
    groupTitle: {
      margin: `0 0 ${theme.spacing.xs} 2px`,
    },
    group: {
      backgroundColor: palette.card,
      borderRadius: 10,
      border: `1px solid ${palette.cardBorder}`,
      boxShadow: palette.cardShadow,

      // macOS style inset list: rows separated by hairlines
      '& > *': {
        padding: '10px 14px',
      },
      '& > * + *': {
        borderTop: `1px solid ${palette.separator}`,
      },
    },
    row: {
      minHeight: 30,
    },
    sliderValue: {
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums',
    },
    // A native range input: Mantine's slider follows the mouse on the main window's document, so it can't be dragged
    // in the settings window. The track fills up to the thumb with the section color, through --fill and --accent.
    slider: {
      display: 'block',
      width: '100%',
      height: 18,
      margin: `${theme.spacing.xs} 0 0`,
      background: 'transparent',
      cursor: 'pointer',
      WebkitAppearance: 'none',

      '&::-webkit-slider-runnable-track': {
        height: 4,
        borderRadius: 2,
        background: `linear-gradient(to right, var(--accent) var(--fill), ${palette.sliderTrack} var(--fill))`,
      },
      '&::-webkit-slider-thumb': {
        width: 18,
        height: 18,
        marginTop: -7,
        borderRadius: '50%',
        backgroundColor: palette.thumb,
        border: '0.5px solid rgba(0, 0, 0, 0.15)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        WebkitAppearance: 'none',
      },
      '&:active::-webkit-slider-thumb': {
        backgroundColor: palette.thumbActive,
      },
      '&:focus': {
        outline: 'none',
      },
      '&:focus-visible::-webkit-slider-thumb': {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 3px var(--focus)',
      },
    },
  };
});

type SettingName = keyof Settings;

interface FieldProps {
  name: SettingName;
  label: string;
  description?: ReactNode;
}

export const SettingsSection: FunctionComponent<{ description?: ReactNode }> = ({ description, children }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.section}>
      {description && (
        <Text size="sm" color="dimmed">
          {description}
        </Text>
      )}
      {children}
    </div>
  );
};

export const SettingsGroup: FunctionComponent<{ title?: string }> = ({ title, children }) => {
  const { classes } = useStyles();
  return (
    <div>
      {title && (
        <Text size="sm" weight={600} className={classes.groupTitle}>
          {title}
        </Text>
      )}
      <div className={classes.group}>{children}</div>
    </div>
  );
};

export const SettingRow: FunctionComponent<Omit<FieldProps, 'name'>> = ({ label, description, children }) => {
  const { classes } = useStyles();
  return (
    <Group position="apart" noWrap spacing="md" className={classes.row}>
      <div>
        <Text size="sm">{label}</Text>
        {description && (
          <Text size="xs" color="dimmed">
            {description}
          </Text>
        )}
      </div>
      {children}
    </Group>
  );
};

export const SwitchField: FunctionComponent<FieldProps> = ({ name, label, description }) => {
  const { control } = useFormContext<Settings>();
  const color = useSectionColor();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, ref } }) => (
        <SettingRow label={label} description={description}>
          <Switch
            ref={ref}
            color={color}
            checked={!!value}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
        </SettingRow>
      )}
    />
  );
};

interface RangeProps {
  min: number;
  max: number;
  step?: number;
}

interface RangeInputProps extends RangeProps {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const RangeInput = forwardRef<HTMLInputElement, RangeInputProps>(
  ({ label, value, min, max, step = 1, disabled, onChange }, ref) => {
    const { classes, theme } = useStyles();
    const color = useSectionColor();
    return (
      <input
        ref={ref}
        type="range"
        aria-label={label}
        className={classes.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={
          {
            '--fill': `${((value - min) / (max - min)) * 100}%`,
            '--accent': disabled ? getPalette(theme).faint : theme.colors[color][6],
            '--focus': theme.colors[color][2],
            opacity: disabled ? 0.6 : 1,
          } as CSSProperties
        }
      />
    );
  }
);

interface SliderFieldProps extends FieldProps, RangeProps {
  format?: (value: number) => string;
}

export const SliderField: FunctionComponent<SliderFieldProps> = ({
  name,
  label,
  description,
  min,
  max,
  step = 1,
  format = String,
}) => {
  const { classes } = useStyles();
  const { control } = useFormContext<Settings>();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, ref } }) => (
        <div>
          <SettingRow label={label} description={description}>
            <Text size="sm" color="dimmed" className={classes.sliderValue}>
              {format(Number(value))}
            </Text>
          </SettingRow>
          <RangeInput
            ref={ref}
            label={label}
            min={min}
            max={max}
            step={step}
            value={Number(value)}
            onChange={onChange}
          />
        </div>
      )}
    />
  );
};

interface SelectFieldProps extends FieldProps {
  // the setting holds the selected option's value
  options: { value: number; label: string }[];
  width?: number;
}

export const SelectField: FunctionComponent<SelectFieldProps> = ({
  name,
  label,
  description,
  options,
  width = 240,
}) => {
  const { control } = useFormContext<Settings>();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, ref } }) => (
        <SettingRow label={label} description={description}>
          <NativeSelect
            ref={ref}
            size="xs"
            w={width}
            style={{ flexShrink: 0 }}
            value={String(value)}
            onChange={(event) => onChange(Number(event.currentTarget.value))}
            data={options.map((option) => ({ value: String(option.value), label: option.label }))}
          />
        </SettingRow>
      )}
    />
  );
};

interface TextFieldProps extends FieldProps {
  placeholder?: string;
}

export const TextField: FunctionComponent<TextFieldProps> = ({ name, label, description, placeholder }) => {
  const { register } = useFormContext<Settings>();
  return (
    <SettingRow label={label} description={description}>
      <TextInput size="xs" w={200} placeholder={placeholder} {...register(name)} />
    </SettingRow>
  );
};
