import { tmdbFetch } from './tmdb'
import type { Genre, Movie, MovieDetail, Paged } from './types'

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
 * The detail endpoint adds three fields the list endpoints never send.
 *
 * Each one has a documented absent form: `genres` is missing for a film with
 * none classified, `runtime` is `null` until a cut exists, and `tagline` is
 * `""`. They map to an empty array and the `0` / `""` sentinels `lib/format.ts`
 * already reads as "do not print this".
 */
const toMovieDetail = (raw: Record<string, unknown>): MovieDetail => ({
  ...toMovie(raw),
  genres: ((raw.genres as { id: number; name: string }[] | undefined) ?? []).map((g) => ({
    id: g.id,
    name: g.name,
  })),
  runtime: (raw.runtime as number | null) ?? 0,
  tagline: (raw.tagline as string) ?? '',
})

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
    return toMovieDetail(await tmdbFetch<Record<string, unknown>>(`/movie/${id}`))
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
