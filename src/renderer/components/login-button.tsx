import { ipcRenderer } from 'electron';
import React, { FunctionComponent, useCallback } from 'react';
import styled from 'styled-components';

import { IpcMessage, WindowName } from '../../constants';
import { getAuthUrl, setClientId, startAuthServer } from '../../main/auth';
import { useSettings } from '../contexts/settings.context';

const Button = styled.button`
  margin: auto;
  background-color: black;
  padding: 1rem;
  color: white;
  border: 1px solid transparent;
  font: inherit;
  cursor: pointer;
  transition: transform 0.2s;
  vertical-align: middle;
  font-size: 12px;

  i {
    color: #84bd00;
  }

  &:hover {
    background-color: #222;
    transform: scale(1.05);
    border: 1px solid #000;
  }

  &:active {
    background-color: #000;
    border: 1px solid rgb(65, 65, 65);
  }
`;

const SpotifyLogo = styled.i`
  margin-right: 0.5rem;
`;

// Opens Spotify's login page in the browser, the auth server then receives the redirect
export const logIn = (clientId: string): void => {
  setClientId(clientId);
  startAuthServer();
  window.open(getAuthUrl(), WindowName.Auth);
};

export const LoginButton: FunctionComponent = () => {
  const {
    state: { spotifyClientId },
  } = useSettings();

  const handleClick = useCallback(() => {
    // Logging in requires a Spotify app of your own, the setup guide walks through making one
    if (!spotifyClientId) {
      ipcRenderer.send(IpcMessage.ShowOnboarding);
      return;
    }

    logIn(spotifyClientId);
  }, [spotifyClientId]);

  return (
    <Button type="button" className="login-btn" onClick={handleClick}>
      <SpotifyLogo className="fab fa-spotify" />
      <span>{spotifyClientId ? 'Log in' : 'Set up'}</span>
    </Button>
  );
};
