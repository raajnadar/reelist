import { getGenres, getMovie, getMoviesByGenre, getTrending, searchMovies } from './api'
import { TmdbError } from './tmdb'

// These tests check the mapping and the error branches, not TMDB itself. The
// transport is mocked, so the suite needs no key and no network — which is what
// lets CI run it.
jest.mock('./tmdb', () => {
  const actual = jest.requireActual('./tmdb')
  return { ...actual, tmdbFetch: jest.fn() }
})

const { tmdbFetch } = jest.requireMock('./tmdb')

beforeEach(() => {
  tmdbFetch.mockReset()
})

// A response with every field the app reads, plus one it does not. The extra
// field must not survive the mapping.
const rawMovie = {
  id: 550,
  title: 'Fight Club',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 8.4,
  release_date: '1999-10-15',
  overview: 'A ticking-time-bomb insomniac.',
  belongs_to_collection: { id: 1, name: 'Unused' },
}

describe('the mapping to Movie', () => {
  it('keeps every field the app declares', async () => {
    tmdbFetch.mockResolvedValue({ results: [rawMovie] })

    const { results } = await getTrending()

    expect(results[0]).toEqual({
      id: 550,
      title: 'Fight Club',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      vote_average: 8.4,
      release_date: '1999-10-15',
      overview: 'A ticking-time-bomb insomniac.',
    })
  })

  it('drops a field the app does not declare', async () => {
    tmdbFetch.mockResolvedValue({ results: [rawMovie] })

    const { results } = await getTrending()

    expect(results[0]).not.toHaveProperty('belongs_to_collection')
  })

  // TMDB omits these keys rather than sending null. The screens read
  // lib/format.ts, which treats '' and 0 as the unknown case, so the mapping
  // has to produce exactly those and not undefined.
  it('fills the sentinels TMDB omits for an announced film', async () => {
    tmdbFetch.mockResolvedValue({ results: [{ id: 1, title: 'Untitled' }] })

    const { results } = await getTrending()

    expect(results[0]).toEqual({
      id: 1,
      title: 'Untitled',
      poster_path: null,
      backdrop_path: null,
      vote_average: 0,
      release_date: '',
      overview: '',
    })
  })

  // A paged endpoint with no matches omits `results` in some TMDB responses.
  // Mapping over undefined would throw where an empty row is correct.
  it('returns an empty list when the response has no results key', async () => {
    tmdbFetch.mockResolvedValue({})

    await expect(getTrending()).resolves.toEqual({
      results: [],
      page: 1,
      total_pages: 1,
    })
  })
})

// The three fields only `/movie/{id}` sends. Each is tested against its absent
// form as well as its present one: the screen drops a line rather than printing
// an empty one, and it can only do that if the mapping keeps the sentinel.
describe('the mapping to MovieDetail', () => {
  it('maps the genres, the runtime, and the tagline', async () => {
    tmdbFetch.mockResolvedValue({
      ...rawMovie,
      genres: [{ id: 18, name: 'Drama' }],
      runtime: 139,
      tagline: 'Mischief. Mayhem. Soap.',
    })

    const movie = await getMovie(550)

    expect(movie).toMatchObject({
      genres: [{ id: 18, name: 'Drama' }],
      runtime: 139,
      tagline: 'Mischief. Mayhem. Soap.',
    })
  })

  // The base fields still map, so the detail mapper cannot drift from the list
  // one. `belongs_to_collection` is in rawMovie and must not survive.
  it('keeps the narrowing the list mapper does', async () => {
    tmdbFetch.mockResolvedValue({ ...rawMovie, genres: [], runtime: 139, tagline: '' })

    const movie = await getMovie(550)

    expect(movie).not.toHaveProperty('belongs_to_collection')
    expect(movie?.title).toBe('Fight Club')
  })

  it('maps a missing genre list to an empty array', async () => {
    tmdbFetch.mockResolvedValue(rawMovie)

    await expect(getMovie(550)).resolves.toMatchObject({ genres: [] })
  })

  // TMDB sends null for a film with no cut yet. `lib/format.ts` reads 0 as
  // absent, so null must arrive there as 0 rather than as null.
  it('maps a null runtime to 0', async () => {
    tmdbFetch.mockResolvedValue({ ...rawMovie, runtime: null })

    await expect(getMovie(550)).resolves.toMatchObject({ runtime: 0 })
  })

  it('keeps the empty tagline TMDB sends for a film with none', async () => {
    tmdbFetch.mockResolvedValue({ ...rawMovie, tagline: '' })

    await expect(getMovie(550)).resolves.toMatchObject({ tagline: '' })
  })

  // A genre object carries more than an id and a name. Only those two may pass.
  it('narrows each genre to its id and name', async () => {
    tmdbFetch.mockResolvedValue({
      ...rawMovie,
      genres: [{ id: 18, name: 'Drama', unused: 'field' }],
    })

    const movie = await getMovie(550)

    expect(movie?.genres[0]).toEqual({ id: 18, name: 'Drama' })
  })
})

