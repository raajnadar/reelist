import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '../../lib/test-utils'
import { mockMovies } from '../../lib/mock'
import SearchScreen, { searchColumnCount } from '../../app/search'
import { SEARCH_DEBOUNCE_MS } from '../../lib/useDebounced'
import { CARD_WIDTH } from '../../components/MovieCard'

// Outside `app/` for the reason movie/[id].test.tsx records: Expo Router builds
// its route table from `require.context('./app')`, so a test file in there
// becomes a route and Metro then bundles the testing library into the app.

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}))

jest.mock('../../lib/api', () => ({
  searchMovies: jest.fn(),
}))

const { searchMovies } = jest.requireMock('../../lib/api')

const FIELD = 'Search movies'

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  searchMovies.mockResolvedValue({ results: [] })
})

afterEach(() => {
  jest.useRealTimers()
})

/** Advances past the debounce and lets the resulting promise settle. */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
  })
}

describe('searchColumnCount', () => {
  // The grid has to stay a grid at every width. A count below two would give a
  // poster the full width of a narrow phone.
  it.each([320, 360, 390, 414, 768, 1024, 1440])(
    'gives at least 2 columns at %ipx',
    (width) => {
      expect(searchColumnCount(width)).toBeGreaterThanOrEqual(2)
    },
  )

  it('never lays out columns wider than the available space', () => {
    for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
      const columns = searchColumnCount(width)
      const needed = columns * CARD_WIDTH + (columns - 1) * 12
      // Two columns is a floor, so a very narrow window is allowed to overflow.
      // Past that, the count must actually fit.
      if (columns > 2) expect(needed).toBeLessThanOrEqual(width - 32)
    }
  })

  it('adds columns as the window widens', () => {
    expect(searchColumnCount(1440)).toBeGreaterThan(searchColumnCount(390))
  })
})

it('shows the prompt and searches for nothing before the user types', () => {
  const screen = renderWithProviders(<SearchScreen />)

  expect(screen.getByText('Type to search for a movie')).toBeTruthy()
  expect(searchMovies).not.toHaveBeenCalled()
})

it('sends one request for a burst of keystrokes, carrying the last value', async () => {
  const screen = renderWithProviders(<SearchScreen />)
  const field = screen.getByLabelText(FIELD)

  // Four keystrokes inside one debounce window.
  for (const value of ['d', 'du', 'dun', 'dune']) {
    fireEvent.changeText(field, value)
    act(() => {
      jest.advanceTimersByTime(50)
    })
  }
  expect(searchMovies).not.toHaveBeenCalled()

  await settle()

  expect(searchMovies).toHaveBeenCalledTimes(1)
  expect(searchMovies).toHaveBeenCalledWith('dune')
})

it('renders a card per result', async () => {
  searchMovies.mockResolvedValue({ results: mockMovies.slice(0, 3) })

  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), 'dune')
  await settle()

  for (const movie of mockMovies.slice(0, 3)) {
    expect(await screen.findByText(movie.title)).toBeTruthy()
  }
})

it('reports a search that matched nothing, distinctly from the first prompt', async () => {
  searchMovies.mockResolvedValue({ results: [] })

  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), 'zzzzz')
  await settle()

  // The two empty states share an empty grid and must not share their words.
  await waitFor(() => expect(screen.getByText('No movies match "zzzzz"')).toBeTruthy())
  expect(screen.queryByText('Type to search for a movie')).toBeNull()
})

it('trims the query before it reaches the data layer', async () => {
  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), '  dune  ')
  await settle()

  expect(searchMovies).toHaveBeenCalledWith('dune')
})

it('treats a whitespace-only box as no search at all', async () => {
  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), '   ')
  await settle()

  expect(searchMovies).not.toHaveBeenCalled()
  expect(screen.getByText('Type to search for a movie')).toBeTruthy()
})

it('clears the results and returns to the prompt when the box is emptied', async () => {
  searchMovies.mockResolvedValue({ results: mockMovies.slice(0, 2) })

  const screen = renderWithProviders(<SearchScreen />)
  const field = screen.getByLabelText(FIELD)

  fireEvent.changeText(field, 'dune')
  await settle()
  expect(await screen.findByText(mockMovies[0].title)).toBeTruthy()

  fireEvent.changeText(field, '')
  await settle()

  // A stale grid under an empty box would contradict the field.
  await waitFor(() => expect(screen.getByText('Type to search for a movie')).toBeTruthy())
  expect(screen.queryByText(mockMovies[0].title)).toBeNull()
})

it('shows the message from a failed search', async () => {
  searchMovies.mockRejectedValue(new Error('TMDB is unavailable'))

  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), 'dune')
  await settle()

  // The screen repeats the error's own message rather than a generic line, so a
  // setup mistake still reads as one. Same contract as the other two screens.
  await waitFor(() => expect(screen.getByText('TMDB is unavailable')).toBeTruthy())
})

it('falls back to a generic message when the throw is not an Error', async () => {
  searchMovies.mockRejectedValue('not an error object')

  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), 'dune')
  await settle()

  await waitFor(() => expect(screen.getByText('Could not search movies')).toBeTruthy())
})

it('drops a stale answer that arrives after a newer one', async () => {
  // The ordering hazard: a slow request for the short query resolves last.
  let resolveSlow: (value: { results: typeof mockMovies }) => void = () => {}
  const slow = new Promise<{ results: typeof mockMovies }>((resolve) => {
    resolveSlow = resolve
  })

  searchMovies
    .mockReturnValueOnce(slow)
    .mockResolvedValueOnce({ results: [mockMovies[1]] })

  const screen = renderWithProviders(<SearchScreen />)
  const field = screen.getByLabelText(FIELD)

  fireEvent.changeText(field, 'du')
  await settle()

  fireEvent.changeText(field, 'dune')
  await settle()

  expect(await screen.findByText(mockMovies[1].title)).toBeTruthy()

  // The first request now answers, too late.
  await act(async () => {
    resolveSlow({ results: [mockMovies[0]] })
  })

  // Without the `active` guard in the effect, this stale answer would replace
  // the newer one and the grid would no longer match the box.
  expect(screen.getByText(mockMovies[1].title)).toBeTruthy()
  expect(screen.queryByText(mockMovies[0].title)).toBeNull()
})

it('clears the box with the trailing icon', async () => {
  searchMovies.mockResolvedValue({ results: mockMovies.slice(0, 2) })

  const screen = renderWithProviders(<SearchScreen />)
  fireEvent.changeText(screen.getByLabelText(FIELD), 'dune')
  await settle()

  fireEvent.press(screen.getByLabelText('Clear search'))
  await settle()

  await waitFor(() => expect(screen.getByText('Type to search for a movie')).toBeTruthy())
})

it('offers no clear icon while the box is empty', () => {
  const screen = renderWithProviders(<SearchScreen />)

  // The icon would be an action that does nothing.
  expect(screen.queryByLabelText('Clear search')).toBeNull()
})
