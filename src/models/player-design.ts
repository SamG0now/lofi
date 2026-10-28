import { clamp, cloneDeep, isEqual } from 'lodash';

// The player's look: built-in designs, and one of the user's own that starts as a copy of any of them
export enum DesignPreset {
  Modern = 'modern',
  Retro = 'retro',
  Halftone = 'halftone',
  Ascii = 'ascii',
  Vinyl = 'vinyl',
  Pulse = 'pulse',
  Ncs = 'ncs',
  Custom = 'custom',
}

export type BuiltInPreset = Exclude<DesignPreset, DesignPreset.Custom>;

// Everything that can be placed on the player
export enum DesignItem {
  Settings = 'settings',
  Visualizations = 'visualizations',
  Logo = 'logo',
  DragHandle = 'dragHandle',
  Close = 'close',
  TrackInfo = 'trackInfo',
  Progress = 'progress',
  Like = 'like',
  Repeat = 'repeat',
  Playback = 'playback',
  Volume = 'volume',
  Visualizer = 'visualizer',
  About = 'about',
}

// The player is split into three bands stacked on top of each other. Each holds rows, and each row holds items on
// its left, in its center and on its right, so a design looks the same whatever the size of the player.
export enum Band {
  Top = 'top',
  Middle = 'middle',
  Bottom = 'bottom',
}

export enum Slot {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}

export const BANDS = [Band.Top, Band.Middle, Band.Bottom];
export const SLOTS = [Slot.Left, Slot.Center, Slot.Right];

export type DesignRow = Record<Slot, DesignItem[]>;
export type DesignBands = Record<Band, DesignRow[]>;

// Where an item comes in from when the controls show, it leaves the same way
export enum Direction {
  TopLeft = 'top-left',
  Top = 'top',
  TopRight = 'top-right',
  Left = 'left',
  None = 'none',
  Right = 'right',
  BottomLeft = 'bottom-left',
  Bottom = 'bottom',
  BottomRight = 'bottom-right',
}

export interface ItemMotion {
  from: Direction;
  // how far away it starts, in pixels
  distance: number;
  // seconds after the controls start showing
  delay: number;
  // starts out smaller and grows to its size on the way
  isGrowing: boolean;
}

// The buttons, icons and song box, and how the album art shows: Modern's plain icons, the original player's ringed
// buttons, everything printed in dots or typed in characters of a single ink, a spinning record, art and controls
// that bump with the beat, or the whole player as NCS's circle with the song in a hazy cloud
export enum DesignLook {
  Modern = 'modern',
  Retro = 'retro',
  Halftone = 'halftone',
  Ascii = 'ascii',
  Vinyl = 'vinyl',
  Pulse = 'pulse',
  Ncs = 'ncs',
}

// the looks that make the player a circle whatever its corners, blending into the desktop around it
export const CIRCLE_LOOKS = [DesignLook.Ncs];
// their edge fades out at least this many pixels, even without the edge haze
export const CIRCLE_MIN_HAZE = 16;

// the looks in a single ink on paper, from the album art or the user's own color
export const INKED_LOOKS = [DesignLook.Halftone, DesignLook.Ascii];

// the looks whose controls glow in the cover's colors and bump with each beat
export const PULSE_LOOKS = [DesignLook.Pulse, DesignLook.Ncs];

// What's behind the controls to keep them readable on any album art
export enum Backdrop {
  // frosted glass rising from the bottom, and a light shade along the top
  Fog = 'fog',
  // the whole art dims and blurs
  Veil = 'veil',
  // the whole art fades into the background, without blurring it
  Fade = 'fade',
  Clear = 'clear',
}

export interface PlayerDesign {
  look: DesignLook;
  backdrop: Backdrop;
  // thin progress and volume bars along the player's edges while the controls show
  hasEdgeBars: boolean;
  // of all animations, in percent of Modern's
  speed: number;
  // the buttons on each side of the rows below the top share its room, instead of keeping to the edge
  isSpread: boolean;
  // the bottom row bends up along the player's rounded corners
  isCurved: boolean;
  bands: DesignBands;
  motion: Record<DesignItem, ItemMotion>;
  // in percent of each item's usual size
  sizes: Record<DesignItem, number>;
}

