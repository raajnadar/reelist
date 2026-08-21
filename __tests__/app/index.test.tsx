import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '../../lib/test-utils'
import { mockMovies } from '../../lib/mock'
import HomeScreen from '../../app/index'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.
//
// This suite covers the search entry point the home screen owns. The rows
// themselves are covered by the component tests.

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
}))

jest.mock('../../lib/api', () => ({
  getTrending: jest.fn(),
  getPopular: jest.fn(),
  getTopRated: jest.fn(),
  getGenres: jest.fn(),
}))

const api = jest.requireMock('../../lib/api')

beforeEach(() => {
  jest.clearAllMocks()
  const paged = { results: mockMovies, page: 1, total_pages: 1 }
  api.getTrending.mockResolvedValue(paged)
  api.getPopular.mockResolvedValue(paged)
  api.getTopRated.mockResolvedValue(paged)
  api.getGenres.mockResolvedValue([
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
  ])
})

it('opens the search screen from the header button', async () => {
  const screen = renderWithProviders(<HomeScreen />)

  fireEvent.press(screen.getByLabelText('Search movies'))

  // The literal path is the assertion. `yarn typecheck` proves the route exists;
  // this proves the button is wired to it.
  expect(mockPush).toHaveBeenCalledWith('/search')

  await act(async () => {})
})

it('keeps the search button reachable while the rows are still loading', async () => {
  const screen = renderWithProviders(<HomeScreen />)

  // Asserted before any await, which is the point: the button has to be there
  // while the requests are still in flight. The button sits outside the
  // Presence block, so it must not wait for data — inside it, a slow network
  // would leave the user with no way to search.
  expect(screen.getByLabelText('Search movies')).toBeTruthy()

  // Then let the mocked requests settle. Without this they resolve after the
  // test ends and React reports the state updates as outside act().
  await act(async () => {})
})

it('still shows the search button when the rows fail to load', async () => {
  api.getTrending.mockRejectedValue(new Error('TMDB is unavailable'))

  const screen = renderWithProviders(<HomeScreen />)

  await waitFor(() => expect(screen.getByText('TMDB is unavailable')).toBeTruthy())
  // Search does not depend on the rows, so a failed home load must not remove it.
  expect(screen.getByLabelText('Search movies')).toBeTruthy()
})

describe('the genre chips', () => {
  it('opens the genre screen with the id and the name', async () => {
    const screen = renderWithProviders(<HomeScreen />)

    await waitFor(() => expect(screen.getByText('Action')).toBeTruthy())
    fireEvent.press(screen.getByText('Action'))

    // The name travels in the query so the genre screen can title itself
    // without fetching the genre list again.
    expect(mockPush).toHaveBeenCalledWith('/genre/28?name=Action')
  })

  /**
   * The reason the genres load in their own effect. A failure here must cost
   * the chips and nothing else — the three film rows are the primary content
   * and they loaded fine.
   */
  it('keeps the film rows when the genres fail to load', async () => {
    api.getGenres.mockRejectedValue(new Error('Genres unavailable'))

    const screen = renderWithProviders(<HomeScreen />)

    await waitFor(() => expect(screen.getByText('Trending this week')).toBeTruthy())
    // No chips, and no error either: a missing shortcut row says nothing.
    expect(screen.queryByText('Action')).toBeNull()
    expect(screen.queryByText('Genres unavailable')).toBeNull()
  })

  // The chips sit outside the Presence block, so a slow film request must not
  // hold them back.
  it('shows the chips while the film rows are still loading', async () => {
    api.getTrending.mockReturnValue(new Promise(() => {}))

    const screen = renderWithProviders(<HomeScreen />)

    await waitFor(() => expect(screen.getByText('Action')).toBeTruthy())
  })

  it('renders no chip row when the genre list is empty', async () => {
    api.getGenres.mockResolvedValue([])

    const screen = renderWithProviders(<HomeScreen />)

    await waitFor(() => expect(screen.getByText('Trending this week')).toBeTruthy())
    expect(screen.queryByText('Action')).toBeNull()
  })
})
