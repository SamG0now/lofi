import { isEqual } from 'lodash';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { FieldPath, useFormContext, useWatch } from 'react-hook-form';

import { Settings } from '../../../models/settings';

// Everything the Design section changes, undone and redone together
const DESIGN_SETTINGS = [
  'design',
  'customDesign',
  'isHalftoneColorFromCover',
  'halftoneColor',
  'isTextShadowEnabled',
  'accentSource',
  'accentColor',
  'controlScale',
  'fontStyle',
  'backdropStrength',
  'isAlwaysShowControls',
  'width',
  'height',
  'isAlwaysSquare',
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

type Snapshot = readonly unknown[];

// a slider dragged or a color picked is one step, once it has stayed put for a moment
const SETTLE_IN_MS = 350;
const MAX_STEPS = 100;

export interface DesignHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** Undo and redo for the Design section, through its settings in the form. */
export const useDesignHistory = (onRestore?: () => void): DesignHistory => {
  const { control, getValues, setValue } = useFormContext<Settings>();
  const values = useWatch<Settings, typeof DESIGN_SETTINGS>({ control, name: DESIGN_SETTINGS }) as Snapshot;
  const steps = useRef<Snapshot[]>([values]);
  const index = useRef(0);
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  const latestValues = useRef(values);
  latestValues.current = values;

  const record = useCallback((snapshot: Snapshot) => {
    if (isEqual(snapshot, steps.current[index.current])) {
      return;
    }
    steps.current = [...steps.current.slice(0, index.current + 1), snapshot].slice(-MAX_STEPS);
    index.current = steps.current.length - 1;
    refresh();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => record(values), SETTLE_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [record, values]);

  const restore = useCallback(
    (snapshot: Snapshot) => {
      DESIGN_SETTINGS.forEach((name, position) => {
        const path = name as FieldPath<Settings>;
        if (!isEqual(getValues(path), snapshot[position])) {
          setValue(path, snapshot[position] as never, { shouldDirty: true });
        }
      });
      onRestore?.();
      refresh();
    },
    [getValues, onRestore, setValue]
  );

  const undo = useCallback(() => {
    // a change that hasn't settled yet is the first to be undone
    record(latestValues.current);
    if (index.current > 0) {
      index.current -= 1;
      restore(steps.current[index.current]);
    }
  }, [record, restore]);

  const redo = useCallback(() => {
    if (index.current < steps.current.length - 1) {
      index.current += 1;
      restore(steps.current[index.current]);
    }
  }, [restore]);

  const isUnsettled = !isEqual(values, steps.current[index.current]);
  return {
    canUndo: index.current > 0 || isUnsettled,
    canRedo: !isUnsettled && index.current < steps.current.length - 1,
    undo,
    redo,
  };
};
