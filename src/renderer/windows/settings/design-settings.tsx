import { Button, createStyles, MantineColor, Text } from '@mantine/core';
import { cloneDeep, isEqual } from 'lodash';
import React, { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldPath, useFormContext, useWatch } from 'react-hook-form';

import {
  BuiltInPreset,
  DESIGN_PRESETS,
  DesignItem,
  DesignPreset,
  findItem,
  hideItem,
  isBuiltInCopy,
  MODERN_DESIGN,
  normalizeDesign,
  PlayerDesign,
} from '../../../models/player-design';
import { DEFAULT_SETTINGS, Settings, VisualizationType } from '../../../models/settings';
import { getDesignTiming } from '../../app/cover/layout';
import { useWindowDocument } from '../../components';
import { PanelGroup, useSetting } from './design-controls';
import { DesignChange, DesignInspector, InspectorTab } from './design-panels';
import { DesignPreview } from './design-preview';
import { DesignStage } from './design-stage';
import { useSectionColor } from './fields';
import { getAccentText, getPalette } from './palette';
import { useDesignHistory } from './use-design-history';

const CONFIRMATION_IN_MS = 4000;
// after the controls hide while the animation replays, before they come back
const HIDDEN_PAUSE_IN_MS = 700;

export const PRESET_NAMES: Record<DesignPreset, string> = {
  [DesignPreset.Modern]: 'Modern',
  [DesignPreset.Retro]: 'Retro',
  [DesignPreset.Halftone]: 'Halftone',
  [DesignPreset.Ascii]: 'ASCII',
  [DesignPreset.Vinyl]: 'Vinyl',
  [DesignPreset.Pulse]: 'Pulse',
  [DesignPreset.Ncs]: 'Full NCS',
  [DesignPreset.Custom]: 'Custom',
};

export const PRESET_DESCRIPTIONS: Record<DesignPreset, string> = {
  [DesignPreset.Modern]: 'Frosted glass over the art',
  [DesignPreset.Retro]: 'The original Lofi',
  [DesignPreset.Halftone]: 'The art printed in dots of one ink',
  [DesignPreset.Ascii]: 'The art typed out in characters, a terminal for controls',
  [DesignPreset.Vinyl]: 'A record that spins while the music plays',
  [DesignPreset.Pulse]: 'The art and the controls bump with the beat',
  [DesignPreset.Ncs]: 'The whole player is the NCS circle, the song floats in a hazy cloud',
  [DesignPreset.Custom]: 'Arranged your way',
};

export const BUILT_IN_PRESETS = Object.values(DesignPreset).filter(
  (preset): preset is BuiltInPreset => preset !== DesignPreset.Custom
);

// What a reset puts back, besides the layout: how everything is drawn, the corners and edges, the art, the song and
// the visuals. The player's size isn't part of a design, it stays.
const RESET_SETTINGS = [
  'isHalftoneColorFromCover',
  'halftoneColor',
  'isTextShadowEnabled',
  'accentSource',
  'accentColor',
  'controlScale',
  'fontStyle',
  'backdropStrength',
  'isAlwaysShowControls',
  'cornerRadius',
  'isEdgeHazeEnabled',
  'edgeHaze',
  'isCoverCenteredHorizontally',
  'isCoverCenteredVertically',
  'artZoom',
  'artBrightness',
  'artSaturation',
  'artBlur',
  'isAlwaysShowTrackInfo',
  'showTrackInfoTemporarilyInSeconds',
  'isAlbumShown',
  'isAlwaysShowSongProgress',
  'isProgressAroundWindow',
  'isProgressBarHazy',
  'barThickness',
  'barColor',
  'visualizationType',
  'visualizationId',
  'visualizerOpacity',
  'ncsZoom',
] as const;

// a custom design started out as the built-in one with its look, picking another one starts it over
const getBasePreset = (design: PlayerDesign): BuiltInPreset =>
  BUILT_IN_PRESETS.find((preset) => DESIGN_PRESETS[preset].look === design.look) ?? DesignPreset.Modern;

