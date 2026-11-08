import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { FlatList } from 'react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import { mockMovies } from '../../../lib/mock'
import { PullToRefresh } from '../../../components/PullToRefresh'
import GenreScreen, { mergePages } from '../../../app/(main)/genre/[id]'
import { MissingProxyUrlError } from '../../../lib/config'
import { setLanguage } from '../../../lib/language'
import type { Movie } from '../../../lib/types'

// Outside `app/` for the reason movie/[id].test.tsx records: Expo Router builds
// its route table from `require.context('./app')`, so a test file in there
// becomes a route and Metro then bundles the testing library into the app.

// A filter test renders the screen and the whole filter sheet. Beside the
// other suites, the first one went past the 5 s default on 2026-11-08.
jest.setTimeout(15_000)

const mockReplace = jest.fn()
const mockSetParams = jest.fn()
let mockParams: Record<string, string> = { id: '28', name: 'Action' }

jest.mock('expo-router', () => ({
  ...jest.requireActual('../../../lib/test-utils').expoRouterMock(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    setParams: mockSetParams,
    canGoBack: () => true,
  })),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('../../../lib/api', () => ({
  getMoviesByGenre: jest.fn(),
  getGenres: jest.fn(),
}))

const { getMoviesByGenre, getGenres } = jest.requireMock('../../../lib/api')

/**
 * A page of `count` films whose ids start at `from`, so pages never overlap.
 *
 * The page number follows from the first id, twenty to a page, unless the test
 * names one. A filtered list starts its ids past every unfiltered page, so its
 * pages are named.
 */
const pageOf = (
  from: number,
  count: number,
  total = 5,
  page = Math.ceil(from / 20) || 1,
) => ({
  results: Array.from({ length: count }, (_, i) => ({
    ...mockMovies[0],
    id: from + i,
    title: `Film ${from + i}`,
  })),
  page,
  total_pages: total,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { id: '28', name: 'Action' }
  getGenres.mockResolvedValue([])
  getMoviesByGenre.mockResolvedValue({
    results: mockMovies,
    page: 1,
    total_pages: 1,
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

  // A deep link can arrive without the name the chips attach. The genre list
  // then names it, under the key the home screen loads the chips with.
  it('reads the name from the genre list when the query has none', async () => {
    mockParams = { id: '28' }
    getGenres.mockResolvedValue([
      { id: 28, name: 'Action' },
      { id: 35, name: 'Comedy' },
    ])

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Action')).toBeTruthy())
    expect(screen.queryByText('Genre')).toBeNull()
  })

  it('falls back to a generic title when the genre list fails too', async () => {
    mockParams = { id: '28' }
    getGenres.mockRejectedValue(new Error('TMDB is unavailable'))

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Genre')).toBeTruthy())
  })

  it('asks for no genre list while the query carries the name', async () => {
    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Action')).toBeTruthy())
    expect(getGenres).not.toHaveBeenCalled()
  })

  it('reports a failed request', async () => {
    getMoviesByGenre.mockRejectedValue(new Error('TMDB is unavailable'))

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('TMDB is unavailable')).toBeTruthy())
  })

  it('shows an empty state for a genre with no films', async () => {
    getMoviesByGenre.mockResolvedValue({ results: [], page: 1, total_pages: 1 })

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Nothing here yet')).toBeTruthy())
  })

  describe('the failure state', () => {
    it('offers a retry that loads the first page again', async () => {
      getMoviesByGenre.mockRejectedValueOnce(new Error('TMDB is unavailable'))
      getMoviesByGenre.mockResolvedValue(pageOf(1, 3))

      const screen = renderWithProviders(<GenreScreen />)

      await waitFor(() => expect(screen.getByText('Could not load movies')).toBeTruthy())

      fireEvent.press(screen.getByText('Try again'))

      await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())
      expect(getMoviesByGenre).toHaveBeenCalledTimes(2)
      expect(getMoviesByGenre).toHaveBeenLastCalledWith(28, 1, {})
    })

    // Same reason as the other screens: the fix is a file on disk and a
    // restart, and a second request cannot apply it.
    it('offers no retry for a setup mistake', async () => {
      getMoviesByGenre.mockRejectedValue(new MissingProxyUrlError())

      const screen = renderWithProviders(<GenreScreen />)

      await waitFor(() => expect(screen.getByText('Setup needed')).toBeTruthy())
      expect(screen.queryByText('Try again')).toBeNull()
    })

    /**
     * A bad id has no genre to load, so a retry would repeat the same nothing.
     * The screen offers the way out instead — and it has to, because a deep
     * link makes this the first entry in the history and `canGoBack` is the
     * only other exit.
     */
    it('offers a way home for a broken link', async () => {
      mockParams = { id: 'abc' }

      const screen = renderWithProviders(<GenreScreen />)

      await waitFor(() => expect(screen.getByText('Broken link')).toBeTruthy())
      expect(screen.queryByText('Try again')).toBeNull()

      fireEvent.press(screen.getByText('Go home'))

      expect(mockReplace).toHaveBeenCalledWith('/')
    })
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
      expect(screen.getByText('That link does not point at a genre.')).toBeTruthy(),
    )
    expect(getMoviesByGenre).not.toHaveBeenCalled()
  })
})

