import {
  Avatar,
  Button,
  createStyles,
  Group,
  MantineColor,
  MantineProvider,
  ScrollArea,
  Text,
  TextInput,
  UnstyledButton,
  useEmotionCache,
} from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import React, { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { FieldErrors, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';

import { version } from '../../../../version.generated';
import { Appearance, DEFAULT_SETTINGS, Settings } from '../../../models/settings';
import { logIn, useWindowDocument } from '../../components';
import { useCurrentlyPlaying } from '../../contexts/currently-playing.context';
import { useSettings } from '../../contexts/settings.context';
import { AccountSettings } from './account-settings';
import { AdvancedSettings } from './advanced-settings';
import { DesignSettings } from './design-settings';
import { SectionColorContext } from './fields';
import { GeneralSettings } from './general-settings';
import { getPalette } from './palette';

const RESET_CONFIRMATION_IN_MS = 4000;
const SAVED_FEEDBACK_IN_MS = 1500;
const TOOLBAR_HEIGHT = 52;

enum Section {
  Account = 'Account',
  Design = 'Design',
  General = 'General',
  Advanced = 'Advanced',
}

interface SectionConfig {
  id: Section;
  icon: string;
  color: MantineColor;
  keywords: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: Section.Account,
    icon: 'fa-solid fa-circle-user',
    color: 'green',
    keywords: 'spotify login logout client id redirect uri premium',
  },
  {
    id: Section.Design,
    icon: 'fa-solid fa-paintbrush',
    color: 'teal',
    keywords: [
      'design layout look style theme modern retro halftone ascii vinyl pulse ncs custom preset move buttons position',
      'animation motion accent color font typeface size scale backdrop shadow window rounded corners circle radius',
      'resize width height square aspect ratio haze edges album art cover zoom brightness saturation blur crop center',
      'song track info title artist album progress bar thickness visualizer visualization opacity spectrum undo',
    ].join(' '),
  },
  {
    id: Section.General,
    icon: 'fa-solid fa-sliders',
    color: 'blue',
    keywords:
      'appearance light dark mode system theme always on top taskbar window playback volume scroll seek skip free account warning',
  },
  {
    id: Section.Advanced,
    icon: 'fa-solid fa-gear',
    color: 'indigo',
    keywords:
      'refresh interval rate limit hardware acceleration fps frame rate smooth performance battery power developer tools debug factory reset erase setup guide onboarding',
  },
];

// Settings that can be invalid, to show the section of the first error when saving fails
const FIELD_SECTIONS: Partial<Record<keyof Settings, Section>> = {
  spotifyClientId: Section.Account,
};

const useStyles = createStyles((theme) => {
  const palette = getPalette(theme);
  return {
    window: {
      position: 'fixed',
      inset: 0,
      // child windows are about:blank documents in quirks mode, which gives forms a bottom margin
      margin: 0,
      display: 'flex',
      backgroundColor: palette.window,
      color: palette.text,
      fontFamily: theme.fontFamily,
      // scrollbars and the lists of native selects follow too
      colorScheme: theme.colorScheme,
    },
    sidebar: {
      width: 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: `0 ${theme.spacing.sm} ${theme.spacing.sm}`,
      background: palette.sidebar,
      borderRight: `1px solid ${palette.hairline}`,
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
    search: {
      margin: `0 0 ${theme.spacing.sm}`,
    },
    profile: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
      borderRadius: 8,
      textAlign: 'left',

      '&:hover': {
        backgroundColor: palette.hover,
      },
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 8px',
      borderRadius: 7,
      fontSize: theme.fontSizes.sm,
      color: palette.text,

      '&:hover': {
        backgroundColor: palette.hover,
      },
    },
    // plain icons in one color, white on the picked section's color
    navIcon: {
      width: 20,
      flexShrink: 0,
      textAlign: 'center',
      fontSize: 15,
      color: palette.muted,
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
    toolbar: {
      height: TOOLBAR_HEIGHT,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${theme.spacing.xl}`,
      borderBottom: `1px solid ${palette.hairline}`,
    },
    content: {
      flex: 1,
      minHeight: 0,
    },
    sectionContent: {
      padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    },
    // the editor fills the window and scrolls its own parts
    designContent: {
      flex: 1,
      minHeight: 0,
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
      borderTop: `1px solid ${palette.hairline}`,
    },
  };
});

interface Props {
  initialValues: Settings;
  onClose: () => void;
  // the player's size is only saved when it was changed here
  onSave: (data: Settings, isResized: boolean) => void;
  onLogout: () => void;
}

// The window takes on the appearance picked right away, before it's saved, like the player takes on its design
const AppearanceProvider: FunctionComponent = ({ children }) => {
  const appearance = useWatch<Settings, 'appearance'>({ name: 'appearance' });
  // read right away, otherwise a dark desktop would see the window open light for a moment
  const systemScheme = useColorScheme(undefined, { getInitialValueInEffect: false });
  const emotionCache = useEmotionCache();
  const colorScheme = appearance === Appearance.Light || appearance === Appearance.Dark ? appearance : systemScheme;
  const theme = useMemo(() => ({ colorScheme }), [colorScheme]);
  return (
    <MantineProvider inherit theme={theme} emotionCache={emotionCache}>
      {children}
    </MantineProvider>
  );
};

const SettingsForm: FunctionComponent<Props> = ({ initialValues, onClose, onSave, onLogout }) => {
  const { classes, cx, theme } = useStyles();
  const palette = getPalette(theme);
  const windowDocument = useWindowDocument();
  const {
    state: { userProfile },
  } = useCurrentlyPlaying();
  const { state: liveSettings } = useSettings();
  const [section, setSection] = useState(initialValues.spotifyClientId ? Section.Design : Section.Account);
  const [query, setQuery] = useState('');
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const {
    handleSubmit,
    reset,
    register,
    resetField,
    getFieldState,
    formState: { isDirty, dirtyFields },
  } = useFormContext<Settings>();
  const isResized = !!(dirtyFields.width || dirtyFields.height);

  // The player can be resized while the settings are open: its size here follows, until it's changed here
  // and so does the visualization, which the player turns on and off too: saving never brings back an old one.
  // They have no inputs of their own and saving resets the form, which forgets them: they're registered each time.
  useEffect(() => {
    if (!getFieldState('width').isDirty && !getFieldState('height').isDirty) {
      register('width');
      register('height');
      resetField('width', { defaultValue: liveSettings.width });
      resetField('height', { defaultValue: liveSettings.height });
    }
  }, [getFieldState, liveSettings.height, liveSettings.width, register, resetField]);
  useEffect(() => {
    if (!getFieldState('visualizationType').isDirty) {
      register('visualizationType');
      resetField('visualizationType', { defaultValue: liveSettings.visualizationType });
    }
  }, [getFieldState, liveSettings.visualizationType, register, resetField]);

  const visibleSections = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search
      ? SECTIONS.filter(({ id, keywords }) => `${id} ${keywords}`.toLowerCase().includes(search))
      : SECTIONS;
  }, [query]);

  const currentSection = SECTIONS.find(({ id }) => id === section);

  useEffect(() => {
    if (visibleSections.length > 0 && !visibleSections.some(({ id }) => id === section)) {
      setSection(visibleSections[0].id);
    }
  }, [section, visibleSections]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    windowDocument.addEventListener('keydown', handleKeyDown);
    return () => windowDocument.removeEventListener('keydown', handleKeyDown);
  }, [onClose, windowDocument]);

  useEffect(() => {
    if (!isConfirmingReset) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setIsConfirmingReset(false), RESET_CONFIRMATION_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [isConfirmingReset]);

  useEffect(() => {
    if (!isSaved) {
      return undefined;
    }
    const timeoutId = setTimeout(() => setIsSaved(false), SAVED_FEEDBACK_IN_MS);
    return () => clearTimeout(timeoutId);
  }, [isSaved]);

  // The window stays open, the saved values become the new baseline for unsaved changes
  const save = useCallback(
    (data: Settings, isResizing: boolean) => {
      onSave(data, isResizing);
      reset(data);
      setIsSaved(true);
    },
    [onSave, reset]
  );
  const onSubmit = useCallback((data: Settings) => save(data, isResized), [isResized, save]);

  const onInvalid = useCallback((errors: FieldErrors<Settings>) => {
    const invalidSection = Object.keys(errors)
      .map((name) => FIELD_SECTIONS[name as keyof Settings])
      .find(Boolean);
    if (invalidSection) {
      setQuery('');
      setSection(invalidSection);
    }
  }, []);

  const handleLogin = useCallback(
    () =>
      handleSubmit((data) => {
        onSubmit(data);
        logIn(data.spotifyClientId);
      }, onInvalid)(),
    [handleSubmit, onInvalid, onSubmit]
  );

  const handleReset = useCallback(() => {
    if (!isConfirmingReset) {
      setIsConfirmingReset(true);
      return;
    }

    // the Spotify app stays, logging in again would need it, and the player keeps its size
    setIsConfirmingReset(false);
    save(
      {
        ...DEFAULT_SETTINGS,
        spotifyClientId: initialValues.spotifyClientId,
        width: liveSettings.width,
        height: liveSettings.height,
      },
      false
    );
  }, [initialValues.spotifyClientId, isConfirmingReset, liveSettings.height, liveSettings.width, save]);

  return (
    <form className={classes.window} onSubmit={handleSubmit(onSubmit, onInvalid)}>
      <nav className={classes.sidebar}>
        <div className={`${classes.sidebarTop} draggable-window`}>
          <div className={classes.trafficLights}>
            <button
              type="button"
              title="Close"
              className={classes.trafficLight}
              style={{ backgroundColor: '#ff5f57', cursor: 'pointer' }}
              onClick={onClose}>
              <i className="fa-solid fa-xmark" />
            </button>
            <span className={classes.trafficLight} style={{ backgroundColor: '#febc2e' }} />
            <span className={classes.trafficLight} style={{ backgroundColor: '#28c840' }} />
          </div>
        </div>

        <TextInput
          className={classes.search}
          size="xs"
          radius="md"
          placeholder="Search"
          icon={<i className="fa-solid fa-magnifying-glass" />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          styles={{ input: { backgroundColor: palette.search, borderColor: palette.hairline } }}
        />

        <UnstyledButton className={classes.profile} onClick={() => setSection(Section.Account)}>
          <Avatar src={userProfile?.avatar || null} size={36} radius="xl" color="green">
            <i className="fa-solid fa-user" />
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text size="sm" weight={600} truncate>
              {userProfile?.name ?? 'Log in'}
            </Text>
            <Text size="xs" color="dimmed" truncate>
              {userProfile ? 'Spotify account' : 'Connect your Spotify account'}
            </Text>
          </div>
        </UnstyledButton>

        {visibleSections.map(({ id, icon, color }) => {
          const isActive = id === section;
          return (
            <UnstyledButton
              key={id}
              className={classes.navItem}
              style={isActive ? { backgroundColor: theme.colors[color][6], color: theme.white } : undefined}
              onClick={() => setSection(id)}>
              <i className={cx(icon, classes.navIcon)} style={isActive ? { color: 'inherit' } : undefined} />
              <span>{id}</span>
            </UnstyledButton>
          );
        })}
        {visibleSections.length === 0 && (
          <Text size="sm" color="dimmed" p="xs">
            No results
          </Text>
        )}

        <Text size="xs" color="dimmed" className={classes.version}>
          Lofi {version}
        </Text>
      </nav>

      <div className={classes.main}>
        <div className={`${classes.toolbar} draggable-window`}>
          <Text size={17} weight={700}>
            {section}
          </Text>
        </div>

        <SectionColorContext.Provider value={currentSection.color}>
          {section === Section.Design ? (
            <div className={classes.designContent}>
              <DesignSettings />
            </div>
          ) : (
            <ScrollArea className={classes.content}>
              <div className={classes.sectionContent}>
                {section === Section.Account && <AccountSettings onLogin={handleLogin} onLogout={onLogout} />}
                {section === Section.General && <GeneralSettings />}
                {section === Section.Advanced && <AdvancedSettings />}
              </div>
            </ScrollArea>
          )}
        </SectionColorContext.Provider>

        <footer className={classes.footer}>
          <Button size="xs" color="red" variant={isConfirmingReset ? 'filled' : 'subtle'} onClick={handleReset}>
            {isConfirmingReset ? 'Click again to reset' : 'Reset to Defaults'}
          </Button>
          <Group spacing="xs">
            <Button size="xs" variant="default" onClick={onClose}>
              {isDirty ? 'Cancel' : 'Close'}
            </Button>
            <Button
              size="xs"
              type="submit"
              color={currentSection.color}
              disabled={!isDirty && !isSaved}
              leftIcon={isSaved && !isDirty ? <i className="fa-solid fa-check" /> : undefined}>
              {isSaved && !isDirty ? 'Saved' : 'Save'}
            </Button>
          </Group>
        </footer>
      </div>
    </form>
  );
};

export const SettingsWindow: FunctionComponent<Props> = ({ initialValues, ...props }) => {
  const methods = useForm<Settings>({
    defaultValues: initialValues,
  });
  return (
    <FormProvider {...methods}>
      <AppearanceProvider>
        <SettingsForm initialValues={initialValues} {...props} />
      </AppearanceProvider>
    </FormProvider>
  );
};
