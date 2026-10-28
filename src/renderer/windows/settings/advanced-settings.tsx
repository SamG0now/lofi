import { Button, createStyles, Group, Text } from '@mantine/core';
import { ipcRenderer } from 'electron';
import React, { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { IpcMessage } from '../../../constants';
import { stopTokenRefresh } from '../../../main/auth';
import { Settings } from '../../../models/settings';
import { getFramesDrawnEvery, measureFrameInterval } from '../../../visualizations/frame-pacing';
import { SelectField, SettingRow, SettingsGroup, SettingsSection, SliderField, SwitchField } from './fields';

// 0 is every frame of the screen
const FRAME_RATES = [0, 120, 100, 60, 30];

const getFrameRateLabel = (frameRate: number): string => (frameRate ? `${frameRate} fps` : 'No limit');

// every one of them, every other one, every third one…
const EVERY: Record<number, string> = { 1: 'every', 2: 'every other', 3: 'every third', 4: 'every fourth' };

// What the limit comes to on the player's screen: the frames it skips are skipped evenly, so on a 144Hz screen 100
// frames a second is every other frame, 72 of them
const useFrameRateHint = (maxFrameRate: number): string => {
  const [frameInterval, setFrameInterval] = useState<number>();

  useEffect(() => {
    let isCurrent = true;
    // the settings window is drawn from the player's, this is the player's
    measureFrameInterval(window).then(
      (interval) => isCurrent && Number.isFinite(interval) && setFrameInterval(interval)
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  if (!frameInterval) {
    return '';
  }
  const every = getFramesDrawnEvery(maxFrameRate, frameInterval);
  const refreshRate = Math.round(1000 / frameInterval);
  const frameRate = Math.round(1000 / (every * frameInterval));
  return ` On the player's ${refreshRate} Hz screen that's ${frameRate} fps, ${
    EVERY[every] ?? `every ${every}th`
  } frame.`;
};

const useStyles = createStyles((theme) => ({
  confirmation: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    padding: '10px 12px',
    borderRadius: 8,
    backgroundColor: theme.fn.rgba(theme.colors.red[6], 0.06),
    boxShadow: `inset 0 0 0 1px ${theme.fn.rgba(theme.colors.red[6], 0.2)}`,
  },
}));

export const AdvancedSettings: FunctionComponent = () => {
  const { classes } = useStyles();
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const maxFrameRate = useWatch<Settings, 'maxFrameRate'>({ name: 'maxFrameRate' });
  const frameRateHint = useFrameRateHint(maxFrameRate);
  // one set by hand in the settings file is there too, in order: no limit first, then from the highest
  const frameRates = FRAME_RATES.includes(maxFrameRate)
    ? FRAME_RATES
    : [...FRAME_RATES, maxFrameRate].sort((a, b) => (!a || !b ? a - b : b - a));

  // Lofi erases everything it saved and starts again, like it was just installed
  const handleFactoryReset = useCallback(() => {
    setIsResetting(true);
    // the login must not be saved again while it's being erased
    stopTokenRefresh();
    ipcRenderer.send(IpcMessage.FactoryReset);
  }, []);

  return (
    <SettingsSection>
      <SettingsGroup>
        <SliderField
          name="trackInfoRefreshTimeInSeconds"
          label="Refresh interval"
          description="How often Lofi checks what's playing, raise it if Spotify starts rate limiting"
          min={1}
          max={10}
          format={(value) => `${value}s`}
        />
        <SelectField
          name="maxFrameRate"
          label="Frame rate limit"
          description={`How often the visualizations and the moving looks may be drawn, lower saves power.${frameRateHint}`}
          options={frameRates.map((frameRate) => ({ value: frameRate, label: getFrameRateLabel(frameRate) }))}
          width={110}
        />
        <SwitchField
          name="isUsingHardwareAcceleration"
          label="Hardware acceleration"
          description="Applies after a restart, turn it off if the player renders incorrectly"
        />
        <SwitchField name="isDebug" label="Developer tools" description="Open the DevTools for every window" />
      </SettingsGroup>

      <SettingsGroup title="Start over">
        <SettingRow
          label="Setup guide"
          description="Connect Spotify, pick a design and place the player, step by step. Unsaved changes here are lost.">
          <Button size="xs" variant="default" onClick={() => ipcRenderer.send(IpcMessage.ShowOnboarding)}>
            Open Guide
          </Button>
        </SettingRow>
        <div>
          <SettingRow label="Factory reset" description="Erase everything Lofi has saved and set it up from scratch">
            <Button
              size="xs"
              color="red"
              variant={isConfirmingReset ? 'light' : 'subtle'}
              disabled={isConfirmingReset}
              onClick={() => setIsConfirmingReset(true)}>
              Factory Reset…
            </Button>
          </SettingRow>
          {isConfirmingReset && (
            <div className={classes.confirmation} role="alertdialog" aria-label="Factory reset">
              <Text size="sm" weight={600}>
                Erase everything and restart Lofi?
              </Text>
              <Text size="xs" color="dimmed">
                Your Spotify login and app, your designs, every setting and where the player sits are all erased. Lofi
                then restarts with the setup guide, as if it was just installed. This can&apos;t be undone.
              </Text>
              <Group spacing="xs" position="right">
                <Button size="xs" variant="default" disabled={isResetting} onClick={() => setIsConfirmingReset(false)}>
                  Cancel
                </Button>
                <Button size="xs" color="red" loading={isResetting} onClick={handleFactoryReset}>
                  Erase and Restart
                </Button>
              </Group>
            </div>
          )}
        </div>
      </SettingsGroup>
    </SettingsSection>
  );
};
