import { Anchor, createStyles, Text } from '@mantine/core';
import React, { FunctionComponent } from 'react';
import { useFormContext } from 'react-hook-form';

import { MACOS } from '../../../constants';
import { Settings } from '../../../models/settings';
import { useSettings } from '../../contexts/settings.context';
import { Segmented, SegmentOption } from '../settings/design-controls';
import { SettingRow, SettingsGroup, SwitchField } from '../settings/fields';
import { GRADIENTS, ICON_URL, Note, StepHeader, TileItem, useGuideStyles } from './parts';

const SIZES: SegmentOption<string>[] = [
  { value: '160', label: 'Small' },
  { value: '220', label: 'Medium' },
  { value: '300', label: 'Large' },
];

const useStyles = createStyles((theme) => ({
  welcome: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    paddingTop: theme.spacing.xs,
  },
  logo: {
    width: 92,
    height: 92,
    marginBottom: theme.spacing.sm,
    filter: 'drop-shadow(0 8px 18px rgba(219, 39, 119, 0.25))',
  },
  features: {
    width: '100%',
    maxWidth: 440,
    marginTop: theme.spacing.lg,
    textAlign: 'left',
  },
  tips: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  tip: {
    padding: '12px 14px',
    backgroundColor: theme.white,
    borderRadius: 12,
    border: '1px solid rgba(0, 0, 0, 0.07)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  },
}));

export const WelcomeStep: FunctionComponent = () => {
  const { classes } = useStyles();
  const { classes: guide } = useGuideStyles();
  return (
    <div className={classes.welcome}>
      <img src={ICON_URL} className={classes.logo} alt="" />
      <h1 className={guide.title}>Welcome to Lofi</h1>
      <Text size="sm" color="dimmed" className={guide.subtitle}>
        A tiny Spotify player that floats on your desktop: your album art, with the controls a hover away. Let&apos;s
        get it set up, it only takes a couple of minutes.
      </Text>
      <div className={`${guide.card} ${classes.features}`}>
        <TileItem icon="fa-brands fa-spotify" background={GRADIENTS.green} title="Connect Spotify">
          Lofi shows what&apos;s playing in Spotify and controls it.
        </TileItem>
        <TileItem icon="fa-solid fa-paintbrush" background={GRADIENTS.teal} title="Pick a design">
          Several to start from, each one yours to rearrange.
        </TileItem>
        <TileItem icon="fa-solid fa-display" background={GRADIENTS.blue} title="Make it at home">
          Choose how big it is and how it sits on your desktop.
        </TileItem>
      </div>
    </div>
  );
};

interface DesktopProps {
  onResize: (side: number) => void;
}

/** How the player sits among the other windows. The player follows along as they're changed. */
export const DesktopStep: FunctionComponent<DesktopProps> = ({ onResize }) => {
  const {
    state: { width, height },
  } = useSettings();
  // the player can be resized meanwhile, a size that isn't one of these leaves them all unpicked
  const size = width === height ? String(width) : '';

  return (
    <>
      <StepHeader
        title="On your desktop"
        subtitle="Lofi floats over your other windows, always a glance away. Changes show on the player as you make them."
      />
      <SettingsGroup>
        <SettingRow label="Size" description="Any other in Settings → Design">
          <div style={{ width: 240, flexShrink: 0 }}>
            <Segmented label="Size" value={size} options={SIZES} onChange={(side) => onResize(Number(side))} />
          </div>
        </SettingRow>
        <SwitchField name="isAlwaysOnTop" label="Always on top" description="Keep Lofi above other windows" />
        <SwitchField name="isVisibleInTaskbar" label="Show in taskbar" description="List Lofi with your open windows" />
        <SwitchField
          name="isAlwaysShowControls"
          label="Always show the controls"
          description="Instead of only while the pointer is over the player"
        />
      </SettingsGroup>
    </>
  );
};

interface DoneProps {
  isConnected: boolean;
  onConnect: () => void;
}

export const DoneStep: FunctionComponent<DoneProps> = ({ isConnected, onConnect }) => {
  const { classes } = useStyles();
  const { watch } = useFormContext<Settings>();
  const skipSongDelay = watch('skipSongDelay');
  // the player asks to log in once it has a Spotify app, to set one up before
  const {
    state: { spotifyClientId },
  } = useSettings();

  return (
    <>
      <StepHeader
        title={isConnected ? "You're all set" : 'Almost there'}
        subtitle="A few things worth knowing about your player."
      />
      {!isConnected && (
        <div style={{ marginBottom: 12 }}>
          <Note icon="fa-brands fa-spotify" tone="warning">
            Lofi isn&apos;t connected to Spotify yet.{' '}
            <Anchor component="button" type="button" color="orange" weight={600} onClick={onConnect}>
              Connect it now
            </Anchor>
            , or later with <b>{spotifyClientId ? 'Log in' : 'Set up'}</b> on the player.
          </Note>
        </div>
      )}
      <div className={classes.tips}>
        <div className={classes.tip}>
          <TileItem icon="fa-solid fa-arrow-pointer" background={GRADIENTS.violet} title="Hover for controls">
            Point at the player to show the song and its controls.
          </TileItem>
        </div>
        <div className={classes.tip}>
          <TileItem icon="fa-solid fa-up-down-left-right" background={GRADIENTS.blue} title="Move it anywhere">
            Drag the player to wherever suits you.
          </TileItem>
        </div>
        <div className={classes.tip}>
          <TileItem icon="fa-solid fa-volume-high" background={GRADIENTS.orange} title="Scroll for volume">
            Scroll over the player to turn Spotify up or down.
          </TileItem>
        </div>
        <div className={classes.tip}>
          <TileItem icon="fa-solid fa-forward" background={GRADIENTS.pink} title="Skip or seek">
            {MACOS ? '⌘' : 'Ctrl'}-click previous or next to jump {skipSongDelay} seconds instead.
          </TileItem>
        </div>
        {!MACOS && (
          <div className={classes.tip}>
            <TileItem icon="fa-solid fa-wave-square" background={GRADIENTS.teal} title="Visualizations">
              The wave button shows one over the art, the palette switches between them.
            </TileItem>
          </div>
        )}
        <div className={classes.tip}>
          <TileItem icon="fa-solid fa-gear" background={GRADIENTS.gray} title="Settings">
            From the gear on the player, or Lofi&apos;s icon in the {MACOS ? 'menu bar' : 'tray'}.
          </TileItem>
        </div>
      </div>
    </>
  );
};
