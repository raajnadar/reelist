import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { Dimensions } from 'react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import { mockMovieDetail } from '../../../lib/mock'
import MovieScreen from '../../../app/movie/[id]'
import { MissingProxyUrlError } from '../../../lib/config'
import { parseStored, STORAGE_KEY } from '../../../lib/watchlist'

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
// Named, because the failure states offer a way home and the press has to be
// checked: a "Go home" button that calls nothing is a dead end on a deep link.
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: mockReplace,
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

it('shows the title, the rating, the date line, and the overview', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<MovieScreen />)

  // The title renders twice on purpose: once in the masthead and once in the
  // floating header, which fades it in as the masthead scrolls away. Only one
  // of the two is ever visible. `findAllByText` states that, where
  // `findByText` would fail on the second copy and read as a defect.
  expect(await screen.findAllByText(movie.title)).toHaveLength(2)
  // The rating stands on its own as a badge, and the year and the runtime are
  // the line beside it. The cards keep the joined form — see lib/format.ts.
  expect(screen.getByText('★ 8.2')).toBeTruthy()
  expect(screen.getByText('2024 · 2h 47m')).toBeTruthy()
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

  expect(await screen.findByText('TMDB has no movie with that id.')).toBeTruthy()
})

// A non-numeric id is a bad link. The screen must not call the data layer at
// all: `Number('abc')` is NaN, and passing that on is how a bad URL turns into
// a confusing failure further down.
it('rejects a non-numeric id without calling the data layer', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: 'abc' })

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('That link does not point at a movie.')).toBeTruthy()
  expect(getMovie).not.toHaveBeenCalled()
})

describe('the failure state', () => {
  it('offers a retry that loads the film again', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockRejectedValueOnce(new Error('Network is down'))
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    await waitFor(() => expect(screen.getByText('Could not load the movie')).toBeTruthy())

    fireEvent.press(screen.getByText('Try again'))

    // The id is unchanged, so only `attempt` can re-run the effect. Without it
    // in the dependency list the press would change nothing the effect reads.
    // The overview, not the title: DetailHeader draws the title as well, so a
    // single-match query finds two nodes once the film loads.
    await waitFor(() => expect(screen.getByText(movie.overview)).toBeTruthy())
    expect(getMovie).toHaveBeenCalledTimes(2)
  })

  // Same reason as the other screens: the fix is a file on disk and a restart,
  // and a second request cannot apply it.
  it('offers no retry for a setup mistake', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockRejectedValue(new MissingProxyUrlError())

    const screen = renderWithProviders(<MovieScreen />)

    await waitFor(() => expect(screen.getByText('Setup needed')).toBeTruthy())
    expect(screen.queryByText('Try again')).toBeNull()
  })

  /**
   * A bad id and an id TMDB has nothing for both leave no film to load, so a
   * retry would repeat the same nothing. The screen offers the way out — and it
   * has to, because a deep link makes this the first entry in the history.
   */
  it.each([
    ['a bad id', 'abc', null],
    ['an id with no film', '999999', null],
  ])('offers a way home for %s', async (_name, id) => {
    mockUseLocalSearchParams.mockReturnValue({ id })
    getMovie.mockResolvedValue(null)

    const screen = renderWithProviders(<MovieScreen />)

    await waitFor(() => expect(screen.getByText('Movie not found')).toBeTruthy())
    expect(screen.queryByText('Try again')).toBeNull()

    fireEvent.press(screen.getByText('Go home'))

    expect(mockReplace).toHaveBeenCalledWith('/')
  })
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
// lib/api.ts maps that to 0, and the date line must then drop the segment rather
// than print "0m".
it('drops the runtime from the date line when the film has none', async () => {
  const noRuntime = { ...movie, runtime: 0 }
  mockUseLocalSearchParams.mockReturnValue({ id: String(noRuntime.id) })
  getMovie.mockResolvedValue(noRuntime)

  const screen = renderWithProviders(<MovieScreen />)

  expect(await screen.findByText('2024')).toBeTruthy()
  expect(screen.queryByText('2024 · 2h 47m')).toBeNull()
})

// The poster is part of the masthead at every width: it overlaps the backdrop
// and gives the title a baseline to sit on. It used to belong to the wide
// layout alone, where it was a second image stacked under the backdrop.
it('renders the poster in the masthead on a narrow window', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<MovieScreen />)

  await screen.findByText(movie.overview)
  expect(screen.getByTestId('detail-poster')).toBeTruthy()
  expect(screen.getByTestId('detail-backdrop')).toBeTruthy()
})

/**
 * The three sections the appended blocks feed. Each one has an absent twin,
 * because TMDB omits a block whose film has nothing in it and `lib/api.ts` maps
 * that to an empty list or a null.
 */
