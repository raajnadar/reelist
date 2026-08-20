/**
 * Field names match the TMDB API response shape on purpose. Mock data and live
 * data then share one type, and integration touches only `lib/api.ts`.
 */
export type Movie = {
  id: number
  title: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  release_date: string
  overview: string
}

/**
 * One page of results.
 *
 * `page` and `total_pages` are what the genre screen pages on: it stops asking
 * for more once `page` reaches `total_pages`. They are required rather than
 * optional so a caller cannot forget to report the end of the list and then
 * request page 501 forever. `lib/api.ts` supplies a safe default for the
 * endpoints TMDB does not page.
 */
export type Paged = {
  results: Movie[]
  page: number
  total_pages: number
}

/** A TMDB genre, as returned by `/genre/movie/list`. */
export type Genre = {
  id: number
  name: string
}
