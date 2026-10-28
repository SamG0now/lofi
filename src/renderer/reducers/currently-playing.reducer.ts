import { RepeatState, SpotifyCurrentlyPlaying, SpotifyUserProfile } from '../api/spotify-api';

export enum CurrentlyPlayingType {
  Unknown = 'unknown',
  Track = 'track',
  Ad = 'ad',
  Episode = 'episode',
}

export interface CurrentlyPlaying {
  id: string;
  uri: string;
  type: CurrentlyPlayingType;
  track: string;
  artist: string;
  album: string;
  progress: number;
  duration: number;
  isPlaying: boolean;
  cover: string;
  volume: number;
  repeatState: RepeatState;
  isLiked: boolean;
  userProfile: SpotifyUserProfile | null;
}

export const INITIAL_STATE: CurrentlyPlaying = {
  id: '',
  uri: '',
  type: CurrentlyPlayingType.Unknown,
  track: '',
  artist: '',
  album: '',
  progress: 0,
  duration: 0,
  isPlaying: false,
  cover: '',
  volume: 0,
  repeatState: RepeatState.Off,
  isLiked: false,
  userProfile: null,
};

export enum CurrentlyPlayingActions {
  SetCurrentlyPlaying = 'setCurrentlyPlaying',
  SetTrackLiked = 'setTrackLiked',
  SetUserProfile = 'setUserProfile',
}

export type CurrentlyPlayingAction =
  | {
      type: CurrentlyPlayingActions.SetCurrentlyPlaying;
      payload: SpotifyCurrentlyPlaying;
    }
  | {
      type: CurrentlyPlayingActions.SetTrackLiked;
      payload: boolean;
    }
  | {
      type: CurrentlyPlayingActions.SetUserProfile;
      payload: SpotifyUserProfile;
    };

export const useCurrentlyPlayingReducer = (
  state: CurrentlyPlaying,
  action: CurrentlyPlayingAction
): CurrentlyPlaying => {
  switch (action.type) {
    case CurrentlyPlayingActions.SetCurrentlyPlaying: {
      if (!action.payload) {
        return state;
      }
      const { item, progress_ms: progress, is_playing: isPlaying, device, repeat_state: repeatState } = action.payload;
      if (!item) {
        return state;
      }
      const { album, artists, description, duration_ms: durationMs, id, images, name, show, type, uri } = item;
      const next: CurrentlyPlaying = {
        ...state,
        id,
        uri,
        type: type as CurrentlyPlayingType,
        track: name,
        // podcast episodes have a show instead of artists and an album
        artist: artists?.map(({ name: artistName }) => artistName).join(', ') || show?.name || description,
        album: album?.name ?? '',
        progress,
        duration: durationMs,
        isPlaying,
        // eslint-disable-next-line no-nested-ternary
        cover: album?.images?.length > 0 ? album.images[0].url : images?.length > 0 ? images[0].url : '',
        volume: device?.volume_percent ?? state.volume,
        repeatState: repeatState ?? state.repeatState,
      };
      // it's polled every second or so: while paused nothing changes, and nothing has to be drawn again
      const isUnchanged = (Object.keys(next) as (keyof CurrentlyPlaying)[]).every((key) => next[key] === state[key]);
      return isUnchanged ? state : next;
    }

    case CurrentlyPlayingActions.SetUserProfile: {
      return {
        ...state,
        userProfile: action.payload,
      };
    }

    case CurrentlyPlayingActions.SetTrackLiked: {
      return {
        ...state,
        isLiked: action.payload,
      };
    }

    default: {
      return state;
    }
  }
};
