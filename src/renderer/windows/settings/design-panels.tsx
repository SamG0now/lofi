import { Alert, Button, createStyles, MantineColor, ScrollArea, Text } from '@mantine/core';
import { clamp } from 'lodash';
import React, { FunctionComponent, KeyboardEvent, ReactNode, useEffect, useState } from 'react';

import {
  MACOS,
  MAX_ART_BLUR_IN_PX,
  MAX_ART_BRIGHTNESS,
  MAX_ART_SATURATION,
  MAX_ART_ZOOM,
  MAX_BACKDROP_STRENGTH,
  MAX_BAR_THICKNESS,
  MAX_CONTROL_SCALE,
  MAX_CORNER_RADIUS,
  MAX_EDGE_HAZE,
  MAX_NCS_ZOOM,
  MAX_SIDE_LENGTH,
  MIN_ART_BRIGHTNESS,
  MIN_CONTROL_SCALE,
  MIN_EDGE_HAZE,
  MIN_NCS_ZOOM,
  MIN_SIDE_LENGTH,
} from '../../../constants';
import {
  Backdrop,
  CIRCLE_LOOKS,
  DEFAULT_ITEM_SIZE,
  DesignItem,
  DesignLook,
  Direction,
  findItem,
  hideItem,
  INKED_LOOKS,
  ItemMotion,
  MAX_DELAY,
  MAX_DISTANCE,
  MAX_ITEM_SIZE,
  MAX_SPEED,
  MIN_ITEM_SIZE,
  MIN_SPEED,
  PlayerDesign,
  showItem,
} from '../../../models/player-design';
import { AccentSource, DEFAULT_SETTINGS, FontStyle, VisualizationType } from '../../../models/settings';
import { visualizations } from '../../../visualizations';
import { ncs } from '../../../visualizations/ncs';
import { FONT_FAMILIES } from '../../app/cover/layout';
import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { useAccentColor } from '../../hooks/use-accent-color';
import { useHalftoneColors } from '../../hooks/use-halftone-colors';
import { ColorGraph } from './color-graph';
import {
  ColorChoice,
  PanelGroup,
  PanelRow,
  PanelSlider,
  PanelSwitch,
  Segmented,
  SegmentOption,
  useSetting,
} from './design-controls';
import { describePlace, DIRECTION_NAMES, DirectionPad, ITEM_INFO } from './design-items';
import { useSectionColor } from './fields';
import { getAccentText, getPalette } from './palette';

export type DesignChange = (change: (design: PlayerDesign) => PlayerDesign) => void;

export enum InspectorTab {
  Presets = 'presets',
  Layout = 'layout',
  Style = 'style',
  Window = 'window',
  Art = 'art',
  Song = 'song',
  Visualizer = 'visualizer',
}

const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: InspectorTab.Presets, label: 'Presets', icon: 'fa-solid fa-swatchbook' },
  { id: InspectorTab.Layout, label: 'Layout', icon: 'fa-solid fa-table-cells-large' },
  { id: InspectorTab.Style, label: 'Style', icon: 'fa-solid fa-palette' },
  { id: InspectorTab.Window, label: 'Window', icon: 'fa-solid fa-vector-square' },
  { id: InspectorTab.Art, label: 'Art', icon: 'fa-solid fa-image' },
  { id: InspectorTab.Song, label: 'Song', icon: 'fa-solid fa-music' },
  { id: InspectorTab.Visualizer, label: 'Visuals', icon: 'fa-solid fa-wave-square' },
];

const BACKDROP_OPTIONS: SegmentOption<Backdrop>[] = [
  { value: Backdrop.Fog, label: 'Fog', title: 'Frosted glass rising from the bottom' },
  { value: Backdrop.Veil, label: 'Veil', title: 'The whole art dims and blurs' },
  { value: Backdrop.Fade, label: 'Fade', title: 'The whole art fades, without blurring' },
  { value: Backdrop.Clear, label: 'Clear', title: 'Nothing, only a shadow under the controls' },
];

const ACCENT_OPTIONS: SegmentOption<AccentSource>[] = [
  { value: AccentSource.Look, label: 'Look', title: "The look's own colors" },
  { value: AccentSource.Cover, label: 'Album', title: "The album art's main color, it changes with each song" },
  { value: AccentSource.Own, label: 'Pick', title: 'A color of your own' },
];

