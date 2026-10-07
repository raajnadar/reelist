import { EMPTY_FILTERS, toDiscoverParams, type DiscoverFilters } from './discover'
import { tmdbFetch } from './tmdb'
import type {
  CastMember,
  GalleryImage,
  Genre,
  Movie,
  MovieDetail,
  Paged,
  PersonDetail,
  Video,
  WatchProvider,
  WatchProviders,
} from './types'

/**
 * The single seam between the UI and the data source. Every screen imports from
 * here and nowhere else, so the transport underneath can change without
 * touching a call site.
 *
 * These functions now call TMDB. They were written async against static mock
 * data first, which is why this change touched no screen: every caller already
 * awaited a promise and handled the failure.
 */

/**
 * TMDB returns far more fields than the app uses, and a `Movie` is the subset
 * `lib/types.ts` declares. Narrowing here keeps a stray field from reaching a
 * component that would then depend on it.
 *
 * The fallbacks are not decoration. TMDB omits `release_date` for an announced
 * film with no date, and returns `overview: ""` for one with no synopsis in the
 * requested language. `lib/format.ts` already treats an empty string and a zero
 * rating as the "unknown" case, so the mapping keeps those sentinels rather
 * than inventing a different one.
 */
const toMovie = (raw: Record<string, unknown>): Movie => ({
  id: raw.id as number,
  title: (raw.title as string) ?? '',
  poster_path: (raw.poster_path as string | null) ?? null,
  backdrop_path: (raw.backdrop_path as string | null) ?? null,
  vote_average: (raw.vote_average as number) ?? 0,
  release_date: (raw.release_date as string) ?? '',
  overview: (raw.overview as string) ?? '',
})

/**
 * The sub-resources the detail request asks TMDB to include in its answer.
 *
 * This string must stay identical to the one allowed value in
 * `ALLOWED_PARAM_VALUES` in `proxy/api/tmdb.ts`. The proxy checks this
 * parameter by value, because TMDB would answer `reviews`, `images`, or
 * `watch/providers` here too and the path allowlist alone would not stop it.
 *
 * A mismatch fails silently: the proxy drops the parameter, TMDB answers with a
 * plain detail response, and the cast row, the trailer button, and the
 * recommendation row all go absent with no error to report.
 */
const APPEND = 'credits,videos,recommendations,images,watch/providers'

/**
 * Which languages the `images` block may carry.
 *
 * Without this TMDB filters the appended images to the request language, and
 * that drops the stills it holds under no language at all — which is most of
 * them, because a backdrop with no text on it is filed as `null`. `en` keeps
 * the ones with English titling beside them.
 *
 * Like `APPEND`, this string must stay identical to the one allowed value in
 * `ALLOWED_PARAM_VALUES` in `proxy/api/tmdb.ts`, and a mismatch fails the same
 * silent way: the gallery arrives with only the titled stills, or with none.
 */
const IMAGE_LANGUAGES = 'en,null'

/**
 * The most stills the gallery shows.
 *
 * TMDB lists every backdrop ever uploaded, sorted by vote, and a popular film
 * has over a hundred. The viewer pages through them one at a time, and nobody
 * swipes past twenty. The cap keeps the row and the filmstrip to a size that
 * mounts at once.
 */
const MAX_IMAGES = 20

/**
 * One performer from the `credits` block.
 *
 * TMDB sends `profile_path: null` for a person with no photo, and omits
 * `character` for an uncredited role. Both absent forms keep the sentinel
 * `lib/types.ts` declares rather than a placeholder string, so the card decides
 * what to draw.
 */
const toCastMember = (raw: Record<string, unknown>): CastMember => ({
  id: raw.id as number,
  name: (raw.name as string) ?? '',
  character: (raw.character as string) ?? '',
  profile_path: (raw.profile_path as string | null) ?? null,
})

/**
 * One still from the `images` block.
 *
 * `aspect_ratio` falls back to 16:9, the shape of every backdrop TMDB accepts,
 * so a record that omits it still lays out at the right height rather than at
 * zero. The pixel sizes TMDB sends beside it are dropped: the viewer sizes the
 * picture from the window, so it never reads them.
 */
const toGalleryImage = (raw: Record<string, unknown>): GalleryImage => ({
  file_path: (raw.file_path as string) ?? '',
  aspect_ratio: (raw.aspect_ratio as number) || 16 / 9,
})

/**
 * The backdrops the gallery shows, out of everything TMDB lists.
 *
 * Backdrops only. The block carries posters and logos as well, and a poster is
 * the picture the screen already leads with, while a logo is a transparent PNG
 * of the title that has no place in a set of stills. A record with no path is
 * dropped rather than mapped, because it would page to a blank frame.
 *
 * TMDB sends the list sorted by vote, best first, so the cap keeps the stills
 * the most people picked.
 */
