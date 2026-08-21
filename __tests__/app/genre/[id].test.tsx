import { fireEvent, waitFor } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import { mockMovies } from '../../../lib/mock'
import GenreScreen, { genreColumnCount, mergePages } from '../../../app/genre/[id]'
import { CARD_WIDTH } from '../../../components/MovieCard'
import type { Movie } from '../../../lib/types'

// Outside `app/` for the reason movie/[id].test.tsx records: Expo Router builds
// its route table from `require.context('./app')`, so a test file in there
// becomes a route and Metro then bundles the testing library into the app.

const mockReplace = jest.fn()
let mockParams: Record<string, string> = { id: '28', name: 'Action' }

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('../../../lib/api', () => ({
  getMoviesByGenre: jest.fn(),
}))

const { getMoviesByGenre } = jest.requireMock('../../../lib/api')

/** A page of `count` films whose ids start at `from`, so pages never overlap. */
const pageOf = (from: number, count: number, total = 5) => ({
  results: Array.from({ length: count }, (_, i) => ({
    ...mockMovies[0],
    id: from + i,
    title: `Film ${from + i}`,
  })),
  page: Math.ceil(from / 20) || 1,
  total_pages: total,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { id: '28', name: 'Action' }
  getMoviesByGenre.mockResolvedValue({
    results: mockMovies,
    page: 1,
    total_pages: 1,
  })
})

describe('genreColumnCount', () => {
  // The grid has to stay a grid at every width, the same invariant the search
  // grid holds.
  it.each([320, 360, 390, 414, 768, 1024, 1440])(
    'gives at least 2 columns at %ipx',
    (width) => {
      expect(genreColumnCount(width)).toBeGreaterThanOrEqual(2)
    },
  )

  it('never lays out columns wider than the available space', () => {
    for (const width of [320, 360, 390, 414, 768, 1024, 1440]) {
      const columns = genreColumnCount(width)
      const needed = columns * CARD_WIDTH + (columns - 1) * 12
      // Two columns can overflow a very narrow window by design; above that the
      // count must fit.
      if (columns > 2) expect(needed).toBeLessThanOrEqual(width - 32)
    }
  })
})

describe('mergePages', () => {
  const film = (id: number) => ({ ...mockMovies[0], id }) as Movie

  it('appends a page that shares no film', () => {
    const merged = mergePages([film(1), film(2)], [film(3)])

    expect(merged.map((m) => m.id)).toEqual([1, 2, 3])
  })

  /**
   * TMDB pages a ranking, not a snapshot, so a film can shift between pages and
   * arrive twice. Two FlatList children with one key is a real defect: React
   * warns and the duplicate takes the wrong press target.
   */
  it('drops a film already on screen', () => {
    const merged = mergePages([film(1), film(2)], [film(2), film(3)])

    expect(merged.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('keeps the films already loaded when the new page is empty', () => {
    expect(mergePages([film(1)], [])).toHaveLength(1)
  })
})

describe('the screen states', () => {
  it('shows the films once they load', async () => {
    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())
  })

  it('titles itself from the name in the query', async () => {
    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Action')).toBeTruthy())
  })

  // A deep link can arrive without the name the chips attach.
  it('falls back to a generic title when the query has no name', async () => {
    mockParams = { id: '28' }

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Genre')).toBeTruthy())
  })

  it('reports a failed request', async () => {
    getMoviesByGenre.mockRejectedValue(new Error('TMDB is unavailable'))

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('TMDB is unavailable')).toBeTruthy())
  })

  it('shows an empty state for a genre with no films', async () => {
    getMoviesByGenre.mockResolvedValue({ results: [], page: 1, total_pages: 1 })

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() =>
      expect(screen.getByText('No movies in this genre yet')).toBeTruthy(),
    )
  })

  /**
   * A route parameter comes from an untrusted source. TMDB answers an
   * unparseable `with_genres` with an unfiltered list, so a bad id would
   * otherwise render as a working screen showing every film.
   */
  it.each(['abc', '0', '-3', ''])('refuses the invalid id %p', async (id) => {
    mockParams = { id }

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() =>
      expect(screen.getByText('That genre does not exist.')).toBeTruthy(),
    )
    expect(getMoviesByGenre).not.toHaveBeenCalled()
  })
})

describe('the paging', () => {
  it('asks for the first page on mount', async () => {
    renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 1))
  })

  it('loads the next page when the grid reaches its end', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(21, 20))
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')

    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 2))
    await waitFor(() => expect(screen.getByText('Film 21')).toBeTruthy())
    // The first page stays: a new page appends rather than replaces.
    expect(screen.getByText('Film 1')).toBeTruthy()
  })

  /**
   * `lib/api.ts` clamps `total_pages` to the TMDB ceiling of 500, so this
   * comparison is the whole stop condition. Without it the screen would ask
   * past the end and TMDB would answer 422.
   */
  it('stops asking once the last page is loaded', async () => {
    getMoviesByGenre.mockResolvedValue(pageOf(1, 20, 1))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')

    expect(getMoviesByGenre).toHaveBeenCalledTimes(1)
  })

  // FlatList fires onEndReached more than once for one approach to the end.
  it('requests a page once when the end fires repeatedly', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    const list = screen.UNSAFE_getByType(FlatList)
    getMoviesByGenre.mockResolvedValueOnce(pageOf(21, 20))
    fireEvent(list, 'endReached')
    fireEvent(list, 'endReached')
    fireEvent(list, 'endReached')

    await waitFor(() => expect(screen.getByText('Film 21')).toBeTruthy())
    // Page 1 on mount, page 2 once — not three times.
    expect(getMoviesByGenre).toHaveBeenCalledTimes(2)
  })

  /**
   * A failed page is not a failed screen. The films already loaded must stay,
   * rather than the whole grid being replaced by an error.
   */
  it('keeps the loaded films when a later page fails', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockRejectedValueOnce(new Error('Page 2 failed'))
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')

    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Film 1')).toBeTruthy()
    expect(screen.queryByText('Page 2 failed')).toBeNull()
  })
})

describe('switching genre', () => {
  /**
   * A page requested for one genre can land after the user opened another. The
   * outcome carries the genre it belongs to, so a late page is dropped rather
   * than appended under the new genre's name.
   */
  it('ignores a page that arrives for the previous genre', async () => {
    let resolvePageTwo: (value: unknown) => void = () => {}
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))

    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    // Page 2 of genre 28 is in flight and has not answered yet.
    getMoviesByGenre.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePageTwo = resolve
      }),
    )
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')
    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 2))

    // The user opens a different genre, which loads its own first page.
    mockParams = { id: '35', name: 'Comedy' }
    getMoviesByGenre.mockResolvedValueOnce(pageOf(500, 3))
    screen.rerender(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 500')).toBeTruthy())

    // Only now does the abandoned page answer.
    resolvePageTwo(pageOf(21, 20))

    await waitFor(() => expect(screen.getByText('Film 500')).toBeTruthy())
    // Genre 28's second page must not appear under Comedy.
    expect(screen.queryByText('Film 21')).toBeNull()
  })
})
