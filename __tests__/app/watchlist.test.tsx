import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import WatchlistScreen from '../../app/(main)/watchlist'
import { mockMovies } from '../../lib/mock'
import { renderWithProviders } from '../../lib/test-utils'
import { parseStored, STORAGE_KEY, toggleSaved } from '../../lib/watchlist'
import { readSearchOrigin } from '../../lib/searchOrigin'
import { haptic } from '../../lib/haptics'

jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }))
const mockHaptic = haptic as jest.Mock

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)

jest.mock('expo-router', () =>
  jest.requireActual('../../lib/test-utils').expoRouterMock(() => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  })),
)

// See index.test.tsx: the renderer's `measureInWindow` never answers.
const BUTTON_RECT = { x: 120, y: 480, width: 150, height: 40 }

jest.mock('../../lib/searchOrigin', () => ({
  ...jest.requireActual('../../lib/searchOrigin'),
  measureWindowRect: jest.fn(() => Promise.resolve(BUTTON_RECT)),
}))

const [first, second, third] = mockMovies

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
})

// Each test waits for the device read. A read that lands after the test ends
// updates the screen outside act(), and React logs a warning.

it('goes back', async () => {
  const screen = renderWithProviders(<WatchlistScreen />)
  await screen.findByTestId('watchlist-empty')

  fireEvent.press(screen.getByLabelText('Go back'))
  expect(mockBack).toHaveBeenCalled()
})

it('returns to the home screen when there is nowhere to go back to', async () => {
  // A deep link makes this the first entry in the history.
  mockCanGoBack.mockReturnValue(false)

  const screen = renderWithProviders(<WatchlistScreen />)
  await screen.findByTestId('watchlist-empty')

  fireEvent.press(screen.getByLabelText('Go back'))
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith('/')
})

it('draws the films saved on the device', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([first, second]))

  const screen = renderWithProviders(<WatchlistScreen />)

  expect(await screen.findByText(first.title)).toBeTruthy()
  expect(screen.getByText(second.title)).toBeTruthy()
})

it('reports an empty watchlist, and offers the search', async () => {
  const screen = renderWithProviders(<WatchlistScreen />)

  // The read has to finish first. Before it does the screen shows placeholders,
  // which is the state the next test covers.
  const empty = await screen.findByTestId('watchlist-empty')
  expect(empty).toBeTruthy()

  fireEvent.press(screen.getByText('Find a movie'))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/search'))
  expect(readSearchOrigin()).toEqual(BUTTON_RECT)
})

it('shows no empty state while the device is still being read', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([first]))

  const screen = renderWithProviders(<WatchlistScreen />)

  // Asserted before any await. A reader with a full watchlist must never see
  // "Nothing saved yet" for a frame on a cold start.
  expect(screen.queryByTestId('watchlist-empty')).toBeNull()
  expect(await screen.findByText(first.title)).toBeTruthy()
})

it('drops a film the reader unsaved while the screen is open', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([first, second]))

  const screen = renderWithProviders(<WatchlistScreen />)
  expect(await screen.findByText(first.title)).toBeTruthy()

  // What the detail screen does when the reader opens a saved film from this
  // grid and presses "Saved". The store is shared, so this screen follows.
  act(() => toggleSaved(first))

  await waitFor(() => expect(screen.queryByText(first.title)).toBeNull())
  expect(screen.getByText(second.title)).toBeTruthy()
})

it('reports a device copy that cannot be parsed as an empty watchlist', async () => {
  // A process the system killed mid-write leaves exactly this.
  await AsyncStorage.setItem(STORAGE_KEY, '[{"id":1')

  const screen = renderWithProviders(<WatchlistScreen />)

  expect(await screen.findByTestId('watchlist-empty')).toBeTruthy()
})

it('sorts the films from the options menu', async () => {
  // Oppenheimer was saved last, so it leads the date-added order. The title
  // order puts Dune first, which is the change this test looks for.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([second, first]))

  const screen = renderWithProviders(<WatchlistScreen />)
  const order = () =>
    screen
      .getAllByText(new RegExp(`^(${first.title}|${second.title})$`))
      .map((t) => t.props.children)

  expect(await screen.findByText(first.title)).toBeTruthy()
  expect(order()).toEqual([second.title, first.title])

  fireEvent.press(screen.getByTestId('watchlist-options'))
  fireEvent.press(await screen.findByText('Title'))

  await waitFor(() => expect(order()).toEqual([first.title, second.title]))
  // The pick also closes the menu. Its exit ends after the order changes.
  await waitFor(() => expect(screen.queryByText('Clear watchlist')).toBeNull())
})