const FONT_OPTIONS: SegmentOption<FontStyle>[] = [
  { value: FontStyle.Inter, label: 'Inter', style: { fontFamily: FONT_FAMILIES[FontStyle.Inter] } },
  { value: FontStyle.System, label: 'System', style: { fontFamily: FONT_FAMILIES[FontStyle.System] } },
  { value: FontStyle.Serif, label: 'Serif', style: { fontFamily: FONT_FAMILIES[FontStyle.Serif] } },
  { value: FontStyle.Mono, label: 'Mono', style: { fontFamily: FONT_FAMILIES[FontStyle.Mono] } },
  { value: FontStyle.Condensed, label: 'Narrow', style: { fontFamily: FONT_FAMILIES[FontStyle.Condensed] } },
];

enum InkSource {
  Cover = 'cover',
  Own = 'own',
}

const INK_OPTIONS: SegmentOption<InkSource>[] = [
  { value: InkSource.Cover, label: 'Album art' },
  { value: InkSource.Own, label: 'Pick' },
];

enum ControlsShown {
  OnHover = 'hover',
  Always = 'always',
}

const CONTROLS_OPTIONS: SegmentOption<ControlsShown>[] = [
  { value: ControlsShown.OnHover, label: 'On hover' },
  { value: ControlsShown.Always, label: 'Always' },
];

const percent = (value: number): string => `${value}%`;

const useStyles = createStyles((theme, color: MantineColor) => {
  const accent = theme.colors[color][6];
  const accentText = getAccentText(theme, color);
  const palette = getPalette(theme);
  return {
    inspector: {
      width: 360,
      flexShrink: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `1px solid ${palette.hairline}`,
      backgroundColor: palette.inspector,
    },
    tabs: {
      display: 'grid',
      gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
      gap: 2,
      padding: '10px 10px 8px',
      borderBottom: `1px solid ${palette.hairline}`,
    },
    tab: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: '6px 0 5px',
      border: 'none',
      borderRadius: 8,
      background: 'none',
      color: palette.muted,
      fontFamily: 'inherit',
      fontSize: 10.5,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.1s, color 0.1s',

      '& i': {
        fontSize: 15,
      },
      '&:hover': {
        backgroundColor: palette.hover,
        color: palette.strong,
      },
    },
    tabActive: {
      backgroundColor: theme.fn.rgba(accent, 0.12),
      color: accentText,

      '&:hover': {
        backgroundColor: theme.fn.rgba(accent, 0.16),
        color: accentText,
      },
    },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    panel: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '14px 14px 20px',
    },
    itemHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    itemIcon: {
      width: 30,
      height: 30,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: theme.fn.rgba(accent, 0.12),
      color: accentText,
      fontSize: 13,
    },
    buttons: {
      display: 'flex',
      gap: 6,
    },
    hint: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.fn.rgba(accent, 0.07),

      '& > i': {
        marginTop: 2,
        fontSize: 18,
        color: accentText,
      },
    },
    dot: {
      width: 18,
      height: 18,
      flexShrink: 0,
      borderRadius: '50%',
      boxShadow: `inset 0 0 0 1px ${palette.swatchEdge}`,
    },
    sizeInputs: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: palette.muted,
    },
    sideInput: {
      width: 64,
      height: 26,
      padding: '0 8px',
      border: `1px solid ${palette.fieldBorder}`,
      borderRadius: 6,
      backgroundColor: palette.field,
      color: palette.text,
      fontFamily: 'inherit',
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums',
      textAlign: 'right',

      '&:focus': {
        outline: 'none',
        borderColor: accent,
        boxShadow: `0 0 0 2px ${theme.fn.rgba(accent, 0.25)}`,
      },
    },
    visualizations: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 6,
    },
    visualization: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 10px',
      border: `1px solid ${palette.buttonBorder}`,
      borderRadius: 8,
      backgroundColor: palette.button,
      color: palette.text,
      fontFamily: 'inherit',
      fontSize: 12,
      textAlign: 'left',
      cursor: 'pointer',

      '&:hover': {
        backgroundColor: palette.buttonHover,
      },
      '& i': {
        color: palette.muted,
        fontSize: 11,
      },
    },
    visualizationActive: {
      borderColor: accent,
      boxShadow: `0 0 0 1px ${accent}`,
      fontWeight: 600,

      '& i': {
        color: accentText,
      },
    },
  };
});

