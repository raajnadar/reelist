import { act, fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import { mockMovieDetail } from '../../../lib/mock'
import { writeCache } from '../../../lib/resourceCache'
import GalleryScreen from '../../../app/gallery/[id]'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file in
// that folder becomes a route.

const mockUseLocalSearchParams = jest.fn()
const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn()

// `Stack.Screen` carries the presentation options and renders nothing; the
// real one needs a navigator above it that no test mounts.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}))

jest.mock('../../../lib/api', () => ({
  getMovie: jest.fn(),
}))

const { getMovie } = jest.requireMock('../../../lib/api')

const movie = mockMovieDetail

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
})

it('opens on the still the link names and shows the position', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id), at: '2' })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<GalleryScreen />)

  expect(await screen.findByText('3 / 4')).toBeTruthy()
  expect(screen.getByText(movie.title)).toBeTruthy()
})

it('opens on the first still when the link names no position', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<GalleryScreen />)

  expect(await screen.findByText('1 / 4')).toBeTruthy()
})

// The detail screen already asked for the film under this key. The viewer
// reads that answer, so opening it from the film sends no second request.
it('draws from the cache without a request when the film is already loaded', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id), at: '0' })
  writeCache(`movie:${movie.id}`, movie)

  const screen = renderWithProviders(<GalleryScreen />)

  expect(screen.getByText('1 / 4')).toBeTruthy()
  expect(getMovie).not.toHaveBeenCalled()
})

it('renders the page in front and every still as a thumbnail', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<GalleryScreen />)

  await screen.findByText('1 / 4')
  // The pager mounts the page in front first and fills its window as it
  // settles, so only the strip is expected to hold all four at once.
  expect(screen.getAllByTestId('gallery-page').length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByTestId('gallery-thumb')).toHaveLength(4)
})

it('goes back on close when there is a screen to go back to', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<GalleryScreen />)

  fireEvent.press(await screen.findByLabelText('Close the gallery'))

  expect(mockBack).toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

// A deep link makes this the first entry in the history. The film's own page
// is the right place to land, not home.
it('goes to the film on close when there is nothing to go back to', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  mockCanGoBack.mockReturnValue(false)
  getMovie.mockResolvedValue(movie)

  const screen = renderWithProviders(<GalleryScreen />)

  fireEvent.press(await screen.findByLabelText('Close the gallery'))

  expect(mockReplace).toHaveBeenCalledWith(`/movie/${movie.id}`)
})

it('reports a film with no stills and offers the way out', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
  getMovie.mockResolvedValue({ ...movie, images: [] })

  const screen = renderWithProviders(<GalleryScreen />)

  expect(await screen.findByText('No stills for this film')).toBeTruthy()

  fireEvent.press(screen.getByText('Go back'))
  expect(mockBack).toHaveBeenCalled()
})

it('reports an id that matches no film', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: '999999' })
  getMovie.mockResolvedValue(null)

  const screen = renderWithProviders(<GalleryScreen />)

  expect(await screen.findByText('TMDB has no movie with that id.')).toBeTruthy()
})

it('rejects a non-numeric id without calling the data layer', async () => {
  mockUseLocalSearchParams.mockReturnValue({ id: 'abc' })

  const screen = renderWithProviders(<GalleryScreen />)

  expect(await screen.findByText('That link does not point at a movie.')).toBeTruthy()
  expect(getMovie).not.toHaveBeenCalled()
})

describe('a tap on the picture', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockUseLocalSearchParams.mockReturnValue({ id: String(movie.id) })
    writeCache(`movie:${movie.id}`, movie)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const tap = (screen: ReturnType<typeof renderWithProviders>) =>
    fireEvent.press(screen.getAllByTestId('gallery-page')[0], {
      nativeEvent: { locationX: 10, locationY: 10 },
    })

  // The chrome is hidden by taking it out of the touch tree as well as fading
  // it, so a hidden close button cannot be pressed by accident.
  it('hides the bar and the strip on one tap, once the double-tap window passes', async () => {
    const screen = renderWithProviders(<GalleryScreen />)

    tap(screen)
    expect(screen.getByTestId('gallery-chrome').props.pointerEvents).toBe('box-none')

    await act(async () => {
      jest.advanceTimersByTime(300)
    })

    expect(screen.getByTestId('gallery-chrome').props.pointerEvents).toBe('none')
  })

  it('brings them back on the next tap', async () => {
    const screen = renderWithProviders(<GalleryScreen />)

    tap(screen)
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    tap(screen)
    await act(async () => {
      jest.advanceTimersByTime(300)
    })

    expect(screen.getByTestId('gallery-chrome').props.pointerEvents).toBe('box-none')
  })

  // Two taps inside the window are a zoom, not two toggles: the first is
  // cancelled, so the chrome stays where it was.
  it('leaves the chrome alone on a double tap', async () => {
    const screen = renderWithProviders(<GalleryScreen />)

    tap(screen)
    tap(screen)
    await act(async () => {
      jest.advanceTimersByTime(300)
    })

    expect(screen.getByTestId('gallery-chrome').props.pointerEvents).toBe('box-none')
  })
})
