import { createStyles, Text } from '@mantine/core';
import React, { FunctionComponent, useCallback, useMemo } from 'react';

import { DESIGN_PRESETS, DesignPreset, resolveDesign } from '../../../models/player-design';
import { VisualizationType } from '../../../models/settings';
import { useSetting } from '../settings/design-controls';
import { DesignPreview } from '../settings/design-preview';
import { BUILT_IN_PRESETS, PRESET_DESCRIPTIONS, PRESET_NAMES } from '../settings/design-settings';
import { StepHeader } from './parts';

const ACCENT = '#0d9488';
const DESK = 'linear-gradient(160deg, #e0ecff 0%, #fbe7f3 55%, #fff1dc 100%)';

const useStyles = createStyles((theme) => ({
  stage: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xl,
    height: 196,
    padding: `0 ${theme.spacing.xl}`,
    marginBottom: theme.spacing.md,
    borderRadius: 14,
    background: DESK,
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.06)',
  },
  stagePlayer: {
    width: 170,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
  },
  // Thumbnails with their names under them, like the wallpapers in macOS
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    minWidth: 0,
    cursor: 'pointer',
    outline: 'none',

    '&:hover > div:first-of-type': {
      boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 3px 10px rgba(0, 0, 0, 0.12)',
    },
    '&:focus-visible > div:first-of-type': {
      boxShadow: `0 0 0 2px ${theme.fn.rgba(ACCENT, 0.5)}`,
    },
  },
  cardPreview: {
    height: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    background: DESK,
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.06)',
    transition: 'box-shadow 0.15s',
    pointerEvents: 'none',
  },
  cardName: {
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}));

/** The built-in designs to pick from, the one picked shown big with the song on it. */
export const DesignStep: FunctionComponent = () => {
  const { classes } = useStyles();
  const [preset, setPreset] = useSetting('design');
  const [customDesign] = useSetting('customDesign');
  const [, setVisualizationType] = useSetting('visualizationType');
  const design = useMemo(() => resolveDesign(preset, customDesign), [customDesign, preset]);
  // the guide can be opened again later, a design of one's own stays to pick
  const presets: DesignPreset[] =
    preset === DesignPreset.Custom ? [...BUILT_IN_PRESETS, DesignPreset.Custom] : BUILT_IN_PRESETS;

  // Another design starts without the visualization, as it does in the settings
  const handleSelect = useCallback(
    (id: DesignPreset) => {
      if (id !== preset) {
        setVisualizationType(VisualizationType.None);
      }
      setPreset(id);
    },
    [preset, setPreset, setVisualizationType]
  );

  return (
    <>
      <StepHeader
        title="Pick a design"
        subtitle="How your player looks. Every part of it can be moved, resized and recolored later in Settings → Design."
      />

      <div className={classes.stage}>
        <div className={classes.stagePlayer}>
          <DesignPreview design={design} maxWidth={170} maxHeight={170} isRevealed isShowingTrackInfo />
        </div>
        <div style={{ minWidth: 0 }}>
          <Text size="lg" weight={700}>
            {PRESET_NAMES[preset]}
          </Text>
          <Text size="sm" color="dimmed" style={{ lineHeight: 1.45 }}>
            {PRESET_DESCRIPTIONS[preset]}.
          </Text>
        </div>
      </div>

      <div className={classes.cards} role="radiogroup" aria-label="Design">
        {presets.map((id) => {
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
              onClick={() => handleSelect(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSelect(id);
                }
              }}>
              <div
                className={classes.cardPreview}
                style={isActive ? { boxShadow: `0 0 0 2px ${ACCENT}` } : undefined}
                aria-hidden>
                <DesignPreview
                  design={id === DesignPreset.Custom ? resolveDesign(id, customDesign) : DESIGN_PRESETS[id]}
                  maxWidth={64}
                  maxHeight={58}
                  isRevealed
                />
              </div>
              <div className={classes.cardName} style={isActive ? { color: ACCENT } : undefined}>
                {PRESET_NAMES[id]}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