const pickImages = (raws: Record<string, unknown>[]): GalleryImage[] =>
  raws
    .map(toGalleryImage)
    .filter((image) => image.file_path)
    .slice(0, MAX_IMAGES)

const toVideo = (raw: Record<string, unknown>): Video => ({
  id: (raw.id as string) ?? '',
  key: (raw.key as string) ?? '',
  name: (raw.name as string) ?? '',
  site: (raw.site as string) ?? '',
  type: (raw.type as string) ?? '',
  official: (raw.official as boolean) ?? false,
})

/**
 * The one video the screen can play, out of everything TMDB lists.
 *
 * The choice belongs here rather than in the screen, for the reason `MAX_PAGE`
 * below does: the rule comes from the shape of the response. A film carries
 * teasers, clips, featurettes, and behind-the-scenes reels beside its trailer,
 * and TMDB lists Vimeo entries the app cannot open. Filtering in the screen
 * would repeat that knowledge in the UI.
 *
 * An official trailer wins over an unofficial one. TMDB marks a studio upload
 * `official: true`, and the rest are fan cuts and reaction videos of varying
 * quality. The first match is the fallback, because TMDB lists videos newest
 * first and a re-release trailer is a better answer than nothing.
 */
const pickTrailer = (raws: Record<string, unknown>[]): Video | null => {
  const trailers = raws
    .map(toVideo)
    .filter((v) => v.site === 'YouTube' && v.type === 'Trailer')

  return trailers.find((v) => v.official) ?? trailers[0] ?? null
}

const toWatchProvider = (raw: Record<string, unknown>): WatchProvider => ({
  id: raw.provider_id as number,
  name: (raw.provider_name as string) ?? '',
  logo_path: (raw.logo_path as string | null) ?? null,
})

/**
 * One group of services, in the order TMDB ranks them.
 *
 * TMDB sends `display_priority`, lowest first, and does not sort the list by
 * it. The rank is the order a reader in the region expects, with the large
 * services first, so the row keeps it rather than the arrival order.
 */
const toProviderGroup = (raws: Record<string, unknown>[] | undefined): WatchProvider[] =>
  [...(raws ?? [])]
    .sort(
      (a, b) =>
        ((a.display_priority as number) ?? 0) - ((b.display_priority as number) ?? 0),
    )
    .map(toWatchProvider)

type RawRegionProviders = {
  link?: string
  flatrate?: Record<string, unknown>[]
  rent?: Record<string, unknown>[]
  buy?: Record<string, unknown>[]
}

/**
 * The services in every country the block holds, keyed by country code.
 *
 * All of them are kept rather than one, because the country is a setting the
 * reader can change on the about screen, and the detail is cached per film.
 * Keeping the map means a change of country re-reads the cache rather than
 * TMDB. The map is small: a few services in each of some sixty countries.
 *
 * A country with a link and no service does occur, and it is dropped, so a
 * key in the map always has something to draw. TMDB omits the block for a
 * film it has no data for, so the read needs the `?? {}` guard.
 *
 * `flatrate` is TMDB's name for a subscription. The app calls it `stream`,
 * because that is the word the row prints.
 */
const toWatchProviders = (
  raw: Record<string, unknown>,
): Record<string, WatchProviders> => {
  const results = (raw.results as Record<string, RawRegionProviders> | undefined) ?? {}
  const byRegion: Record<string, WatchProviders> = {}

  for (const [code, region] of Object.entries(results)) {
    const providers = {
      link: region.link ?? '',
      stream: toProviderGroup(region.flatrate),
      rent: toProviderGroup(region.rent),
      buy: toProviderGroup(region.buy),
    }
    if (providers.stream.length || providers.rent.length || providers.buy.length) {
      byRegion[code] = providers
    }
  }

  return byRegion
}

/**
 * The detail endpoint adds six fields the list endpoints never send.
 *
 * Each one has a documented absent form: `genres` is missing for a film with
 * none classified, `runtime` is `null` until a cut exists, and `tagline` is
 * `""`. They map to an empty array and the `0` / `""` sentinels `lib/format.ts`
 * already reads as "do not print this".
 *
 * The last four arrive because the request carries `append_to_response`, which
 * nests each sub-resource under its own key. TMDB omits a block whose film has
 * nothing in it, so each read needs the `?? {}` guard before the field below it.
 * A film with no cast is common — an announced film has none — and reaching
 * into an absent block would throw where an empty row is the right answer.
 *
 * `recommendations` arrives as a full paged envelope. It goes through `toPaged`
 * and keeps only the results, because the screen shows one row rather than a
 * grid it can page through.
 */
