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
    // SafeAreaProvider stays: the components that apply insets read no context,
    // but app/index.tsx calls useSafeAreaInsets, which does.
    <SafeAreaProvider>
      {/*
        Handing the provider the { light, dark } pair (core alpha.12) makes it
        follow the OS setting and enables useThemeMode below. The old single
        `theme={darkTheme}` pinned every user to dark.

        `mode` is controlled from lib/appearance.ts rather than left to the
        provider's own `storage`, so the about screen reads and writes the same
        value the provider applies.
      */}
      <ThemeProvider theme={themes} mode={mode} onModeChange={setMode}>
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
          <Screens />
        </MotionConfig>
        <ThemedStatusBar />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
