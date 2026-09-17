/**
 * TMDB returns an empty `release_date` for unreleased films and `0` for an
 * unrated one. Both need a fallback at every call site, so they live here.
 */

/**
 * The year in a TMDB date (`2024-02-27`), or null when the field is the empty
 * sentinel. The length check is what separates the two: TMDB sends a whole date
 * or nothing, never a year on its own.
 */
const yearOf = (date: string) => (date.length >= 4 ? date.slice(0, 4) : null)

export const releaseYear = (releaseDate: string) => yearOf(releaseDate)

export const ratingLabel = (voteAverage: number) =>
  voteAverage > 0 ? voteAverage.toFixed(1) : null

/**
 * A runtime in minutes, as `2h 12m`.
 *
 * TMDB reports an unknown runtime as `0` or `null` — an announced film with no
 * cut yet — and `lib/api.ts` maps both to `0`. The hour part is dropped under
 * 60 minutes (`48m`, not `0h 48m`), and the minute part is dropped on an exact
 * hour (`2h`, not `2h 0m`).
 */
export const runtimeLabel = (minutes: number) => {
  if (minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/**
 * Joins the rating, the year, and the runtime into one meta line, dropping
 * whichever is absent.
 *
 * `runtime` is optional because only the detail endpoint sends it. The cards
 * call this with two arguments and get exactly the line they got before.
 */
export const metaLine = (voteAverage: number, releaseDate: string, runtime = 0) => {
  const rating = ratingLabel(voteAverage)
  const year = releaseYear(releaseDate)
  const length = runtimeLabel(runtime)
  const parts = [rating ? `★ ${rating}` : null, year, length].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Not rated'
}

/**
 * The year and the runtime, as `2024 · 2h 47m`.
 *
 * The detail screen shows the rating as its own badge, so it needs the rest of
 * the meta line without it. `metaLine` above stays as it is: the cards have one
 * line for all three facts and no room for a badge.
 *
 * Returns `''` when the film has neither — an announced film with no date and
 * no cut. The caller then renders no line at all rather than a stray separator.
 */
export const releaseLine = (releaseDate: string, runtime = 0) =>
  [releaseYear(releaseDate), runtimeLabel(runtime)].filter(Boolean).join(' · ')

/**
 * The years a person lived, as `1930–2014`.
 *
 * The four branches are the four states the data has. TMDB omits a birthday it
 * does not hold, and sends a null deathday for a living person; `lib/api.ts`
 * maps both to `''`. A single year carries a word with it, because `1963`
 * beside a name reads as a year of death as easily as a year of birth.
 *
 * Returns `''` when neither year is known, so the caller prints no line at all.
 */
export const lifeSpan = (birthday: string, deathday: string) => {
  const born = yearOf(birthday)
  const died = yearOf(deathday)
  if (born && died) return `${born}–${died}`
  if (born) return `Born ${born}`
  if (died) return `Died ${died}`
  return ''
}
