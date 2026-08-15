import { waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import { mockMovies } from '../../../lib/mock'
import MovieScreen from '../../../app/movie/[id]'

// This test mirrors the path of the screen it covers, but it stays outside
// `app/`. Expo Router builds the route table with `require.context('./app')`,
// which matches every file in that folder. A test file in `app/` becomes a
// route, so Metro bundles `@testing-library/react-native` into the app and the
// build fails on its Node imports (`console`, `util`). Tests for other folders
// can stay beside their source, because the router does not read those folders.

// The screen reads its id from the router and its data from lib/api. Both are
// mocked per test so each branch is reachable: a real film, an id with no film,
// and an id that is not a number. Those last two render nothing the type system
// can check — a wrong branch is a blank screen, not a type error.

const mockUseLocalSearchParams = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}))

jest.mock('../../../lib/api', () => ({
  getMovie: jest.fn(),
}))

const { getMovie } = jest.requireMock('../../../lib/api')

// Dune: a film with every field populated.
const movie = mockMovies[0]

beforeEach(() => {
  jest.clearAllMocks()
})

it('shows the title, the meta line, and the overview', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<MovieScreen />)

  // The title renders twice on purpose: once in the app bar and once in the
  // body. `findAllByText` states that, where `findByText` would fail on the
  // second copy and read as a defect.
  expect(await screen.findAllByText(movie.title)).toHaveLength(2)
  expect(screen.getByText('★ 8.2 · 2024')).toBeTruthy()
  expect(screen.getByText(movie.overview)).toBeTruthy()
})

it('passes the id to the data layer as a number, not the raw string param', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  renderWithProviders(<MovieScreen />)

  await waitFor(() => expect(getMovie).toHaveBeenCalledWith(movie.id))
})

it('reports an id that matches no film', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: '999999' })
  getMovie.mockResolvedValue(null)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('That movie is not in the list')).toBeTruthy()
})

// A non-numeric id is a bad link. The screen must not call the data layer at
// all: `Number('abc')` is NaN, and passing that on is how a bad URL turns into
// a confusing failure further down.
it('rejects a non-numeric id without calling the data layer', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: 'abc' })

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('That link is not a valid movie')).toBeTruthy()
  expect(getMovie).not.toHaveBeenCalled()
})

it('reports a failure from the data layer', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockRejectedValue(new Error('Network is down'))

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('Network is down')).toBeTruthy()
})

// A film with no artwork must render the fallback, not an Image with a null
// source. This is the TMDB sentinel the mock data covers on purpose.
it('renders a fallback when the film has no artwork', async () => {
  const noArt = { ...movie, poster_path: null, backdrop_path: null }
  mockUseLocalSearchParams.mockReturnValue({ id: String(noArt.id) })
  getMovie.mockResolvedValue(noArt)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('No image')).toBeTruthy()
})

it('renders a placeholder when the film has no overview', async () => {
  const noOverview = { ...movie, overview: '' }
  mockUseLocalSearchParams.mockReturnValue({ id: String(noOverview.id) })
  getMovie.mockResolvedValue(noOverview)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('No overview yet.')).toBeTruthy()
})
