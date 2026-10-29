import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { useEffect, type ReactElement } from 'react'
import { Text } from 'react-native'
import { mockMovies } from '../lib/mock'
import { readSearchOrigin } from '../lib/searchOrigin'
import { renderWithProviders } from '../lib/test-utils'
import { useContentWidth } from '../lib/useContentWidth'
import { setWatched, STORAGE_KEY } from '../lib/watchlist'
import { AppNavigation } from './AppNavigation'

let mockBreakpoint = 'compact'
let mockPathname = '/'
let mockKeyboardUp = false
/** The route names in the group's stack, oldest first. */
let mockGroupHistory = ['index']
const mockNavigate = jest.fn()
const mockPush = jest.fn()
const mockDismissTo = jest.fn()

jest.mock('@rootnative/core', () => ({
  ...jest.requireActual('@rootnative/core'),
  useBreakpoint: () => mockBreakpoint,
}))

jest.mock('expo-router', () => ({
  ...jest.requireActual('../lib/test-utils').expoRouterMock(() => ({
    push: mockPush,
    navigate: mockNavigate,
    dismissTo: mockDismissTo,
  })),
  usePathname: () => mockPathname,
  // The root stack, with the group's route and the stack inside it.
  useRoute: () => ({ key: 'group' }),
  useNavigation: () => ({
    getState: () => ({
      routes: [
        { key: 'group', state: { routes: mockGroupHistory.map((name) => ({ name })) } },
      ],
    }),
  }),
}))

// The wrapper's `measureInWindow` is a `jest.fn` in this renderer and never
// answers, so the real helper would wait for ever and the push would never
// come. The mock answers with a box, which also lets a test check the box
// reached the store the search sheet reads.
const ICON_RECT = { x: 183, y: 772, width: 24, height: 24 }

jest.mock('../lib/searchOrigin', () => ({
  ...jest.requireActual('../lib/searchOrigin'),
  measureWindowRect: jest.fn(() => Promise.resolve(ICON_RECT)),
}))

// lib/useKeyboardShrinksWindow.test.ts covers the keyboard events themselves.
jest.mock('../lib/useKeyboardShrinksWindow', () => ({
  useKeyboardShrinksWindow: () => mockKeyboardUp,
}))

beforeEach(() => {
  mockBreakpoint = 'compact'
  mockPathname = '/'
  mockKeyboardUp = false
  mockGroupHistory = ['index']
  mockNavigate.mockClear()
  mockPush.mockClear()
  mockDismissTo.mockClear()
})

const content = <Text>Screen</Text>

/**
 * Renders, then lets the watchlist read settle. The read starts on mount, and
 * an answer that lands after the test reports a state update outside act().
 */
async function renderNavigation(screens: ReactElement = content) {
  const screen = renderWithProviders(<AppNavigation>{screens}</AppNavigation>)
  await act(async () => {})
  return screen
}

