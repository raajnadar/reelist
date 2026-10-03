import { mdiResolver } from '@rootnative/components/mdi'
import { PortalHost } from '@rootnative/components/portal'
import { SnackbarProvider } from '@rootnative/components/snackbar'
import { ThemeProvider, useThemeMode } from '@rootnative/core'
import { MotionConfig } from '@rootnative/inertia'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { setMode, useAppearance } from '../lib/appearance'
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
            layer resolves the app's named transitions too. No screen has a FAB
            or a bottom bar, so the snackbar needs no `bottomOffset`.
          */}
          <PortalHost>
            <SnackbarProvider>
              <Screens />
            </SnackbarProvider>
          </PortalHost>
        </MotionConfig>
        <ThemedStatusBar />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