describe('the trailer button', () => {
  // The button opens the player screen rather than YouTube. The title travels
  // with the key, so the player names the film without a request of its own.
  it('opens the player screen for the trailer key', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    fireEvent.press(await screen.findByText('Watch trailer'))

    expect(mockPush).toHaveBeenCalledWith(
      `/trailer/${movie.trailer?.key}?title=${encodeURIComponent(movie.title)}`,
    )
  })

  // `lib/api.ts` reports no playable trailer as null, and the button is then
  // absent rather than disabled: a button that answers nothing reads as broken.
  it('is absent for a film with no trailer', async () => {
    const noTrailer = { ...movie, trailer: null }
    mockUseLocalSearchParams.mockReturnValue({ id: String(noTrailer.id) })
    getMovie.mockResolvedValue(noTrailer)

    const screen = renderWithProviders(<MovieScreen />)

    // The overview is the marker that the body rendered at all.
    expect(await screen.findByText(noTrailer.overview)).toBeTruthy()
    expect(screen.queryByText('Watch trailer')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('the save button', () => {
  it('saves the film, and reports it as saved', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    fireEvent.press(await screen.findByText('Save'))

    // The label states what the film is now, not what the next press will do.
    expect(await screen.findByText('Saved')).toBeTruthy()
    expect(screen.queryByText('Save')).toBeNull()
  })

  it('removes a film that is already saved', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)
    fireEvent.press(await screen.findByText('Save'))

    fireEvent.press(await screen.findByText('Saved'))

    expect(await screen.findByText('Save')).toBeTruthy()
  })

  it('writes the saved film to the device', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)
    fireEvent.press(await screen.findByText('Save'))

    // The card fields only. A MovieDetail carries the cast, the videos, and
    // twenty recommended films, and none of that belongs on the device.
    await waitFor(async () => {
      const saved = parseStored(await AsyncStorage.getItem(STORAGE_KEY))
      expect(saved).toHaveLength(1)
      expect(saved[0]).toEqual({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        vote_average: movie.vote_average,
        release_date: movie.release_date,
        overview: movie.overview,
      })
    })
  })

  // The trailer button is the one that can be absent. This one is the same for
  // every film, because every film can be saved.
  it('is there for a film with no trailer', async () => {
    const noTrailer = { ...movie, trailer: null }
    mockUseLocalSearchParams.mockReturnValue({ id: String(noTrailer.id) })
    getMovie.mockResolvedValue(noTrailer)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText('Save')).toBeTruthy()
  })
})

describe('the cast row', () => {
  it('names each performer and the part they play', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText('Cast')).toBeTruthy()
    expect(screen.getByText('Timothée Chalamet')).toBeTruthy()
    expect(screen.getByText('Paul Atreides')).toBeTruthy()
  })

  // CastRow returns null for an empty list, so an announced film with nobody
  // billed shows no heading above nothing.
  it('is absent for a film with no billed cast', async () => {
    const noCast = { ...movie, cast: [] }
    mockUseLocalSearchParams.mockReturnValue({ id: String(noCast.id) })
    getMovie.mockResolvedValue(noCast)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText(noCast.overview)).toBeTruthy()
    expect(screen.queryByText('Cast')).toBeNull()
  })
})

describe('the recommendation row', () => {
  it('shows the films TMDB recommends', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText('More like this')).toBeTruthy()
    expect(screen.getByText(movie.recommendations[0].title)).toBeTruthy()
  })

  /**
   * The dead end this row answers. A film TMDB recommends nothing for has to
   * end at the overview rather than at an empty heading — MovieRow returns null
   * for an empty list, which is the same rule the home screen rows follow.
   */
  it('is absent for a film with no recommendations', async () => {
    const noRecs = { ...movie, recommendations: [] }
    mockUseLocalSearchParams.mockReturnValue({ id: String(noRecs.id) })
    getMovie.mockResolvedValue(noRecs)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText(noRecs.overview)).toBeTruthy()
    expect(screen.queryByText('More like this')).toBeNull()
  })
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

  it('renders the poster beside the title', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    getMovie.mockResolvedValue(movie)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByTestId('detail-poster')).toBeTruthy()
    expect(screen.getByText(movie.overview)).toBeTruthy()
  })

  // A film with no poster path gets no placeholder box: an empty rectangle beside
  // the title reads as a broken image. The title column takes the width instead.
  it('omits the poster for a film with no poster', async () => {
    const noPoster = { ...movie, poster_path: null }
    mockUseLocalSearchParams.mockReturnValue({ id: String(noPoster.id) })
    getMovie.mockResolvedValue(noPoster)

    const screen = renderWithProviders(<MovieScreen />)

    expect(await screen.findByText(noPoster.overview)).toBeTruthy()
    expect(screen.queryByTestId('detail-poster')).toBeNull()
  })
})