const usePanelStyles = (): ReturnType<typeof useStyles> => useStyles(useSectionColor());

const Note: FunctionComponent = ({ children }) => (
  <Text size="xs" color="dimmed">
    {children}
  </Text>
);

interface LayoutPanelProps {
  design: PlayerDesign;
  onChange: DesignChange;
  selected?: DesignItem;
  onSelect: (item?: DesignItem) => void;
  isRevealed: boolean;
  onReplay: () => void;
}

const LayoutPanel: FunctionComponent<LayoutPanelProps> = ({
  design,
  onChange,
  selected,
  onSelect,
  isRevealed,
  onReplay,
}) => {
  const { classes } = usePanelStyles();
  const color = useSectionColor();
  const [isAlwaysShowControls, setIsAlwaysShowControls] = useSetting('isAlwaysShowControls');
  const place = selected && findItem(design, selected);
  const motion = selected && design.motion[selected];

  const updateMotion = (changes: Partial<ItemMotion>, shouldReplay = false): void => {
    onChange((previous) => ({
      ...previous,
      motion: { ...previous.motion, [selected]: { ...previous.motion[selected], ...changes } },
    }));
    if (shouldReplay) {
      onReplay();
    }
  };

  return (
    <>
      {selected ? (
        <PanelGroup title="Selected" action={{ label: 'Done', onClick: () => onSelect(undefined) }}>
          <div className={classes.itemHeader}>
            <span className={classes.itemIcon}>
              <i className={ITEM_INFO[selected].icon} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" weight={600} truncate>
                {ITEM_INFO[selected].name}
              </Text>
              <Text size="xs" color="dimmed" truncate>
                {place ? describePlace(place) : 'Not on the player'}
              </Text>
            </div>
          </div>
          {place ? (
            <>
              <PanelSlider
                label="Size"
                description="Or scroll over it on the player"
                value={design.sizes[selected] ?? DEFAULT_ITEM_SIZE}
                min={MIN_ITEM_SIZE}
                max={MAX_ITEM_SIZE}
                step={5}
                format={percent}
                onChange={(size) =>
                  onChange((previous) => ({ ...previous, sizes: { ...previous.sizes, [selected]: size } }))
                }
              />
              <PanelRow label="Comes in from" description={DIRECTION_NAMES[motion.from]}>
                <DirectionPad value={motion.from} onChange={(from) => updateMotion({ from }, true)} />
              </PanelRow>
              <PanelSwitch
                label="Grow in"
                description="Starts out smaller"
                checked={motion.isGrowing}
                onChange={(isGrowing) => updateMotion({ isGrowing }, true)}
              />
              <PanelSlider
                label="Distance"
                value={motion.distance}
                min={0}
                max={MAX_DISTANCE}
                disabled={motion.from === Direction.None}
                format={(value) => `${value}px`}
                onChange={(distance) => updateMotion({ distance })}
              />
              <PanelSlider
                label="Delay"
                value={motion.delay}
                min={0}
                max={MAX_DELAY}
                step={0.02}
                format={(value) => `${value.toFixed(2)}s`}
                onChange={(delay) => updateMotion({ delay })}
              />
              <div className={classes.buttons}>
                <Button
                  size="xs"
                  variant="light"
                  color={color}
                  leftIcon={<i className="fa-solid fa-play" />}
                  disabled={!isRevealed}
                  onClick={onReplay}>
                  Replay
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  leftIcon={<i className="fa-solid fa-eye-slash" />}
                  onClick={() => onChange((previous) => hideItem(previous, selected))}>
                  Hide
                </Button>
              </div>
            </>
          ) : (
            <>
              <Note>
                Drag it onto the player wherever you want it, or put it back where the built-in designs have it.
              </Note>
              <div className={classes.buttons}>
                <Button
                  size="xs"
                  color={color}
                  leftIcon={<i className="fa-solid fa-plus" />}
                  onClick={() => onChange((previous) => showItem(previous, selected))}>
                  Add to the player
                </Button>
              </div>
            </>
          )}
        </PanelGroup>
      ) : (
        <div className={classes.hint}>
          <i className="fa-solid fa-hand-pointer" />
          <div>
            <Text size="sm" weight={600}>
              Click something on the player
            </Text>
            <Note>
              Drag it to move it, off the player to hide it, or scroll over it to resize it. Drag the dot on the corner
              to round the corners, and the bracket to resize the player.
            </Note>
          </div>
        </div>
      )}

      <PanelGroup title="Arrangement">
        <PanelSwitch
          label="Spread out the sides"
          description="Buttons beside the middle share their side of the row, instead of keeping to the edge"
          checked={design.isSpread}
          onChange={(isSpread) => onChange((previous) => ({ ...previous, isSpread }))}
        />
        <PanelSwitch
          label="Follow the corners"
          description="The bottom row bends up along rounded corners"
          checked={design.isCurved}
          onChange={(isCurved) => onChange((previous) => ({ ...previous, isCurved }))}
        />
        <PanelSlider
          label="Animation speed"
          description="Of everything coming in and going away"
          value={design.speed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={25}
          format={(value) => `${value / 100}×`}
          onChange={(speed) => onChange((previous) => ({ ...previous, speed }))}
        />
      </PanelGroup>

      <PanelGroup title="Controls">
        <PanelRow
          label="Show them"
          description={isAlwaysShowControls ? 'Always on the player' : 'While the pointer is over the player'}
          below={
            <div style={{ marginTop: 8 }}>
              <Segmented
                label="Show the controls"
                value={isAlwaysShowControls ? ControlsShown.Always : ControlsShown.OnHover}
                options={CONTROLS_OPTIONS}
                onChange={(shown) => setIsAlwaysShowControls(shown === ControlsShown.Always)}
              />
            </div>
          }
        />
      </PanelGroup>
    </>
  );
};

const StylePanel: FunctionComponent<{ design: PlayerDesign; onChange: DesignChange }> = ({ design, onChange }) => {
  const { classes, theme } = usePanelStyles();
  const {
    state: { cover },
  } = useCurrentlyPlaying();
  const [isInkFromCover, setIsInkFromCover] = useSetting('isHalftoneColorFromCover');
  const [inkColor, setInkColor] = useSetting('halftoneColor');
  const [accentSource, setAccentSource] = useSetting('accentSource');
  const [accentColor, setAccentColor] = useSetting('accentColor');
  const [fontStyle, setFontStyle] = useSetting('fontStyle');
  const [controlScale, setControlScale] = useSetting('controlScale');
  const [isTextShadowEnabled, setIsTextShadowEnabled] = useSetting('isTextShadowEnabled');
  const [backdropStrength, setBackdropStrength] = useSetting('backdropStrength');
  const { ink, paper } = useHalftoneColors(cover || undefined, isInkFromCover, inkColor);
  const accent = useAccentColor(cover || undefined, accentSource, accentColor);

  const isInked = INKED_LOOKS.includes(design.look);

  return (
    <>
      {isInked && (
        <PanelGroup title="Ink">
          <PanelRow
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={classes.dot}
                  style={{
                    backgroundColor: ink,
                    boxShadow: `inset 0 0 0 4px ${paper}, 0 0 0 1px ${getPalette(theme).swatchEdge}`,
                  }}
                />
                From
              </span>
            }
            description={isInkFromCover ? 'Changes with each song' : 'For the art, the icons and the text'}>
            <div style={{ width: 150 }}>
              <Segmented
                label="Ink"
                value={isInkFromCover ? InkSource.Cover : InkSource.Own}
                options={INK_OPTIONS}
                onChange={(source) => setIsInkFromCover(source === InkSource.Cover)}
              />
            </div>
          </PanelRow>
          {!isInkFromCover && (
            <div>
              <ColorGraph label="Ink" value={inkColor} onChange={setInkColor} />
            </div>
          )}
        </PanelGroup>
      )}

      <PanelGroup title="Accent">
        <PanelRow
          label={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className={classes.dot}
                style={{
                  background: accent ?? 'conic-gradient(#1ed760, #3ecf8e, #ffc46b, #e57be6, #1ed760)',
                }}
              />
              Color
            </span>
          }
          description={
            isInked ? 'The ink stands in for it in this look' : 'Liked, repeat and the visualization button'
          }>
          <div style={{ width: 170 }}>
            <Segmented label="Accent" value={accentSource} options={ACCENT_OPTIONS} onChange={setAccentSource} />
          </div>
        </PanelRow>
        {accentSource === AccentSource.Own && (
          <div>
            <ColorChoice label="Accent" value={accentColor} onChange={setAccentColor} />
          </div>
        )}
      </PanelGroup>

      <PanelGroup title="Text and icons">
        <PanelRow
          label="Typeface"
          description={design.look === DesignLook.Ascii ? 'ASCII always types in monospace' : undefined}
          below={
            <div style={{ marginTop: 8 }}>
              <Segmented label="Typeface" value={fontStyle} options={FONT_OPTIONS} onChange={setFontStyle} />
            </div>
          }
        />
        <PanelSlider
          label="Size"
          description="Of everything, on top of following the player's size"
          value={controlScale}
          min={MIN_CONTROL_SCALE}
          max={MAX_CONTROL_SCALE}
          step={5}
          format={percent}
          onChange={setControlScale}
        />
        <PanelSwitch
          label="Shadows"
          description="For reading the song and the icons on light album art"
          checked={isTextShadowEnabled}
          onChange={setIsTextShadowEnabled}
        />
      </PanelGroup>

      <PanelGroup title="Backdrop">
        <PanelRow
          label="Behind the controls"
          description="Keeps them readable on any album art"
          below={
            <div style={{ marginTop: 8 }}>
              <Segmented
                label="Backdrop"
                value={design.backdrop}
                options={BACKDROP_OPTIONS}
                onChange={(backdrop) => onChange((previous) => ({ ...previous, backdrop }))}
              />
            </div>
          }
        />
        <PanelSlider
          label="Strength"
          description="How much it dims and blurs the art"
          disabled={design.backdrop === Backdrop.Clear}
          value={backdropStrength}
          min={0}
          max={MAX_BACKDROP_STRENGTH}
          step={10}
          format={percent}
          onChange={setBackdropStrength}
        />
      </PanelGroup>
    </>
  );
};