describe('AppNavigation', () => {
  it('draws the bar on a phone', async () => {
    const screen = await renderNavigation()

    expect(screen.getByTestId('app-navigation-bar')).toBeTruthy()
    expect(screen.queryByTestId('app-navigation-rail')).toBeNull()
    expect(screen.queryByTestId('app-navigation-drawer')).toBeNull()
    expect(screen.getByText('Screen')).toBeTruthy()
  })

  it('draws the rail on a tablet', async () => {
    mockBreakpoint = 'expanded'
    const screen = await renderNavigation()

    expect(screen.getByTestId('app-navigation-rail')).toBeTruthy()
    expect(screen.queryByTestId('app-navigation-bar')).toBeNull()
  })

  it('draws the drawer on a wide monitor', async () => {
    mockBreakpoint = 'extraLarge'
    const screen = await renderNavigation()

    expect(screen.getByTestId('app-navigation-drawer')).toBeTruthy()
    expect(screen.getByTestId('app-navigation-drawer-item-watchlist')).toBeTruthy()
    expect(screen.queryByTestId('app-navigation-bar')).toBeNull()
  })

  it('hands the page the width beside the rail, once it has laid out', async () => {
    mockBreakpoint = 'expanded'
    function Probe() {
      return <Text>{`width ${useContentWidth()}`}</Text>
    }
    const screen = await renderNavigation(<Probe />)
    const beforeLayout = screen.getByText(/^width /).props.children

    fireEvent(screen.getByTestId('app-navigation-content'), 'layout', {
      nativeEvent: { layout: { x: 80, y: 0, width: 1200, height: 800 } },
    })

    expect(screen.getByText('width 1200')).toBeTruthy()
    expect(beforeLayout).not.toBe('width 1200')
  })

  it('opens a destination that is not in the history with navigate', async () => {
    const screen = await renderNavigation()

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-watchlist'))

    // The literal path is the assertion. `yarn typecheck` proves the route
    // exists; this proves the item is wired to it.
    expect(mockNavigate).toHaveBeenCalledWith('/watchlist')
    expect(mockDismissTo).not.toHaveBeenCalled()
  })

  // `navigate` would stack a second home above the film. The real router's
  // history is in __tests__/app/(main)/_layout.test.tsx.
  it('returns to a destination that is already in the history', async () => {
    mockPathname = '/movie/1'
    mockGroupHistory = ['index', 'movie/[id]']
    const screen = await renderNavigation()

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-home'))

    expect(mockDismissTo).toHaveBeenCalledWith('/')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('opens a destination from the drawer', async () => {
    mockBreakpoint = 'extraLarge'
    const screen = await renderNavigation()

    fireEvent.press(screen.getByTestId('app-navigation-drawer-item-watchlist'))

    expect(mockNavigate).toHaveBeenCalledWith('/watchlist')
  })

  it('opens the search sheet from its icon, after measuring it', async () => {
    const screen = await renderNavigation()

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-search'))

    // The wait is the measurement: the push comes after the icon's box is in,
    // not before. A plain navigate would open the sheet with no box to fly from.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/search'))
    expect(mockNavigate).not.toHaveBeenCalled()
    // And the box is where the search sheet will read it from.
    expect(readSearchOrigin()).toEqual(ICON_RECT)

    await act(async () => {})
  })

  it('does nothing on a press of the lit destination', async () => {
    mockPathname = '/watchlist'
    const screen = await renderNavigation()

    fireEvent.press(screen.getByTestId('app-navigation-bar-item-watchlist'))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('opens the settings and the privacy policy from the end of the drawer', async () => {
    mockBreakpoint = 'extraLarge'
    const screen = await renderNavigation()

    fireEvent.press(screen.getByTestId('app-navigation-drawer-item-settings'))
    expect(mockNavigate).toHaveBeenCalledWith('/about')

    fireEvent.press(screen.getByTestId('app-navigation-drawer-item-privacy'))
    expect(mockNavigate).toHaveBeenCalledWith('/privacy')
  })

  it('lights the settings in the drawer while the sheet is open', async () => {
    mockBreakpoint = 'extraLarge'
    mockPathname = '/about'
    const screen = await renderNavigation()

    expect(screen.getByTestId('app-navigation-drawer-item-settings')).toBeSelected()
  })

  // A remount of the screens throws away their state and scroll position, and
  // a wide page load of the static site changes the layout once, from the bar
  // of the server render to the rail or the drawer.
  it('keeps the screens mounted when the layout changes', async () => {
    let mounts = 0
    function Screens() {
      useEffect(() => {
        mounts += 1
      }, [])
      return <Text>Screen</Text>
    }
    const screen = await renderNavigation(<Screens />)

    for (const breakpoint of ['expanded', 'extraLarge', 'compact']) {
      mockBreakpoint = breakpoint
      screen.rerender(
        <AppNavigation>
          <Screens />
        </AppNavigation>,
      )
    }
    mockPathname = '/trailer/dQw4w9WgXcQ'
    screen.rerender(
      <AppNavigation>
        <Screens />
      </AppNavigation>,
    )

    expect(mounts).toBe(1)
  })

  it('counts the saved films on the watchlist icon', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockMovies.slice(0, 2)))

    const screen = await renderNavigation()

    // The label carries the count: the badge is for the eye only.
    expect(await screen.findByLabelText('Watchlist, 2 films to watch')).toBeTruthy()
  })

  it('leaves the watched films out of the count', async () => {
    const [first, second, third] = mockMovies
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([first, { ...second, watched: true }, { ...third, watched: true }]),
    )

    const screen = await renderNavigation()

    expect(await screen.findByLabelText('Watchlist, 1 film to watch')).toBeTruthy()
  })

  it('drops the count when the last film to watch is marked watched', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockMovies.slice(0, 1)))

    const screen = await renderNavigation()
    expect(await screen.findByLabelText('Watchlist, 1 film to watch')).toBeTruthy()

    act(() => {
      setWatched([mockMovies[0].id], true)
    })

    await waitFor(() => expect(screen.queryByLabelText(/^Watchlist, /)).toBeNull())
  })

  it('counts the saved films at the end of the drawer row', async () => {
    mockBreakpoint = 'extraLarge'
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockMovies.slice(0, 1)))

    const screen = await renderNavigation()

    const watchlist = await screen.findByLabelText('Watchlist, 1 film to watch')
    expect(watchlist).toHaveTextContent(/1$/)
  })

  it('shows no count on an empty watchlist', async () => {
    const screen = await renderNavigation()

    expect(screen.queryByLabelText(/^Watchlist, /)).toBeNull()
  })

  it('steps out of the way of the trailer and the gallery', async () => {
    mockPathname = '/trailer/dQw4w9WgXcQ'
    const screen = await renderNavigation()

    expect(screen.queryByTestId('app-navigation-bar')).toBeNull()
    expect(screen.getByText('Screen')).toBeTruthy()
  })

  it('steps aside while the keyboard shrinks the window', async () => {
    const screen = await renderNavigation()

    mockKeyboardUp = true
    screen.rerender(<AppNavigation>{content}</AppNavigation>)
    expect(screen.queryByTestId('app-navigation-bar')).toBeNull()
    expect(screen.getByText('Screen')).toBeTruthy()

    mockKeyboardUp = false
    screen.rerender(<AppNavigation>{content}</AppNavigation>)
    expect(screen.getByTestId('app-navigation-bar')).toBeTruthy()
  })
})