describe('the paging', () => {
  it('asks for the first page on mount', async () => {
    renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 1, {}))
  })

  it('loads the next page when the grid reaches its end', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(21, 20))
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')

    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 2, {}))
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
    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 2, {}))

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

describe('the filters', () => {
  type Screen = ReturnType<typeof renderWithProviders>

  /**
   * The sheet takes no touch until its first layout, and the test renderer
   * runs no layout, so the test sends the one the library tests send.
   */
  const openSheet = async (screen: Screen) => {
    fireEvent.press(screen.getByTestId('filter-open'))
    fireEvent(await screen.findByTestId('filter-sheet'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 600 } },
    })
  }

  /** Moves a slider by its accessibility actions, as a screen reader does. */
  const step = (screen: Screen, label: string, times: number) => {
    for (let i = 0; i < times; i++) {
      fireEvent(screen.getByLabelText(label), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
    }
  }

  /** "Any", then 5+, 6+, 7+: three steps up is 7+. */
  const pickRating = async (screen: Screen, steps: number) => {
    await openSheet(screen)
    step(screen, 'Minimum rating', steps)
    fireEvent.press(screen.getByTestId('filter-apply'))
  }

  it('shows no filter row for a broken link', async () => {
    mockParams = { id: 'abc' }

    const screen = renderWithProviders(<GenreScreen />)

    await waitFor(() => expect(screen.getByText('Broken link')).toBeTruthy())
    expect(screen.queryByTestId('filter-open')).toBeNull()
  })

  /**
   * A pick is a new list, not a narrowing of the one on screen. The first page
   * is asked for again under the filter, and every page loaded before the pick
   * goes, or the grid would show unfiltered films above the filtered ones.
   */
  it('reloads from the first page with the pick, and drops the pages before it', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(21, 20))
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')
    await waitFor(() => expect(screen.getByText('Film 21')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(100, 3, 1, 1))
    await pickRating(screen, 3)

    await waitFor(() => expect(screen.getByText('Film 100')).toBeTruthy())
    expect(getMoviesByGenre).toHaveBeenLastCalledWith(28, 1, { rating: 7 })
    expect(screen.queryByText('Film 1')).toBeNull()
    expect(screen.queryByText('Film 21')).toBeNull()
  })

  /**
   * The sheet holds a draft. Each step of a slider would otherwise reload the
   * grid behind the sheet, and a way out of the sheet would not undo it.
   */
  it('changes nothing until the reader presses Show films', async () => {
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    await openSheet(screen)
    fireEvent.press(screen.getByTestId('language-ta'))
    step(screen, 'Minimum rating', 2)

    expect(getMoviesByGenre).toHaveBeenCalledTimes(1)
    expect(mockSetParams).not.toHaveBeenCalled()
  })

  it('drops the draft when the reader closes the sheet', async () => {
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    await openSheet(screen)
    fireEvent.press(screen.getByTestId('language-ta'))
    expect(screen.getByTestId('language-ta')).toBeChecked()
    fireEvent.press(screen.getByLabelText('Close filters'))
    await openSheet(screen)

    expect(screen.getByTestId('language-ta')).not.toBeChecked()
    expect(getMoviesByGenre).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('filter-language')).toBeNull()
  })

  it('starts the sheet on the filters on screen', async () => {
    mockParams = { id: '28', name: 'Action', language: 'ta,ml', rating: '7' }
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    await openSheet(screen)

    expect(screen.getByTestId('language-ta')).toBeChecked()
    expect(screen.getByTestId('language-ml')).toBeChecked()
    expect(screen.getByTestId('language-en')).not.toBeChecked()
    expect(screen.getByLabelText('Minimum rating').props.accessibilityValue.text).toBe(
      '7+',
    )
  })

  it('sends every pick of the sheet in one request', async () => {
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    await openSheet(screen)
    fireEvent.press(screen.getByText('Top rated'))
    fireEvent.press(screen.getByTestId('decade-1990'))
    fireEvent.press(screen.getByTestId('language-ml'))
    fireEvent.press(screen.getByTestId('language-ta'))
    step(screen, 'Runtime', 6)
    fireEvent.press(screen.getByTestId('filter-apply'))

    await waitFor(() =>
      expect(getMoviesByGenre).toHaveBeenLastCalledWith(28, 1, {
        sort: 'rated',
        decade: 1990,
        languages: ['ta', 'ml'],
        runtime: { min: 90 },
      }),
    )
  })

  it('clears every pick of the draft with Clear all', async () => {
    mockParams = { id: '28', name: 'Action', decade: '1990', sort: 'newest' }
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    await openSheet(screen)
    fireEvent.press(screen.getByTestId('filter-clear'))
    fireEvent.press(screen.getByTestId('filter-apply'))

    await waitFor(() => expect(getMoviesByGenre).toHaveBeenLastCalledWith(28, 1, {}))
    expect(screen.queryByTestId('filter-decade')).toBeNull()
    expect(screen.queryByTestId('filter-sort')).toBeNull()
  })

  it('starts again from the first page on a pull to refresh', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(21, 20))
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')
    await waitFor(() => expect(screen.getByText('Film 21')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(100, 3, 1, 1))
    act(() => screen.UNSAFE_getByType(PullToRefresh).props.onRefresh())

    // The grid stays up while the new first page loads.
    expect(screen.getByText('Film 1')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Film 100')).toBeTruthy())
    expect(getMoviesByGenre).toHaveBeenLastCalledWith(28, 1, {})
    // The pages after the first go with the old first page.
    expect(screen.queryByText('Film 21')).toBeNull()
  })

  it('keeps the grid and says so when the refresh fails', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockRejectedValueOnce(new Error('offline'))
    act(() => screen.UNSAFE_getByType(PullToRefresh).props.onRefresh())

    await waitFor(() => expect(screen.getByText('Could not refresh')).toBeTruthy())
    expect(screen.getByText('Film 1')).toBeTruthy()
  })

  // The preference from the about screen is the start value for this visit.
  it('starts on the preferred film language', async () => {
    act(() => setLanguage('ta'))

    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    expect(getMoviesByGenre).toHaveBeenCalledWith(28, 1, { languages: ['ta'] })
    expect(screen.getByText('Tamil')).toBeTruthy()
  })

  // So a reload or a shared link keeps the pick. Every name is sent, and a
  // cleared filter as `undefined`, which takes it out of the address.
  it('writes each pick to the address', async () => {
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())
    expect(mockSetParams).not.toHaveBeenCalled()

    await openSheet(screen)
    step(screen, 'Minimum rating', 3)
    fireEvent.press(screen.getByTestId('language-ml'))
    fireEvent.press(screen.getByTestId('language-ta'))
    fireEvent.press(screen.getByTestId('filter-apply'))

    await waitFor(() =>
      expect(mockSetParams).toHaveBeenCalledWith({
        sort: undefined,
        decade: undefined,
        rating: '7',
        language: 'ta,ml',
        runtime: undefined,
      }),
    )
  })

  it('starts on the filters the address carries, over the preferred language', async () => {
    act(() => setLanguage('ta'))
    mockParams = { id: '28', name: 'Action', decade: '1990', rating: '7' }

    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    expect(getMoviesByGenre).toHaveBeenCalledWith(28, 1, { decade: 1990, rating: 7 })
    expect(screen.getByText('1990s')).toBeTruthy()
    expect(screen.getByText('7+')).toBeTruthy()
    expect(screen.queryByText('Tamil')).toBeNull()
    // The address already says so.
    expect(mockSetParams).not.toHaveBeenCalled()
  })

  // A link is untrusted. A value the sheet does not offer reads as no filter.
  it('ignores a filter value the sheet does not offer', async () => {
    mockParams = {
      id: '28',
      name: 'Action',
      rating: '4',
      language: 'xx',
      sort: 'revenue',
    }

    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    expect(getMoviesByGenre).toHaveBeenCalledWith(28, 1, {})
  })

  it('names each pick on its own chip', async () => {
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    await openSheet(screen)
    fireEvent.press(screen.getByText('Newest'))
    fireEvent.press(screen.getByTestId('language-ta'))
    fireEvent.press(screen.getByTestId('language-ko'))
    fireEvent.press(screen.getByTestId('filter-apply'))

    await waitFor(() => expect(screen.getByText('Tamil +1')).toBeTruthy())
    expect(screen.getByLabelText('Languages: Tamil, Korean')).toBeTruthy()
    expect(screen.getByLabelText('Sort: Newest')).toBeTruthy()
  })

  it('opens the sheet from a pick chip', async () => {
    mockParams = { id: '28', name: 'Action', decade: '1990' }
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText(mockMovies[0].title)).toBeTruthy())

    fireEvent.press(screen.getByTestId('filter-decade'))

    expect(await screen.findByTestId('filter-sheet')).toBeTruthy()
  })

  it('sends the next page under the same pick', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 3, 1))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(100, 20, 5, 1))
    await openSheet(screen)
    fireEvent.press(screen.getByTestId('decade-1990'))
    fireEvent.press(screen.getByTestId('filter-apply'))
    await waitFor(() => expect(screen.getByText('Film 100')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(120, 20, 5, 2))
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')

    await waitFor(() =>
      expect(getMoviesByGenre).toHaveBeenLastCalledWith(28, 2, { decade: 1990 }),
    )
  })

  // The chip carries its own clear, so a reader never has to open the sheet to
  // undo one pick. The unfiltered page is in the store, so no request follows.
  it('clears one pick from its chip', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 3, 1))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce(pageOf(100, 3, 1, 1))
    await openSheet(screen)
    fireEvent.press(screen.getByTestId('language-ta'))
    fireEvent.press(screen.getByTestId('filter-apply'))
    await waitFor(() => expect(screen.getByText('Film 100')).toBeTruthy())

    fireEvent.press(screen.getByLabelText('Remove Languages: Tamil'))

    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())
    expect(screen.queryByText('Film 100')).toBeNull()
    expect(getMoviesByGenre).toHaveBeenCalledTimes(2)
  })

  /**
   * An empty answer under a pick is not an empty genre. The films are there,
   * and the message says what to change rather than that there is nothing.
   */
  it('offers to clear the filters when nothing matches', async () => {
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 3, 1))
    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockResolvedValueOnce({ results: [], page: 1, total_pages: 1 })
    await pickRating(screen, 5)

    await waitFor(() => expect(screen.getByTestId('genre-no-match')).toBeTruthy())
    expect(screen.queryByText('Nothing here yet')).toBeNull()

    fireEvent.press(screen.getByText('Clear filters'))

    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())
  })

  /**
   * A page requested under one pick can land after the reader changed it. The
   * outcome carries the key it belongs to, so a late page is dropped rather
   * than appended under the new pick.
   */
  it('ignores a page that arrives for the previous pick', async () => {
    let resolvePageTwo: (value: unknown) => void = () => {}
    getMoviesByGenre.mockResolvedValueOnce(pageOf(1, 20))

    const screen = renderWithProviders(<GenreScreen />)
    await waitFor(() => expect(screen.getByText('Film 1')).toBeTruthy())

    getMoviesByGenre.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePageTwo = resolve
      }),
    )
    fireEvent(screen.UNSAFE_getByType(FlatList), 'endReached')
    await waitFor(() => expect(getMoviesByGenre).toHaveBeenCalledWith(28, 2, {}))

    getMoviesByGenre.mockResolvedValueOnce(pageOf(100, 3, 1, 1))
    await pickRating(screen, 3)
    await waitFor(() => expect(screen.getByText('Film 100')).toBeTruthy())

    resolvePageTwo(pageOf(21, 20))

    await waitFor(() => expect(screen.getByText('Film 100')).toBeTruthy())
    expect(screen.queryByText('Film 21')).toBeNull()
  })
})
