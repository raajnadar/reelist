/**
 * TMDB returns an empty `release_date` for unreleased films and `0` for an
 * unrated one. Both need a fallback at every call site, so they live here.
 */
export const releaseYear = (releaseDate: string) =>
  releaseDate.length >= 4 ? releaseDate.slice(0, 4) : null

export const ratingLabel = (voteAverage: number) =>
  voteAverage > 0 ? voteAverage.toFixed(1) : null

/** Joins the rating and year into one meta line, dropping whichever is absent. */
export const metaLine = (voteAverage: number, releaseDate: string) => {
  const rating = ratingLabel(voteAverage)
  const year = releaseYear(releaseDate)
  const parts = [rating ? `★ ${rating}` : null, year].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Not rated'
}
