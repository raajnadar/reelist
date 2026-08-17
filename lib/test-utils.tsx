import { ThemeProvider } from '@rootnative/core'
import { MotionConfig } from '@rootnative/inertia'
import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { transitions } from './motion'
import { darkTheme, lightTheme } from '../theme'

// A screen under test needs the same providers app/_layout.tsx gives it. Without
// them `useSafeAreaInsets` and `useTheme` throw, and every test fails for a
// reason that has nothing to do with what it checks.

// SafeAreaProvider measures its frame from the native layer, which does not
// exist here. These metrics are the standard test values — a notched phone —
// and they let the provider resolve without a measurement pass.
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

function Providers({ children }: { children: ReactElement }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider theme={{ light: lightTheme, dark: darkTheme }}>
        {/*
          The app registers its named transitions at the root, so a component
          that writes `transition="press"` only resolves the name under this
          provider. Without it every such lookup misses, warns, and silently
          falls back to the default spring — the test would then exercise
          motion the app never runs.
        */}
        <MotionConfig transitions={transitions}>{children}</MotionConfig>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

/**
 * `render` from RTL, wrapped in the providers the app supplies at its root.
 *
 * Returns `screen`, which is the only query API in this version of the library.
 * RTL 14 returns an empty object from `render` itself, so a test that destructures
 * queries from the return value gets `undefined` for every one of them.
 */
export const renderWithProviders = (ui: ReactElement) => {
  render(ui, { wrapper: Providers })
  return screen
}
