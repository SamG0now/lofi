import { MouseEvent } from 'react';

import { RepeatState } from '../../../api/spotify-api';

// What the player shows, and what its controls do
export interface PlayerData {
  title: string;
  subtitle: string;
  message?: string;
  progress: number;
  duration: number;
  isPlaying: boolean;
  isLiked: boolean;
  volume: number;
  repeatState: RepeatState;
  canControlPlayback: boolean;
  isVisualizing: boolean;
}

export interface PlayerActions {
  onSettings: () => void;
  onClose: () => void;
  onAbout: () => void;
  onVisualizationCycle: (event: MouseEvent) => void;
  onVisualizationToggle: () => void;
  onLike: () => void;
  onRepeat: () => void;
  onMute: () => void;
  onSkip: (isForward: boolean, event: MouseEvent) => void;
  onPlayPause: () => void;
  onSeek: (event: MouseEvent<HTMLDivElement>) => void;
}
