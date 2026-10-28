import { Button, createStyles, Group, keyframes, MantineColor, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import { omit, pick } from 'lodash';
import React, { FunctionComponent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { version } from '../../../../version.generated';
import { Settings } from '../../../models/settings';
import { logIn } from '../../components';
import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { useSettings } from '../../contexts/settings.context';
import { CLIENT_ID_REGEX } from '../settings/account-settings';
import { SectionColorContext } from '../settings/fields';
import { DesignStep } from './design-step';
import { GRADIENTS, ICON_URL, Tile } from './parts';
import { SpotifyStep } from './spotify-step';
import { DesktopStep, DoneStep, WelcomeStep } from './steps';

const TOOLBAR_HEIGHT = 52;

enum Step {
  Welcome = 'welcome',
  Spotify = 'spotify',
  Design = 'design',
  Desktop = 'desktop',
  Done = 'done',
}

interface StepConfig {
  id: Step;
  label: string;
  icon: string;
  color: MantineColor;
  tile: string;
}

const STEPS: StepConfig[] = [
  { id: Step.Welcome, label: 'Welcome', icon: 'fa-solid fa-hand-sparkles', color: 'pink', tile: GRADIENTS.pink },
  { id: Step.Spotify, label: 'Connect Spotify', icon: 'fa-brands fa-spotify', color: 'green', tile: GRADIENTS.green },
  { id: Step.Design, label: 'Pick a Design', icon: 'fa-solid fa-paintbrush', color: 'teal', tile: GRADIENTS.teal },
  { id: Step.Desktop, label: 'On Your Desktop', icon: 'fa-solid fa-display', color: 'blue', tile: GRADIENTS.blue },
  { id: Step.Done, label: 'All Set', icon: 'fa-solid fa-flag-checkered', color: 'orange', tile: GRADIENTS.orange },
];

// Applied as soon as they're picked, the player shows them right away
const LIVE_SETTINGS: (keyof Settings)[] = [
  'design',
  'visualizationType',
  'isAlwaysOnTop',
  'isVisibleInTaskbar',
  'isAlwaysShowControls',
];

const appear = keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'none' },
});

