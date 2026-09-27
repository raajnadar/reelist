import { seed } from './prerenderSeed'
import type { Genre, Movie, MovieDetail } from './types'

/**
 * One film as the prerender seed stores it.
 *
 * The seed carries only what the static HTML needs: the head tags, the title
 * block, the genres, and the overview. The lists a film owns — the cast, the
 * trailer, the gallery, the recommendations, and the providers — arrive from
 * the proxy after the page hydrates, the same as for a film with no seed. They
 * are left out to keep the seed small, because the web bundle carries it.
 */
export type PrerenderedMovie = Omit<
  MovieDetail,
  'cast' | 'trailer' | 'recommendations' | 'images' | 'providers'
>

/**
 * What scripts/prerender-seed.js writes to lib/prerender.json.
 *
 * `movies` is every film the export writes a page for. `lists` are the three
 * home rows as ids into `movies`, in the order TMDB returned them, so the
 * static home page carries its rows and a crawler finds the film pages from
 * it. `genres` is the chip row for the same reason. Keep the script and this
 * type in step.
 */
export type PrerenderSeed = {
  movies: Record<string, PrerenderedMovie>
  lists: { trending: number[]; popular: number[]; topRated: number[] }
  genres: Genre[]
}

/**
 * Widens a seed entry to the full detail the screen draws, with each list
 * empty. The screen then fills the lists from the proxy.
 */
export const fromSeed = (entry: PrerenderedMovie): MovieDetail => ({
  ...entry,
  cast: [],
  trailer: null,
  recommendations: [],
  images: [],
  providers: {},
})

/**
 * The prerendered copy of one film, or null when the build has none.
 *
 * On the web this is what the static HTML for `/movie/{id}` is rendered from,
 * and what the same page hydrates with, so the two agree. Native and a local
 * build have an empty seed and always get null.
 */
export const prerenderedMovie = (id: number): MovieDetail | null => {
  const entry = seed.movies[String(id)]
  return entry ? fromSeed(entry) : null
}

/** The ids the static export writes a page for. */
export const prerenderedIds = (): number[] =>
  Object.keys(seed.movies)
    .map(Number)
    .filter((id) => Number.isInteger(id))

const toMovies = (ids: number[]): Movie[] =>
  ids.flatMap((id) => {
    const entry = seed.movies[String(id)]
    return entry ? [entry] : []
  })

/**
 * The three home rows from the seed, or null when the build has none.
 *
 * Null rather than three empty rows, so the home screen can tell a build
 * with no seed from one whose lists came back empty, and draw its skeleton
 * for the first.
 */
export const prerenderedLists = (): {
  trending: Movie[]
  popular: Movie[]
  topRated: Movie[]
} | null => {
  const { trending, popular, topRated } = seed.lists
  if (!trending.length && !popular.length && !topRated.length) return null
  return {
    trending: toMovies(trending),
    popular: toMovies(popular),
    topRated: toMovies(topRated),
  }
}

/** The genre chips from the seed, or null when the build has none. */
export const prerenderedGenres = (): Genre[] | null =>
  seed.genres.length ? seed.genres : null
