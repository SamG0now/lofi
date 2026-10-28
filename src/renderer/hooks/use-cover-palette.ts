import { useEffect, useState } from 'react';

import { Palette } from '../../visualizations/models';
import { DEFAULT_PALETTE, getCoverPalette } from '../../visualizations/palette';

// The cover's colors, they stay on the previous cover's while the new one loads
export const useCoverPalette = (coverUrl?: string): Palette => {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    let isCurrent = true;
    getCoverPalette(coverUrl).then((coverPalette) => isCurrent && setPalette(coverPalette));
    return () => {
      isCurrent = false;
    };
  }, [coverUrl]);

  return palette;
};
