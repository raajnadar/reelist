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
  cast: CastMember[]
  trailer: Video | null
  recommendations: Movie[]
}

/**
 * One credited performer, from the `credits` block of the detail response.
 *
 * `profile_path` is nullable for the reason `poster_path` is: a person with no
 * photo is a real state, and the card draws a placeholder for it rather than a
 * broken image. `character` follows the string convention instead, because TMDB
 * omits it for an uncredited role and `''` already reads as "do not print
 * this".
 */
export type CastMember = {
  id: number
  name: string
  character: string
  profile_path: string | null
}

/**
 * One video, from the `videos` block.
 *
 * `id` is a string here, not a number. TMDB identifies a video by a hash while
 * it identifies a film by an integer, so this type cannot borrow the shape of
 * the others.
 *
 * `site` and `type` stay as plain strings rather than a union. TMDB adds a
 * video type when it likes — `Featurette` and `Behind the Scenes` arrived after
 * the rest — and a union would turn a new value into a compile error in a file
 * that only ever filters on the two values it knows.
 */
export type Video = {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

/**
 * One person, as `/person/{id}` returns it.
 *
 * The sentinels follow the convention `Movie` sets. TMDB sends `""` for a
 * biography it does not hold in the requested language, and `null` for the
 * birthday, the deathday, and the place of birth of a person it has no record
 * for — a living person always has a null deathday. `lib/api.ts` maps every one
 * of those to `''`, so the screen drops a line rather than printing an empty
 * one.
 *
 * `credits` is the filmography, from the `movie_credits` block. The entries are
 * plain `Movie` values, so the grid draws them with the card every other list
 * on the screen uses.
 */
export type PersonDetail = {
  id: number
  name: string
  biography: string
  birthday: string
  deathday: string
  place_of_birth: string
  known_for_department: string
  profile_path: string | null
  credits: Movie[]
}
