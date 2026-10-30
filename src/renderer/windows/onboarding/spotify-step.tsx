import { ActionIcon, Avatar, Badge, Button, createStyles, Text, TextInput } from '@mantine/core';
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
import { CLIENT_ID_REGEX } from '../settings/account-settings';
import { Note, StepHeader, useGuideStyles } from './parts';

const COPIED_FEEDBACK_IN_MS = 1500;
const MONOSPACE_INPUT = { input: { fontFamily: 'monospace', fontSize: 12 } };
const SPOTIFY_GREEN = '#16a34a';

const useStyles = createStyles((theme) => ({
  instructions: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    counterReset: 'instruction',
  },
  instruction: {
    position: 'relative',
    paddingLeft: '48px !important',
    counterIncrement: 'instruction',
    fontSize: theme.fontSizes.sm,
    lineHeight: 1.5,

    // the number in a green circle
    '&::before': {
      content: 'counter(instruction)',
      position: 'absolute',
      left: 16,
      top: 12,
      width: 22,
      height: 22,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.fn.rgba(SPOTIFY_GREEN, 0.12),
      color: SPOTIFY_GREEN,
      fontSize: 12,
      fontWeight: 700,
    },
  },
  field: {
    marginTop: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  waiting: {
    marginTop: theme.spacing.md,
  },
  account: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
}));

interface Props {
  onLogin: () => void;
  onLogout: () => void;
}

/** Walks through registering a Spotify app of one's own, which Spotify requires, and logging in with it. */
export const SpotifyStep: FunctionComponent<Props> = ({ onLogin, onLogout }) => {
  const { classes } = useStyles();
  const { classes: guide } = useGuideStyles();
  const windowDocument = useWindowDocument();
  const {
    state: { userProfile },
    dispatch,
  } = useCurrentlyPlaying();
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<Settings>();
  const [isCopied, setIsCopied] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const clientId = watch('spotifyClientId')?.trim() ?? '';
  const isClientIdValid = !!clientId && CLIENT_ID_REGEX.test(clientId);

  useEffect(() => {
    if (!isCopied) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  useEffect(() => {
    if (userProfile) {
      setIsWaiting(false);
    }
  }, [userProfile]);

  const openDashboard = useCallback(() => {
    ipcRenderer.send(IpcMessage.OpenLink, ApplicationUrl.SpotifyDashboard);
  }, []);

  // Use the clipboard of the guide's window, it has focus rather than the main window
  const copyRedirectUri = useCallback(async () => {
    await windowDocument.defaultView.navigator.clipboard.writeText(AUTH_REDIRECT_URI);
    setIsCopied(true);
  }, [windowDocument]);

  const handleLogin = useCallback(() => {
    setIsWaiting(true);
    onLogin();
  }, [onLogin]);

  const handleLogout = useCallback(() => {
    onLogout();
    dispatch({ type: CurrentlyPlayingActions.SetUserProfile, payload: null });
  }, [dispatch, onLogout]);

  if (userProfile) {
    const isFree = userProfile.accountType === AccountType.Free;
    return (
      <>
        <StepHeader title="Spotify is connected" subtitle="Lofi will show what's playing in Spotify, on any device." />
        <div className={classes.stack}>
          <div className={guide.card}>
            <div className={classes.account}>
              <Avatar src={userProfile.avatar || null} size={52} radius="xl" color="green">
                <i className="fa-solid fa-user" />
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text weight={600} truncate>
                  {userProfile.name}
                </Text>
                {userProfile.email && (
                  <Text size="xs" color="dimmed" truncate>
                    {userProfile.email}
                  </Text>
                )}
                {userProfile.accountType !== AccountType.Unknown && (
                  <Badge mt={4} size="sm" variant="light" color={isFree ? 'gray' : 'green'}>
                    {capitalize(userProfile.accountType)}
                  </Badge>
                )}
              </div>
              <Button variant="default" size="xs" onClick={handleLogout}>
                Log Out
              </Button>
            </div>
          </div>
          {isFree ? (
            <Note icon="fa-solid fa-triangle-exclamation" tone="warning">
              Spotify only lets Premium accounts control playback, so Lofi shows what&apos;s playing without the
              controls.
            </Note>
          ) : (
            <Note icon="fa-solid fa-circle-check" tone="success">
              All done here. Play something in Spotify and it shows up on the player.
            </Note>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <StepHeader
        title="Connect Spotify"
        subtitle="Spotify lets Lofi in through an app of your own. It's free and takes a minute, but the account that makes it needs Premium."
      />

      <Note icon="fa-solid fa-user-group">
        No Premium? Ask someone with Premium to add your Spotify name and email under <b>User Management</b> in their
        app, then use their Client ID below. You&apos;ll see what&apos;s playing, without the controls.
      </Note>

      <ol className={`${guide.card} ${classes.instructions}`}>
        <li className={classes.instruction}>
          <div className={classes.row} style={{ alignItems: 'center' }}>
            <span>Open the Spotify developer dashboard and log in.</span>
            <Button
              size="xs"
              variant="light"
              color="green"
              rightIcon={<i className="fa-solid fa-arrow-up-right-from-square" />}
              onClick={openDashboard}>
              Open Dashboard
            </Button>
          </div>
        </li>
        <li className={classes.instruction}>
          Click <b>Create app</b>. Any name and description will do, like <i>Lofi</i>.
        </li>
        <li className={classes.instruction}>
          Add this <b>Redirect URI</b> exactly as it&apos;s written:
          <TextInput
            className={classes.field}
            size="xs"
            readOnly
            value={AUTH_REDIRECT_URI}
            styles={MONOSPACE_INPUT}
            aria-label="Redirect URI"
            rightSection={
              <ActionIcon size="sm" onClick={copyRedirectUri} color={isCopied ? 'green' : 'gray'} title="Copy">
                <i className={isCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} />
              </ActionIcon>
            }
          />
        </li>
        <li className={classes.instruction}>
          Tick <b>Web API</b>, agree to the terms and click <b>Save</b>.
        </li>
        <li className={classes.instruction}>
          Open the app&apos;s <b>Settings</b>, copy its <b>Client ID</b> here and log in:
          <div className={`${classes.row} ${classes.field}`}>
            <TextInput
              style={{ flex: 1 }}
              size="xs"
              placeholder="32 letters and numbers"
              aria-label="Client ID"
              styles={MONOSPACE_INPUT}
              error={errors.spotifyClientId?.message}
              {...register('spotifyClientId', {
                setValueAs: (value: string) => value?.trim() ?? '',
                pattern: {
                  value: CLIENT_ID_REGEX,
                  message: "That doesn't look like a client ID: 32 letters and numbers",
                },
              })}
            />
            <Button
              size="xs"
              color="green"
              leftIcon={<i className="fa-brands fa-spotify" />}
              disabled={!isClientIdValid}
              title={isClientIdValid ? 'Your browser opens to log in' : 'Paste the client ID first'}
              onClick={handleLogin}>
              {isWaiting ? 'Try Again' : 'Log In'}
            </Button>
          </div>
        </li>
      </ol>

      {isWaiting && (
        <div className={classes.waiting}>
          <Note icon="fa-solid fa-circle-notch fa-spin">
            Finish logging in in your browser. Nothing happening? Check the redirect URI, then try again.
          </Note>
        </div>
      )}
    </>
  );
};
