import { getMovie, getTrending, searchMovies } from './api'
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

    await expect(getTrending()).resolves.toEqual({ results: [] })
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
    await expect(searchMovies('   ')).resolves.toEqual({ results: [] })
    expect(tmdbFetch).not.toHaveBeenCalled()
  })

  it('sends the trimmed query', async () => {
    tmdbFetch.mockResolvedValue({ results: [] })

    await searchMovies('  fight club  ')

    expect(tmdbFetch).toHaveBeenCalledWith('/search/movie', { query: 'fight club' })
  })
})