it('clears the watchlist, and the undo puts every film back', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([first, second]))

  const screen = renderWithProviders(<WatchlistScreen />)
  expect(await screen.findByText(first.title)).toBeTruthy()

  fireEvent.press(screen.getByTestId('watchlist-options'))
  fireEvent.press(await screen.findByText('Clear watchlist'))

  expect(await screen.findByTestId('watchlist-empty')).toBeTruthy()
  expect(screen.getByText('Watchlist cleared')).toBeTruthy()
  expect(mockHaptic).toHaveBeenLastCalledWith('unsave')

  fireEvent.press(screen.getByText('Undo'))

  expect(await screen.findByText(first.title)).toBeTruthy()
  expect(screen.getByText(second.title)).toBeTruthy()
  expect(mockHaptic).toHaveBeenLastCalledWith('save')
})

it('shows no options menu on an empty watchlist', async () => {
  const screen = renderWithProviders(<WatchlistScreen />)

  expect(await screen.findByTestId('watchlist-empty')).toBeTruthy()
  expect(screen.queryByTestId('watchlist-options')).toBeNull()
})

describe('watched state', () => {
  const store = (films: object[]) =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(films))
  const stored = async () => parseStored(await AsyncStorage.getItem(STORAGE_KEY))
  const card = (screen: ReturnType<typeof renderWithProviders>, title: string) =>
    screen.getByRole('checkbox', { name: new RegExp(`^${title}\\.`) })

  const startSelecting = async (screen: ReturnType<typeof renderWithProviders>) => {
    fireEvent.press(screen.getByTestId('watchlist-options'))
    fireEvent.press(await screen.findByText('Select films'))
    await waitFor(() => expect(screen.getByLabelText('Stop selecting')).toBeTruthy())
  }

  it('splits the films into To watch and Watched', async () => {
    await store([first, { ...second, watched: true }])

    const screen = renderWithProviders(<WatchlistScreen />)

    expect(await screen.findByText(first.title)).toBeTruthy()
    expect(screen.queryByText(second.title)).toBeNull()

    fireEvent.press(screen.getByText('Watched'))

    expect(await screen.findByText(second.title)).toBeTruthy()
    expect(screen.queryByText(first.title)).toBeNull()
  })

  it('shows how many of the saved films the reader watched', async () => {
    await store([first, { ...second, watched: true }, third])

    const screen = renderWithProviders(<WatchlistScreen />)

    expect(await screen.findByText('1 of 3 films watched')).toBeTruthy()
    expect(screen.getByLabelText('Films watched').props.accessibilityValue).toMatchObject(
      {
        now: 33,
      },
    )
  })

  it('marks the picked films as watched, and the undo takes the mark off', async () => {
    await store([first, second])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    fireEvent.press(card(screen, first.title))
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(mockHaptic).toHaveBeenLastCalledWith('select')

    fireEvent.press(screen.getByLabelText('Mark as watched'))

    await waitFor(() => expect(screen.queryByText(first.title)).toBeNull())
    expect(screen.getByText('1 film marked as watched')).toBeTruthy()
    expect(screen.getByText('1 of 2 films watched')).toBeTruthy()
    expect(mockHaptic).toHaveBeenLastCalledWith('save')
    // The action ends select mode.
    expect(screen.getByText('Watchlist')).toBeTruthy()
    await waitFor(async () =>
      expect(await stored()).toEqual([{ ...first, watched: true }, second]),
    )

    fireEvent.press(screen.getByText('Undo'))

    expect(await screen.findByText(first.title)).toBeTruthy()
    expect(mockHaptic).toHaveBeenLastCalledWith('unsave')
    await waitFor(async () => expect(await stored()).toEqual([first, second]))
  })

  it('marks a watched film as not watched from the Watched tab', async () => {
    await store([{ ...first, watched: true }, second])

    const screen = renderWithProviders(<WatchlistScreen />)
    fireEvent.press(await screen.findByText('Watched'))
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    fireEvent.press(card(screen, first.title))
    fireEvent.press(screen.getByLabelText('Mark as not watched'))

    expect(await screen.findByText('1 film marked as not watched')).toBeTruthy()
    expect(await screen.findByTestId('watchlist-none-watched')).toBeTruthy()
    await waitFor(async () => expect(await stored()).toEqual([first, second]))
  })

  it('removes the picked films, and the undo puts each back in its place', async () => {
    await store([first, second, third])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    fireEvent.press(card(screen, first.title))
    fireEvent.press(card(screen, third.title))
    expect(screen.getByText('2 selected')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Remove from watchlist'))

    await waitFor(() => expect(screen.queryByText(first.title)).toBeNull())
    expect(screen.queryByText(third.title)).toBeNull()
    expect(screen.getByText(second.title)).toBeTruthy()
    expect(screen.getByText('2 films removed from your watchlist')).toBeTruthy()
    expect(mockHaptic).toHaveBeenLastCalledWith('unsave')

    fireEvent.press(screen.getByText('Undo'))

    await waitFor(async () => expect(await stored()).toEqual([first, second, third]))
    expect(mockHaptic).toHaveBeenLastCalledWith('save')
  })

  it('picks every film on the tab, then none', async () => {
    await store([first, second, { ...third, watched: true }])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    fireEvent.press(screen.getByLabelText('Select all'))
    // Two, not three: the watched film is on the other tab.
    expect(screen.getByText('2 selected')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Select none'))
    expect(screen.getByText('Select films')).toBeTruthy()
  })

  it('opens no film from a card in select mode', async () => {
    await store([first])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    fireEvent.press(card(screen, first.title))

    expect(mockPush).not.toHaveBeenCalled()
    expect(card(screen, first.title)).toBeChecked()
  })

  it('offers no action until a film is picked', async () => {
    await store([first])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    expect(screen.getByLabelText('Mark as watched')).toBeDisabled()
    expect(screen.getByLabelText('Remove from watchlist')).toBeDisabled()
  })

  it('ends select mode from the close button, and from a change of tab', async () => {
    await store([first, { ...second, watched: true }])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()

    await startSelecting(screen)
    fireEvent.press(screen.getByLabelText('Stop selecting'))
    expect(screen.getByText('Watchlist')).toBeTruthy()

    await startSelecting(screen)
    fireEvent.press(screen.getByText('Watched'))
    expect(await screen.findByText(second.title)).toBeTruthy()
    expect(screen.queryByLabelText('Stop selecting')).toBeNull()
  })

  it('ends select mode on the Android back press, and keeps the screen', async () => {
    const addListener = jest.spyOn(BackHandler, 'addEventListener')
    await store([first])

    const screen = renderWithProviders(<WatchlistScreen />)
    expect(await screen.findByText(first.title)).toBeTruthy()
    await startSelecting(screen)

    const [event, onBack] = addListener.mock.calls.at(-1)!
    expect(event).toBe('hardwareBackPress')
    let handled: boolean | undefined
    act(() => {
      handled = onBack({ type: 'hardwareBackPress', timeStamp: Date.now() })
    })

    // `true` stops the press there, so the stack does not close the screen.
    expect(handled).toBe(true)
    expect(screen.getByText('Watchlist')).toBeTruthy()
    addListener.mockRestore()
  })

  it('says so when every film is watched, and offers the search', async () => {
    await store([{ ...first, watched: true }])

    const screen = renderWithProviders(<WatchlistScreen />)

    expect(await screen.findByTestId('watchlist-all-watched')).toBeTruthy()
    fireEvent.press(screen.getByText('Find a movie'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/search'))
  })

  it('sends a reader with nothing watched to select mode on the To watch tab', async () => {
    await store([first])

    const screen = renderWithProviders(<WatchlistScreen />)
    fireEvent.press(await screen.findByText('Watched'))
    expect(await screen.findByTestId('watchlist-none-watched')).toBeTruthy()

    fireEvent.press(screen.getByText('Select films'))

    expect(await screen.findByText(first.title)).toBeTruthy()
    expect(card(screen, first.title)).toBeTruthy()
  })
})
