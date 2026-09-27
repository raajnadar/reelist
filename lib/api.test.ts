import {
  getGenres,
  getMovie,
  getMoviesByGenre,
  getPerson,
  getPopularByLanguage,
  getTrending,
  searchMovies,
} from './api'
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

/**
 * The cast, the trailer, and the recommendations arrive inside the detail
 * response, under their own keys, because the request carries
 * `append_to_response`. TMDB omits a block whose film has nothing in it, so
 * every test here has an absent-block twin.
 */
describe('the appended blocks', () => {
  const rawCast = {
    id: 819,
    name: 'Edward Norton',
    character: 'The Narrator',
    profile_path: '/face.jpg',
    known_for_department: 'Acting',
  }

  it('asks TMDB for all five blocks in one request', async () => {
    tmdbFetch.mockResolvedValue(rawMovie)

    await getMovie(550)

    expect(tmdbFetch).toHaveBeenCalledWith('/movie/550', {
      append_to_response: 'credits,videos,recommendations,images,watch/providers',
      include_image_language: 'en,null',
    })
  })

  /**
   * The value has to match `ALLOWED_PARAM_VALUES` in the proxy exactly. The
   * proxy drops a value it does not know, TMDB then answers a plain detail
   * response, and all three sections go absent with no error to report — so
   * this string is asserted on its own rather than only inside the call above.
   */
  it('sends the exact value the proxy allows', async () => {
    tmdbFetch.mockResolvedValue(rawMovie)

    await getMovie(550)

    expect(tmdbFetch.mock.calls[0][1].append_to_response).toBe(
      'credits,videos,recommendations,images,watch/providers',
    )
  })

  /**
   * The same rule for the language list. TMDB filters the appended images to
   * the request language without it, and the stills with no text on them —
   * most of them — are filed under no language and would be dropped.
   */
  it('sends the exact image language list the proxy allows', async () => {
    tmdbFetch.mockResolvedValue(rawMovie)

    await getMovie(550)

    expect(tmdbFetch.mock.calls[0][1].include_image_language).toBe('en,null')
  })

  describe('the cast', () => {
    it('maps each performer to the four fields the card reads', async () => {
      tmdbFetch.mockResolvedValue({ ...rawMovie, credits: { cast: [rawCast] } })

      const movie = await getMovie(550)

      expect(movie?.cast).toEqual([
        {
          id: 819,
          name: 'Edward Norton',
          character: 'The Narrator',
          profile_path: '/face.jpg',
        },
      ])
    })

    // The crew is in the same block and is far longer than the cast. None of it
    // may reach the row.
    it('drops the crew', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        credits: { cast: [rawCast], crew: [{ id: 7467, name: 'David Fincher' }] },
      })

      const movie = await getMovie(550)

      expect(movie?.cast).toHaveLength(1)
      expect(movie).not.toHaveProperty('crew')
    })

    // An announced film has no cast yet, and TMDB omits the whole block. Reading
    // into it would throw where an absent row is the right answer.
    it('maps an absent credits block to an empty list', async () => {
      tmdbFetch.mockResolvedValue(rawMovie)

      await expect(getMovie(550)).resolves.toMatchObject({ cast: [] })
    })

    // A person with no photo on file, and an uncredited part. Both keep the
    // sentinel lib/types.ts declares.
    it('keeps the absent forms TMDB reports for one person', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        credits: { cast: [{ id: 1, name: 'Nobody' }] },
      })

      const movie = await getMovie(550)

      expect(movie?.cast[0]).toEqual({
        id: 1,
        name: 'Nobody',
        character: '',
        profile_path: null,
      })
    })
  })

  describe('the trailer', () => {
    const video = (over: Record<string, unknown>) => ({
      id: 'abc',
      key: 'k',
      name: 'A video',
      site: 'YouTube',
      type: 'Trailer',
      official: false,
      ...over,
    })

    /**
     * The choice, in one test. The screen shows one button, so the seam has to
     * reduce a mixed list to one video: not the Vimeo entry, which the app
     * cannot open; not the teaser or the featurette, which are not the trailer;
     * and the studio upload rather than the fan cut.
     */
    it('picks the official YouTube trailer out of a mixed list', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        videos: {
          results: [
            video({ key: 'vimeo', site: 'Vimeo', official: true }),
            video({ key: 'teaser', type: 'Teaser', official: true }),
            video({ key: 'featurette', type: 'Featurette', official: true }),
            video({ key: 'fan-cut' }),
            video({ key: 'studio', official: true }),
          ],
        },
      })

      const movie = await getMovie(550)

      expect(movie?.trailer?.key).toBe('studio')
    })

    // A film can carry a trailer that no studio uploaded. It is a better answer
    // than no button at all.
    it('falls back to an unofficial trailer', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        videos: { results: [video({ key: 'fan-cut' })] },
      })

      await expect(getMovie(550)).resolves.toMatchObject({
        trailer: expect.objectContaining({ key: 'fan-cut' }),
      })
    })

    // null, not undefined and not an empty object: the screen hides the button
    // on this value.
    it('reports no trailer as null', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        videos: { results: [video({ type: 'Clip' })] },
      })

      await expect(getMovie(550)).resolves.toMatchObject({ trailer: null })
    })

    it('reports an absent videos block as null', async () => {
      tmdbFetch.mockResolvedValue(rawMovie)

      await expect(getMovie(550)).resolves.toMatchObject({ trailer: null })
    })
  })

  describe('the images', () => {
    const rawStill = (file_path: string, extra: Record<string, unknown> = {}) => ({
      file_path,
      aspect_ratio: 1.778,
      width: 3840,
      height: 2160,
      iso_639_1: null,
      vote_average: 5.3,
      ...extra,
    })

    it('maps each backdrop to the path and the ratio the viewer reads', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        images: { backdrops: [rawStill('/a.jpg'), rawStill('/b.jpg')] },
      })

      const movie = await getMovie(550)

      expect(movie?.images).toEqual([
        { file_path: '/a.jpg', aspect_ratio: 1.778 },
        { file_path: '/b.jpg', aspect_ratio: 1.778 },
      ])
    })

    // The block carries posters and logos beside the backdrops. The poster is
    // the picture the screen already leads with, and a logo is a title on a
    // transparent ground, so neither belongs among the stills.
    it('keeps the backdrops only', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        images: {
          backdrops: [rawStill('/a.jpg')],
          posters: [rawStill('/poster.jpg', { aspect_ratio: 0.667 })],
          logos: [rawStill('/logo.png', { aspect_ratio: 3.2 })],
        },
      })

      const movie = await getMovie(550)

      expect(movie?.images.map((image) => image.file_path)).toEqual(['/a.jpg'])
    })

    it('drops a backdrop with no path, which would page to a blank frame', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        images: { backdrops: [rawStill('/a.jpg'), { aspect_ratio: 1.778 }] },
      })

      const movie = await getMovie(550)

      expect(movie?.images).toHaveLength(1)
    })

    // TMDB sends the list best first, so the cap keeps the front of it.
    it('caps the list at twenty, keeping the first twenty', async () => {
      const backdrops = Array.from({ length: 30 }, (_, i) => rawStill(`/${i}.jpg`))
      tmdbFetch.mockResolvedValue({ ...rawMovie, images: { backdrops } })

      const movie = await getMovie(550)

      expect(movie?.images).toHaveLength(20)
      expect(movie?.images[0].file_path).toBe('/0.jpg')
      expect(movie?.images[19].file_path).toBe('/19.jpg')
    })

    it('falls back to 16:9 for a backdrop with no ratio', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        images: { backdrops: [{ file_path: '/a.jpg' }] },
      })

      const movie = await getMovie(550)

      expect(movie?.images[0].aspect_ratio).toBeCloseTo(16 / 9)
    })

    it('maps an absent images block to an empty list', async () => {
      tmdbFetch.mockResolvedValue(rawMovie)

      const movie = await getMovie(550)

      expect(movie?.images).toEqual([])
    })
  })

  describe('the watch providers', () => {
    const rawProvider = (
      provider_id: number,
      provider_name: string,
      display_priority: number,
    ) => ({
      provider_id,
      provider_name,
      logo_path: `/${provider_id}.jpg`,
      display_priority,
    })

    const withProviders = (region: Record<string, unknown>, code = 'IN') => ({
      ...rawMovie,
      'watch/providers': { id: 550, results: { [code]: region } },
    })

    it('maps the three groups and the link for the region', async () => {
      tmdbFetch.mockResolvedValue(
        withProviders({
          link: 'https://www.themoviedb.org/movie/550/watch?locale=IN',
          flatrate: [rawProvider(8, 'Netflix', 1)],
          rent: [rawProvider(2, 'Apple TV', 4)],
          buy: [rawProvider(2, 'Apple TV', 4), rawProvider(3, 'Google Play', 5)],
        }),
      )

      const movie = await getMovie(550)

      expect(movie?.providers).toEqual({
        IN: {
          link: 'https://www.themoviedb.org/movie/550/watch?locale=IN',
          stream: [{ id: 8, name: 'Netflix', logo_path: '/8.jpg' }],
          rent: [{ id: 2, name: 'Apple TV', logo_path: '/2.jpg' }],
          buy: [
            { id: 2, name: 'Apple TV', logo_path: '/2.jpg' },
            { id: 3, name: 'Google Play', logo_path: '/3.jpg' },
          ],
        },
      })
    })

    // TMDB sends the rank beside each service and does not sort by it. The row
    // shows the large services first, which is what the rank encodes.
    it('sorts each group by the rank TMDB sends', async () => {
      tmdbFetch.mockResolvedValue(
        withProviders({
          flatrate: [
            rawProvider(9, 'Prime Video', 3),
            rawProvider(8, 'Netflix', 1),
            rawProvider(122, 'Hotstar', 2),
          ],
        }),
      )

      const movie = await getMovie(550)

      expect(movie?.providers.IN.stream.map((p) => p.name)).toEqual([
        'Netflix',
        'Hotstar',
        'Prime Video',
      ])
    })

    it('maps an absent group to an empty list', async () => {
      tmdbFetch.mockResolvedValue(
        withProviders({ flatrate: [rawProvider(8, 'Netflix', 1)] }),
      )

      const movie = await getMovie(550)

      expect(movie?.providers.IN).toMatchObject({ rent: [], buy: [] })
    })

    // The country is a setting the reader can change, and the detail is cached
    // per film, so every country stays in the map.
    it('keeps every region the block holds', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        'watch/providers': {
          results: {
            IN: { flatrate: [rawProvider(8, 'Netflix', 1)] },
            US: { buy: [rawProvider(2, 'Apple TV', 4)] },
          },
        },
      })

      const movie = await getMovie(550)

      expect(Object.keys(movie?.providers ?? {})).toEqual(['IN', 'US'])
    })

    // TMDB omits the whole block for a film it has no provider data for.
    it('maps an absent block to an empty map', async () => {
      tmdbFetch.mockResolvedValue(rawMovie)

      await expect(getMovie(550)).resolves.toMatchObject({ providers: {} })
    })

    // A region entry that holds a link and no service does occur. The row must
    // stay absent for it, so the region is dropped rather than kept with three
    // empty lists.
    it('drops a region with a link and no service', async () => {
      tmdbFetch.mockResolvedValue(
        withProviders({ link: 'https://www.themoviedb.org/movie/550/watch?locale=IN' }),
      )

      await expect(getMovie(550)).resolves.toMatchObject({ providers: {} })
    })

    it('keeps the absent logo TMDB reports for one service', async () => {
      tmdbFetch.mockResolvedValue(
        withProviders({ flatrate: [{ provider_id: 1, provider_name: 'Nobody' }] }),
      )

      const movie = await getMovie(550)

      expect(movie?.providers.IN.stream).toEqual([
        { id: 1, name: 'Nobody', logo_path: null },
      ])
    })
  })

  describe('the recommendations', () => {
    // The block is a full paged envelope. The row shows one page and cannot
    // page, so only the results survive.
    it('maps the results to Movie and drops the paging', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawMovie,
        recommendations: { results: [rawMovie], page: 1, total_pages: 12 },
      })

      const movie = await getMovie(550)

      expect(movie?.recommendations).toHaveLength(1)
      expect(movie?.recommendations[0].title).toBe('Fight Club')
      expect(movie?.recommendations[0]).not.toHaveProperty('belongs_to_collection')
      expect(movie).not.toHaveProperty('total_pages')
    })

    it('maps an absent recommendations block to an empty list', async () => {
      tmdbFetch.mockResolvedValue(rawMovie)

      await expect(getMovie(550)).resolves.toMatchObject({ recommendations: [] })
    })
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

  // The filter names are the ones the proxy allows. A rename on either side
  // would drop the parameter silently, so the request is checked by name here.
  it('adds the filter parameters to the request', async () => {
    tmdbFetch.mockResolvedValue({ results: [] })

    await getMoviesByGenre(28, 1, {
      decade: 2010,
      rating: 7,
      language: 'hi',
      runtime: 'short',
    })

    expect(tmdbFetch).toHaveBeenCalledWith('/discover/movie', {
      with_genres: '28',
      page: '1',
      'primary_release_date.gte': '2010-01-01',
      'primary_release_date.lte': '2019-12-31',
      'vote_average.gte': '7',
      'vote_count.gte': '100',
      with_original_language: 'hi',
      'with_runtime.lte': '89',
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

describe('getPopularByLanguage', () => {
  // The same parameter name the genre filter uses, and one the proxy allows, so
  // the row needs no proxy change. Popularity is the discover default sort, so
  // no sort parameter is sent.
  it('asks discover for the first page in the language', async () => {
    tmdbFetch.mockResolvedValue({ results: [rawMovie] })

    const paged = await getPopularByLanguage('ta')

    expect(tmdbFetch).toHaveBeenCalledWith('/discover/movie', {
      with_original_language: 'ta',
      page: '1',
    })
    expect(paged.results[0].title).toBe('Fight Club')
  })
})

describe('getPerson', () => {
  // A response with every field the person screen reads, plus one it does not.
  const rawPerson = {
    id: 1082047,
    name: 'Timothée Chalamet',
    biography: 'An American actor.',
    birthday: '1995-12-27',
    deathday: null,
    place_of_birth: 'New York City, New York, USA',
    known_for_department: 'Acting',
    profile_path: '/face.jpg',
    also_known_as: ['Timmy'],
  }

  /** One film credit, in the shape the `movie_credits` block sends it. */
  const credit = (id: number, title: string, release_date: string) => ({
    id,
    title,
    release_date,
    poster_path: '/p.jpg',
    backdrop_path: null,
    vote_average: 7,
    overview: 'A film.',
    character: 'Someone',
    credit_id: `credit-${id}`,
  })

  it('maps the fields the screen reads', async () => {
    tmdbFetch.mockResolvedValue(rawPerson)

    const person = await getPerson(1082047)

    expect(person).toEqual({
      id: 1082047,
      name: 'Timothée Chalamet',
      biography: 'An American actor.',
      birthday: '1995-12-27',
      deathday: '',
      place_of_birth: 'New York City, New York, USA',
      known_for_department: 'Acting',
      profile_path: '/face.jpg',
      credits: [],
    })
  })

  it('drops a field the app does not declare', async () => {
    tmdbFetch.mockResolvedValue(rawPerson)

    await expect(getPerson(1082047)).resolves.not.toHaveProperty('also_known_as')
  })

  /**
   * TMDB sends null for a date it does not hold, and for the birthplace of a
   * person it has little on. The screen drops a line rather than printing an
   * empty one, which it can only do if the mapping keeps the `''` sentinel.
   */
  it('maps every absent string to the empty sentinel', async () => {
    tmdbFetch.mockResolvedValue({
      id: 5,
      name: 'Nobody Known',
      birthday: null,
      deathday: null,
      place_of_birth: null,
      biography: '',
    })

    await expect(getPerson(5)).resolves.toMatchObject({
      birthday: '',
      deathday: '',
      place_of_birth: '',
      biography: '',
      known_for_department: '',
      profile_path: null,
    })
  })

  it('asks TMDB for the filmography in the same request', async () => {
    tmdbFetch.mockResolvedValue(rawPerson)

    await getPerson(1082047)

    expect(tmdbFetch).toHaveBeenCalledWith('/person/1082047', {
      append_to_response: 'movie_credits',
    })
  })

  /**
   * The value has to match `ALLOWED_PARAM_VALUES` in the proxy exactly. The
   * proxy drops a value it does not know, TMDB then answers a plain person
   * response, and the filmography arrives empty with no error to report — so
   * this string is asserted on its own as well as inside the call above.
   */
  it('sends the exact append value the proxy allows', async () => {
    tmdbFetch.mockResolvedValue(rawPerson)

    await getPerson(1082047)

    expect(tmdbFetch.mock.calls[0][1].append_to_response).toBe('movie_credits')
  })

  describe('the filmography', () => {
    it('maps each credit to the fields a card reads', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawPerson,
        movie_credits: { cast: [credit(1, 'A Film', '2024-01-01')] },
      })

      const person = await getPerson(1082047)

      expect(person?.credits).toEqual([
        {
          id: 1,
          title: 'A Film',
          poster_path: '/p.jpg',
          backdrop_path: null,
          vote_average: 7,
          release_date: '2024-01-01',
          overview: 'A film.',
        },
      ])
    })

    it('newest first', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawPerson,
        movie_credits: {
          cast: [
            credit(1, 'Older', '2010-05-01'),
            credit(2, 'Newest', '2024-02-27'),
            credit(3, 'Middle', '2019-11-04'),
          ],
        },
      })

      const person = await getPerson(1082047)

      expect(person?.credits.map((m) => m.title)).toEqual(['Newest', 'Middle', 'Older'])
    })

    /**
     * An announced film carries the empty date sentinel, which sorts before
     * every real date as a string. The least certain entries belong at the end
     * of a filmography rather than at the top of it.
     */
    it('puts a film with no release date last', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawPerson,
        movie_credits: {
          cast: [
            credit(1, 'Announced', ''),
            credit(2, 'Released', '2024-02-27'),
            credit(3, 'Also Announced', ''),
          ],
        },
      })

      const person = await getPerson(1082047)

      expect(person?.credits[0].title).toBe('Released')
      expect(person?.credits).toHaveLength(3)
    })

    /**
     * A dual role, or a voice part beside a screen part, gives one film two
     * credits under the same id. The grid keys on that id, so the duplicate
     * would hand FlatList two children with one key.
     */
    it('keeps one entry for a film credited twice', async () => {
      tmdbFetch.mockResolvedValue({
        ...rawPerson,
        movie_credits: {
          cast: [
            { ...credit(7, 'Dual Role', '2021-06-01'), character: 'The Twin' },
            { ...credit(7, 'Dual Role', '2021-06-01'), character: 'The Other Twin' },
          ],
        },
      })

      const person = await getPerson(1082047)

      expect(person?.credits).toHaveLength(1)
    })

    // TMDB omits the block for a person with no film work. Reaching into it
    // would throw where an empty grid is the right answer.
    it('maps an absent movie_credits block to an empty list', async () => {
      tmdbFetch.mockResolvedValue(rawPerson)

      await expect(getPerson(1082047)).resolves.toMatchObject({ credits: [] })
    })

    it('maps an empty cast list to an empty filmography', async () => {
      tmdbFetch.mockResolvedValue({ ...rawPerson, movie_credits: { cast: [] } })

      await expect(getPerson(1082047)).resolves.toMatchObject({ credits: [] })
    })
  })

  // The same split getMovie makes: "TMDB has nobody with that id" is not a
  // failed request, and only one of the two is worth a retry button.
  it('returns null for a person that does not exist', async () => {
    tmdbFetch.mockRejectedValue(
      new TmdbError('The resource you requested could not be found.', 404),
    )

    await expect(getPerson(999999999)).resolves.toBeNull()
  })

  it('rethrows a failure that is not a 404', async () => {
    tmdbFetch.mockRejectedValue(new TmdbError('TMDB is unavailable', 503))

    await expect(getPerson(1082047)).rejects.toThrow('TMDB is unavailable')
  })
})
