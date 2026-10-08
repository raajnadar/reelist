import type { Genre, Movie, MovieDetail } from './types'

/**
 * One film as the prerender seed stores it.
 *
 * The seed carries only what the static HTML needs: the head tags, the title
 * block, the genres, and the overview. The lists a film owns — the cast, the
 * trailer, the gallery, the recommendations, and the providers — arrive from
 * the proxy after the page hydrates, the same as for a film with no seed. They
 * are left out to keep each page small, because the page carries its part of
 * the seed in its HTML.
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

/** The part of the seed the home page carries. */
export type HomeSeed = {
  /** Null when the build has no seed, so the screen draws its skeleton. */
  lists: { trending: Movie[]; popular: Movie[]; topRated: Movie[] } | null
  genres: Genre[]
}

/**
 * The seed, for a route `loader` or `generateStaticParams` only.
 *
 * Both run at export time, in Node. The import is dynamic, so the bundler puts
 * the seed in a chunk of its own that the browser never asks for. Each page
 * gets its own part from its loader, in its HTML. See
 * lib/usePrerendered.web.ts.
 *
 * Jest cannot run a dynamic import, so the tests give the functions below a
 * seed of their own. The tracked copy is empty, so a local build finds
 * nothing in it.
 */
export const loadSeed = async (): Promise<PrerenderSeed> =>
  (await import('./prerender.json')).default as PrerenderSeed

/** The ids the static export writes a film page for. */
export const movieIds = (seed: PrerenderSeed): number[] =>
  Object.keys(seed.movies)
    .map(Number)
    .filter((id) => Number.isInteger(id))

/**
 * The seed copy of one film, or null when the seed has none.
 *
 * `id` is the route parameter as the loader gets it. The export also renders
 * the route template, where the parameter is `[id]`.
 */
export const movieEntry = (seed: PrerenderSeed, id: string): PrerenderedMovie | null =>
  Object.hasOwn(seed.movies, id) ? seed.movies[id] : null

/**
 * The fields a film card draws. The home page carries 60 cards in its HTML,
 * so the fields only the film page needs stay out.
 */
const toCard = ({
  id,
  title,
  poster_path,
  backdrop_path,
  vote_average,
  release_date,
  overview,
}: PrerenderedMovie): Movie => ({
  id,
  title,
  poster_path,
  backdrop_path,
  vote_average,
  release_date,
  overview,
})

/** The home rows and the genre chips from the seed. */
export const homeEntry = (seed: PrerenderSeed): HomeSeed => {
  const toMovies = (ids: number[]): Movie[] =>
    ids.flatMap((id) => {
      const entry = seed.movies[String(id)]
      return entry ? [toCard(entry)] : []
    })
  const { trending, popular, topRated } = seed.lists
  const empty = !trending.length && !popular.length && !topRated.length
  return {
    lists: empty
      ? null
      : {
          trending: toMovies(trending),
          popular: toMovies(popular),
          topRated: toMovies(topRated),
        },
    genres: seed.genres,
  }
}

/** One genre from the seed, or null when the seed has none. */
export const genreEntry = (seed: PrerenderSeed, id: string): Genre | null =>
  seed.genres.find((genre) => String(genre.id) === id) ?? null

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