describe('getMovie', () => {
  it('returns null for a film that does not exist', async () => {
    tmdbFetch.mockRejectedValue(new TmdbError('Not found', 404))

    await expect(getMovie(99999999)).resolves.toBeNull()
  })

  // The detail screen prints a different message for a failure than for a
  // missing film, so every non-404 has to keep throwing.
  it('rethrows a failure that is not a 404', async () => {
    tmdbFetch.mockRejectedValue(new TmdbError('Invalid API key', 401))

    await expect(getMovie(550)).rejects.toThrow('Invalid API key')
  })
})

describe('searchMovies', () => {
  // TMDB answers an empty query with 422. A cleared search box is not an error.
  it('returns an empty list without calling TMDB for a blank query', async () => {
    await expect(searchMovies('   ')).resolves.toEqual({
      results: [],
      page: 1,
      total_pages: 1,
    })
    expect(tmdbFetch).not.toHaveBeenCalled()
  })

  it('sends the trimmed query', async () => {
    tmdbFetch.mockResolvedValue({ results: [] })

    await searchMovies('  fight club  ')

    expect(tmdbFetch).toHaveBeenCalledWith('/search/movie', { query: 'fight club' })
  })
})

describe('the paging fields', () => {
  it('reports the page and the total from the response', async () => {
    tmdbFetch.mockResolvedValue({ results: [], page: 3, total_pages: 12 })

    await expect(getMoviesByGenre(28, 3)).resolves.toMatchObject({
      page: 3,
      total_pages: 12,
    })
  })

  // The unpaged endpoints omit both keys. A screen reads `page < total_pages`
  // to decide whether to ask for more, so the default has to say "complete".
  it('defaults an unpaged response to a single finished page', async () => {
    tmdbFetch.mockResolvedValue({ results: [] })

    await expect(getTrending()).resolves.toMatchObject({ page: 1, total_pages: 1 })
  })

  /**
   * TMDB answers a request past page 500 with a 422, however large
   * `total_pages` is. Without the clamp an endless scroll through a popular
   * genre would turn into an error at the 501st page.
   */
  it('clamps a total above the TMDB page ceiling', async () => {
    tmdbFetch.mockResolvedValue({ results: [], page: 1, total_pages: 43892 })

    await expect(getMoviesByGenre(28)).resolves.toMatchObject({ total_pages: 500 })
  })
})

describe('getGenres', () => {
  it('maps the genre list', async () => {
    tmdbFetch.mockResolvedValue({
      genres: [
        { id: 28, name: 'Action' },
        { id: 35, name: 'Comedy' },
      ],
    })

    await expect(getGenres()).resolves.toEqual([
      { id: 28, name: 'Action' },
      { id: 35, name: 'Comedy' },
    ])
  })

  // Same reason as the results key: mapping over undefined would throw where
  // an empty chip row is correct.
  it('returns an empty list when the response has no genres key', async () => {
    tmdbFetch.mockResolvedValue({})

    await expect(getGenres()).resolves.toEqual([])
  })

  it('drops a field the app does not declare', async () => {
    tmdbFetch.mockResolvedValue({ genres: [{ id: 28, name: 'Action', unused: true }] })

    const genres = await getGenres()

    expect(genres[0]).not.toHaveProperty('unused')
  })
})

describe('getMoviesByGenre', () => {
  it('sends the genre and the page as strings', async () => {
    tmdbFetch.mockResolvedValue({ results: [] })

    await getMoviesByGenre(28, 2)

    expect(tmdbFetch).toHaveBeenCalledWith('/discover/movie', {
      with_genres: '28',
      page: '2',
    })
  })

  // The screen loads the first page without naming it.
  it('defaults to the first page', async () => {
    tmdbFetch.mockResolvedValue({ results: [] })

    await getMoviesByGenre(28)

    expect(tmdbFetch).toHaveBeenCalledWith('/discover/movie', {
      with_genres: '28',
      page: '1',
    })
  })

  it('maps the results to Movie', async () => {
    tmdbFetch.mockResolvedValue({ results: [rawMovie], page: 1, total_pages: 1 })

    const { results } = await getMoviesByGenre(28)

    expect(results[0].title).toBe('Fight Club')
    expect(results[0]).not.toHaveProperty('belongs_to_collection')
  })

  // A failure here is not a missing film: the screen reports it rather than
  // showing an empty genre, so it must not be swallowed the way getMovie's 404 is.
  it('rethrows a failed request', async () => {
    tmdbFetch.mockRejectedValue(new TmdbError('Service offline', 503))

    await expect(getMoviesByGenre(28)).rejects.toThrow('Service offline')
  })
})
