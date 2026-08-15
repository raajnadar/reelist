import { ThemeProvider, useThemeMode } from '@rootnative/core'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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
        <Stack screenOptions={{ headerShown: false }} />
        <ThemedStatusBar />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
