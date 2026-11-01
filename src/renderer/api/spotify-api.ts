import { SPOTIFY_API_URL as API_URL } from '../../constants';
import { AuthData, refreshAccessToken } from '../../main/auth';
import { SpotifyApiError, SpotifyErrorResponse } from './spotify-api-error';

export { SpotifyApiError };

export enum AccountType {
  Free = 'free',
  Premium = 'premium',
  // Spotify stopped sharing the subscription type with Development Mode apps (February 2026)
  Unknown = 'unknown',
}

export const PREMIUM_REQUIRED_REASON = 'PREMIUM_REQUIRED';

const NO_ACTIVE_DEVICE_REASON = 'NO_ACTIVE_DEVICE';

interface SpotifyImage {
  url: string;
}

interface SpotifyAccount {
  id: string;
  product?: string;
  email?: string;
  display_name: string;
  images: SpotifyImage[];
}

export interface SpotifyUserProfile {
  id: string;
  email?: string;
  name: string;
  avatar: string;
  accountType: AccountType;
}

export enum RepeatState {
  Off = 'off',
  Context = 'context',
  Track = 'track',
}

export interface SpotifyCurrentlyPlaying {
  device: {
    volume_percent: number;
  };
  repeat_state: RepeatState;
  progress_ms: number;
  item: {
    album: {
      name: string;
      images: [
        {
          height: number;
          width: number;
          url: string;
        }
      ];
    };
    artists: [
      {
        name: string;
      }
    ];
    description: string;
    show?: {
      name: string;
    };
    id: string;
    images: [
      {
        height: number;
        width: number;
        url: string;
      }
    ];
    duration_ms: number;
    name: string;
    type: string;
    uri: string;
  };
  is_playing: boolean;
}

const getAccountType = (product?: string): AccountType => {
  switch (product) {
    case AccountType.Premium:
      return AccountType.Premium;

    case undefined:
    case null:
      return AccountType.Unknown;

    // 'free' and the legacy 'open'
    default:
      return AccountType.Free;
  }
};

class SpotifyApi {
  private isThrottled: boolean;

  private throttleTime: number;

  private accessToken: string;

  private refreshToken: string;

  async updateTokens(data: AuthData): Promise<SpotifyUserProfile> {
    this.accessToken = data?.access_token;
    this.refreshToken = data?.refresh_token;

    if (!this.accessToken) {
      return null;
    }

    const userProfile = await this.fetch<SpotifyAccount>('/me', {
      method: 'GET',
    });

    return {
      id: userProfile?.id,
      email: userProfile?.email,
      accountType: getAccountType(userProfile?.product),
      name: userProfile?.display_name,
      avatar: userProfile?.images?.length > 0 ? userProfile?.images[0].url : '',
    };
  }

  async getCurrentlyPlaying(): Promise<SpotifyCurrentlyPlaying> {
    return this.fetch<SpotifyCurrentlyPlaying>('/me/player?additional_types=track,episode', {
      method: 'GET',
    });
  }

  async play(pause: boolean): Promise<void> {
    await this.command(`/me/player/${pause ? 'pause' : 'play'}`, 'PUT');
  }

  async skip(isForward: boolean): Promise<void> {
    await this.command(`/me/player/${isForward ? 'next' : 'previous'}`, 'POST');
  }

  // The per-type /me/tracks endpoints were replaced by /me/library, which takes URIs instead of IDs
  async like(isLiked: boolean, uri: string): Promise<void> {
    const verb = isLiked ? 'DELETE' : 'PUT';
    await this.fetch(`/me/library?uris=${encodeURIComponent(uri)}`, {
      method: verb,
    });
  }

  async isTrackLiked(uri: string): Promise<boolean> {
    const likedResponse: Array<boolean> = await this.fetch(`/me/library/contains?uris=${encodeURIComponent(uri)}`, {
      method: 'GET',
    });

    if (!likedResponse || likedResponse.length === 0) {
      return false;
    }
    return likedResponse[0];
  }

  async seek(newProgress: number): Promise<void> {
    await this.command(`/me/player/seek?position_ms=${Math.max(0, Math.round(newProgress))}`, 'PUT');
  }

  async setVolume(newVolume: number): Promise<void> {
    await this.command(`/me/player/volume?volume_percent=${newVolume}`, 'PUT');
  }

  async setRepeat(repeatState: RepeatState): Promise<void> {
    await this.command(`/me/player/repeat?state=${repeatState}`, 'PUT');
  }

  // Spotify stops accepting commands once a device goes idle, even while it still reports the song,
  // so wake the user's device (keeping its play/pause state) and retry once
  private async command(path: string, method: string): Promise<void> {
    try {
      await this.fetch(path, { method });
    } catch (error) {
      if (!(error instanceof SpotifyApiError) || error.reason !== NO_ACTIVE_DEVICE_REASON) {
        throw error;
      }
      const response = await this.fetch<{ devices: { id: string | null; is_active: boolean }[] }>(
        '/me/player/devices',
        { method: 'GET' }
      );
      const devices = response?.devices?.filter((device) => device.id) ?? [];
      const device = devices.find((d) => d.is_active) ?? devices[0];
      if (!device) {
        throw new SpotifyApiError(404, 'No Spotify device found. Open Spotify and play something first.', error.reason);
      }
      await this.fetch('/me/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: [device.id] }),
      });
      await this.fetch(path, { method });
    }
  }

  private async fetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    if (!this.accessToken) {
      return null;
    }

    if (this.isThrottled) {
      const timeLeft = this.throttleTime - new Date().getTime();
      if (timeLeft > 0) {
        throw new Error(`API calls throttled, wait ${Math.round(timeLeft / 1000)}s...`);
      }
      this.isThrottled = false;
    }

    const initWithBearer = {
      ...init,
      headers: new Headers({
        ...(init?.headers as Record<string, string>),
        Authorization: `Bearer ${this.accessToken}`,
      }),
    };

    const res = await fetch(API_URL + input, initWithBearer);
    if (res.ok) {
      // Player and library commands answer with an empty body (204, or 200 without content),
      // or with a plain-text ID (next/previous), so only JSON bodies are parsed
      const body = await res.text();
      const isJson = res.headers.get('content-type')?.includes('json');
      return body && isJson ? JSON.parse(body) : null;
    }

    switch (res.status) {
      case 401: {
        if (this.refreshToken) {
          await refreshAccessToken(this.refreshToken);
        }
        break;
      }
      case 429: {
        const retryAfter = parseInt(res.headers.get('retry-after'), 10) + 1;
        if (retryAfter) {
          this.throttleTime = new Date().getTime() + retryAfter * 1000;
          this.isThrottled = true;
        }
        break;
      }
      default: {
        break;
      }
    }

    const { error } = await res
      .clone()
      .json()
      .catch((): SpotifyErrorResponse => ({}));
    // Some errors, like an account the Spotify app doesn't allow, come back as plain text
    const text = error ? '' : await res.text().catch(() => '');
    throw new SpotifyApiError(res.status, error?.message || text.trim() || res.statusText, error?.reason);
  }
}

export const SpotifyApiInstance = new SpotifyApi();