const useStyles = createStyles((theme, color: MantineColor) => {
  const accent = theme.colors[color][6];
  const palette = getPalette(theme);
  return {
    root: {
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    },
    // Thumbnails with their names under them, like the wallpapers in macOS
    cards: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: 8,
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
      cursor: 'pointer',
      outline: 'none',

      '&:hover > div:first-of-type': {
        boxShadow: `inset 0 0 0 1px ${palette.cardBorder}, 0 3px 10px rgba(0, 0, 0, 0.12)`,
      },
      '&:focus-visible > div:first-of-type': {
        boxShadow: `0 0 0 2px ${theme.fn.rgba(accent, 0.5)}`,
      },
    },
    cardPreview: {
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      background: palette.desk,
      boxShadow: `inset 0 0 0 1px ${palette.cardBorder}`,
      transition: 'box-shadow 0.15s',
      pointerEvents: 'none',
    },
    cardName: {
      fontSize: 11,
      fontWeight: 600,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    about: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    startOver: {
      height: 24,
      padding: '0 6px',
      border: `1px solid ${palette.fieldBorder}`,
      borderRadius: 6,
      backgroundColor: palette.field,
      color: palette.text,
      fontFamily: 'inherit',
      fontSize: 12,
      cursor: 'pointer',
    },
    banner: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.xs,
      padding: '7px 16px',
      backgroundColor: palette.banner,
      borderBottom: '1px solid rgba(249, 115, 22, 0.25)',

      '& > i': {
        color: theme.colors.orange[6],
      },
    },
    workspace: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
    },
  };
});

/**
 * Plays the controls going away and coming back, to show how they move. Returns whether they're shown, and how to
 * play it.
 */
const useReplay = (design: PlayerDesign): [boolean, () => void] => {
  const [isRevealed, setIsRevealed] = useState(true);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const designRef = useRef(design);
  designRef.current = design;

  const replay = useCallback(() => {
    clearTimeout(timeout.current);
    setIsRevealed(false);
    const { revealTime } = getDesignTiming(designRef.current);
    timeout.current = setTimeout(() => setIsRevealed(true), revealTime * 1000 + HIDDEN_PAUSE_IN_MS);
  }, []);

  useEffect(() => () => clearTimeout(timeout.current), []);
  return [isRevealed, replay];
};

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (element.isContentEditable ||
      element.tagName === 'TEXTAREA' ||
      (element.tagName === 'INPUT' && !['checkbox', 'range', 'radio'].includes((element as HTMLInputElement).type)))
  );
};

/**
 * The player's design: a built-in one to start from, the player to arrange, and an inspector for everything else
 * about its look, the window, the art, the song and the visualization.
 */
