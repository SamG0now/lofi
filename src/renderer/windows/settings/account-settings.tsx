import { ActionIcon, Anchor, Avatar, Badge, Button, Group, Text, TextInput } from '@mantine/core';
import { ipcRenderer } from 'electron';
import { capitalize } from 'lodash';
import React, { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { ApplicationUrl, IpcMessage } from '../../../constants';
import { AUTH_REDIRECT_URI } from '../../../main/auth';
import { Settings } from '../../../models/settings';
import { AccountType } from '../../api/spotify-api';
import { useWindowDocument } from '../../components';
import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { CurrentlyPlayingActions } from '../../reducers/currently-playing.reducer';
import { SettingRow, SettingsGroup, SettingsSection } from './fields';

// 32 hexadecimal characters, or nothing
export const CLIENT_ID_REGEX = /^\s*([0-9a-f]{32})?\s*$/i;
const COPIED_FEEDBACK_IN_MS = 1500;
const MONOSPACE_INPUT = { input: { fontFamily: 'monospace' } };

interface Props {
  onLogin: () => void;
  onLogout: () => void;
}

export const AccountSettings: FunctionComponent<Props> = ({ onLogin, onLogout }) => {
  const {
    state: { userProfile },
    dispatch,
  } = useCurrentlyPlaying();
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<Settings>();
  const windowDocument = useWindowDocument();
  const [isCopied, setIsCopied] = useState(false);
  const clientId = watch('spotifyClientId');

  useEffect(() => {
    if (!isCopied) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  const handleLogoutClick = useCallback(() => {
    onLogout();
    dispatch({
      type: CurrentlyPlayingActions.SetUserProfile,
      payload: null,
    });
  }, [dispatch, onLogout]);

  const openDashboard = useCallback(() => {
    ipcRenderer.send(IpcMessage.OpenLink, ApplicationUrl.SpotifyDashboard);
  }, []);

  // Use the clipboard of the settings window, it has focus rather than the main window
  const copyRedirectUri = useCallback(async () => {
    await windowDocument.defaultView.navigator.clipboard.writeText(AUTH_REDIRECT_URI);
    setIsCopied(true);
  }, [windowDocument]);

  return (
    <SettingsSection description="Lofi talks to Spotify through a Spotify app that you register.">
      <SettingsGroup>
        {userProfile ? (
          <Group position="apart" noWrap>
            <Group noWrap spacing="sm">
              <Avatar src={userProfile.avatar || null} size="lg" radius="xl" color="green">
                <i className="fa-solid fa-user" />
              </Avatar>
              <div>
                <Text weight={600}>{userProfile.name}</Text>
                {userProfile.email && (
                  <Text size="xs" color="dimmed">
                    {userProfile.email}
                  </Text>
                )}
                {userProfile.accountType !== AccountType.Unknown && (
                  <Badge
                    mt={4}
                    size="sm"
                    variant="light"
                    color={userProfile.accountType === AccountType.Premium ? 'green' : 'gray'}>
                    {capitalize(userProfile.accountType)}
                  </Badge>
                )}
              </div>
            </Group>
            <Button variant="default" size="xs" onClick={handleLogoutClick}>
              Log out
            </Button>
          </Group>
        ) : (
          <Group position="apart" noWrap>
            <Text size="sm" color="dimmed">
              {clientId?.trim() ? 'Not logged in' : 'Set up your Spotify app below to log in'}
            </Text>
            <Button
              size="xs"
              color="green"
              leftIcon={<i className="fa-brands fa-spotify" />}
              disabled={!clientId?.trim() || !!errors.spotifyClientId}
              onClick={onLogin}>
              Log in with Spotify
            </Button>
          </Group>
        )}
      </SettingsGroup>

      <SettingsGroup title="Spotify app">
        <Text size="sm" color="dimmed">
          Create an app on the{' '}
          <Anchor component="button" type="button" color="green" onClick={openDashboard}>
            Spotify developer dashboard
          </Anchor>{' '}
          and select <b>Web API</b>. Add the redirect URI below to it exactly as shown, save it, then paste its client
          ID here.
        </Text>
        <SettingRow label="Redirect URI">
          <TextInput
            size="xs"
            w={290}
            readOnly
            value={AUTH_REDIRECT_URI}
            styles={MONOSPACE_INPUT}
            rightSection={
              <ActionIcon size="sm" onClick={copyRedirectUri} color={isCopied ? 'green' : 'gray'} title="Copy">
                <i className={isCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} />
              </ActionIcon>
            }
          />
        </SettingRow>
        <SettingRow label="Client ID" description="Changing it logs you out">
          <TextInput
            size="xs"
            w={290}
            placeholder="From the app's settings"
            styles={MONOSPACE_INPUT}
            error={errors.spotifyClientId?.message}
            {...register('spotifyClientId', {
              setValueAs: (value: string) => value?.trim() ?? '',
              pattern: { value: CLIENT_ID_REGEX, message: 'Must be 32 hexadecimal characters' },
            })}
          />
        </SettingRow>
      </SettingsGroup>
    </SettingsSection>
  );
};
