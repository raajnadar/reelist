import { waitFor } from '@testing-library/react-native'
import { Dimensions } from 'react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import { mockMovieDetail } from '../../../lib/mock'
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

// `push` is here for GenreChips, which the body renders: it navigates to the
// genre screen on a press. A mock missing the method throws inside the chip row
// rather than failing an assertion, so the whole screen renders as nothing.
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}))

jest.mock('../../../lib/api', () => ({
  getMovie: jest.fn(),
}))

const { getMovie } = jest.requireMock('../../../lib/api')

// Dune: a film with every field the detail endpoint sends.
const movie = mockMovieDetail

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
  // The runtime joins the rating and the year, which is what the detail endpoint
  // adds over a list entry.
  expect(screen.getByText('★ 8.2 · 2024 · 2h 47m')).toBeTruthy()
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

// The three fields the detail endpoint adds over a list entry. Each has a
// documented absent form, and each must be a line that disappears rather than an
// empty row — the same rule the meta line already follows.

it('shows the tagline and the genre chips', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText(movie.tagline)).toBeTruthy()
  expect(screen.getByText('Science Fiction')).toBeTruthy()
  expect(screen.getByText('Adventure')).toBeTruthy()
})

it('omits the tagline for a film that has none', async () => {
  const noTagline = { ...movie, tagline: '' }
  mockUseLocalSearchParams.mockReturnValue({ id: String(noTagline.id) })
  getMovie.mockResolvedValue(noTagline)

  const screen = renderWithProviders(<MovieScreen />)

  // The overview is the marker that the body rendered at all. Without it this
  // assertion would also pass on a screen that failed to load.
  expect(await screen.findByText(noTagline.overview)).toBeTruthy()
  expect(screen.queryByText(movie.tagline)).toBeNull()
})

// GenreChips returns null for an empty list, so a film with no genres must leave
// no gap and no error. The film still has to render.
it('renders a film that has no genres', async () => {
  const noGenres = { ...movie, genres: [] }
  mockUseLocalSearchParams.mockReturnValue({ id: String(noGenres.id) })
  getMovie.mockResolvedValue(noGenres)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText(noGenres.overview)).toBeTruthy()
  expect(screen.queryByText('Science Fiction')).toBeNull()
})

// TMDB reports an unknown runtime as null for an announced film with no cut yet.
// lib/api.ts maps that to 0, and the meta line must then drop the segment rather
// than print "0m".
it('drops the runtime from the meta line when the film has none', async () => {
  const noRuntime = { ...movie, runtime: 0 }
  mockUseLocalSearchParams.mockReturnValue({ id: String(noRuntime.id) })
  getMovie.mockResolvedValue(noRuntime)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('★ 8.2 · 2024')).toBeTruthy()
})

// The test renderer reports a 390pt window, which is `compact`. The poster
// column belongs to the wide layout only: on a phone the backdrop is already the
// hero, and a second image of the same film would push the overview off screen.
it('does not render the poster column on a narrow window', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<MovieScreen />)

  await screen.findByText(movie.overview)
  expect(screen.queryByTestId('detail-poster')).toBeNull()
})

// The wide layout. `useBreakpointValue` reads `useWindowDimensions`, so widening
// the reported window is what selects the two-column arrangement — the same path
// a desktop browser takes. Without this block every test above runs at the
// renderer's 390pt default, and the poster column would never be exercised.
describe('on a wide window', () => {
  // `Dimensions.get` is what `useWindowDimensions` reads, and the same seam
  // components/SkeletonGrid.test.tsx uses to pin its breakpoint map.
  beforeEach(() => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 1440,
      height: 900,
      scale: 2,
      fontScale: 1,
    } as never)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders the poster beside the text', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByTestId('detail-poster')).toBeTruthy()
    expect(screen.getByText(movie.overview)).toBeTruthy()
  })

  // A film with no poster path gets no placeholder box: an empty rectangle beside
  // the title reads as a broken image. The text column takes the width instead.
  it('omits the poster column for a film with no poster', async () => {
    const noPoster = { ...movie, poster_path: null }
    mockUseLocalSearchParams.mockReturnValue({ id: String(noPoster.id) })
    getMovie.mockResolvedValue(noPoster)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText(noPoster.overview)).toBeTruthy()
    expect(screen.queryByTestId('detail-poster')).toBeNull()
  })
})
