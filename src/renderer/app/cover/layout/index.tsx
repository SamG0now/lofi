import React, {
  CSSProperties,
  FunctionComponent,
  PointerEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent,
} from 'react';
import styled, { css } from 'styled-components';

import { LINUX, WINDOWS } from '../../../../constants';
import {
  Backdrop,
  Band,
  BANDS,
  DEFAULT_ITEM_SIZE,
  DesignItem,
  DesignLook,
  DesignRow,
  Direction,
  findItem,
  INKED_LOOKS,
  PlayerDesign,
  Slot,
  SLOTS,
  STRETCHED_ITEMS,
} from '../../../../models/player-design';
import { FontStyle } from '../../../../models/settings';
import { isHexColor, withAlpha } from '../../../colors';
import { observeSize } from '../../../observe-size';
import { MONOSPACE } from '../art/ascii';
import { ItemContent } from './items';
import { PlayerActions, PlayerData } from './models';
import {
  FADE,
  FADE_S,
  getEntranceTransform,
  getItemSteps,
  getSinkTransition,
  getStayTransition,
  getTiming,
  getTransitions,
  GLIDE,
  GLIDE_S,
  REVEALED,
  Step,
  Timing,
} from './motion';

export type { PlayerActions, PlayerData } from './models';

// The look beyond the design's layout and motion, the same for every design
export interface LayoutStyle {
  // of what's switched on, each look has its own otherwise
  accent?: string;
  // of the text and icons, in percent
  controlScale: number;
  fontStyle: FontStyle;
  // of the backdrop's shade and blur, in percent
  backdropStrength: number;
}

export const DEFAULT_LAYOUT_STYLE: LayoutStyle = {
  controlScale: 100,
  fontStyle: FontStyle.Inter,
  backdropStrength: 100,
};

export const FONT_FAMILIES: Record<FontStyle, string> = {
  [FontStyle.Inter]: "'Inter UI', sans-serif",
  [FontStyle.System]: "system-ui, -apple-system, 'Segoe UI', 'Noto Sans', Cantarell, sans-serif",
  [FontStyle.Serif]: "'Iowan Old Style', 'Palatino Linotype', 'Noto Serif', 'DejaVu Serif', Georgia, serif",
  [FontStyle.Mono]: MONOSPACE,
  [FontStyle.Condensed]: "'Fira Sans Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif",
};

// visualizations need the native audio capture
const HAS_VISUALIZATIONS = WINDOWS || LINUX;

// The player can have any size, the design follows it: rows full of buttons move them closer together in narrow
// players and drop the secondary ones in very narrow ones, short players tighten the rows
const NARROW_WIDTH = 200;
const VERY_NARROW_WIDTH = 160;
const SHORT_HEIGHT = 150;
// how much room an item takes in a row, to tell rows full of buttons
const ITEM_WEIGHTS: Partial<Record<DesignItem, number>> = {
  [DesignItem.Playback]: 3,
  [DesignItem.Logo]: 2,
  [DesignItem.DragHandle]: 2,
  [DesignItem.TrackInfo]: 4,
  [DesignItem.Progress]: 4,
};
const CROWDED_WEIGHT = 6;

// distance kept from the player's edges, which may be faded or rounded
const SAFE_X = 'max(12px, var(--edge-haze, 0px), var(--corner-inset-x, 0px))';
const SAFE_Y = 'max(8px, var(--edge-haze, 0px), var(--corner-inset-y, 0px))';
// the top band sits closer to the top edge, and so further in from the rounded corners
const TOP_PADDING_X = 'max(0.4em, var(--edge-haze, 0px), var(--corner-inset-top-x, 0px))';
const TOP_PADDING_Y = 'max(0.1em, var(--edge-haze, 0px), var(--corner-inset-top-y, 0px))';
const BAND_PADDINGS: Record<Band, string> = {
  [Band.Top]: `${TOP_PADDING_Y} ${TOP_PADDING_X} 0`,
  [Band.Middle]: `0 ${SAFE_X}`,
  [Band.Bottom]: `0 ${SAFE_X} ${SAFE_Y}`,
};
const SLOT_COLUMNS: Record<Slot, number> = { [Slot.Left]: 1, [Slot.Center]: 2, [Slot.Right]: 3 };
const SLOT_JUSTIFY: Record<Slot, string> = {
  [Slot.Left]: 'flex-start',
  [Slot.Center]: 'center',
  [Slot.Right]: 'flex-end',
};