interface SideInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

// typed in, only taken once it's done: half a number would resize the player on the way
const SideInput: FunctionComponent<SideInputProps> = ({ label, value, onChange }) => {
  const { classes } = usePanelStyles();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const apply = (): void => {
    const number = Math.round(Number(text));
    if (Number.isFinite(number) && text.trim()) {
      const side = clamp(number, MIN_SIDE_LENGTH, MAX_SIDE_LENGTH);
      onChange(side);
      setText(String(side));
    } else {
      setText(String(value));
    }
  };

  return (
    <input
      type="number"
      aria-label={label}
      className={classes.sideInput}
      min={MIN_SIDE_LENGTH}
      max={MAX_SIDE_LENGTH}
      value={text}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={apply}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          apply();
        }
      }}
    />
  );
};

// the shapes keep the player's longer side
enum Shape {
  Square = 'square',
  Wide = 'wide',
  Tall = 'tall',
}

const SHAPE_OPTIONS: SegmentOption<Shape>[] = [
  { value: Shape.Square, label: 'Square', icon: 'fa-regular fa-square' },
  { value: Shape.Wide, label: 'Wide', icon: 'fa-solid fa-panorama' },
  { value: Shape.Tall, label: 'Tall', icon: 'fa-solid fa-mobile-screen' },
];

