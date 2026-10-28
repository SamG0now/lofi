export interface SpotifyErrorResponse {
  error?: {
    status: number;
    message: string;
    reason?: string;
  };
}

export class SpotifyApiError extends Error {
  status: number;

  reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(`${status}: ${message}`);
    this.status = status;
    this.reason = reason;
  }
}