const SHADE_STEPS: Step[] = [['opacity', 0.4, FADE]];
const FOG_FADE: Step = ['opacity', 0.5, FADE];
const FOG_BLUR: Step = ['backdrop-filter', 0.6, FADE];
const FOG_GLIDE: Step = ['transform', GLIDE_S, GLIDE];
// the backdrops shade and blur the art as much as the backdrop strength says
const STRENGTH = 'var(--backdrop-strength, 1)';
const shade = (alpha: number): string => `rgba(0, 0, 0, calc(${alpha} * ${STRENGTH}))`;
const FOG_FILTER = `blur(calc(16px * ${STRENGTH})) saturate(calc(1 + 0.4 * ${STRENGTH}))`;
const VEIL_STEPS: Step[] = [['opacity', 0.4, FADE]];
const FADE_STEPS: Step[] = [['opacity', 0.4, FADE]];
const BAR_STEPS: Step[] = [['opacity', FADE_S, FADE]];
// how far the art fades towards the paper of a halftone, all over, and behind the song where it stays
const FADE_TO_PAPER = 0.7;
const SHADE_TO_PAPER = 0.9;
const BACKDROP_STEPS: Record<Backdrop, Step[]> = {
  [Backdrop.Fog]: [...SHADE_STEPS, FOG_FADE, FOG_BLUR, FOG_GLIDE],
  [Backdrop.Veil]: VEIL_STEPS,
  [Backdrop.Fade]: FADE_STEPS,
  [Backdrop.Clear]: [],
};

// Hidden until the controls show, positioned and timed through variables. What stays on the player while the
// controls are hidden has a place and a transition of its own.
const layer = css`
  opacity: 0;
  transform: var(--hidden-transform, none);
  transition: var(--hide-transition);

  &.is-staying {
    opacity: 1;
    transform: var(--stay-transform, none);
    transition: var(--stay-transition);
  }

  ${REVEALED} {
    opacity: 1;
    transform: none;
    transition: var(--show-transition);
  }
`;

// Sizes are relative to the player rather than to the window, so the preview in the settings looks the same
const Frame = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
  container-type: size;
  color: white;
`;

const Inner = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  /* text and icons scale with the player, limited by its height for wide and short players, then as chosen */
  font-size: calc(clamp(10px, min(4cqw, 7cqh), 14px) * var(--control-scale, 1));

  .is-mono & {
    font-family: ${MONOSPACE};
  }
`;

const TopShade = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28%;
  pointer-events: none;
  background: linear-gradient(to bottom, ${shade(0.4)}, rgba(0, 0, 0, 0));
  ${layer}
`;

// Frosted glass behind the controls, its blur fades out towards the top instead of ending on a hard edge
const Fog = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 70%;
  pointer-events: none;
  background: linear-gradient(to top, ${shade(0.55)} 0%, ${shade(0.2)} 100%);
  -webkit-mask-image: linear-gradient(to top, #000 45%, transparent 100%);
  backdrop-filter: blur(0) saturate(1);
  ${layer}

  &.is-staying {
    backdrop-filter: ${FOG_FILTER};
  }

  ${REVEALED} {
    backdrop-filter: ${FOG_FILTER};
  }
`;

// The original player dimmed and blurred all of the art
const Veil = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-color: ${shade(0.5)};
  backdrop-filter: blur(calc(3px * ${STRENGTH}));
  ${layer}
`;

// The art fades into the background: towards the paper of a halftone, towards black otherwise
const Fade = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-color: var(--fade-color, ${shade(0.55)});
  ${layer}
`;