const getShape = (width: number, height: number): Shape => {
  if (width === height) {
    return Shape.Square;
  }
  return width > height ? Shape.Wide : Shape.Tall;
};

const WindowPanel: FunctionComponent<{ design: PlayerDesign }> = ({ design }) => {
  const { classes } = usePanelStyles();
  const [width, setWidth] = useSetting('width');
  const [height, setHeight] = useSetting('height');
  const [isAlwaysSquare, setIsAlwaysSquare] = useSetting('isAlwaysSquare');
  const [cornerRadius, setCornerRadius] = useSetting('cornerRadius');
  const [isEdgeHazeEnabled, setIsEdgeHazeEnabled] = useSetting('isEdgeHazeEnabled');
  const [edgeHaze, setEdgeHaze] = useSetting('edgeHaze');
  const isCircle = CIRCLE_LOOKS.includes(design.look);

  const setShape = (shape: Shape): void => {
    const side = Math.max(width, height);
    const shortSide = clamp(Math.round((side * 3) / 4), MIN_SIDE_LENGTH, MAX_SIDE_LENGTH);
    setWidth(shape === Shape.Tall ? shortSide : side);
    setHeight(shape === Shape.Wide ? shortSide : side);
  };

  // a square player has one side
  const setSide = (side: number): void => {
    setWidth(side);
    setHeight(side);
  };

  const setSquare = (isSquare: boolean): void => {
    setIsAlwaysSquare(isSquare);
    if (isSquare) {
      setSide(Math.max(width, height));
    }
  };

  return (
    <>
      <PanelGroup
        title="Size"
        action={{
          label: 'Swap',
          disabled: width === height,
          onClick: () => {
            setWidth(height);
            setHeight(width);
          },
        }}>
        <PanelRow label="Pixels" description="Or drag the bracket on the corner of the player">
          <div className={classes.sizeInputs}>
            <SideInput label="Width" value={width} onChange={isAlwaysSquare ? setSide : setWidth} />×
            <SideInput label="Height" value={height} onChange={isAlwaysSquare ? setSide : setHeight} />
          </div>
        </PanelRow>
        <PanelSwitch
          label="Keep it square"
          description="Stays 1:1 however it's resized"
          checked={isAlwaysSquare}
          onChange={setSquare}
        />
        {!isAlwaysSquare && (
          <div>
            <Segmented label="Shape" value={getShape(width, height)} options={SHAPE_OPTIONS} onChange={setShape} />
          </div>
        )}
      </PanelGroup>

      <PanelGroup title="Corners">
        {isCircle ? (
          <div>
            <Note>Full NCS is always round, whatever the corners.</Note>
          </div>
        ) : (
          <PanelSlider
            label="Roundness"
            description="All the way turns a square player into a circle"
            value={cornerRadius}
            min={0}
            max={MAX_CORNER_RADIUS}
            format={(value) => {
              if (!value) {
                return 'Square';
              }
              return value === MAX_CORNER_RADIUS ? 'Circle' : `${value}%`;
            }}
            onChange={setCornerRadius}
          />
        )}
      </PanelGroup>

      <PanelGroup title="Edges">
        <PanelSwitch
          label="Hazy edges"
          description="Blur and fade the edges into the desktop"
          checked={isEdgeHazeEnabled}
          onChange={setIsEdgeHazeEnabled}
        />
        <PanelSlider
          label="Width"
          disabled={!isEdgeHazeEnabled}
          value={edgeHaze}
          min={MIN_EDGE_HAZE}
          max={MAX_EDGE_HAZE}
          format={(value) => `${value}px`}
          onChange={setEdgeHaze}
        />
      </PanelGroup>
    </>
  );
};

