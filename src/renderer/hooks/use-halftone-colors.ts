import { useMemo } from 'react';

import { DEFAULT_SETTINGS } from '../../models/settings';
import { getPaperColor, isHexColor, rgbToHex } from '../colors';
import { useCoverPalette } from './use-cover-palette';

export interface HalftoneColors {
  // the dots, icons and text
  ink: string;
  // what they're printed on
  paper: string;
}

// The cover's main vivid color changes with each song, or the user's own color
export const useHalftoneColors = (
  coverUrl: string | undefined,
  isFromCover: boolean,
  color: string
): HalftoneColors => {
  const [mainColor] = useCoverPalette(isFromCover ? coverUrl : undefined);
  return useMemo(() => {
    let ink = isHexColor(color) ? color : DEFAULT_SETTINGS.halftoneColor;
    if (isFromCover) {
      ink = rgbToHex(mainColor);
    }
    return { ink, paper: getPaperColor(ink) };
  }, [color, isFromCover, mainColor]);
};
