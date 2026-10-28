import { useMemo } from 'react';

import { AccentSource } from '../../models/settings';
import { isHexColor, rgbToHex } from '../colors';
import { useCoverPalette } from './use-cover-palette';

/** The color of switched on buttons and the progress: none for the look's own, the cover's main color or the user's. */
export const useAccentColor = (
  coverUrl: string | undefined,
  source: AccentSource,
  color: string
): string | undefined => {
  const [mainColor] = useCoverPalette(source === AccentSource.Cover ? coverUrl : undefined);
  return useMemo(() => {
    if (source === AccentSource.Cover) {
      return rgbToHex(mainColor);
    }
    return source === AccentSource.Own && isHexColor(color) ? color : undefined;
  }, [color, mainColor, source]);
};