const toMovieDetail = (raw: Record<string, unknown>): MovieDetail => {
  const credits = (raw.credits as { cast?: Record<string, unknown>[] }) ?? {}
  const videos = (raw.videos as { results?: Record<string, unknown>[] }) ?? {}
  const recommendations = (raw.recommendations as RawPaged) ?? {}
  const images = (raw.images as { backdrops?: Record<string, unknown>[] }) ?? {}
  const providers = (raw['watch/providers'] as Record<string, unknown>) ?? {}

  return {
    ...toMovie(raw),
    genres: ((raw.genres as { id: number; name: string }[] | undefined) ?? []).map(
      (g) => ({
        id: g.id,
        name: g.name,
      }),
    ),
    runtime: (raw.runtime as number | null) ?? 0,
    tagline: (raw.tagline as string) ?? '',
    vote_count: (raw.vote_count as number) ?? 0,
    cast: (credits.cast ?? []).map(toCastMember),
    trailer: pickTrailer(videos.results ?? []),
    recommendations: toPaged(recommendations).results,
    images: pickImages(images.backdrops ?? []),
    providers: toWatchProviders(providers),
  }
}

type RawPaged = {
  results?: Record<string, unknown>[]
  page?: number
  total_pages?: number
}

/**
 * TMDB refuses a page above 500 on the paged endpoints with a 422, whatever
 * `total_pages` says — a popular genre reports tens of thousands. Clamping here
 * rather than in the screen keeps the rule with the API that imposes it, and
 * means the screen's "am I at the end?" check is the only one it needs.
 */
const MAX_PAGE = 500

/**
 * `page` and `total_pages` default to 1, not 0. The unpaged endpoints omit both,
 * and a screen comparing `page < total_pages` must read "one page, already
 * complete" from that — a 0 would make the first page look like a page before
 * the beginning.
 */
const toPaged = (raw: RawPaged): Paged => ({
  results: (raw.results ?? []).map(toMovie),
  page: raw.page ?? 1,
  total_pages: Math.min(raw.total_pages ?? 1, MAX_PAGE),
})

/**
 * The sub-resource the person request asks TMDB to include.
 *
 * Its own constant rather than a second use of `APPEND`, because the two name
 * the blocks of two different endpoints. `credits` on a person means their
 * television work as well as their films, and this screen draws a grid of
 * films.
 *
 * Like `APPEND`, this string must stay identical to a value in
 * `ALLOWED_PARAM_VALUES` in `proxy/api/tmdb.ts`. A mismatch fails silently: the
 * proxy drops the parameter, TMDB answers with a plain person response, and the
 * filmography arrives empty with no error to report.
 */
const PERSON_APPEND = 'movie_credits'

/**
 * Newest first, with the undated films last.
 *
 * TMDB returns a filmography in no order a reader would expect — neither by
 * date nor by billing. The rule lives here rather than in the screen for the
 * reason `pickTrailer` does: it comes from the shape of the response.
 *
 * An announced film carries the empty date sentinel, which sorts before every
 * real date as a string. Those entries go to the end instead, where the least
 * certain part of a filmography belongs.
 */
const byNewest = (a: Movie, b: Movie): number => {
  if (!a.release_date) return b.release_date ? 1 : 0
  if (!b.release_date) return -1
  return b.release_date.localeCompare(a.release_date)
}

/**
 * The films of one person, from the `cast` list of the `movie_credits` block.
 *
 * One film can appear twice: a performer credited for a dual role, or for a
 * voice part beside a screen part, gets one entry per credit under the same
 * film id. The grid keys on that id, so the duplicate would hand FlatList two
 * children with one key — the defect `mergePages` guards against on the genre
 * screen. The first credit wins, because the entries carry the same film.
 */
const toCredits = (raws: Record<string, unknown>[]): Movie[] => {
  const byId = new Map<number, Movie>()
  for (const raw of raws) {
    const movie = toMovie(raw)
    if (!byId.has(movie.id)) byId.set(movie.id, movie)
  }
  return [...byId.values()].sort(byNewest)
}

/**
 * The person endpoint, and the one block appended to it.
 *
 * Every string field has a documented absent form. TMDB omits `birthday` and
 * `place_of_birth` for a person it holds no record of, sends `deathday: null`
 * for a living person, and `biography: ''` for one with no text in the
 * requested language. All of them map to `''`, which `lib/types.ts` declares as
 * the sentinel the screen reads as "do not print this line".
 *
 * `movie_credits` is absent for a person with no film work at all, so the read
 * needs the `?? {}` guard before the `cast` below it.
 */