export const DesignSettings: FunctionComponent = () => {
  const color = useSectionColor();
  const { classes, theme } = useStyles(color);
  const accent = theme.colors[color][6];
  const windowDocument = useWindowDocument();
  const [preset, setPreset] = useSetting('design');
  const [storedCustomDesign, setCustomDesign] = useSetting('customDesign');
  const [, setVisualizationType] = useSetting('visualizationType');

  const customDesign = useMemo(() => normalizeDesign(storedCustomDesign), [storedCustomDesign]);
  // Changes to a built-in design while the custom one has changes of its own: shown, but only kept once confirmed
  const [pendingDesign, setPendingDesign] = useState<PlayerDesign | null>(null);
  const [confirmingStartOver, setConfirmingStartOver] = useState<BuiltInPreset | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const { control, setValue } = useFormContext<Settings>();
  const resetValues = useWatch<Settings, typeof RESET_SETTINGS>({ control, name: RESET_SETTINGS });
  const [selected, setSelected] = useState<DesignItem>();
  const [tab, setTab] = useState(InspectorTab.Presets);

  const design =
    pendingDesign ??
    (preset === DesignPreset.Custom ? customDesign : DESIGN_PRESETS[preset as BuiltInPreset] ?? MODERN_DESIGN);
  const [isRevealed, replay] = useReplay(design);
  const history = useDesignHistory(useCallback(() => setPendingDesign(null), []));

  useEffect(() => {
    if (!confirmingStartOver) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setConfirmingStartOver(null), CONFIRMATION_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [confirmingStartOver]);

  useEffect(() => {
    if (!isConfirmingReset) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setIsConfirmingReset(false), CONFIRMATION_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [isConfirmingReset]);

  // The design picked goes back to how it comes: a built-in one only has its settings changed, a custom one goes back to
  // the built-in one it started as
  const resetTo = preset === DesignPreset.Custom ? getBasePreset(customDesign) : (preset as BuiltInPreset);
  const isReset =
    preset !== DesignPreset.Custom &&
    !pendingDesign &&
    RESET_SETTINGS.every((name, index) => isEqual(resetValues[index], DEFAULT_SETTINGS[name]));

  const handleReset = useCallback(() => {
    if (!isConfirmingReset) {
      setIsConfirmingReset(true);
      return;
    }
    setIsConfirmingReset(false);
    RESET_SETTINGS.forEach((name) =>
      setValue(name as FieldPath<Settings>, cloneDeep(DEFAULT_SETTINGS[name]) as never, { shouldDirty: true })
    );
    if (preset === DesignPreset.Custom) {
      setCustomDesign(cloneDeep(DESIGN_PRESETS[resetTo]));
      setPreset(resetTo);
    }
    setPendingDesign(null);
    setSelected(undefined);
  }, [isConfirmingReset, preset, resetTo, setCustomDesign, setPreset, setValue]);

  const switchToCustom = useCallback(
    (newDesign: PlayerDesign) => {
      setCustomDesign(newDesign);
      setPreset(DesignPreset.Custom);
      setPendingDesign(null);
    },
    [setCustomDesign, setPreset]
  );

  // A built-in design stays as it is, changing it makes a custom design out of it
  const handleChange: DesignChange = useCallback(
    (change) => {
      const newDesign = change(design);
      if (preset === DesignPreset.Custom) {
        setCustomDesign(newDesign);
      } else if (!pendingDesign && isBuiltInCopy(customDesign)) {
        switchToCustom(newDesign);
      } else {
        setPendingDesign(newDesign);
      }
    },
    [customDesign, design, pendingDesign, preset, setCustomDesign, switchToCustom]
  );

  // Another design starts without the visualization, the wave button on the player brings it back
  const handlePresetSelect = useCallback(
    (id: DesignPreset) => {
      if (id !== preset) {
        setVisualizationType(VisualizationType.None);
      }
      setPreset(id);
      setPendingDesign(null);
      setIsConfirmingReset(false);
    },
    [preset, setPreset, setVisualizationType]
  );

  const handleStartOver = useCallback(
    (from: BuiltInPreset) => {
      if (!isBuiltInCopy(customDesign) && confirmingStartOver !== from) {
        setConfirmingStartOver(from);
        return;
      }
      setConfirmingStartOver(null);
      setCustomDesign(cloneDeep(DESIGN_PRESETS[from]));
    },
    [confirmingStartOver, customDesign, setCustomDesign]
  );

  const handleSelect = useCallback((item?: DesignItem) => {
    setSelected(item);
    if (item) {
      setTab(InspectorTab.Layout);
    }
  }, []);

  // Undo and redo like any editor, and the picked item goes away with delete
  const latest = useRef({ history, selected, design, handleChange });
  latest.current = { history, selected, design, handleChange };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) {
        return;
      }
      const { current } = latest;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault();
        if (key === 'y' || event.shiftKey) {
          current.history.redo();
        } else {
          current.history.undo();
        }
      } else if ((key === 'delete' || key === 'backspace') && current.selected) {
        const item = current.selected;
        if (findItem(current.design, item)) {
          event.preventDefault();
          current.handleChange((previous) => hideItem(previous, item));
        }
      }
    };
    windowDocument.addEventListener('keydown', handleKeyDown);
    return () => windowDocument.removeEventListener('keydown', handleKeyDown);
  }, [windowDocument]);

  const presets = (
    <PanelGroup title="Designs">
      <div className={classes.cards} role="radiogroup" aria-label="Design">
        {Object.values(DesignPreset).map((id) => {
          const isActive = id === preset;
          return (
            // not a button: the little player inside has buttons of its own
            <div
              key={id}
              role="radio"
              aria-checked={isActive}
              aria-label={`${PRESET_NAMES[id]}, ${PRESET_DESCRIPTIONS[id].toLowerCase()}`}
              title={PRESET_DESCRIPTIONS[id]}
              tabIndex={0}
              className={classes.card}
              onClick={() => handlePresetSelect(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handlePresetSelect(id);
                }
              }}>
              <div
                className={classes.cardPreview}
                style={isActive ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
                aria-hidden>
                <DesignPreview
                  design={id === DesignPreset.Custom ? customDesign : DESIGN_PRESETS[id]}
                  maxWidth={60}
                  maxHeight={54}
                  isRevealed
                />
              </div>
              <div className={classes.cardName} style={isActive ? { color: getAccentText(theme, color) } : undefined}>
                {PRESET_NAMES[id]}
              </div>
            </div>
          );
        })}
      </div>
      <div className={classes.about}>
        <Text size="xs" color="dimmed" style={{ flexBasis: '100%' }}>
          <b>{PRESET_NAMES[preset]}</b>: {PRESET_DESCRIPTIONS[preset]?.toLowerCase()}.
          {preset === DesignPreset.Custom
            ? ` Yours to change, it started out as ${PRESET_NAMES[resetTo]}.`
            : ' Built in, moving or changing anything on it turns it into your Custom design.'}
        </Text>
        <Button
          size="xs"
          compact
          variant={isConfirmingReset ? 'filled' : 'light'}
          color={isConfirmingReset ? 'red' : color}
          leftIcon={<i className="fa-solid fa-rotate-left" />}
          disabled={isReset}
          title={`Puts ${PRESET_NAMES[resetTo]}'s layout back, and its colors, text, corners, edges, art, song and visuals settings. The player's size stays.`}
          onClick={handleReset}>
          {isConfirmingReset ? 'Click again to reset' : `Reset to ${PRESET_NAMES[resetTo]}`}
        </Button>
        {preset === DesignPreset.Custom &&
          (confirmingStartOver ? (
            <>
              <Text size="xs" color="red" style={{ flex: 1 }}>
                Replace yours with {PRESET_NAMES[confirmingStartOver]}?
              </Text>
              <Button size="xs" compact variant="default" onClick={() => setConfirmingStartOver(null)}>
                Cancel
              </Button>
              <Button size="xs" compact color="red" onClick={() => handleStartOver(confirmingStartOver)}>
                Replace
              </Button>
            </>
          ) : (
            <select
              aria-label="Start over from a built-in design"
              className={classes.startOver}
              value=""
              onChange={(event) => handleStartOver(event.currentTarget.value as BuiltInPreset)}>
              <option value="" disabled>
                Start over from…
              </option>
              {BUILT_IN_PRESETS.map((from) => (
                <option key={from} value={from}>
                  {PRESET_NAMES[from]}
                </option>
              ))}
            </select>
          ))}
        {isConfirmingReset && (
          <Text size="xs" color="dimmed" style={{ flexBasis: '100%' }}>
            {preset === DesignPreset.Custom ? 'Your Custom design goes back to how it started, and ' : 'Its '}
            colors, text, corners, edges, art, song and visuals settings go back to how they come. The player&apos;s
            size stays. Undo brings it all back.
          </Text>
        )}
      </div>
    </PanelGroup>
  );

  return (
    <div className={classes.root}>
      {pendingDesign && (
        <div className={classes.banner}>
          <i className="fa-solid fa-circle-info" />
          <Text size="xs" style={{ flex: 1 }}>
            You already have a Custom design. Replace it with this version of {PRESET_NAMES[preset]}?
          </Text>
          <Button size="xs" compact variant="default" onClick={() => setPendingDesign(null)}>
            Keep mine
          </Button>
          <Button size="xs" compact color={color} onClick={() => switchToCustom(pendingDesign)}>
            Replace
          </Button>
        </div>
      )}

      <div className={classes.workspace}>
        <DesignStage
          design={design}
          onChange={handleChange}
          selected={selected}
          onSelect={handleSelect}
          isRevealed={isRevealed}
          onReplay={replay}
          history={history}
        />
        <DesignInspector
          tab={tab}
          onTabChange={setTab}
          presets={presets}
          design={design}
          onChange={handleChange}
          selected={selected}
          onSelect={handleSelect}
          isRevealed={isRevealed}
          onReplay={replay}
        />
      </div>
    </div>
  );
};