const useStyles = createStyles((theme) => ({
  window: {
    position: 'fixed',
    inset: 0,
    // child windows are about:blank documents in quirks mode, which gives forms a bottom margin
    margin: 0,
    display: 'flex',
    backgroundColor: '#f5f5f7',
    color: '#1d1d1f',
    fontFamily: theme.fontFamily,
  },
  sidebar: {
    width: 230,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: `0 ${theme.spacing.sm} ${theme.spacing.sm}`,
    background: 'linear-gradient(165deg, #e6f0ff 0%, #f3e9ff 45%, #ffe9f1 75%, #fff4e5 100%)',
    borderRight: '1px solid rgba(0, 0, 0, 0.08)',
  },
  sidebarTop: {
    height: TOOLBAR_HEIGHT,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 6,
  },
  trafficLights: {
    display: 'flex',
    gap: 8,
    WebkitAppRegion: 'no-drag',

    '&:hover i': {
      opacity: 1,
    },
  },
  trafficLight: {
    width: 12,
    height: 12,
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.15)',

    '& i': {
      fontSize: 8,
      opacity: 0,
      color: 'rgba(0, 0, 0, 0.55)',
    },
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: `0 ${theme.spacing.xs}`,
    marginBottom: theme.spacing.md,
  },
  brandIcon: {
    width: 30,
    height: 30,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 8px',
    borderRadius: 7,
    fontSize: theme.fontSizes.sm,
    color: '#1d1d1f',

    '&:not(:disabled):hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.5,
    },
  },
  stepCheck: {
    marginLeft: 'auto',
    fontSize: 13,
  },
  version: {
    marginTop: 'auto',
    padding: theme.spacing.xs,
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  // only there to move the window by
  toolbar: {
    height: 28,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  page: {
    padding: `4px 40px ${theme.spacing.xl}`,
    animation: `${appear} 0.25s ease-out`,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
}));

interface Props {
  initialValues: Settings;
  // only what the guide changes, and the player's size only when it's picked here
  onSave: (values: Partial<Settings>, isResized?: boolean) => void;
  onLogout: () => void;
  // finished or put away for later
  onClose: () => void;
}

/**
 * The setup guide, opened on the first start: connecting Spotify, a design, how the player sits on the desktop and a
 * few tips. Everything picked is applied as it's picked, closing it at any point keeps what was done.
 */
export const Onboarding: FunctionComponent<Props> = ({ initialValues, onSave, onLogout, onClose }) => {
  const { classes, theme } = useStyles();
  const {
    state: { userProfile },
  } = useCurrentlyPlaying();
  const { state: liveSettings } = useSettings();
  const [step, setStep] = useState(Step.Welcome);
  const [furthest, setFurthest] = useState(0);
  const isConnected = !!userProfile;

  // The player's size follows the live one, it can be resized while the guide is open
  const methods = useForm<Settings>({
    defaultValues: omit(initialValues, ['width', 'height']),
    mode: 'onTouched',
  });
  const { watch, getValues } = methods;

  const save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (LIVE_SETTINGS.includes(name as keyof Settings)) {
        save.current(pick(values, LIVE_SETTINGS) as Partial<Settings>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // A Spotify app that looks right is kept when the guide moves on, logging in later is then a click on the player.
  // Changing it logs out, the login belongs to the app it was made with.
  const keepClientId = useCallback(() => {
    const clientId = getValues('spotifyClientId')?.trim() ?? '';
    if (clientId && CLIENT_ID_REGEX.test(clientId) && clientId !== liveSettings.spotifyClientId) {
      onSave({ spotifyClientId: clientId });
    }
  }, [getValues, liveSettings.spotifyClientId, onSave]);

  const goTo = useCallback(
    (next: Step) => {
      keepClientId();
      setStep(next);
      setFurthest((index) =>
        Math.max(
          index,
          STEPS.findIndex(({ id }) => id === next)
        )
      );
    },
    [keepClientId]
  );

  const finish = useCallback(() => {
    keepClientId();
    onClose();
  }, [keepClientId, onClose]);

  const handleLogin = useCallback(() => {
    keepClientId();
    logIn(getValues('spotifyClientId').trim());
  }, [getValues, keepClientId]);

  const handleResize = useCallback((side: number) => onSave({ width: side, height: side }, true), [onSave]);

  const index = STEPS.findIndex(({ id }) => id === step);
  const current = STEPS[index];
  const next = STEPS[index + 1];

  let page: ReactNode;
  let primary: ReactNode;
  switch (step) {
    case Step.Welcome: {
      page = <WelcomeStep />;
      primary = (
        <Button color={current.color} onClick={() => goTo(next.id)}>
          Get Started
        </Button>
      );
      break;
    }
    case Step.Spotify: {
      page = <SpotifyStep onLogin={handleLogin} onLogout={onLogout} />;
      primary = isConnected ? (
        <Button color={current.color} onClick={() => goTo(next.id)}>
          Continue
        </Button>
      ) : (
        <Button variant="default" onClick={() => goTo(next.id)}>
          Skip for Now
        </Button>
      );
      break;
    }
    case Step.Design: {
      page = <DesignStep />;
      break;
    }
    case Step.Desktop: {
      page = <DesktopStep onResize={handleResize} />;
      break;
    }
    default: {
      page = <DoneStep isConnected={isConnected} onConnect={() => goTo(Step.Spotify)} />;
      primary = (
        <Button color={current.color} onClick={finish}>
          {isConnected ? 'Start Listening' : 'Finish'}
        </Button>
      );
      break;
    }
  }
  primary = primary ?? (
    <Button color={current.color} onClick={() => goTo(next.id)}>
      Continue
    </Button>
  );

  return (
    <FormProvider {...methods}>
      <div className={classes.window}>
        <nav className={classes.sidebar}>
          <div className={`${classes.sidebarTop} draggable-window`}>
            <div className={classes.trafficLights}>
              <button
                type="button"
                title="Close, set up the rest later"
                className={classes.trafficLight}
                style={{ backgroundColor: '#ff5f57', cursor: 'pointer' }}
                onClick={finish}>
                <i className="fa-solid fa-xmark" />
              </button>
              <span className={classes.trafficLight} style={{ backgroundColor: '#febc2e' }} />
              <span className={classes.trafficLight} style={{ backgroundColor: '#28c840' }} />
            </div>
          </div>

          <div className={`${classes.brand} draggable-window`}>
            <img src={ICON_URL} className={classes.brandIcon} alt="" />
            <div>
              <Text size="sm" weight={700} style={{ lineHeight: 1.2 }}>
                Lofi
              </Text>
              <Text size="xs" color="dimmed" style={{ lineHeight: 1.2 }}>
                Setup
              </Text>
            </div>
          </div>

          {STEPS.map(({ id, label, icon, color, tile }, stepIndex) => {
            const isActive = id === step;
            // Spotify is only done once it's connected, skipping it doesn't count
            const isDone = stepIndex < furthest && (id !== Step.Spotify || isConnected);
            return (
              <UnstyledButton
                key={id}
                className={classes.stepItem}
                disabled={stepIndex > furthest}
                aria-current={isActive ? 'step' : undefined}
                style={isActive ? { backgroundColor: theme.colors[color][6], color: theme.white } : undefined}
                onClick={() => goTo(id)}>
                <Tile icon={icon} background={tile} size={24} />
                <span>{label}</span>
                {isDone && (
                  <i
                    className={`fa-solid fa-circle-check ${classes.stepCheck}`}
                    style={{ color: isActive ? theme.white : theme.colors[color][6] }}
                  />
                )}
              </UnstyledButton>
            );
          })}

          <Text size="xs" color="dimmed" className={classes.version}>
            Lofi {version}
          </Text>
        </nav>

        <div className={classes.main}>
          <div className={`${classes.toolbar} draggable-window`} />
          <SectionColorContext.Provider value={current.color}>
            {/* a step starts at its top */}
            <ScrollArea key={step} className={classes.content}>
              <div className={classes.page}>{page}</div>
            </ScrollArea>
          </SectionColorContext.Provider>

          <footer className={classes.footer}>
            {step === Step.Welcome ? (
              <Button variant="subtle" color="gray" onClick={finish}>
                Set Up Later
              </Button>
            ) : (
              <Text size="xs" color="dimmed">
                Step {index + 1} of {STEPS.length}
              </Text>
            )}
            <Group spacing="xs">
              {index > 0 && (
                <Button variant="default" onClick={() => goTo(STEPS[index - 1].id)}>
                  Back
                </Button>
              )}
              {primary}
            </Group>
          </footer>
        </div>
      </div>
    </FormProvider>
  );
};
