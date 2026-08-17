import { fireEvent, waitFor } from '@testing-library/react-native'
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
}))

const api = jest.requireMock('../../lib/api')

beforeEach(() => {
  jest.clearAllMocks()
  const paged = { results: mockMovies }
  api.getTrending.mockResolvedValue(paged)
  api.getPopular.mockResolvedValue(paged)
  api.getTopRated.mockResolvedValue(paged)
})

it('opens the search screen from the header button', async () => {
  const screen = renderWithProviders(<HomeScreen />)

  fireEvent.press(screen.getByLabelText('Search movies'))

  // The literal path is the assertion. `yarn typecheck` proves the route exists;
  // this proves the button is wired to it.
  expect(mockPush).toHaveBeenCalledWith('/search')
})

it('keeps the search button reachable while the rows are still loading', () => {
  const screen = renderWithProviders(<HomeScreen />)

  // The button sits outside the Presence block, so it must not wait for data.
  // Inside it, a slow network would leave the user with no way to search.
  expect(screen.getByLabelText('Search movies')).toBeTruthy()
})

it('still shows the search button when the rows fail to load', async () => {
  api.getTrending.mockRejectedValue(new Error('TMDB is unavailable'))

  const screen = renderWithProviders(<HomeScreen />)

  await waitFor(() => expect(screen.getByText('TMDB is unavailable')).toBeTruthy())
  // Search does not depend on the rows, so a failed home load must not remove it.
  expect(screen.getByLabelText('Search movies')).toBeTruthy()
})
