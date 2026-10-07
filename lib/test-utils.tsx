import { mdiResolver } from '@rootnative/components/mdi'
import { PortalHost } from '@rootnative/components/portal'
import { SnackbarProvider } from '@rootnative/components/snackbar'
import { ThemeProvider } from '@rootnative/core'
import { MotionConfig } from '@rootnative/inertia'
import { render, screen } from '@testing-library/react-native'
import { cloneElement, type ReactElement } from 'react'
import { Linking } from 'react-native'
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

type LinkMockProps = {
  href: string
  asChild?: boolean
  children: ReactElement<{ onPress?: (event?: unknown) => void }>
}

/**
 * What a test hands `jest.mock('expo-router', ...)`: a router and a `Link`.
 *
 * The cards and the chips are links, and the real `Link` needs a navigation
 * container that no test mounts. This one puts a press handler on its child
 * that calls `router.push` with the href, so a test that presses a card can
 * assert the same call it asserted when the card was a press handler. An href
 * with a scheme goes to `Linking.openURL`, as the real `Link` sends it.
 *
 * `router` is a function, because a mock factory runs when the module is
 * first required, which is before the `mockPush` at the top of a test file is
 * assigned. The function is called at press time and at each `useRouter`.
 *
 * A test that needs more from the module spreads this and adds to it.
 */
export function expoRouterMock<R extends { push: (href: string) => void }>(
  router: () => R,
) {
  function Link({ href, children }: LinkMockProps) {
    return cloneElement(children, {
      onPress: (event?: unknown) => {
        children.props.onPress?.(event)
        if (/^[a-z][a-z\d+.-]*:/i.test(href)) void Linking.openURL(href)
        else router().push(href)
      },
    })
  }

  return { useRouter: router, Link }
}

function Providers({ children }: { children: ReactElement }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider
        theme={{ light: lightTheme, dark: darkTheme }}
        iconResolver={mdiResolver}
      >
        {/*
          The app registers its named transitions at the root, so a component
          that writes `transition="press"` only resolves the name under this
          provider. Without it every such lookup misses, warns, and silently
          falls back to the default spring — the test would then exercise
          motion the app never runs.
        */}
        <MotionConfig transitions={transitions}>
          <PortalHost>
            <SnackbarProvider>{children}</SnackbarProvider>
          </PortalHost>
        </MotionConfig>
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
