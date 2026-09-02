import { tmdbFetch } from './tmdb'
import type { CastMember, Genre, Movie, MovieDetail, Paged, Video } from './types'

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
const APPEND = 'credits,videos,recommendations'

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

/**
 * The detail endpoint adds six fields the list endpoints never send.
 *
 * Each one has a documented absent form: `genres` is missing for a film with
 * none classified, `runtime` is `null` until a cut exists, and `tagline` is
 * `""`. They map to an empty array and the `0` / `""` sentinels `lib/format.ts`
 * already reads as "do not print this".
 *
 * The last three arrive because the request carries `append_to_response`, which
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
    cast: (credits.cast ?? []).map(toCastMember),
    trailer: pickTrailer(videos.results ?? []),
    recommendations: toPaged(recommendations).results,
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
 * One page of films in one genre.
 *
 * `page` is 1-based, which is what TMDB expects; the caller passes the next page
 * it wants rather than an offset. An id that names no genre is not an error:
 * TMDB ignores `with_genres` it cannot parse and answers with an unfiltered
 * list, so the screen shows films rather than a failure.
 */
export const getMoviesByGenre = async (genreId: number, page = 1): Promise<Paged> =>
  toPaged(
    await tmdbFetch<RawPaged>('/discover/movie', {
      with_genres: String(genreId),
      page: String(page),
    }),
  )
