import { createStyles, MantineColor } from '@mantine/core';
import React, { FunctionComponent } from 'react';

import { Band, DesignItem, Direction, ItemPlace } from '../../../models/player-design';
import { useSectionColor } from './fields';
import { getPalette } from './palette';

export const ITEM_INFO: Record<DesignItem, { name: string; icon: string }> = {
  [DesignItem.Settings]: { name: 'Settings', icon: 'fa-solid fa-gear' },
  [DesignItem.Visualizations]: { name: 'Next visualization', icon: 'fa-solid fa-palette' },
  [DesignItem.Logo]: { name: 'Lofi logo', icon: 'fa-solid fa-font' },
  [DesignItem.DragHandle]: { name: 'Drag handle', icon: 'fa-solid fa-grip-lines' },
  [DesignItem.Close]: { name: 'Close', icon: 'fa-solid fa-xmark' },
  [DesignItem.TrackInfo]: { name: 'Song', icon: 'fa-solid fa-music' },
  [DesignItem.Progress]: { name: 'Progress', icon: 'fa-solid fa-bars-progress' },
  [DesignItem.Like]: { name: 'Like', icon: 'fa-solid fa-heart' },
  [DesignItem.Repeat]: { name: 'Repeat', icon: 'fa-solid fa-repeat' },
  [DesignItem.Playback]: { name: 'Playback', icon: 'fa-solid fa-play' },
  [DesignItem.Volume]: { name: 'Volume', icon: 'fa-solid fa-volume-high' },
  [DesignItem.Visualizer]: { name: 'Visualization', icon: 'fa-solid fa-wave-square' },
  [DesignItem.About]: { name: 'About', icon: 'fa-solid fa-circle-question' },
};

const BAND_NAMES: Record<Band, string> = {
  [Band.Top]: 'Top',
  [Band.Middle]: 'Middle',
  [Band.Bottom]: 'Bottom',
};

export const describePlace = ({ band, row, slot }: ItemPlace): string => `${BAND_NAMES[band]}, row ${row + 1}, ${slot}`;

// The pad shows the item in the middle and where it can come from around it
const DIRECTION_PAD = [
  Direction.TopLeft,
  Direction.Top,
  Direction.TopRight,
  Direction.Left,
  Direction.None,
  Direction.Right,
  Direction.BottomLeft,
  Direction.Bottom,
  Direction.BottomRight,
];

export const DIRECTION_NAMES: Record<Direction, string> = {
  [Direction.TopLeft]: 'From the top left',
  [Direction.Top]: 'From above',
  [Direction.TopRight]: 'From the top right',
  [Direction.Left]: 'From the left',
  [Direction.None]: 'Fades in where it is',
  [Direction.Right]: 'From the right',
  [Direction.BottomLeft]: 'From the bottom left',
  [Direction.Bottom]: 'From below',
  [Direction.BottomRight]: 'From the bottom right',
};

// each arrow points from its side towards the item in the middle
const ARROW_ANGLES: Record<Direction, number> = {
  [Direction.TopLeft]: 45,
  [Direction.Top]: 90,
  [Direction.TopRight]: 135,
  [Direction.Left]: 0,
  [Direction.None]: 0,
  [Direction.Right]: 180,
  [Direction.BottomLeft]: -45,
  [Direction.Bottom]: -90,
  [Direction.BottomRight]: -135,
};

const useStyles = createStyles((theme, color: MantineColor) => {
  const accent = theme.colors[color][6];
  const palette = getPalette(theme);
  return {
    pad: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 28px)',
      gap: 4,
      flexShrink: 0,
    },
    padCell: {
      width: 28,
      height: 28,
      padding: 0,
      border: 'none',
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.well,
      color: palette.muted,
      fontSize: 11,
      cursor: 'pointer',
      transition: 'background-color 0.1s, color 0.1s',

      '&:hover': {
        backgroundColor: palette.wellHover,
        color: palette.strong,
      },
    },
    padCellActive: {
      backgroundColor: accent,
      color: theme.white,
      boxShadow: `0 1px 3px ${theme.fn.rgba(accent, 0.5)}`,

      '&:hover': {
        backgroundColor: accent,
        color: theme.white,
      },
    },
  };
});

export const DirectionPad: FunctionComponent<{ value: Direction; onChange: (direction: Direction) => void }> = ({
  value,
  onChange,
}) => {
  const { classes, cx } = useStyles(useSectionColor());
  return (
    <div className={classes.pad} role="radiogroup" aria-label="Comes in from">
      {DIRECTION_PAD.map((direction) => (
        <button
          key={direction}
          type="button"
          role="radio"
          aria-checked={direction === value}
          title={DIRECTION_NAMES[direction]}
          className={cx(classes.padCell, direction === value && classes.padCellActive)}
          onClick={() => onChange(direction)}>
          {direction === Direction.None ? (
            <i className="fa-solid fa-circle-dot" />
          ) : (
            <i className="fa-solid fa-arrow-right" style={{ transform: `rotate(${ARROW_ANGLES[direction]}deg)` }} />
          )}
        </button>
      ))}
    </div>
  );
};