export const MIN_SPEED = 25;
export const MAX_SPEED = 400;
export const MAX_DISTANCE = 80;
export const MAX_DELAY = 1;
export const MIN_ITEM_SIZE = 50;
export const MAX_ITEM_SIZE = 200;
export const DEFAULT_ITEM_SIZE = 100;

export const ITEMS = Object.values(DesignItem);
const DIRECTIONS = Object.values(Direction);

const usualSizes = (): Record<DesignItem, number> =>
  Object.fromEntries(ITEMS.map((item) => [item, DEFAULT_ITEM_SIZE])) as Record<DesignItem, number>;

// the song and the progress stretch out over the room their row leaves them
export const STRETCHED_ITEMS = [DesignItem.TrackInfo, DesignItem.Progress];

const row = (left: DesignItem[] = [], center: DesignItem[] = [], right: DesignItem[] = []): DesignRow => ({
  left,
  center,
  right,
});

const motion = (from: Direction, distance: number, delay: number): ItemMotion => ({
  from,
  distance,
  delay,
  isGrowing: false,
});

// The top row slides down a little, then the song, the progress and the buttons rise one row after the other
const MODERN_TOP = motion(Direction.Top, 6, 0.05);
const MODERN_BUTTONS = motion(Direction.Bottom, 12, 0.2);

export const MODERN_DESIGN: PlayerDesign = {
  look: DesignLook.Modern,
  backdrop: Backdrop.Fog,
  hasEdgeBars: false,
  speed: 100,
  isSpread: true,
  isCurved: true,
  bands: {
    [Band.Top]: [row([DesignItem.Settings, DesignItem.Visualizations], [DesignItem.DragHandle], [DesignItem.Close])],
    [Band.Middle]: [],
    [Band.Bottom]: [
      row([], [DesignItem.TrackInfo]),
      row([], [DesignItem.Progress]),
      row([DesignItem.Like, DesignItem.Repeat], [DesignItem.Playback], [DesignItem.Volume, DesignItem.Visualizer]),
    ],
  },
  motion: {
    [DesignItem.Settings]: MODERN_TOP,
    [DesignItem.Visualizations]: MODERN_TOP,
    [DesignItem.Logo]: MODERN_TOP,
    [DesignItem.DragHandle]: MODERN_TOP,
    [DesignItem.Close]: MODERN_TOP,
    [DesignItem.TrackInfo]: motion(Direction.Bottom, 12, 0.08),
    [DesignItem.Progress]: motion(Direction.Bottom, 12, 0.14),
    [DesignItem.Like]: MODERN_BUTTONS,
    [DesignItem.Repeat]: MODERN_BUTTONS,
    [DesignItem.Playback]: MODERN_BUTTONS,
    [DesignItem.Volume]: MODERN_BUTTONS,
    [DesignItem.Visualizer]: MODERN_BUTTONS,
    [DesignItem.About]: MODERN_BUTTONS,
  },
  sizes: usualSizes(),
};

// The original player: everything fades in quickly where it is
const RETRO_FADE = motion(Direction.None, 8, 0);

export const RETRO_DESIGN: PlayerDesign = {
  look: DesignLook.Retro,
  backdrop: Backdrop.Veil,
  hasEdgeBars: true,
  speed: 300,
  isSpread: false,
  isCurved: false,
  bands: {
    [Band.Top]: [row([DesignItem.Settings, DesignItem.Logo], [], [DesignItem.Close])],
    [Band.Middle]: [row([], [DesignItem.Playback]), row([], [DesignItem.Like])],
    [Band.Bottom]: [row([], [DesignItem.TrackInfo]), row([DesignItem.Visualizer], [], [DesignItem.About])],
  },
  motion: Object.fromEntries(ITEMS.map((item) => [item, RETRO_FADE])) as Record<DesignItem, ItemMotion>,
  sizes: usualSizes(),
};

// Modern's layout printed in dots: everything pops up where it is, row after row
export const HALFTONE_DESIGN: PlayerDesign = {
  look: DesignLook.Halftone,
  backdrop: Backdrop.Fade,
  hasEdgeBars: false,
  speed: 125,
  isSpread: true,
  isCurved: true,
  bands: cloneDeep(MODERN_DESIGN.bands),
  motion: Object.fromEntries(
    ITEMS.map((item) => [item, { ...MODERN_DESIGN.motion[item], from: Direction.None, isGrowing: true }])
  ) as Record<DesignItem, ItemMotion>,
  sizes: usualSizes(),
};

