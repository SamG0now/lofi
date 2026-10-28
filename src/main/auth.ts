/* eslint-disable no-console */
import crypto from 'crypto';
import * as http from 'http';

export interface AuthData {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  scope?: string;
}

let server: http.Server;
let codeState: string;
let codeVerifier: string;
let clientId = '';
let refreshTokenTimeoutId: NodeJS.Timeout;
let refreshRequest: Promise<void> = null;
let onTokenRetrieved: (data: AuthData) => void = null;

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const AUTH_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTH_HOST = '127.0.0.1';
const AUTH_PORT = 41419;
// Spotify no longer accepts 'localhost' redirect URIs, only explicit loopback addresses
export const AUTH_REDIRECT_URI = `http://${AUTH_HOST}:${AUTH_PORT}`;
const AUTH_RETRY_DELAY_IN_SECONDS = 30;
const AUTH_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-private',
  'user-library-read',
  'user-library-modify',
  'user-read-email',
];

const base64URLEncode = (str: Buffer): string =>
  str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const sha256 = (str: string): Buffer => crypto.createHash('sha256').update(str).digest();

export const setTokenRetrievedCallback = (callback: (data: AuthData) => void): void => {
  if (onTokenRetrieved) {
    console.warn('Token retrieved callback already set, it should only be set once.');
  }

  onTokenRetrieved = callback;
};

// Every user registers their own Spotify app, so the client ID comes from the settings
export const setClientId = (id: string): void => {
  clientId = id?.trim() ?? '';
};

export const getAuthUrl = (): string => {
  codeVerifier = base64URLEncode(crypto.randomBytes(32));
  codeState = base64URLEncode(crypto.randomBytes(32));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: AUTH_REDIRECT_URI,
    scope: AUTH_SCOPES.join(' '),
    state: codeState,
    code_challenge: base64URLEncode(sha256(codeVerifier)),
    code_challenge_method: 'S256',
  });

  return `${AUTH_URL}?${params}`;
};

const hasRequiredScopes = (scope: string): boolean => {
  const tokenScopes = scope?.split(' ') ?? [];
  return AUTH_SCOPES.every((requiredScope) => tokenScopes.includes(requiredScope));
};

const scheduleTokenRefresh = (refreshToken: string, delayInSeconds: number): void => {
  if (refreshTokenTimeoutId) {
    clearTimeout(refreshTokenTimeoutId);
    refreshTokenTimeoutId = null;
  }

  if (refreshToken) {
    refreshTokenTimeoutId = setTimeout(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      () => refreshAccessToken(refreshToken),
      delayInSeconds * 1000
    );
  }
};

const setRefreshTokenInterval = (data: AuthData): void => {
  // refresh at token's half-life ('expires_in' is in seconds)
  scheduleTokenRefresh(data?.refresh_token, (data?.expires_in ?? 60 * 60) / 2);
};

export const stopTokenRefresh = (): void => setRefreshTokenInterval(null);

const requestRefreshedToken = async (refreshToken: string): Promise<void> => {
  console.log('Refreshing access token...');

  let res: Response;
  try {
    res = await fetch(AUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
  } catch (error) {
    // Offline (e.g. right after boot or resume), keep the current tokens and try again later
    console.warn(`Could not reach Spotify, retrying in ${AUTH_RETRY_DELAY_IN_SECONDS}s...`, error);
    scheduleTokenRefresh(refreshToken, AUTH_RETRY_DELAY_IN_SECONDS);
    return;
  }

  let data = await res.json().catch((): null => null);

  if (res.status >= 500 || res.status === 429) {
    console.warn(`status ${res.status}: Spotify unavailable, retrying in ${AUTH_RETRY_DELAY_IN_SECONDS}s...`);
    scheduleTokenRefresh(refreshToken, AUTH_RETRY_DELAY_IN_SECONDS);
    return;
  }

  if (res.status !== 200) {
    console.error(`status ${res.status}: Failed to refresh access token\n  ${data?.error}: ${data?.error_description}`);
    data = null;
  } else if (!hasRequiredScopes(data.scope)) {
    console.warn(
      `Authorization scopes mismatch\n    Expected: ${AUTH_SCOPES.join(' ')}\n    Token has: '${data.scope}`
    );
    data = null;
  } else {
    // Spotify may or may not rotate the refresh token, keep using the current one if it doesn't
    data.refresh_token = data.refresh_token ?? refreshToken;
    console.log('Access token refreshed.');
  }

  setRefreshTokenInterval(data);
  onTokenRetrieved(data);
};

export const refreshAccessToken = (refreshToken: string): Promise<void> => {
  // Concurrent 401s must not trigger parallel refreshes, a rotated refresh token can only be used once
  if (!refreshRequest) {
    refreshRequest = requestRefreshedToken(refreshToken).finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
};

const retrieveAccessToken = async (verifier: string, code: string): Promise<AuthData> => {
  console.log('Retrieving access token...');

  const res = await fetch(AUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: AUTH_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (res.status !== 200) {
    const errorText = await res.text();
    throw new Error(`status ${res.status}: Failed to retrieve access token\n${errorText}`);
  }

  console.log('Access token retrieved.');

  return res.json();
};

const stopServer = (): void => {
  if (server) {
    server.close();
    server = null;
    console.log('Auth server stopped.');
  }
};

const handleServerResponse = async (request: http.IncomingMessage, response: http.ServerResponse): Promise<void> => {
  const urlObj = new URL(request.url, AUTH_REDIRECT_URI);

  // Ignore anything that isn't the redirect itself, e.g. the browser asking for favicon.ico
  if (urlObj.pathname !== '/') {
    response.writeHead(404);
    response.end();
    return;
  }

  response.setHeader('Content-Type', 'text/plain; charset=utf-8');

  try {
    if (urlObj.searchParams.get('state') !== codeState) {
      console.error('Invalid state', urlObj.toString());
      response.end('Lofi authorization error: invalid state, you may close this window and retry.');
      return;
    }

    const error = urlObj.searchParams.get('error');
    if (error) {
      console.error(error);
      response.end(`Lofi authorization error '${error}', you may close this window and retry.`);
      return;
    }

    const code = urlObj.searchParams.get('code');
    if (code) {
      const data = await retrieveAccessToken(codeVerifier, code);
      setRefreshTokenInterval(data);
      response.end('Lofi authorization successful, you may now close this window.');
      onTokenRetrieved(data);
    }
  } catch (e) {
    console.error(e);
    response.end('Lofi authorization failed, you may close this window and retry.');
  } finally {
    stopServer();
  }
};

export const startAuthServer = (): void => {
  console.log('Starting auth server...');
  if (!server) {
    server = http.createServer(async (request, response) => {
      await handleServerResponse(request, response);
    });

    server.on('error', (error) => {
      console.error(`Auth server error: ${error.message}`);
      server = null;
    });

    // Only listen on the loopback interface, the redirect never comes from the network
    server.listen(AUTH_PORT, AUTH_HOST);
  }
};
