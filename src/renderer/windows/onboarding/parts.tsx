import { createStyles, Text } from '@mantine/core';
import React, { FunctionComponent, ReactNode } from 'react';

import lofiIcon from '../../../../icon.png';

// The guide's window is a blank page: the icon is found where the player's page is
export const ICON_URL = new URL(lofiIcon, window.location.href).href;

export const useGuideStyles = createStyles((theme) => ({
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: -0.3,
    color: '#1d1d1f',
  },
  subtitle: {
    marginTop: 6,
    maxWidth: 470,
    lineHeight: 1.45,
  },
  tile: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.white,
    boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.35), 0 1px 2px rgba(0, 0, 0, 0.15)',
  },
  // macOS style inset list: rows separated by hairlines
  card: {
    backgroundColor: theme.white,
    borderRadius: 12,
    border: '1px solid rgba(0, 0, 0, 0.07)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',

    '& > *': {
      padding: '12px 16px',
    },
    '& > * + *': {
      borderTop: '1px solid #ececf0',
    },
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  note: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: theme.fontSizes.sm,
    lineHeight: 1.45,

    '& > i': {
      marginTop: 3,
    },
  },
}));

// The colors of the notes, soft enough for the light window
const NOTE_COLORS = {
  info: { background: '#eef4ff', border: 'rgba(37, 99, 235, 0.2)', icon: '#2563eb' },
  warning: { background: '#fff8e6', border: 'rgba(249, 115, 22, 0.25)', icon: '#ea580c' },
  success: { background: '#ecfdf3', border: 'rgba(22, 163, 74, 0.25)', icon: '#16a34a' },
};

export const StepHeader: FunctionComponent<{ title: string; subtitle?: ReactNode }> = ({ title, subtitle }) => {
  const { classes } = useGuideStyles();
  return (
    <div className={classes.header}>
      <h1 className={classes.title}>{title}</h1>
      {subtitle && (
        <Text size="sm" color="dimmed" className={classes.subtitle}>
          {subtitle}
        </Text>
      )}
    </div>
  );
};

/** A rounded square with an icon on a gradient, like the ones in macOS's System Settings. */
export const Tile: FunctionComponent<{ icon: string; background: string; size?: number }> = ({
  icon,
  background,
  size = 32,
}) => {
  const { classes } = useGuideStyles();
  return (
    <span
      className={classes.tile}
      style={{ width: size, height: size, borderRadius: size * 0.26, fontSize: size * 0.45, background }}>
      <i className={icon} />
    </span>
  );
};

/** A tile with a title and what it's about next to it. */
export const TileItem: FunctionComponent<{ icon: string; background: string; title: string }> = ({
  icon,
  background,
  title,
  children,
}) => {
  const { classes } = useGuideStyles();
  return (
    <div className={classes.item}>
      <Tile icon={icon} background={background} />
      <div style={{ minWidth: 0 }}>
        <Text size="sm" weight={600}>
          {title}
        </Text>
        <Text size="xs" color="dimmed" style={{ lineHeight: 1.45 }}>
          {children}
        </Text>
      </div>
    </div>
  );
};

export const Note: FunctionComponent<{ icon: string; tone?: keyof typeof NOTE_COLORS }> = ({
  icon,
  tone = 'info',
  children,
}) => {
  const { classes } = useGuideStyles();
  const colors = NOTE_COLORS[tone];
  return (
    <div
      className={classes.note}
      style={{ backgroundColor: colors.background, boxShadow: `inset 0 0 0 1px ${colors.border}` }}>
      <i className={icon} style={{ color: colors.icon }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
};

export const GRADIENTS = {
  pink: 'linear-gradient(180deg, #f9a8d4, #db2777)',
  green: 'linear-gradient(180deg, #4ade80, #16a34a)',
  teal: 'linear-gradient(180deg, #5eead4, #0d9488)',
  blue: 'linear-gradient(180deg, #60a5fa, #2563eb)',
  orange: 'linear-gradient(180deg, #fdba74, #ea580c)',
  violet: 'linear-gradient(180deg, #c4b5fd, #7c3aed)',
  yellow: 'linear-gradient(180deg, #fde68a, #d97706)',
  gray: 'linear-gradient(180deg, #cbd5e1, #64748b)',
};
