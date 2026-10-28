import { createStyles, MantineColor, Text } from '@mantine/core';
import { clamp, minBy } from 'lodash';
import React, { FunctionComponent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { MAX_CORNER_RADIUS, MAX_SIDE_LENGTH, MIN_SIDE_LENGTH } from '../../../constants';
import {
  Band,
  BANDS,
  CIRCLE_LOOKS,
  DEFAULT_ITEM_SIZE,
  DesignItem,
  DropTarget,
  findItem,
  getHiddenItems,
  hideItem,
  MAX_ITEM_SIZE,
  MIN_ITEM_SIZE,
  moveItem,
  PlayerDesign,
  Slot,
  SLOTS,
} from '../../../models/player-design';
import { getEdgeGeometry } from '../../app/edge-haze';
import { useWindowDocument } from '../../components';
import { observeSize } from '../../observe-size';
import { Segmented, SegmentOption, useSetting } from './design-controls';
import { ITEM_INFO } from './design-items';
import { DesignPreview } from './design-preview';
import { useSectionColor } from './fields';
import { getAccentText, getPalette } from './palette';
import { DesignHistory } from './use-design-history';

// a press only becomes a drag once the pointer moved this far, otherwise it picks the item
const DRAG_THRESHOLD = 4;
// how far around the player still counts as on it, further away an item is taken off the player
const DROP_MARGIN = 16;
// the top and bottom of a row add a new row above or below it, the rest puts the item into the row
const ROW_EDGE = 5;
// the center of a row reaches a little past its items
const CENTER_MARGIN = 6;
const LINE = 3;
const LINE_INSET = 6;
// the player is shown up to this much bigger than it is, with this much desk around it
const MAX_SCALE = 1.75;
const DESK_MARGIN = 36;
// under the player, for its size
const LABEL_ROOM = 24;
// the corner handle sits on the middle of the rounded corner's curve, at least this far in from the corner
const ARC_MIDDLE = 1 - Math.SQRT1_2;
const MIN_HANDLE_INSET = 9;
// a resized player becomes square within this many pixels of it
const SQUARE_SNAP = 6;
// a scroll this long over an item grows or shrinks it a step
const WHEEL_STEP = 40;
const SIZE_STEP = 10;

enum PreviewMode {
  Shown = 'shown',
  Idle = 'idle',
}

const PREVIEW_MODES: SegmentOption<PreviewMode>[] = [
  { value: PreviewMode.Shown, label: 'Controls', icon: 'fa-solid fa-hand-pointer', title: 'As it looks on hover' },
  {
    value: PreviewMode.Idle,
    label: 'Idle',
    icon: 'fa-solid fa-moon',
    title: 'As it looks without the pointer over it, hover the preview to show the controls',
  },
];

interface LineRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Drop = { target: DropTarget; line: LineRect } | { isHiding: true };

const contains = (rect: DOMRect, x: number, y: number, margin = 0): boolean =>
  x >= rect.left - margin && x <= rect.right + margin && y >= rect.top - margin && y <= rect.bottom + margin;

const getSlotAt = (x: number, rowRect: DOMRect, center: HTMLElement): Slot => {
  const centerRect = center.getBoundingClientRect();
  const middle = rowRect.left + rowRect.width / 2;
  // an empty center still takes the middle third of the row
  const [start, end] = center.children.length
    ? [centerRect.left - CENTER_MARGIN, centerRect.right + CENTER_MARGIN]
    : [middle - rowRect.width / 6, middle + rowRect.width / 6];
  if (x < start) {
    return Slot.Left;
  }
  return x > end ? Slot.Right : Slot.Center;
};

// Next to the items of a row: the line goes between the two items the pointer is between
const getSlotDrop = (band: Band, rowIndex: number, row: HTMLElement, x: number): Drop => {
  const rowRect = row.getBoundingClientRect();
  const slotElements = Object.fromEntries(
    SLOTS.map((slot) => [slot, row.querySelector<HTMLElement>(`[data-slot="${slot}"]`)])
  ) as Record<Slot, HTMLElement>;
  const slot = getSlotAt(x, rowRect, slotElements.center);
  const slotRect = slotElements[slot].getBoundingClientRect();
  const itemRects = (Array.from(slotElements[slot].children) as HTMLElement[]).map((item) =>
    item.getBoundingClientRect()
  );
  const index = itemRects.filter(({ left, width }) => left + width / 2 < x).length;

  let lineX: number;
  if (!itemRects.length) {
    lineX = {
      [Slot.Left]: slotRect.left,
      [Slot.Center]: slotRect.left + slotRect.width / 2,
      [Slot.Right]: slotRect.right,
    }[slot];
  } else if (index === 0) {
    lineX = itemRects[0].left;
  } else if (index === itemRects.length) {
    lineX = itemRects[index - 1].right;
  } else {
    lineX = (itemRects[index - 1].right + itemRects[index].left) / 2;
  }

  return {
    target: { band, row: rowIndex, slot, index, isNewRow: false },
    line: { left: lineX - LINE / 2, top: rowRect.top, width: LINE, height: rowRect.height },
  };
};

// Between rows, or in an empty band: a new row, on the side of the player the pointer is on
const getRowDrop = (
  band: Band,
  bandElement: HTMLElement,
  rowRects: DOMRect[],
  frame: DOMRect,
  x: number,
  y: number
): Drop => {
  const index = rowRects.filter(({ top, height }) => top + height / 2 < y).length;
  const third = frame.width / 3;
  const slot = SLOTS[clamp(Math.floor((x - frame.left) / third), 0, SLOTS.length - 1)];
  const bandRect = bandElement.getBoundingClientRect();

  let lineY: number;
  if (!rowRects.length) {
    lineY = {
      [Band.Top]: bandRect.bottom,
      [Band.Middle]: bandRect.top + bandRect.height / 2,
      [Band.Bottom]: bandRect.top,
    }[band];
  } else if (index === 0) {
    lineY = rowRects[0].top - 1;
  } else if (index === rowRects.length) {
    lineY = rowRects[index - 1].bottom + 1;
  } else {
    lineY = (rowRects[index - 1].bottom + rowRects[index].top) / 2;
  }

  return {
    target: { band, row: index, slot, index: 0, isNewRow: true },
    line: {
      left: frame.left + third * SLOTS.indexOf(slot) + LINE_INSET,
      top: lineY - LINE / 2,
      width: third - 2 * LINE_INSET,
      height: LINE,
    },
  };
};

const getDrop = (screen: HTMLElement, x: number, y: number, isPlaced: boolean): Drop => {
  const frame = screen.getBoundingClientRect();
  if (!contains(frame, x, y, DROP_MARGIN)) {
    return isPlaced ? { isHiding: true } : null;
  }

  // the band under the pointer, or else the closest one: an empty band is only a line
  const bands = BANDS.map((band) => ({
    band,
    element: screen.querySelector<HTMLElement>(`[data-band="${band}"]`),
  })).filter(({ element }) => element);
  const { band, element } = minBy(bands, ({ element: bandElement }) => {
    const { top, bottom } = bandElement.getBoundingClientRect();
    return Math.max(top - y, 0, y - bottom);
  });

  const rows = Array.from(element.children) as HTMLElement[];
  const rowRects = rows.map((row) => row.getBoundingClientRect());
  const rowIndex = rowRects.findIndex(({ top, height }) => {
    const edge = Math.min(ROW_EDGE, height * 0.2);
    return y >= top + edge && y <= top + height - edge;
  });

  return rowIndex >= 0
    ? getSlotDrop(band, rowIndex, rows[rowIndex], x)
    : getRowDrop(band, element, rowRects, frame, x, y);
};

interface DragState {
  item: DesignItem;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  isDragging: boolean;
  drop: Drop | null;
}

// the round handle on the corner and the one for resizing the player, each with where it started from
type HandleDrag =
  | { kind: 'corner'; startX: number; startY: number; startRadius: number }
  | { kind: 'size'; startX: number; startY: number; startWidth: number; startHeight: number; scale: number };

const useStyles = createStyles((theme, color: MantineColor) => {
  const accent = theme.colors[color][6];
  const palette = getPalette(theme);
  return {
    stagePane: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 16px',
      gap: 10,
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    modes: {
      width: 190,
    },
    toolButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 26,
      padding: '0 10px',
      border: `1px solid ${palette.buttonBorder}`,
      borderRadius: 7,
      backgroundColor: palette.button,
      color: palette.text,
      fontFamily: 'inherit',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',

      '&:hover:not(:disabled)': {
        backgroundColor: palette.buttonHover,
      },
      '&:disabled': {
        color: palette.faint,
        cursor: 'default',
      },
      '& i': {
        fontSize: 11,
      },
    },
    iconButton: {
      width: 28,
      padding: 0,
      justifyContent: 'center',
    },
    spacer: {
      flex: 1,
    },
    // a bit of desktop around the player, dotted like a canvas
    desk: {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      paddingBottom: LABEL_ROOM,
      borderRadius: 12,
      background: [`radial-gradient(${palette.deskDots} 1px, transparent 1.2px) 0 0 / 16px 16px`, palette.desk].join(
        ', '
      ),
      boxShadow: `inset 0 0 0 1px ${palette.cardBorder}`,
    },
    player: {
      position: 'relative',
    },
    handle: {
      position: 'absolute',
      zIndex: 10,
      width: 14,
      height: 14,
      margin: -7,
      padding: 0,
      border: `2px solid ${accent}`,
      borderRadius: '50%',
      backgroundColor: theme.white,
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.35)',
      cursor: 'nwse-resize',
      touchAction: 'none',
      opacity: 0,
      transition: 'opacity 0.15s, transform 0.1s',

      '&:hover': {
        transform: 'scale(1.2)',
      },
    },
    sizeHandle: {
      position: 'absolute',
      zIndex: 10,
      right: -12,
      bottom: -12,
      width: 22,
      height: 22,
      padding: 0,
      border: 'none',
      background: 'none',
      cursor: 'nwse-resize',
      touchAction: 'none',
      opacity: 0,
      transition: 'opacity 0.15s',

      // a bracket around the corner of the player
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 2,
        left: 2,
        width: 12,
        height: 12,
        borderRight: `3px solid ${accent}`,
        borderBottom: `3px solid ${accent}`,
        borderBottomRightRadius: 4,
        filter: 'drop-shadow(0 1px 1px rgba(255, 255, 255, 0.9))',
      },
    },
    handlesShown: {
      opacity: 1,
    },
    outline: {
      position: 'absolute',
      inset: -1,
      zIndex: 9,
      border: `1.5px dashed ${theme.fn.rgba(accent, 0.7)}`,
      borderRadius: 2,
      pointerEvents: 'none',
    },
    badge: {
      position: 'absolute',
      zIndex: 11,
      padding: '2px 8px',
      borderRadius: 999,
      backgroundColor: 'rgba(29, 29, 31, 0.85)',
      color: 'white',
      fontSize: 11,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
    sizeLabel: {
      position: 'absolute',
      left: '50%',
      bottom: 10,
      transform: 'translateX(-50%)',
      padding: '2px 10px',
      borderRadius: 999,
      backgroundColor: palette.pill,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
      color: palette.secondary,
      fontSize: 11,
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
    tray: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      padding: '6px 10px',
      borderRadius: 10,
      border: `1px dashed ${palette.dashed}`,
      transition: 'background-color 0.15s, border-color 0.15s',
    },
    trayTarget: {
      borderColor: accent,
      backgroundColor: theme.fn.rgba(accent, 0.08),
    },
    chip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 999,
      border: `1px solid ${palette.buttonBorder}`,
      backgroundColor: palette.button,
      fontSize: 12,
      cursor: 'grab',
      touchAction: 'none',

      '&:hover': {
        backgroundColor: palette.buttonHover,
      },

      '& i': {
        color: palette.muted,
        fontSize: 11,
      },
    },
    chipSelected: {
      borderColor: accent,
      boxShadow: `0 0 0 1px ${accent}`,
    },
    ghost: {
      position: 'fixed',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      backgroundColor: palette.raised,
      boxShadow: `0 6px 18px rgba(0, 0, 0, 0.2), 0 0 0 1px ${palette.cardBorder}`,
      color: palette.text,
      fontSize: 12,
      fontWeight: 600,
      pointerEvents: 'none',
      transform: 'translate(12px, 10px)',

      '& i': {
        color: getAccentText(theme, color),
      },
    },
    line: {
      position: 'fixed',
      zIndex: 999,
      borderRadius: LINE,
      backgroundColor: accent,
      boxShadow: '0 0 0 1.5px white, 0 1px 4px rgba(0, 0, 0, 0.4)',
      pointerEvents: 'none',
    },
  };
});

