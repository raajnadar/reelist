import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import WatchlistScreen from '../../app/watchlist'
import { mockMovies } from '../../lib/mock'
import { renderWithProviders } from '../../lib/test-utils'
import { STORAGE_KEY, toggleSaved } from '../../lib/watchlist'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
}))

const [first, second] = mockMovies

beforeEach(() => {
  jest.clearAllMocks()
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
  expect(mockPush).toHaveBeenCalledWith('/search')
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