// A terminal: the lofi prompt on top, everything printed in place line after line
const printed = (delay: number): ItemMotion => motion(Direction.None, 0, delay);

export const ASCII_DESIGN: PlayerDesign = {
  look: DesignLook.Ascii,
  backdrop: Backdrop.Fade,
  hasEdgeBars: false,
  speed: 150,
  isSpread: false,
  isCurved: false,
  bands: {
    [Band.Top]: [row([DesignItem.Settings, DesignItem.Visualizations], [DesignItem.Logo], [DesignItem.Close])],
    [Band.Middle]: [],
    [Band.Bottom]: cloneDeep(MODERN_DESIGN.bands.bottom),
  },
  motion: Object.fromEntries(
    ITEMS.map((item) => {
      const rowDelays: Partial<Record<DesignItem, number>> = {
        [DesignItem.TrackInfo]: 0.06,
        [DesignItem.Progress]: 0.12,
      };
      const isTop = MODERN_DESIGN.motion[item].from === Direction.Top;
      return [item, printed(rowDelays[item] ?? (isTop ? 0 : 0.18))];
    })
  ) as Record<DesignItem, ItemMotion>,
  sizes: usualSizes(),
};

// The playback buttons sit on the record's label, the song and a row of the rest under the record
export const VINYL_DESIGN: PlayerDesign = {
  look: DesignLook.Vinyl,
  backdrop: Backdrop.Fade,
  hasEdgeBars: false,
  speed: 100,
  isSpread: false,
  isCurved: false,
  bands: {
    [Band.Top]: cloneDeep(MODERN_DESIGN.bands.top),
    [Band.Middle]: [row([], [DesignItem.Playback])],
    [Band.Bottom]: [
      row([], [DesignItem.TrackInfo]),
      row([DesignItem.Like, DesignItem.Repeat], [DesignItem.Progress], [DesignItem.Volume, DesignItem.Visualizer]),
    ],
  },
  motion: {
    ...MODERN_DESIGN.motion,
    [DesignItem.Playback]: { ...motion(Direction.None, 0, 0.1), isGrowing: true },
    [DesignItem.TrackInfo]: motion(Direction.Bottom, 12, 0.12),
    [DesignItem.Progress]: MODERN_BUTTONS,
  },
  sizes: usualSizes(),
};

// Modern's layout, bouncing up into place
export const PULSE_DESIGN: PlayerDesign = {
  look: DesignLook.Pulse,
  backdrop: Backdrop.Fade,
  hasEdgeBars: false,
  speed: 150,
  isSpread: true,
  isCurved: true,
  bands: cloneDeep(MODERN_DESIGN.bands),
  motion: Object.fromEntries(
    ITEMS.map((item) => [item, { ...MODERN_DESIGN.motion[item], from: Direction.Bottom, distance: 8, isGrowing: true }])
  ) as Record<DesignItem, ItemMotion>,
  sizes: usualSizes(),
};

// The circle fills the player: the settings and close on top, playback on the spinning album, the song and its
// progress floating up out of the haze below it
export const NCS_DESIGN: PlayerDesign = {
  look: DesignLook.Ncs,
  backdrop: Backdrop.Clear,
  hasEdgeBars: false,
  speed: 100,
  isSpread: false,
  isCurved: false,
  bands: {
    [Band.Top]: [row([DesignItem.Settings], [DesignItem.DragHandle], [DesignItem.Close])],
    [Band.Middle]: [row([], [DesignItem.Playback])],
    [Band.Bottom]: [
      row([], [DesignItem.TrackInfo]),
      row([DesignItem.Like], [DesignItem.Progress], [DesignItem.Volume]),
    ],
  },
  motion: {
    ...MODERN_DESIGN.motion,
    [DesignItem.Playback]: { ...motion(Direction.None, 0, 0.12), isGrowing: true },
    [DesignItem.TrackInfo]: { ...motion(Direction.Bottom, 16, 0.06), isGrowing: true },
    [DesignItem.Progress]: { ...motion(Direction.Bottom, 12, 0.16), isGrowing: true },
    [DesignItem.Like]: motion(Direction.Left, 12, 0.22),
    [DesignItem.Volume]: motion(Direction.Right, 12, 0.22),
  },
  sizes: usualSizes(),
};

