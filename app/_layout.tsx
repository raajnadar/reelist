import { ThemeProvider } from '@rootnative/core'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { darkTheme } from '../theme'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider theme={darkTheme}>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
