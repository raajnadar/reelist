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

export type Paged = {
  results: Movie[]
}
