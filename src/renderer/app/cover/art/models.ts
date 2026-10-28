// The one color some looks print everything in, and the color they print on
export interface Inks {
  ink: string;
  paper: string;
}

// Shown when nothing is playing, in the preview in the settings
export const SAMPLE_COVER = [
  'radial-gradient(circle at 28% 30%, rgba(255, 255, 255, 0.55) 0, transparent 38%)',
  'radial-gradient(circle at 75% 72%, #38bdf8 0, transparent 55%)',
  'linear-gradient(135deg, #f472b6 0%, #fb923c 55%, #facc15 100%)',
].join(', ');

export const getCoverBackground = (coverUrl?: string): string => (coverUrl ? `url(${coverUrl})` : SAMPLE_COVER);