const toPersonDetail = (raw: Record<string, unknown>): PersonDetail => {
  const credits = (raw.movie_credits as { cast?: Record<string, unknown>[] }) ?? {}

  return {
    id: raw.id as number,
    name: (raw.name as string) ?? '',
    biography: (raw.biography as string) ?? '',
    birthday: (raw.birthday as string | null) ?? '',
    deathday: (raw.deathday as string | null) ?? '',
    place_of_birth: (raw.place_of_birth as string | null) ?? '',
    known_for_department: (raw.known_for_department as string) ?? '',
    profile_path: (raw.profile_path as string | null) ?? null,
    credits: toCredits(credits.cast ?? []),
  }
}

export const getTrending = async (): Promise<Paged> =>
  toPaged(await tmdbFetch<RawPaged>('/trending/movie/week'))

export const getPopular = async (): Promise<Paged> =>
  toPaged(await tmdbFetch<RawPaged>('/movie/popular'))

export const getTopRated = async (): Promise<Paged> =>
  toPaged(await tmdbFetch<RawPaged>('/movie/top_rated'))

/**
 * Returns null for a film that does not exist, rather than throwing. The detail
 * screen already separates "no such film" from "the request failed", and it
 * prints a different message for each.
 */
export const getMovie = async (id: number): Promise<MovieDetail | null> => {
  try {
    return toMovieDetail(
      await tmdbFetch<Record<string, unknown>>(`/movie/${id}`, {
        append_to_response: APPEND,
        include_image_language: IMAGE_LANGUAGES,
      }),
    )
  } catch (e) {
    if (e instanceof Error && 'status' in e && e.status === 404) return null
    throw e
  }
}

/** Called by app/search.tsx, once the typing in the box stops. */
export const searchMovies = async (query: string): Promise<Paged> => {
  const q = query.trim()
  // TMDB answers an empty query with a 422. Return early instead, so a cleared
  // search box is not an error state.
  if (!q) return { results: [], page: 1, total_pages: 1 }
  return toPaged(await tmdbFetch<RawPaged>('/search/movie', { query: q }))
}

/**
 * The genre list that names the chips on the home screen and titles the genre
 * screen. TMDB returns roughly 19 genres and changes them rarely, so the proxy
 * cache absorbs almost every call.
 */
export const getGenres = async (): Promise<Genre[]> => {
  const raw = await tmdbFetch<{ genres?: { id: number; name: string }[] }>(
    '/genre/movie/list',
  )
  return (raw.genres ?? []).map((g) => ({ id: g.id, name: g.name }))
}

/**
 * One page of films in one genre, narrowed by the filters the reader picked.
 *
 * `page` is 1-based, which is what TMDB expects; the caller passes the next page
 * it wants rather than an offset. An id that names no genre is not an error:
 * TMDB ignores `with_genres` it cannot parse and answers with an unfiltered
 * list, so the screen shows films rather than a failure.
 *
 * `filters` becomes the extra parameters `lib/discover.ts` names. Each of them
 * must be in `ALLOWED_PARAMS` in `proxy/api/tmdb.ts`, or the proxy drops it
 * and the grid shows the unfiltered list under a filter chip that says
 * otherwise.
 */
export const getMoviesByGenre = async (
  genreId: number,
  page = 1,
  filters: DiscoverFilters = EMPTY_FILTERS,
): Promise<Paged> =>
  toPaged(
    await tmdbFetch<RawPaged>('/discover/movie', {
      with_genres: String(genreId),
      page: String(page),
      ...toDiscoverParams(filters),
    }),
  )

/**
 * The most popular films in one original language, for the home row a reader
 * with a language preference sees first.
 *
 * The discover endpoint with one filter, rather than a new path: it sorts by
 * popularity when it is asked nothing else, and `with_original_language` is
 * already a parameter the proxy allows, so this needs no proxy change. The
 * screen shows one row and cannot page, so only the first page is asked for.
 */
export const getPopularByLanguage = async (language: string): Promise<Paged> =>
  toPaged(
    await tmdbFetch<RawPaged>('/discover/movie', {
      ...toDiscoverParams({ language }),
      page: '1',
    }),
  )

/**
 * One person, and the films they appear in.
 *
 * Returns null for an id TMDB has nobody for, the same way `getMovie` does. The
 * person screen separates "no such person" from "the request failed", and only
 * one of the two is worth offering a retry for.
 */
export const getPerson = async (id: number): Promise<PersonDetail | null> => {
  try {
    return toPersonDetail(
      await tmdbFetch<Record<string, unknown>>(`/person/${id}`, {
        append_to_response: PERSON_APPEND,
      }),
    )
  } catch (e) {
    if (e instanceof Error && 'status' in e && e.status === 404) return null
    throw e
  }
}