// Where the song stays on the player once the controls hide, the art fades out under it, from the edge it rests on
const SongShade = styled.div<{ isAtTop: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  pointer-events: none;
  ${({ isAtTop }) => (isAtTop ? 'top: 0;' : 'bottom: 0;')}
  background: linear-gradient(
    ${({ isAtTop }) => (isAtTop ? 'to bottom' : 'to top')},
    var(--shade-color, ${shade(0.6)}) 30%,
    transparent
  );
  ${layer}
`;

// Along the bottom and up the left, just inside the faded edges where they'd disappear
const EdgeBar = styled.div`
  position: absolute;
  left: var(--edge-haze, 0px);
  bottom: var(--edge-haze, 0px);
  pointer-events: none;
  ${layer}
`;

// Without text shadows, the song and the icons stand on the art by themselves. The pulse look keeps its glow, it's
// what the look is about.
export const flatText = css`
  &.no-text-shadow *:not(.is-pulsing *) {
    text-shadow: none !important;
  }
`;

const BandBox = styled.div<{ band: Band }>`
  position: relative;
  grid-row: ${({ band }) => BANDS.indexOf(band) + 1};
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  min-width: 0;
  padding: ${({ band }) => BAND_PADDINGS[band]};
  ${({ band }) =>
    band === Band.Middle &&
    css`
      align-self: center;
    `}

  .is-short & {
    gap: 1px;
  }
`;

// The sides share the leftover space so the center stays in the middle, unless the center stretches out
const RowBox = styled.div<{ isStretched: boolean }>`
  display: grid;
  grid-template-columns: ${({ isStretched }) =>
    isStretched ? 'auto minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto minmax(0, 1fr)'};
  align-items: center;
`;

// spread out, the buttons on a side share its room like the ones around play in Spotify's miniplayer
const SlotBox = styled.div<{ side: Slot; isSpread: boolean }>`
  grid-row: 1;
  grid-column: ${({ side }) => SLOT_COLUMNS[side]};
  display: flex;
  align-items: center;
  justify-content: ${({ side, isSpread }) => (isSpread ? 'space-around' : SLOT_JUSTIFY[side])};
  min-width: 0;
`;

const ItemBox = styled.div<{ side: Slot; isStretched: boolean }>`
  ${layer}
  position: relative;
  display: flex;
  align-items: center;
  justify-content: ${({ side }) => SLOT_JUSTIFY[side]};
  min-width: 0;
  ${({ isStretched }) =>
    isStretched &&
    css`
      flex: 1 1 auto;
    `}

  .is-very-narrow .is-crowded &.is-secondary {
    display: none;
  }

  .is-clear & {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .no-text-shadow & {
    filter: none;
  }

  /* In the preview in the settings, items are picked and dragged as a whole */
  .is-editing & {
    border-radius: 0.4em;
    cursor: grab;
  }

  .is-editing & * {
    pointer-events: none;
    cursor: inherit;
  }

  .is-editing &:hover {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85);
  }

  .is-editing &.is-selected {
    box-shadow: 0 0 0 2px var(--selection-color, white), 0 0 0 3px rgba(255, 255, 255, 0.9);
  }

  .is-editing &.is-dragged {
    opacity: 0.3;
  }
`;

// Bends an item along a rounded corner, inside the item so it adds up with how the item comes in
const Warp = styled.div`
  display: flex;
  align-items: center;
  justify-content: inherit;
  min-width: 0;
  transform-origin: center;
`;

type Variables = Record<`--${string}`, string>;

const getLayerStyle = (timing: Timing, steps: Step[], hiddenTransform?: string, stayTransition?: string): Variables => {
  const { show, hide } = getTransitions(timing, steps);
  return {
    '--hidden-transform': hiddenTransform ?? 'none',
    '--stay-transform': hiddenTransform ?? 'none',
    '--show-transition': show,
    '--hide-transition': hide,
    ...(stayTransition && { '--stay-transition': stayTransition }),
  };
};

export const getDesignTiming = (design: PlayerDesign): Timing => {
  const placed = BANDS.flatMap((band) => design.bands[band]).flatMap((designRow) =>
    SLOTS.flatMap((slot) => designRow[slot])
  );
  return getTiming(
    design.speed,
    placed.map((item) => design.motion[item]),
    [...BACKDROP_STEPS[design.backdrop], ...(design.hasEdgeBars ? BAR_STEPS : [])]
  );
};

const getRowWeight = (designRow: DesignRow): number =>
  SLOTS.flatMap((slot) => designRow[slot]).reduce((weight, item) => weight + (ITEM_WEIGHTS[item] ?? 1), 0);

export interface LayoutEditor {
  selected?: DesignItem;
  dragged?: DesignItem;
  onItemPointerDown: (item: DesignItem, event: PointerEvent<HTMLElement>) => void;
  onItemWheel?: (item: DesignItem, event: WheelEvent<HTMLElement>) => void;
}

interface Props {
  design: PlayerDesign;
  data: PlayerData;
  actions: PlayerActions;
  barColor: string;
  barThickness: number;
  // the song is kept on the player while the controls are hidden
  isTrackInfoEnabled: boolean;
  isShowingTrackInfo: boolean;
  // the halftone look prints everything in this ink on this paper
  ink?: string;
  paper?: string;
  // shows the controls without hovering, for the preview in the settings
  isRevealed?: boolean;
  // the preview in the settings also shows the items that aren't available, and lets them be picked and moved
  editor?: LayoutEditor;
  layoutStyle?: LayoutStyle;
}

export const PlayerLayout: FunctionComponent<Props> = ({
  design,
  data,
  actions,
  barColor,
  barThickness,
  isTrackInfoEnabled,
  isShowingTrackInfo,
  ink = 'white',
  paper = 'black',
  isRevealed,
  editor,
  layoutStyle = DEFAULT_LAYOUT_STYLE,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const bandRefs = useRef<Partial<Record<Band, HTMLDivElement>>>({});
  const infoRef = useRef<HTMLDivElement>(null);
  const [sizeClassName, setSizeClassName] = useState('');
  // how far the song moves to rest at the edge of its band once the controls hide
  const [restOffset, setRestOffset] = useState(0);

  const isEditing = !!editor;
  const infoPlace = useMemo(() => findItem(design, DesignItem.TrackInfo), [design]);
  const infoBand = infoPlace?.band;

  const isAvailable = (item: DesignItem): boolean => {
    if (isEditing) {
      return true;
    }
    switch (item) {
      case DesignItem.Visualizations:
        return HAS_VISUALIZATIONS && data.isVisualizing;
      case DesignItem.Visualizer:
        return HAS_VISUALIZATIONS;
      case DesignItem.Playback:
      case DesignItem.Repeat:
      case DesignItem.Volume:
        return data.canControlPlayback;
      default:
        return true;
    }
  };

  const timing = useMemo(() => getDesignTiming(design), [design]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const measure = (): void => {
      const { offsetWidth: width, offsetHeight: height } = frame;
      setSizeClassName(
        [
          width < NARROW_WIDTH && 'is-narrow',
          width < VERY_NARROW_WIDTH && 'is-very-narrow',
          height < SHORT_HEIGHT && 'is-short',
        ]
          .filter(Boolean)
          .join(' ')
      );
    };
    measure();
    return observeSize([frame], measure);
  }, []);

  // Measured before the first paint, the song would otherwise start out of place and move. Below the middle it rests
  // at the bottom of its band, where the rows under it were, above the middle at the top.
  useLayoutEffect(() => {
    const info = infoRef.current;
    const band = infoBand && bandRefs.current[infoBand];
    if (!info || !band || infoBand === Band.Middle) {
      setRestOffset(0);
      return undefined;
    }

    const measure = (): void => {
      const rows = Array.from(band.children) as HTMLElement[];
      if (infoBand === Band.Bottom) {
        const end = Math.max(...rows.map((designRow) => designRow.offsetTop + designRow.offsetHeight));
        setRestOffset(Math.max(0, end - info.offsetTop - info.offsetHeight));
      } else {
        const start = Math.min(...rows.map((designRow) => designRow.offsetTop));
        setRestOffset(Math.min(0, start - info.offsetTop));
      }
    };
    measure();
    return observeSize([band, info], measure);
  }, [infoBand, design, data.canControlPlayback, data.isVisualizing]);

  // The bottom row bends up along the rounded corners, each item tilted to follow the edge. Positions are measured
  // without transforms, how the items come in doesn't throw them off.
  const { isCurved } = design;
  const updateCurve = useCallback(() => {
    const frame = frameRef.current;
    const lastRow = isCurved ? bandRefs.current[Band.Bottom]?.lastElementChild : null;
    const view = frame.ownerDocument.defaultView ?? window;
    const radius = lastRow ? parseFloat(view.getComputedStyle(frame).getPropertyValue('--corner-radius')) || 0 : 0;
    const flatHalfWidth = Math.max(0, frame.offsetWidth / 2 - radius);

    frame.querySelectorAll<HTMLElement>('[data-warp]').forEach((element) => {
      let left = 0;
      for (let node = element; node && node !== frame; node = node.offsetParent as HTMLElement) {
        left += node.offsetLeft;
      }
      const x = left + element.offsetWidth / 2 - frame.offsetWidth / 2;
      const intoCorner = Math.min(Math.abs(x) - flatHalfWidth, radius);
      if (!radius || intoCorner <= 0 || !lastRow.contains(element)) {
        // eslint-disable-next-line no-param-reassign
        element.style.transform = '';
        return;
      }
      const rise = radius - Math.sqrt(radius ** 2 - intoCorner ** 2);
      const angle = ((Math.asin(intoCorner / radius) * 180) / Math.PI) * Math.sign(x);
      // eslint-disable-next-line no-param-reassign
      element.style.transform = `translateY(${(-rise).toFixed(2)}px) rotate(${(-angle).toFixed(2)}deg)`;
    });
  }, [isCurved]);

  // after every render, which may have moved things or changed the corners, and whenever the player's size changes
  useLayoutEffect(() => updateCurve());
  useLayoutEffect(
    () => observeSize([frameRef.current, bandRefs.current[Band.Bottom]].filter(Boolean), updateCurve),
    [updateCurve]
  );

  const restTransform = restOffset ? `translateY(${restOffset}px)` : 'none';
  const isSettling = isTrackInfoEnabled && !!restOffset;
  // the rows the song moves over sink away under it, unless they come in some other way
  const sinkingItems = useMemo(() => {
    if (!infoPlace || infoPlace.band === Band.Middle) {
      return new Set<DesignItem>();
    }
    const isBottom = infoPlace.band === Band.Bottom;
    return new Set(
      design.bands[infoPlace.band]
        .filter((_, index) => (isBottom ? index > infoPlace.row : index < infoPlace.row))
        .flatMap((designRow) => SLOTS.flatMap((slot) => designRow[slot]))
        .filter((item) => design.motion[item].from === (isBottom ? Direction.Bottom : Direction.Top))
    );
  }, [design, infoPlace]);

  const getItemStyle = (item: DesignItem): Variables => {
    const motion = design.motion[item];
    const { show, hide } = getTransitions(timing, getItemSteps(motion));
    const style: Variables = {
      '--hidden-transform': getEntranceTransform(motion),
      '--show-transition': show,
      '--hide-transition': hide,
    };

    if (item === DesignItem.TrackInfo) {
      style['--stay-transform'] = restTransform;
      style['--stay-transition'] = getStayTransition(timing, [['opacity', FADE_S, FADE]]);
      if (isSettling) {
        style['--hidden-transform'] = restTransform;
      }
    } else if (isSettling && sinkingItems.has(item)) {
      style['--hidden-transform'] = restTransform;
      if (isShowingTrackInfo) {
        style['--hide-transition'] = getSinkTransition(timing);
      }
    }
    return style;
  };

  // the backdrop behind the song stays along with it, and settles with it
  const isInfoShown = isShowingTrackInfo && !!infoPlace && isAvailable(DesignItem.TrackInfo);
  const fogTransform = isTrackInfoEnabled && infoBand === Band.Bottom ? restTransform : 'none';
  const progressPercentage = data.duration ? (data.progress / data.duration) * 100 : 0;
  const isInked = INKED_LOOKS.includes(design.look);
  const edgeBarColor = isInked ? ink : barColor;

  const frameClassName = [
    'player-overlay draggable',
    sizeClassName,
    isRevealed && 'is-revealed',
    isEditing && 'is-editing',
    design.backdrop === Backdrop.Clear && 'is-clear',
    isInked && 'is-inked',
    design.look === DesignLook.Ascii && 'is-mono',
    design.look === DesignLook.Pulse && 'is-pulsing',
    design.look === DesignLook.Ncs && 'is-ncs',
  ]
    .filter(Boolean)
    .join(' ');
  const strength = layoutStyle.backdropStrength / 100;
  const paperShade = (alpha: number): string =>
    isHexColor(paper) ? withAlpha(paper, Math.min(1, Number((alpha * strength).toFixed(3)))) : paper;
  // the items pick the size, the typeface and the ink and paper up from here
  const frameStyle = {
    '--control-scale': String(layoutStyle.controlScale / 100),
    '--backdrop-strength': String(strength),
    fontFamily: FONT_FAMILIES[layoutStyle.fontStyle] ?? FONT_FAMILIES[FontStyle.Inter],
    ...(isInked && {
      '--ink': ink,
      '--paper': paper,
      '--fade-color': paperShade(FADE_TO_PAPER),
      '--shade-color': paperShade(SHADE_TO_PAPER),
    }),
  };

  const renderItem = (item: DesignItem, slot: Slot): JSX.Element => {
    const className = [
      'draggable',
      item === DesignItem.Volume && 'is-secondary',
      item === DesignItem.TrackInfo && isShowingTrackInfo && 'is-staying',
      editor?.selected === item && 'is-selected',
      editor?.dragged === item && 'is-dragged',
    ]
      .filter(Boolean)
      .join(' ');

    const isStretched = STRETCHED_ITEMS.includes(item);
    const scale = (design.sizes[item] ?? DEFAULT_ITEM_SIZE) / 100;
    const content = (
      <ItemContent
        item={item}
        look={design.look}
        slot={slot}
        data={data}
        actions={actions}
        accent={layoutStyle.accent}
      />
    );

    return (
      <ItemBox
        key={item}
        ref={item === DesignItem.TrackInfo ? infoRef : undefined}
        className={className}
        side={slot}
        isStretched={isStretched}
        style={
          {
            ...getItemStyle(item),
            ...(scale !== 1 && { fontSize: `${scale}em`, '--item-scale': String(scale) }),
          } as CSSProperties
        }
        data-item={item}
        onPointerDown={editor ? (event) => editor.onItemPointerDown(item, event) : undefined}
        onWheel={editor?.onItemWheel ? (event) => editor.onItemWheel(item, event) : undefined}>
        {/* the song and the progress stretch over the middle, they never reach into a corner */}
        {isStretched ? content : <Warp data-warp>{content}</Warp>}
      </ItemBox>
    );
  };

  return (
    <Frame ref={frameRef} className={frameClassName} style={frameStyle as CSSProperties}>
      <Inner className="draggable">
        {design.backdrop === Backdrop.Fog && (
          <>
            <TopShade
              className={isInfoShown && infoBand === Band.Top ? 'is-staying' : undefined}
              style={
                getLayerStyle(timing, SHADE_STEPS, 'none', getStayTransition(timing, SHADE_STEPS)) as CSSProperties
              }
            />
            <Fog
              className={isInfoShown && infoBand === Band.Bottom ? 'is-staying' : undefined}
              style={
                getLayerStyle(
                  timing,
                  [FOG_FADE, FOG_BLUR, FOG_GLIDE],
                  fogTransform,
                  getStayTransition(timing, [FOG_FADE, FOG_BLUR])
                ) as CSSProperties
              }
            />
          </>
        )}
        {design.backdrop === Backdrop.Veil && <Veil style={getLayerStyle(timing, VEIL_STEPS) as CSSProperties} />}
        {design.backdrop === Backdrop.Fade && (
          <>
            <Fade style={getLayerStyle(timing, FADE_STEPS) as CSSProperties} />
            {(infoBand === Band.Top || infoBand === Band.Bottom) && (
              <SongShade
                isAtTop={infoBand === Band.Top}
                className={isInfoShown ? 'is-staying' : undefined}
                style={
                  getLayerStyle(
                    timing,
                    [...FADE_STEPS, FOG_GLIDE],
                    isTrackInfoEnabled ? restTransform : 'none',
                    getStayTransition(timing, FADE_STEPS)
                  ) as CSSProperties
                }
              />
            )}
          </>
        )}
        {design.hasEdgeBars && (
          <>
            <EdgeBar
              style={
                {
                  ...getLayerStyle(timing, BAR_STEPS),
                  width: `${progressPercentage}%`,
                  height: barThickness,
                  backgroundColor: edgeBarColor,
                } as CSSProperties
              }
            />
            <EdgeBar
              style={
                {
                  ...getLayerStyle(timing, BAR_STEPS),
                  width: barThickness,
                  height: `${data.volume}%`,
                  backgroundColor: edgeBarColor,
                } as CSSProperties
              }
            />
          </>
        )}

        {BANDS.map((band) => (
          <BandBox
            key={band}
            ref={(element: HTMLDivElement) => {
              bandRefs.current[band] = element;
            }}
            band={band}
            className="draggable"
            data-band={band}>
            {design.bands[band].map((designRow, rowIndex) => (
              <RowBox
                // rows have no identity of their own, they're where they are
                // eslint-disable-next-line react/no-array-index-key
                key={rowIndex}
                className={`draggable${getRowWeight(designRow) >= CROWDED_WEIGHT ? ' is-crowded' : ''}`}
                isStretched={designRow.center.some((item) => STRETCHED_ITEMS.includes(item))}
                data-row={rowIndex}>
                {SLOTS.map((slot) => (
                  <SlotBox
                    key={slot}
                    side={slot}
                    isSpread={design.isSpread && band !== Band.Top && slot !== Slot.Center}
                    className="draggable"
                    data-slot={slot}>
                    {designRow[slot].filter(isAvailable).map((item) => renderItem(item, slot))}
                  </SlotBox>
                ))}
              </RowBox>
            ))}
          </BandBox>
        ))}
      </Inner>
    </Frame>
  );
};
