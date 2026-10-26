import { router, Stack, type Href } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { Text } from 'react-native'
import MainLayout from '../../../app/(main)/_layout'
import NotFoundScreen from '../../../app/+not-found'
import { MovieCard } from '../../../components/MovieCard'
import { mockMovies } from '../../../lib/mock'
import { Providers } from '../../../lib/test-utils'

// expo-router/testing-library swaps Reanimated for `react-native-reanimated/mock`,
// which has no `useReducedMotion`, so the motion library throws on its first
// render. The app tests run the real module (see jest.setup.js), so this does too.
jest.mock('react-native-reanimated/mock', () =>
  jest.requireActual('react-native-reanimated'),
)

jest.mock('@rootnative/core', () => ({
  ...jest.requireActual('@rootnative/core'),
  useBreakpoint: () => 'compact',
}))

/**
 * The root stack of app/_layout.tsx without its providers: the group, and the
 * two sheets above it with their real presentation.
 */
function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="about" options={{ presentation: 'transparentModal' }} />
      <Stack.Screen name="search" options={{ presentation: 'transparentModal' }} />
    </Stack>
  )
}

const film = mockMovies[0]

/**
 * The real group layout and its navigation, with a page that shows only its
 * name in place of each screen. The search sheet holds one real result card.
 */
async function renderApp(initialUrl: string) {
  const page = (name: string) =>
    function Page() {
      return <Text>{name}</Text>
    }
  const view = renderRouter(
    {
      _layout: RootLayout,
      '(main)/_layout': MainLayout,
      '(main)/index': page('Home page'),
      '(main)/watchlist': page('Watchlist page'),
      '(main)/movie/[id]': page('Film page'),
      search: () => <MovieCard movie={film} dismissTo />,
      about: page('Settings'),
      '+not-found': NotFoundScreen,
    },
    { initialUrl, wrapper: Providers },
  )
  return view
}

/** The route names of the root stack, and of the first group stack in it. */
function history(view: Awaited<ReturnType<typeof renderApp>>) {
  // The router keeps the app's root stack in a `__root` route of its own.
  const root = view.getRouterState()?.routes[0].state
  return {
    root: root?.routes.map((r) => r.name),
    main: root?.routes[0].state?.routes.map((r) => r.name),
  }
}

describe('the history under the navigation', () => {
  it('returns to a destination that is already in the history', async () => {
    const view = await renderApp('/')
    await act(async () => {})

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-watchlist'))
    expect(view.getPathname()).toBe('/watchlist')

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-home'))
    expect(view.getPathname()).toBe('/')

    // One home, not a second one above the watchlist.
    expect(history(view).main).toEqual(['index'])
    expect(router.canGoBack()).toBe(false)
  })

  it('opens a destination that is not in the history above the page', async () => {
    const view = await renderApp(`/movie/${film.id}`)
    await act(async () => {})

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-home'))

    expect(view.getPathname()).toBe('/')
    expect(history(view).main).toEqual(['movie/[id]', 'index'])
  })

  it('opens a film from the search sheet in the one group', async () => {
    const view = await renderApp('/watchlist')
    await act(async () => {})
    act(() => router.push('/search'))
    await act(async () => {})

    fireEvent.press(screen.getByText(film.title))
    await act(async () => {})

    expect(view.getPathname()).toBe(`/movie/${film.id}`)
    // The sheet closed, and the film went into the group that was already
    // there. A second group would draw a second navigation bar.
    expect(history(view)).toEqual({ root: ['(main)'], main: ['watchlist', 'movie/[id]'] })
    expect(screen.getAllByTestId('app-navigation-bar')).toHaveLength(1)

    act(() => router.back())
    expect(view.getPathname()).toBe('/watchlist')
  })

  it('goes home from a dead link, in the group under it', async () => {
    const view = await renderApp('/watchlist')
    await act(async () => {})
    // A dead link is a path the typed routes do not know, by definition.
    act(() => router.push('/no-such-page' as Href))
    await act(async () => {})

    fireEvent.press(screen.getByText('Go home'))
    await act(async () => {})

    expect(view.getPathname()).toBe('/')
    expect(history(view)).toEqual({ root: ['(main)'], main: ['watchlist', 'index'] })
  })

  it('goes home from a dead link opened first, in its place', async () => {
    const view = await renderApp('/no-such-page')
    await act(async () => {})

    fireEvent.press(screen.getByText('Go home'))
    await act(async () => {})

    expect(view.getPathname()).toBe('/')
    expect(history(view)).toEqual({ root: ['(main)'], main: ['index'] })
  })
})
