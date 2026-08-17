import { ThemeProvider, useThemeMode } from '@rootnative/core'
import { MotionConfig } from '@rootnative/inertia'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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

export default function RootLayout() {
  return (
    // SafeAreaProvider stays: the components that apply insets read no context,
    // but app/index.tsx calls useSafeAreaInsets, which does.
    <SafeAreaProvider>
      {/*
        Handing the provider the { light, dark } pair (core alpha.12) makes it
        follow the OS setting and enables useThemeMode below. The old single
        `theme={darkTheme}` pinned every user to dark.
      */}
      <ThemeProvider theme={{ light: lightTheme, dark: darkTheme }}>
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
          <Stack screenOptions={{ headerShown: false }} />
        </MotionConfig>
        <ThemedStatusBar />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