export const DESIGN_PRESETS: Record<BuiltInPreset, PlayerDesign> = {
  [DesignPreset.Modern]: MODERN_DESIGN,
  [DesignPreset.Retro]: RETRO_DESIGN,
  [DesignPreset.Halftone]: HALFTONE_DESIGN,
  [DesignPreset.Ascii]: ASCII_DESIGN,
  [DesignPreset.Vinyl]: VINYL_DESIGN,
  [DesignPreset.Pulse]: PULSE_DESIGN,
  [DesignPreset.Ncs]: NCS_DESIGN,
};

// the built-in design each look comes from
const LOOK_DESIGNS: Record<DesignLook, PlayerDesign> = {
  [DesignLook.Modern]: MODERN_DESIGN,
  [DesignLook.Retro]: RETRO_DESIGN,
  [DesignLook.Halftone]: HALFTONE_DESIGN,
  [DesignLook.Ascii]: ASCII_DESIGN,
  [DesignLook.Vinyl]: VINYL_DESIGN,
  [DesignLook.Pulse]: PULSE_DESIGN,
  [DesignLook.Ncs]: NCS_DESIGN,
};

const isItem = (value: unknown): value is DesignItem => ITEMS.includes(value as DesignItem);

const toNumber = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;

const isRowFilled = (designRow: DesignRow): boolean => SLOTS.some((slot) => designRow[slot].length > 0);

const toMotion = (value: unknown, fallback: ItemMotion): ItemMotion => {
  const { from, distance, delay, isGrowing } = (value ?? {}) as Partial<ItemMotion>;
  return {
    from: DIRECTIONS.includes(from) ? from : fallback.from,
    distance: toNumber(distance, 0, MAX_DISTANCE, fallback.distance),
    delay: toNumber(delay, 0, MAX_DELAY, fallback.delay),
    isGrowing: typeof isGrowing === 'boolean' ? isGrowing : fallback.isGrowing,
  };
};

// The settings file can be edited by hand or come from an older version: whatever isn't valid falls back to Modern
export const normalizeDesign = (value: unknown): PlayerDesign => {
  if (!value || typeof value !== 'object') {
    return cloneDeep(MODERN_DESIGN);
  }

  const design = value as Partial<PlayerDesign>;
  // an item is only shown once, the first time it comes up
  const placed = new Set<DesignItem>();
  const toItems = (items: unknown): DesignItem[] =>
    (Array.isArray(items) ? items : []).filter((item) => {
      if (!isItem(item) || placed.has(item)) {
        return false;
      }
      placed.add(item);
      return true;
    });
  const toRows = (rows: unknown): DesignRow[] =>
    (Array.isArray(rows) ? rows : [])
      .map((designRow) => {
        const { left, center, right } = (designRow ?? {}) as Partial<DesignRow>;
        return row(toItems(left), toItems(center), toItems(right));
      })
      .filter(isRowFilled);
  const bands = (design.bands ?? {}) as Partial<DesignBands>;
  const look = Object.values(DesignLook).includes(design.look) ? design.look : MODERN_DESIGN.look;
  // designs saved before these could be changed keep what their look's built-in design does
  const lookDesign = LOOK_DESIGNS[look];

  return {
    look,
    backdrop: Object.values(Backdrop).includes(design.backdrop) ? design.backdrop : MODERN_DESIGN.backdrop,
    hasEdgeBars: typeof design.hasEdgeBars === 'boolean' ? design.hasEdgeBars : MODERN_DESIGN.hasEdgeBars,
    speed: toNumber(design.speed, MIN_SPEED, MAX_SPEED, MODERN_DESIGN.speed),
    isSpread: typeof design.isSpread === 'boolean' ? design.isSpread : lookDesign.isSpread,
    isCurved: typeof design.isCurved === 'boolean' ? design.isCurved : lookDesign.isCurved,
    bands: {
      [Band.Top]: toRows(bands.top),
      [Band.Middle]: toRows(bands.middle),
      [Band.Bottom]: toRows(bands.bottom),
    },
    motion: Object.fromEntries(
      ITEMS.map((item) => [item, toMotion(design.motion?.[item], MODERN_DESIGN.motion[item])])
    ) as Record<DesignItem, ItemMotion>,
    sizes: Object.fromEntries(
      ITEMS.map((item) => [item, toNumber(design.sizes?.[item], MIN_ITEM_SIZE, MAX_ITEM_SIZE, DEFAULT_ITEM_SIZE)])
    ) as Record<DesignItem, number>,
  };
};

