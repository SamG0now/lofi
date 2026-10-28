/* eslint-disable no-console */
import { ipcRenderer, IpcRendererEvent } from 'electron';
import { omit } from 'lodash';
import React, { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { IpcMessage, MAX_CORNER_RADIUS, WindowName } from '../../constants';
import {
  AuthData,
  refreshAccessToken,
  setClientId,
  setTokenRetrievedCallback,
  stopTokenRefresh,
} from '../../main/auth';
import { CIRCLE_LOOKS, CIRCLE_MIN_HAZE, resolveDesign } from '../../models/player-design';
import { DEFAULT_SETTINGS, Settings, VisualizationType } from '../../models/settings';
import { visualizations } from '../../visualizations';
import { setMaxFrameRate } from '../../visualizations/frame-pacing';
import { AccountType, SpotifyApiInstance } from '../api/spotify-api';
import { WindowPortal } from '../components';
import { useCurrentlyPlaying } from '../contexts/currently-playing.context';
import { useSettings } from '../contexts/settings.context';
import { useWindowSize } from '../hooks/use-window-size';
import { Size } from '../models';
import { CurrentlyPlayingActions } from '../reducers/currently-playing.reducer';
import { SettingsActionType } from '../reducers/settings.reducer';
import { About } from '../windows/about';
import { Onboarding } from '../windows/onboarding';
import { SettingsWindow } from '../windows/settings';
import { Cover } from './cover';
import { flatText } from './cover/layout';
import { getEdgeStyles } from './edge-haze';
import { Welcome } from './welcome';

const LEFT_MOUSE_BUTTON = 0;
// managed outside of the settings window, saving it never overwrites them, unless the player was resized there
const SETTINGS_KEPT_ON_SAVE: (keyof Settings)[] = ['accessToken', 'refreshToken', 'x', 'y', 'width', 'height'];
const SIZE_SETTINGS: (keyof Settings)[] = ['width', 'height'];
const Haze = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
`;

const VisibleUi = styled.div`
  height: 100%;
  width: 100%;
  background: linear-gradient(135deg, #1f1f1f 0%, #2d2d2d 100%);
  position: relative;

  &:hover {
    .controls,
    .menu {
      transition: 0.1s;
      opacity: 1;
    }

    .bar {
      opacity: 0;
    }

    .welcome-content {
      filter: blur(0.5rem);
    }

    .menu .logo-typo {
      background-position: left center;
      color: #ef9671;
      transition: background-position 2000ms ease-out;
    }
  }

  .top {
    top: 0;
  }

  .right {
    right: 0;
  }

  .bottom {
    bottom: 0;
  }

  .left {
    left: 0;
  }

  ${flatText}
`;

export const App: FunctionComponent = () => {
  const [shouldShowAbout, setShouldShowAbout] = useState(false);
  const [shouldShowSettings, setShouldShowSettings] = useState(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [message, setMessage] = useState('');

  const { state, dispatch } = useSettings();
  // the setup guide opens on the first start, and after a factory reset which starts Lofi again
  const isOnboardedOnStart = useRef(state.isOnboarded);
  const { state: currentlyPlaying, dispatch: currentlyPlayingDispatch } = useCurrentlyPlaying();
  const { accessToken, refreshToken, spotifyClientId, visualizationId, visualizationType, maxFrameRate } =
    state || DEFAULT_SETTINGS;
  const { cornerRadius, edgeHaze = 0, isEdgeHazeEnabled = false } = useMemo(() => state, [state]);
  const windowSize = useWindowSize();
  // A song in NCS's circle takes over the player: it's round whatever its corners, with nothing but the circle's
  // light around it fading into the desktop. Without a song, the player stays as it is.
  const lookDesign = useMemo(() => resolveDesign(state.design, state.customDesign), [state.customDesign, state.design]);
  const isCircle = !!accessToken && !!currentlyPlaying.id && CIRCLE_LOOKS.includes(lookDesign.look);
  const { windowStyle, hazeLayers } = useMemo(() => {
    const haze = isEdgeHazeEnabled ? edgeHaze : 0;
    return isCircle
      ? getEdgeStyles(windowSize, MAX_CORNER_RADIUS, Math.max(haze, CIRCLE_MIN_HAZE))
      : getEdgeStyles(windowSize, cornerRadius, haze);
  }, [cornerRadius, edgeHaze, isCircle, isEdgeHazeEnabled, windowSize]);

  const updateTokens = useCallback(
    async (data: AuthData) => {
      if (!data || !data.access_token || !data.refresh_token) {
        stopTokenRefresh();
        dispatch({ type: SettingsActionType.ResetTokens });
      } else {
        dispatch({ type: SettingsActionType.SetTokens, payload: data });
      }

      try {
        const userProfile = await SpotifyApiInstance.updateTokens(data);
        if (userProfile) {
          currentlyPlayingDispatch({
            type: CurrentlyPlayingActions.SetUserProfile,
            payload: userProfile,
          });

          console.log(`User '${userProfile.name}' successfully authenticated.`);
        } else {
          currentlyPlayingDispatch({ type: CurrentlyPlayingActions.SetUserProfile, payload: null });
          console.error('User not authenticated.');
        }
      } catch (error) {
        console.error(error);
      }
    },
    [currentlyPlayingDispatch, dispatch]
  );

  useEffect(() => {
    if (currentlyPlaying.userProfile?.accountType === AccountType.Free && state.showFreemiumWarning) {
      const playbackDisabledMessage = 'Account is not premium, playback controls disabled.';
      console.warn(playbackDisabledMessage);
      setMessage(playbackDisabledMessage);
    } else {
      setMessage('');
    }
  }, [currentlyPlaying.userProfile?.accountType, state.showFreemiumWarning]);

  useEffect(() => {
    setTokenRetrievedCallback(updateTokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the previews in the settings window keep to it too, they're drawn from here
  useEffect(() => {
    setMaxFrameRate(maxFrameRate ?? DEFAULT_SETTINGS.maxFrameRate);
  }, [maxFrameRate]);

  // Must run before the initial token refresh below, which needs the client ID
  useEffect(() => {
    setClientId(spotifyClientId);
  }, [spotifyClientId]);

  const handleAuth = useCallback(async () => {
    try {
      if (refreshToken) {
        await refreshAccessToken(refreshToken);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      await updateTokens(null);
    }
  }, [refreshToken, updateTokens]);

  useEffect(() => {
    ipcRenderer.on(IpcMessage.ShowAbout, () => setShouldShowAbout(true));
    ipcRenderer.on(IpcMessage.ShowSettings, () => setShouldShowSettings(true));
    ipcRenderer.on(IpcMessage.ShowOnboarding, () => {
      // saving the settings would undo what's picked in the guide
      setShouldShowSettings(false);
      setShouldShowOnboarding(true);
    });

    ipcRenderer.on(IpcMessage.WindowReady, async () => {
      // once the player is in place, for the guide to open over it
      if (!isOnboardedOnStart.current) {
        setShouldShowOnboarding(true);
      }

      let animationId = 0;
      let mouseX = 0;
      let mouseY = 0;

      const moveWindow = (): void => {
        ipcRenderer.send(IpcMessage.WindowMoving, { mouseX, mouseY });
        animationId = requestAnimationFrame(moveWindow);
      };

      const onMouseUp = ({ button }: { button: number }): void => {
        if (button !== LEFT_MOUSE_BUTTON) {
          return;
        }

        ipcRenderer.send(IpcMessage.WindowMoved);
        document.removeEventListener('mouseup', onMouseUp);
        cancelAnimationFrame(animationId);
      };

      const onMouseDown = (event: MouseEvent): void => {
        const { button, clientX, clientY, target } = event;
        const targetElement = target as unknown as Element;

        const isDraggable = targetElement.classList?.contains('draggable');
        if (button !== LEFT_MOUSE_BUTTON || !isDraggable) {
          return;
        }

        cancelAnimationFrame(animationId);
        mouseX = clientX;
        mouseY = clientY;
        document.addEventListener('mouseup', onMouseUp);

        requestAnimationFrame(moveWindow);
      };

      document.getElementById('app-body').addEventListener('mousedown', onMouseDown);
    });

    ipcRenderer.on(IpcMessage.WindowMoved, (_: IpcRendererEvent, data: { x: number; y: number }) => {
      dispatch({
        type: SettingsActionType.SetWindowPos,
        payload: data,
      });
    });

    ipcRenderer.on(IpcMessage.WindowResized, (_: IpcRendererEvent, size: Size) => {
      dispatch({
        type: SettingsActionType.SetWindowSize,
        payload: size,
      });
    });
  }, [dispatch]);

  useEffect(() => {
    handleAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The settings window may stay open for a while: the login and the player's bounds it holds can be outdated
  const handleSettingsSave = useCallback(
    (data: Settings, isResized: boolean) => {
      const kept = isResized
        ? SETTINGS_KEPT_ON_SAVE.filter((key) => !SIZE_SETTINGS.includes(key))
        : SETTINGS_KEPT_ON_SAVE;
      const settings = { ...state, ...omit(data, kept) };
      dispatch({
        type: SettingsActionType.UpdateSettings,
        payload: settings,
      });
      ipcRenderer.send(IpcMessage.SettingsChanged, settings);

      // Tokens are tied to the Spotify app that issued them
      if (settings.spotifyClientId !== spotifyClientId) {
        updateTokens(null);
      }
    },
    [dispatch, spotifyClientId, state, updateTokens]
  );

  const handleOnboardingSave = useCallback(
    (values: Partial<Settings>, isResized = false) => handleSettingsSave({ ...state, ...values }, isResized),
    [handleSettingsSave, state]
  );

  // Finished or put away, it only opens again when asked for
  const closeOnboarding = useCallback(() => {
    setShouldShowOnboarding(false);
    dispatch({ type: SettingsActionType.SetOnboarded });
  }, [dispatch]);

  const handleVisualizationChange = useCallback(() => {
    dispatch({
      type: SettingsActionType.SetVisualizationType,
      payload: visualizationType === VisualizationType.None ? VisualizationType.Small : VisualizationType.None,
    });
  }, [dispatch, visualizationType]);

  const handleVisualizationCycle = useCallback(
    (isPrevious: boolean) => {
      let id: number;
      if (isPrevious) {
        id = visualizationId === 0 ? visualizations.length - 1 : visualizationId - 1;
      } else {
        id = visualizationId === visualizations.length - 1 ? 0 : visualizationId + 1;
      }
      dispatch({
        type: SettingsActionType.SetVisualization,
        payload: id,
      });
    },
    [dispatch, visualizationId]
  );

  return (
    <VisibleUi
      id="visible-ui"
      className={state.isTextShadowEnabled === false ? 'click-on no-text-shadow' : 'click-on'}
      style={isCircle ? { ...windowStyle, background: 'transparent' } : windowStyle}>
      {shouldShowSettings && (
        <WindowPortal onUnload={() => setShouldShowSettings(false)} name={WindowName.Settings}>
          <SettingsWindow
            initialValues={state}
            onSave={handleSettingsSave}
            onClose={() => setShouldShowSettings(false)}
            onLogout={() => updateTokens(null)}
          />
        </WindowPortal>
      )}

      {shouldShowAbout && (
        <WindowPortal onUnload={() => setShouldShowAbout(false)} name={WindowName.About}>
          <About onClose={() => setShouldShowAbout(false)} />
        </WindowPortal>
      )}

      {shouldShowOnboarding && (
        <WindowPortal onUnload={closeOnboarding} name={WindowName.Onboarding}>
          <Onboarding
            initialValues={state}
            onSave={handleOnboardingSave}
            onLogout={() => updateTokens(null)}
            onClose={closeOnboarding}
          />
        </WindowPortal>
      )}

      {accessToken ? (
        <Cover
          settings={state}
          message={message}
          onVisualizationChange={handleVisualizationChange}
          onVisualizationCycle={handleVisualizationCycle}
        />
      ) : (
        <Welcome />
      )}
      {/* around the circle there's only the desktop, which the haze would mist over */}
      {!isCircle &&
        hazeLayers.map((style, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Haze key={index} style={style} />
        ))}
    </VisibleUi>
  );
};