interface Props {
  design: PlayerDesign;
  // edits go through here: a built-in design isn't changed, it turns into the custom one
  onChange: (change: (design: PlayerDesign) => PlayerDesign) => void;
  selected?: DesignItem;
  onSelect: (item?: DesignItem) => void;
  // false while the controls go away and come back to show how they move
  isRevealed: boolean;
  onReplay: () => void;
  history: DesignHistory;
}

/**
 * The player to design, as big as there's room for: its items are dragged into place, or off it to hide them, and
 * scrolled over to resize them. Handles on its corners round them and resize the player.
 */
export const DesignStage: FunctionComponent<Props> = ({
  design,
  onChange,
  selected,
  onSelect,
  isRevealed,
  onReplay,
  history,
}) => {
  const color = useSectionColor();
  const { classes, cx, theme } = useStyles(color);
  const accent = theme.colors[color][6];
  const windowDocument = useWindowDocument();
  const deskRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [deskSize, setDeskSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<PreviewMode>(PreviewMode.Shown);
  const [isHovered, setIsHovered] = useState(false);
  const [isSongShown, setIsSongShown] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [handleDrag, setHandleDrag] = useState<HandleDrag | null>(null);
  const wheelDelta = useRef(0);

  const [width, setWidth] = useSetting('width');
  const [height, setHeight] = useSetting('height');
  const [isAlwaysSquare] = useSetting('isAlwaysSquare');
  const [cornerRadius, setCornerRadius] = useSetting('cornerRadius');
  const [isEdgeHazeEnabled] = useSetting('isEdgeHazeEnabled');
  const [edgeHaze] = useSetting('edgeHaze');
  const [isAlwaysShowControls] = useSetting('isAlwaysShowControls');
  const [isAlwaysShowTrackInfo] = useSetting('isAlwaysShowTrackInfo');
  const [songSeconds] = useSetting('showTrackInfoTemporarilyInSeconds');

  // the pointer listeners outlive renders, they read the latest values from here
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const latest = useRef({ design, onChange });
  latest.current = { design, onChange };

  useLayoutEffect(() => {
    const desk = deskRef.current;
    // the room inside, the label's room at the bottom is taken off later
    const measure = (): void => setDeskSize({ width: desk.clientWidth, height: desk.clientHeight });
    measure();
    return observeSize([desk], measure);
  }, []);

  // Idle, the song shows for as long as it does after a song change, to show what that looks like
  const isIdle = mode === PreviewMode.Idle && !isAlwaysShowControls;
  useEffect(() => {
    if (!isIdle || isHovered || isAlwaysShowTrackInfo || !songSeconds) {
      setIsSongShown(false);
      return undefined;
    }
    setIsSongShown(true);
    const timeoutId = setTimeout(() => setIsSongShown(false), songSeconds * 1000);
    return () => clearTimeout(timeoutId);
  }, [isAlwaysShowTrackInfo, isHovered, isIdle, songSeconds]);

  const fitScale =
    deskSize.width && width && height
      ? Math.min(
          (deskSize.width - 2 * DESK_MARGIN) / width,
          (deskSize.height - LABEL_ROOM - 2 * DESK_MARGIN) / height,
          MAX_SCALE
        )
      : 1;
  // while the player is resized it stays at the same scale, so the handle stays under the pointer
  const scale = Math.max(0.2, handleDrag?.kind === 'size' ? handleDrag.scale : fitScale);
  const isShowingControls = (!isIdle || isHovered || !!drag) && isRevealed;
  const isCircle = CIRCLE_LOOKS.includes(design.look);
  const shortSide = Math.min(width, height);
  // the haze rounds the corners too, at least as much as it's wide: the handle sits on the curve that shows
  const { radius: shownRadius } = getEdgeGeometry({ width, height }, cornerRadius, isEdgeHazeEnabled ? edgeHaze : 0);
  const shownRadiusPercent = Math.round((shownRadius / shortSide) * 100);
  const cornerInset = Math.max(MIN_HANDLE_INSET, shownRadius * ARC_MIDDLE * scale);
  const areHandlesShown = (isHovered && !drag) || !!handleDrag;

  const startDrag = useCallback(
    (item: DesignItem, event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !isRevealed) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const { clientX: x, clientY: y, pointerId } = event;
      setDrag({ item, pointerId, startX: x, startY: y, x, y, isDragging: false, drop: null });
    },
    [isRevealed]
  );

  // scrolling over an item grows or shrinks it, a step at a time however fine the scrolling
  const resizeItem = useCallback(
    (item: DesignItem, event: React.WheelEvent<HTMLElement>) => {
      wheelDelta.current += event.deltaY;
      if (Math.abs(wheelDelta.current) < WHEEL_STEP) {
        return;
      }
      const step = -Math.sign(wheelDelta.current) * SIZE_STEP;
      wheelDelta.current = 0;
      onSelect(item);
      onChange((previous) => ({
        ...previous,
        sizes: {
          ...previous.sizes,
          [item]: clamp((previous.sizes[item] ?? DEFAULT_ITEM_SIZE) + step, MIN_ITEM_SIZE, MAX_ITEM_SIZE),
        },
      }));
    },
    [onChange, onSelect]
  );

  const isPointerDown = !!drag;
  useEffect(() => {
    if (!isPointerDown) {
      return undefined;
    }

    const handleMove = (event: PointerEvent): void => {
      const { current } = dragRef;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }
      const { clientX: x, clientY: y } = event;
      const isDragging = current.isDragging || Math.hypot(x - current.startX, y - current.startY) > DRAG_THRESHOLD;
      const isPlaced = !!findItem(latest.current.design, current.item);
      const drop = isDragging ? getDrop(screenRef.current, x, y, isPlaced) : null;
      setDrag({ ...current, x, y, isDragging, drop });
    };

    const handleUp = (event: PointerEvent): void => {
      const { current } = dragRef;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }
      setDrag(null);
      onSelect(current.item);

      const { item, drop } = current;
      if (!current.isDragging || !drop) {
        return;
      }
      latest.current.onChange((previous) =>
        'isHiding' in drop ? hideItem(previous, item) : moveItem(previous, item, drop.target)
      );
    };

    const handleCancel = (): void => setDrag(null);

    windowDocument.addEventListener('pointermove', handleMove);
    windowDocument.addEventListener('pointerup', handleUp);
    windowDocument.addEventListener('pointercancel', handleCancel);
    return () => {
      windowDocument.removeEventListener('pointermove', handleMove);
      windowDocument.removeEventListener('pointerup', handleUp);
      windowDocument.removeEventListener('pointercancel', handleCancel);
    };
  }, [isPointerDown, onSelect, windowDocument]);

  const handleDeskPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!(event.target as HTMLElement).closest('[data-item], button')) {
        onSelect(undefined);
      }
    },
    [onSelect]
  );

  // The handles keep the pointer while they're dragged, wherever it goes
  const startHandleDrag = (event: React.PointerEvent<HTMLElement>, next: HandleDrag): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHandleDrag(next);
  };

  const moveHandle = (event: React.PointerEvent<HTMLElement>): void => {
    if (!handleDrag || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    const dx = event.clientX - handleDrag.startX;
    const dy = event.clientY - handleDrag.startY;

    if (handleDrag.kind === 'corner') {
      // along the diagonal, where the handle sits on the curve
      const radiusInPx = ((dx + dy) / 2 / ARC_MIDDLE / scale) * (100 / shortSide);
      setCornerRadius(Math.round(clamp(handleDrag.startRadius + radiusInPx, 0, MAX_CORNER_RADIUS)));
      return;
    }

    const { startWidth, startHeight } = handleDrag;
    // no bigger than the desk has room for at this scale, the next drag can make it bigger still
    const maxWidth = Math.floor(Math.min(MAX_SIDE_LENGTH, (deskSize.width - DESK_MARGIN) / scale));
    const maxHeight = Math.floor(Math.min(MAX_SIDE_LENGTH, (deskSize.height - LABEL_ROOM - DESK_MARGIN) / scale));
    // the player stays in the middle of the desk, it grows on both sides to keep its corner under the pointer
    let nextWidth = clamp(Math.round(startWidth + (2 * dx) / scale), MIN_SIDE_LENGTH, maxWidth);
    let nextHeight = clamp(Math.round(startHeight + (2 * dy) / scale), MIN_SIDE_LENGTH, maxHeight);
    if (isAlwaysSquare) {
      // along the diagonal, the corner stays on it
      const side = clamp(Math.round(startWidth + (dx + dy) / scale), MIN_SIDE_LENGTH, Math.min(maxWidth, maxHeight));
      nextWidth = side;
      nextHeight = side;
    } else if (event.shiftKey) {
      // the same shape, bigger or smaller
      const ratio = Math.max(nextWidth / startWidth, nextHeight / startHeight);
      nextWidth = clamp(Math.round(startWidth * ratio), MIN_SIDE_LENGTH, maxWidth);
      nextHeight = clamp(Math.round(startHeight * ratio), MIN_SIDE_LENGTH, maxHeight);
    } else if (Math.abs(nextWidth - nextHeight) <= SQUARE_SNAP) {
      nextHeight = nextWidth;
    }
    setWidth(Math.round(nextWidth));
    setHeight(Math.round(nextHeight));
  };

  const endHandleDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setHandleDrag(null);
  };

  const hiddenItems = getHiddenItems(design);
  const isDragging = !!drag?.isDragging;
  const isHidingTarget = isDragging && !!drag.drop && 'isHiding' in drag.drop;
  const dropLine = isDragging && drag.drop && 'line' in drag.drop ? drag.drop.line : null;

  let trayHint = 'Everything is on the player. Drag something off it to hide it.';
  if (isHidingTarget) {
    trayHint = `Let go to hide ${ITEM_INFO[drag.item].name.toLowerCase()}`;
  } else if (hiddenItems.length) {
    trayHint = 'Not on the player, drag onto it to add:';
  }

  let sizeLabel = `${width} × ${height}`;
  if (handleDrag?.kind === 'size') {
    sizeLabel += isAlwaysSquare ? ' · kept square' : ' · Shift keeps the shape';
  } else if (isIdle) {
    sizeLabel += ' · hover to show the controls';
  } else {
    sizeLabel += ' · drag to move · scroll to resize';
  }

  return (
    <div className={classes.stagePane}>
      <div className={classes.toolbar}>
        <div className={classes.modes}>
          <Segmented
            label="Preview"
            value={isAlwaysShowControls ? PreviewMode.Shown : mode}
            options={PREVIEW_MODES}
            onChange={(next) => setMode(next)}
          />
        </div>
        <button
          type="button"
          title="Hide the controls and bring them back, to see how they move"
          className={classes.toolButton}
          disabled={!isRevealed}
          onClick={() => {
            setMode(PreviewMode.Shown);
            onReplay();
          }}>
          <i className="fa-solid fa-play" />
          Replay
        </button>
        <div className={classes.spacer} />
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className={cx(classes.toolButton, classes.iconButton)}
          disabled={!history.canUndo}
          onClick={history.undo}>
          <i className="fa-solid fa-rotate-left" />
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          className={cx(classes.toolButton, classes.iconButton)}
          disabled={!history.canRedo}
          onClick={history.redo}>
          <i className="fa-solid fa-rotate-right" />
        </button>
      </div>

      <div ref={deskRef} className={classes.desk} onPointerDown={handleDeskPointerDown}>
        <div
          className={classes.player}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}>
          <DesignPreview
            ref={screenRef}
            design={design}
            scale={scale}
            isRevealed={isShowingControls}
            isShowingTrackInfo={isSongShown}
            isDetailed
            editor={{
              selected,
              dragged: isDragging ? drag.item : undefined,
              onItemPointerDown: startDrag,
              onItemWheel: resizeItem,
            }}
            style={{ ['--selection-color' as string]: accent, opacity: isHidingTarget ? 0.6 : 1 }}
          />

          {handleDrag?.kind === 'size' && <div className={classes.outline} />}
          {!isCircle && (
            <button
              type="button"
              aria-label="Round the corners"
              title="Drag to round the corners"
              className={cx(classes.handle, areHandlesShown && classes.handlesShown)}
              style={{ left: cornerInset, top: cornerInset }}
              onPointerDown={(event) =>
                startHandleDrag(event, {
                  kind: 'corner',
                  startX: event.clientX,
                  startY: event.clientY,
                  startRadius: Math.max(cornerRadius, shownRadiusPercent),
                })
              }
              onPointerMove={moveHandle}
              onPointerUp={endHandleDrag}
              onPointerCancel={endHandleDrag}
            />
          )}
          {handleDrag?.kind === 'corner' && (
            <span className={classes.badge} style={{ left: cornerInset + 12, top: cornerInset + 12 }}>
              {cornerRadius === MAX_CORNER_RADIUS && 'Circle'}
              {cornerRadius > 0 && cornerRadius < MAX_CORNER_RADIUS && `Corners ${cornerRadius}%`}
              {!cornerRadius && (shownRadius ? 'Square, the haze rounds it' : 'Square')}
            </span>
          )}
          <button
            type="button"
            aria-label="Resize the player"
            title="Drag to resize the player"
            className={cx(classes.sizeHandle, areHandlesShown && classes.handlesShown)}
            onPointerDown={(event) =>
              startHandleDrag(event, {
                kind: 'size',
                startX: event.clientX,
                startY: event.clientY,
                startWidth: width,
                startHeight: height,
                scale,
              })
            }
            onPointerMove={moveHandle}
            onPointerUp={endHandleDrag}
            onPointerCancel={endHandleDrag}
          />
        </div>
        <span className={classes.sizeLabel}>{sizeLabel}</span>
      </div>

      <div className={cx(classes.tray, isHidingTarget && classes.trayTarget)}>
        <Text size="xs" color="dimmed" mr={2}>
          {trayHint}
        </Text>
        {hiddenItems.map((item) => (
          <div
            key={item}
            role="button"
            tabIndex={0}
            className={cx(classes.chip, selected === item && classes.chipSelected)}
            onPointerDown={(event) => startDrag(item, event)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                onSelect(item);
              }
            }}>
            <i className={ITEM_INFO[item].icon} />
            {ITEM_INFO[item].name}
          </div>
        ))}
      </div>

      {isDragging &&
        ReactDOM.createPortal(
          <>
            {dropLine && <div className={classes.line} style={dropLine} />}
            <div className={classes.ghost} style={{ left: drag.x, top: drag.y }}>
              <i className={isHidingTarget ? 'fa-solid fa-eye-slash' : ITEM_INFO[drag.item].icon} />
              {isHidingTarget ? `Hide ${ITEM_INFO[drag.item].name.toLowerCase()}` : ITEM_INFO[drag.item].name}
            </div>
          </>,
          windowDocument.body
        )}
    </div>
  );
};