export const resolveDesign = (preset: DesignPreset, customDesign: unknown): PlayerDesign => {
  if (preset === DesignPreset.Custom) {
    return normalizeDesign(customDesign);
  }
  return DESIGN_PRESETS[preset] ?? MODERN_DESIGN;
};

// a custom design that's still a plain copy of a built-in one has nothing to lose when it's replaced
export const isBuiltInCopy = (design: unknown): boolean => {
  const normalized = normalizeDesign(design);
  return Object.values(DESIGN_PRESETS).some((preset) => isEqual(preset, normalized));
};

export interface ItemPlace {
  band: Band;
  row: number;
  slot: Slot;
  index: number;
}

export const findItem = (design: PlayerDesign, item: DesignItem): ItemPlace | null =>
  BANDS.flatMap((band) =>
    design.bands[band].flatMap((designRow, rowIndex) =>
      SLOTS.map((slot) => ({ band, row: rowIndex, slot, index: designRow[slot].indexOf(item) }))
    )
  ).find(({ index }) => index >= 0) ?? null;

export const getHiddenItems = (design: PlayerDesign): DesignItem[] => ITEMS.filter((item) => !findItem(design, item));

// Where an item goes: into a row next to the items already there, or into a new row of its own
export interface DropTarget extends ItemPlace {
  // a new row is added before `row`, `index` is unused
  isNewRow: boolean;
}

// marks the spot an item moves to while it's taken out of where it was
const PLACEHOLDER = '' as DesignItem;

const mapItems = (bands: DesignBands, change: (items: DesignItem[]) => DesignItem[]): DesignBands =>
  Object.fromEntries(
    BANDS.map((band) => [
      band,
      bands[band]
        .map((designRow) => row(change(designRow.left), change(designRow.center), change(designRow.right)))
        .filter(isRowFilled),
    ])
  ) as DesignBands;

export const hideItem = (design: PlayerDesign, item: DesignItem): PlayerDesign => ({
  ...design,
  bands: mapItems(design.bands, (items) => items.filter((other) => other !== item)),
});

export const moveItem = (design: PlayerDesign, item: DesignItem, target: DropTarget): PlayerDesign => {
  const bands = cloneDeep(design.bands);
  const rows = bands[target.band];
  if (target.isNewRow || !rows[target.row]) {
    rows.splice(clamp(target.row, 0, rows.length), 0, { ...row(), [target.slot]: [PLACEHOLDER] });
  } else {
    const items = rows[target.row][target.slot];
    items.splice(clamp(target.index, 0, items.length), 0, PLACEHOLDER);
  }

  return {
    ...design,
    bands: mapItems(bands, (items) =>
      items.filter((other) => other !== item).map((other) => (other === PLACEHOLDER ? item : other))
    ),
  };
};

// A hidden item comes back where the built-in designs have it, the ones with this design's look first
export const showItem = (design: PlayerDesign, item: DesignItem): PlayerDesign => {
  const sameLook = Object.values(DESIGN_PRESETS).filter((preset) => preset.look === design.look);
  const presets = [...sameLook, MODERN_DESIGN, RETRO_DESIGN];
  const place = presets.map((preset) => findItem(preset, item)).find(Boolean) ?? {
    band: Band.Top,
    row: 0,
    slot: Slot.Right,
    index: 0,
  };
  const rows = design.bands[place.band];
  // the preset's row may not exist here: the item gets its own row on the side of the band facing the edge
  const hasRow = place.row < rows.length;
  return moveItem(design, item, {
    ...place,
    row: hasRow || place.band !== Band.Top ? Math.min(place.row, rows.length) : 0,
    isNewRow: !hasRow,
  });
};