const ArtPanel: FunctionComponent = () => {
  const [isCenteredX, setIsCenteredX] = useSetting('isCoverCenteredHorizontally');
  const [isCenteredY, setIsCenteredY] = useSetting('isCoverCenteredVertically');
  const [zoom, setZoom] = useSetting('artZoom');
  const [brightness, setBrightness] = useSetting('artBrightness');
  const [saturation, setSaturation] = useSetting('artSaturation');
  const [blur, setBlur] = useSetting('artBlur');
  const isAdjusted =
    zoom !== DEFAULT_SETTINGS.artZoom ||
    brightness !== DEFAULT_SETTINGS.artBrightness ||
    saturation !== DEFAULT_SETTINGS.artSaturation ||
    blur !== DEFAULT_SETTINGS.artBlur;

  return (
    <>
      <PanelGroup
        title="Adjust"
        action={{
          label: 'Reset',
          disabled: !isAdjusted,
          onClick: () => {
            setZoom(DEFAULT_SETTINGS.artZoom);
            setBrightness(DEFAULT_SETTINGS.artBrightness);
            setSaturation(DEFAULT_SETTINGS.artSaturation);
            setBlur(DEFAULT_SETTINGS.artBlur);
          },
        }}>
        <PanelSlider
          label="Zoom"
          value={zoom}
          min={100}
          max={MAX_ART_ZOOM}
          step={5}
          format={percent}
          onChange={setZoom}
        />
        <PanelSlider
          label="Brightness"
          value={brightness}
          min={MIN_ART_BRIGHTNESS}
          max={MAX_ART_BRIGHTNESS}
          step={5}
          format={percent}
          onChange={setBrightness}
        />
        <PanelSlider
          label="Saturation"
          description="None turns it black and white"
          value={saturation}
          min={0}
          max={MAX_ART_SATURATION}
          step={5}
          format={(value) => (value ? `${value}%` : 'None')}
          onChange={setSaturation}
        />
        <PanelSlider
          label="Blur"
          value={blur}
          min={0}
          max={MAX_ART_BLUR_IN_PX}
          step={0.5}
          format={(value) => (value ? `${value}px` : 'Off')}
          onChange={setBlur}
        />
      </PanelGroup>

      <PanelGroup title="Crop">
        <PanelSwitch
          label="Center horizontally"
          description="Crop tall players evenly on the left and right, instead of only on the right"
          checked={isCenteredX}
          onChange={setIsCenteredX}
        />
        <PanelSwitch
          label="Center vertically"
          description="Crop wide players evenly at the top and bottom, instead of only at the bottom"
          checked={isCenteredY}
          onChange={setIsCenteredY}
        />
      </PanelGroup>
    </>
  );
};

