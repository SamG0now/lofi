import { useEffect, useState } from 'react';

import { Size } from '../models';

const getWindowSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

// Updates while the window is being resized, unlike the size in the settings which is saved once it's done
export const useWindowSize = (): Size => {
  const [size, setSize] = useState<Size>(getWindowSize);

  useEffect(() => {
    const handleResize = (): void => setSize(getWindowSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};
