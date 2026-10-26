import { mdiResolver } from '@rootnative/components/mdi'
import { PortalHost } from '@rootnative/components/portal'
import { SnackbarProvider } from '@rootnative/components/snackbar'
import { ThemeProvider, useTheme, useThemeMode } from '@rootnative/core'
import { MotionConfig } from '@rootnative/inertia'
import { SeoProvider } from '@rootnative/seo/react'
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router'
import { useMemo } from 'react'
import { StatusBar } from 'expo-status-bar'
import type { ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { UpdateSnackbar } from '../components/UpdateSnackbar'
import { setMode, useAppearance } from '../lib/appearance'
import { site } from '../lib/site'
import { transitions } from '../lib/motion'
import { darkTheme, lightTheme } from '../theme'

/**
 * The status bar sits outside the theme, so it has to be told which scheme is
 * rendering. `scheme` is the resolved 'light' | 'dark' — not `mode`, which can
 * still be 'system'.
 */
function ThemedStatusBar() {
  const { scheme } = useThemeMode()

  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
}

/**
 * Hands React Navigation the colours of the app theme.
 *
 * Expo Router leaves the navigator on React Navigation's DefaultTheme, and the
 * stack paints every card in that theme's light grey before the screen inside
 * it draws. On web, a route loads its chunk on the first open after a reload
 * (asyncRoutes in app.json), and the production fallback for that wait is
 * nothing. So a dark reader saw a light card until the chunk arrived. With
 * the app colours on the navigator, the card is the right colour from the
 * first frame.
 */
function NavigationTheme({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const { scheme } = useThemeMode()

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outlineVariant,
      },
    }
  }, [scheme, theme])

  return (
    <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
  )
}

/**
 * Built once, outside the component. A fresh object on each render would
 * re-render every themed component in the app for no change.
 */
const themes = { light: lightTheme, dark: darkTheme }

/**
 * The screens, and the one that is not a screen.
 *
 * Naming one screen here does not opt the rest out. Expo Router still finds
 * every file in `app/`; a `<Stack.Screen>` only adds options to the route it
 * names.
 */
function Screens() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        Every page with the navigation around it, in a stack of its own. See
        app/(main)/_layout.tsx. The two sheets below sit above the group, so
        their scrim covers the navigation as well as the page.

        A link from a sheet to a page in the group must close the sheet first,
        with `dismissTo`. A plain push from a sheet adds a second copy of the
        group above it, with a second navigation and a history of its own.
      */}
      <Stack.Screen name="(main)" />
      {/*
        The about screen is a detour, not a place: the reader opens it, changes
        the look, and returns to the film they were on. It has to keep the
        screen underneath on display while the theme repaints it, because that
        repaint is the one thing the screen exists to show.

        `transparentModal` is what does that, and it is plain React Navigation
        — no flag, and the same behaviour on all three platforms. The navigator
        keeps the screen below mounted and visible whenever the screen above it
        is a transparent presentation, and gives this route a see-through
        background to draw on. The card and its scrim are then ordinary views
        inside app/about.tsx, which is why their size and corner can come from
        the theme like everything else.

        `presentation: 'modal'` was the other way. On iOS and Android it is a
        sheet, but on the web it needs `EXPO_UNSTABLE_WEB_MODAL` before Expo
        Router will draw anything other than a full page — an unstable flag in
        three npm scripts, for one screen.
      */}
      <Stack.Screen
        name="about"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
      {/*
        The search is a sheet over the screen it was opened from, for the same
        reason: its field flies out of the button that opened it, and the glass
        behind it shows the film rows still there. The fade is the route's whole
        part in the movement; the pill drives its own trip inside app/search.tsx.
      */}
      <Stack.Screen
        name="search"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack>
  )
}

export default function RootLayout() {
  /**
   * The mode the reader chose, from lib/appearance.ts. It is read here rather
   * than inside app/about.tsx, because the provider that applies it has to sit
   * above every screen — a press on the about screen repaints the film screens
   * behind it.
   */
  const { mode } = useAppearance()

  return (
    // Expo Router mounts its own SafeAreaProvider, and this one is the same
    // provider one level up. Every `insetTop` bar and the snackbar layer read
    // their inset from it, which is correct on the first paint of a modal.
    <SafeAreaProvider>
      {/*
        Handing the provider the { light, dark } pair (core alpha.12) makes it
        follow the OS setting and enables useThemeMode below. The old single
        `theme={darkTheme}` pinned every user to dark.

        `mode` is controlled from lib/appearance.ts rather than left to the
        provider's own `storage`, so the about screen reads and writes the same
        value the provider applies.
      */}
      <ThemeProvider
        theme={themes}
        mode={mode}
        onModeChange={setMode}
        iconResolver={mdiResolver}
      >
        {/*
          Registers the app's named transitions (lib/motion.ts) for the whole
          tree, so a component writes `transition="press"` rather than its own
          spring numbers.

          `reducedMotion` defaults to "user": every animation below downgrades
          to no-animation when the OS asks for reduced motion. That is the
          reason this wraps the app rather than each screen — an unwrapped
          subtree would keep animating.
        */}
        <MotionConfig transitions={transitions}>
          {/*
            Inside MotionConfig, so a menu or a snackbar drawn in the portal
            layer resolves the app's named transitions too. No `bottomOffset`
            here: only a phone has a bottom bar, and the navigation raises the
            snackbar above it with `useSnackbarOffset` while the bar is up.
          */}
          <PortalHost>
            <SnackbarProvider>
              <UpdateSnackbar />
              <SeoProvider site={site}>
                {/*
                  No `<main>` here: app/(main)/_layout.tsx draws it inside the
                  navigation, and lib/useRootScreenRole.ts gives it to a root
                  screen that has no page below it.
                */}
                <NavigationTheme>
                  <Screens />
                </NavigationTheme>
              </SeoProvider>
            </SnackbarProvider>
          </PortalHost>
        </MotionConfig>
        <ThemedStatusBar />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