const SongPanel: FunctionComponent<{ design: PlayerDesign; onChange: DesignChange }> = ({ design, onChange }) => {
  const [isAlwaysShown, setIsAlwaysShown] = useSetting('isAlwaysShowTrackInfo');
  const [seconds, setSeconds] = useSetting('showTrackInfoTemporarilyInSeconds');
  const [isAlbumShown, setIsAlbumShown] = useSetting('isAlbumShown');
  const [isProgressShown, setIsProgressShown] = useSetting('isAlwaysShowSongProgress');
  const [isAround, setIsAround] = useSetting('isProgressAroundWindow');
  const [isHazy, setIsHazy] = useSetting('isProgressBarHazy');
  const [thickness, setThickness] = useSetting('barThickness');
  const [barColor, setBarColor] = useSetting('barColor');
  const isInked = INKED_LOOKS.includes(design.look);
  const isSongPlaced = !!findItem(design, DesignItem.TrackInfo);

  return (
    <>
      <PanelGroup title="Song">
        <PanelSwitch
          label="Always show"
          description="Keep the song on the player when the controls hide"
          checked={isAlwaysShown}
          onChange={setIsAlwaysShown}
        />
        <PanelSlider
          label="Show when the song changes"
          description="Try it with the Idle preview"
          disabled={isAlwaysShown}
          value={seconds}
          min={0}
          max={10}
          format={(value) => (value ? `${value}s` : 'Off')}
          onChange={setSeconds}
        />
        <PanelSwitch
          label="Show the album"
          description="After the artist, under the title"
          checked={isAlbumShown}
          onChange={setIsAlbumShown}
        />
        <PanelSlider
          label="Text size"
          description={isSongPlaced ? undefined : 'The song isn’t on the player'}
          disabled={!isSongPlaced}
          value={design.sizes[DesignItem.TrackInfo] ?? DEFAULT_ITEM_SIZE}
          min={MIN_ITEM_SIZE}
          max={MAX_ITEM_SIZE}
          step={5}
          format={percent}
          onChange={(size) =>
            onChange((previous) => ({ ...previous, sizes: { ...previous.sizes, [DesignItem.TrackInfo]: size } }))
          }
        />
      </PanelGroup>

      <PanelGroup title="Progress bar">
        <PanelSwitch
          label="Show when idle"
          description="A thin bar while the controls are hidden"
          checked={isProgressShown}
          onChange={setIsProgressShown}
        />
        <PanelSwitch
          label="All the way around"
          description="Around the edges from the middle of the top, instead of along the bottom"
          checked={isAround}
          onChange={setIsAround}
        />
        <PanelSwitch
          label="Hazy"
          description="Blurred and glowing, melting into the edges"
          checked={isHazy}
          onChange={setIsHazy}
        />
        <PanelSwitch
          label="Edge bars"
          description="Progress along the bottom and volume up the left while the controls show"
          checked={design.hasEdgeBars}
          onChange={(hasEdgeBars) => onChange((previous) => ({ ...previous, hasEdgeBars }))}
        />
        <PanelSlider
          label="Thickness"
          value={thickness}
          min={1}
          max={MAX_BAR_THICKNESS}
          format={(value) => `${value}px`}
          onChange={setThickness}
        />
        <PanelRow
          label="Color"
          description={isInked ? 'This look draws the bars in its ink' : undefined}
          below={
            <div style={{ marginTop: 8 }}>
              <ColorChoice label="Bar color" value={barColor} onChange={setBarColor} />
            </div>
          }
        />
      </PanelGroup>
    </>
  );
};

