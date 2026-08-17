import { tmdbFetch } from './tmdb'
import type { Movie, Paged } from './types'

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

type RawPaged = { results?: Record<string, unknown>[] }

const toPaged = (raw: RawPaged): Paged => ({
  results: (raw.results ?? []).map(toMovie),
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
export const getMovie = async (id: number): Promise<Movie | null> => {
  try {
    return toMovie(await tmdbFetch<Record<string, unknown>>(`/movie/${id}`))
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
  if (!q) return { results: [] }
  return toPaged(await tmdbFetch<RawPaged>('/search/movie', { query: q }))
}
