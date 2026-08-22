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

/**
 * One film, as `/movie/{id}` returns it.
 *
 * The extra fields are the reason this type exists rather than three optional
 * fields on `Movie`. The list endpoints — trending, popular, search, discover —
 * never send `genres`, `runtime`, or `tagline`, so a card that read one would
 * always find it absent. Keeping them here means only the screen that fetches
 * the detail endpoint can reach them, and the compiler enforces that.
 *
 * The sentinels follow the convention `Movie` already sets: TMDB reports an
 * unknown runtime as `0` or `null` and a missing tagline as `""`, and
 * `lib/format.ts` reads both as "absent" rather than printing them.
 */
export type MovieDetail = Movie & {
  genres: Genre[]
  runtime: number
  tagline: string
}