const VisualizerPanel: FunctionComponent<{ design: PlayerDesign }> = ({ design }) => {
  const { classes, cx } = usePanelStyles();
  const [type, setType] = useSetting('visualizationType');
  const [id, setId] = useSetting('visualizationId');
  const [opacity, setOpacity] = useSetting('visualizerOpacity');
  const [ncsZoom, setNcsZoom] = useSetting('ncsZoom');
  const isOn = type !== VisualizationType.None;
  const isFullNcs = design.look === DesignLook.Ncs;

  // the circle is the same whether it's the whole player or over the art
  const ncsCircle = (
    <PanelGroup
      title="NCS circle"
      action={{
        label: 'Reset',
        disabled: ncsZoom === DEFAULT_SETTINGS.ncsZoom,
        onClick: () => setNcsZoom(DEFAULT_SETTINGS.ncsZoom),
      }}>
      <PanelSlider
        label="Zoom"
        description="The circle and everything around it, bigger or smaller"
        value={ncsZoom}
        min={MIN_NCS_ZOOM}
        max={MAX_NCS_ZOOM}
        step={5}
        format={percent}
        onChange={setNcsZoom}
      />
    </PanelGroup>
  );

  return (
    <>
      {MACOS && (
        <Alert color="yellow" variant="light">
          Visualizations aren&apos;t available on macOS yet.
        </Alert>
      )}
      {isFullNcs && (
        <Alert color="cyan" variant="light">
          Full NCS is a visualization of its own, the others don&apos;t show over it.
        </Alert>
      )}
      {isFullNcs && ncsCircle}
      <PanelGroup title="Visualization">
        <PanelSwitch
          label="Show"
          description="The wave button on the player turns it on and off too, picking another design turns it off"
          checked={isOn}
          onChange={(isShown) => setType(isShown ? VisualizationType.Small : VisualizationType.None)}
        />
        {/* 0% would fail the settings validation on the next start */}
        <PanelSlider
          label="Opacity"
          description="Over the album art"
          value={opacity}
          min={5}
          max={100}
          step={5}
          format={percent}
          onChange={setOpacity}
        />
      </PanelGroup>
      {!isFullNcs && visualizations[id] === ncs && ncsCircle}

      <PanelGroup title="Style">
        <div>
          <div className={classes.visualizations} role="radiogroup" aria-label="Visualization">
            {visualizations.map(({ name }, index) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={index === id}
                className={cx(classes.visualization, index === id && classes.visualizationActive)}
                onClick={() => {
                  setId(index);
                  if (!isOn) {
                    setType(VisualizationType.Small);
                  }
                }}>
                <i className="fa-solid fa-wave-square" />
                {name}
              </button>
            ))}
          </div>
          <Text size="xs" color="dimmed" mt={8}>
            Most take their colors from the album art. On the player, the palette button switches between them and
            right-clicking it goes back.
          </Text>
        </div>
      </PanelGroup>
    </>
  );
};

interface InspectorProps extends LayoutPanelProps {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  // the built-in designs and the user's own to pick from
  presets: ReactNode;
}

/** Everything about the player's design that isn't dragged around on it, a tab for each part of it. */
export const DesignInspector: FunctionComponent<InspectorProps> = ({ tab, onTabChange, presets, ...layout }) => {
  const { classes, cx } = usePanelStyles();
  const { design, onChange } = layout;

  return (
    <aside className={classes.inspector}>
      <div className={classes.tabs} role="tablist" aria-label="Design">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === tab}
            className={cx(classes.tab, id === tab && classes.tabActive)}
            onClick={() => onTabChange(id)}>
            <i className={icon} />
            {label}
          </button>
        ))}
      </div>
      <ScrollArea className={classes.scroll}>
        <div className={classes.panel} role="tabpanel">
          {tab === InspectorTab.Presets && presets}
          {tab === InspectorTab.Layout && <LayoutPanel {...layout} />}
          {tab === InspectorTab.Style && <StylePanel design={design} onChange={onChange} />}
          {tab === InspectorTab.Window && <WindowPanel design={design} />}
          {tab === InspectorTab.Art && <ArtPanel />}
          {tab === InspectorTab.Song && <SongPanel design={design} onChange={onChange} />}
          {tab === InspectorTab.Visualizer && <VisualizerPanel design={design} />}
        </div>
      </ScrollArea>
    </aside>
  );
};
