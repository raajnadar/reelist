/**
 * The filters the genre screen offers, and the TMDB parameters they become.
 *
 * The choices live here rather than in the screen for the reason `pickTrailer`
 * lives in `lib/api.ts`: each one is a rule about the shape of a TMDB request.
 * The screen only draws the labels and stores the picks.
 *
 * Every filter is optional, and an unset one sends nothing. TMDB answers the
 * plain genre list for a request with no filter, which is what the screen shows
 * before the reader touches the row.
 */

export type RuntimeBand = 'short' | 'medium' | 'long'

export type DiscoverFilters = {
  /** The first year of a decade: `2010` means 2010 to 2019. */
  decade?: number
  /** The lowest average vote a film may have, out of 10. */
  rating?: number
  /** The ISO 639-1 code of the original language. */
  language?: string
  runtime?: RuntimeBand
}

export const EMPTY_FILTERS: DiscoverFilters = {}

export type FilterOption<T> = { value: T; label: string }

const THIS_YEAR = new Date().getFullYear()
const FIRST_DECADE = 1950

/**
 * A decade rather than a year. A year is a long list that needs a picker of its
 * own, and a reader who wants a decade of films has no way to say so with it.
 * The list starts at the current decade and ends at the 1950s, which is where
 * TMDB's catalogue thins out.
 */
export const DECADES: FilterOption<number>[] = Array.from(
  { length: (Math.floor(THIS_YEAR / 10) * 10 - FIRST_DECADE) / 10 + 1 },
  (_, i) => {
    const start = Math.floor(THIS_YEAR / 10) * 10 - i * 10
    return { value: start, label: `${start}s` }
  },
)

export const RATINGS: FilterOption<number>[] = [
  { value: 6, label: '6+' },
  { value: 7, label: '7+' },
  { value: 8, label: '8+' },
]

/**
 * The languages the menu offers. TMDB accepts any ISO 639-1 code, and a list of
 * all of them is over a hundred entries long. These cover the catalogues with
 * the most films, in the order a reader is likely to want them.
 */
export const LANGUAGES: FilterOption<string>[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
]

export const RUNTIMES: FilterOption<RuntimeBand>[] = [
  { value: 'short', label: 'Under 90 min' },
  { value: 'medium', label: '90 to 120 min' },
  { value: 'long', label: 'Over 2 hours' },
]

/**
 * The runtime band edges, in minutes. The bands share their edges, so a film of
 * exactly 90 minutes is in the middle band and not in the short one.
 */
const RUNTIME_BOUNDS: Record<RuntimeBand, { gte?: number; lte?: number }> = {
  short: { lte: 89 },
  medium: { gte: 90, lte: 120 },
  long: { gte: 121 },
}

/**
 * The fewest votes a film needs before its average counts.
 *
 * Without this a rating floor lifts the films with one or two votes of 10 to
 * the top of every genre, because TMDB sorts by popularity and a film nobody
 * rated has no bad votes. The floor is only useful over a sample.
 */
export const MIN_VOTES = 100

export const hasFilters = (filters: DiscoverFilters): boolean =>
  filters.decade !== undefined ||
  filters.rating !== undefined ||
  filters.language !== undefined ||
  filters.runtime !== undefined

/**
 * The query parameters for one set of filters, in the names TMDB uses on
 * `/discover/movie`. Each name must also be in `ALLOWED_PARAMS` in
 * `proxy/api/tmdb.ts`, or the proxy drops it and TMDB answers the unfiltered
 * list with no error.
 */
export const toDiscoverParams = (filters: DiscoverFilters): Record<string, string> => {
  const params: Record<string, string> = {}

  if (filters.decade !== undefined) {
    params['primary_release_date.gte'] = `${filters.decade}-01-01`
    params['primary_release_date.lte'] = `${filters.decade + 9}-12-31`
  }

  if (filters.rating !== undefined) {
    params['vote_average.gte'] = String(filters.rating)
    params['vote_count.gte'] = String(MIN_VOTES)
  }

  if (filters.language !== undefined) {
    params['with_original_language'] = filters.language
  }

  if (filters.runtime !== undefined) {
    const { gte, lte } = RUNTIME_BOUNDS[filters.runtime]
    if (gte !== undefined) params['with_runtime.gte'] = String(gte)
    if (lte !== undefined) params['with_runtime.lte'] = String(lte)
  }

  return params
}

/**
 * One string for one set of filters, for the cache key of the first page.
 *
 * The parameters rather than the object: two objects with the same picks in a
 * different order must read as one request, and the parameter names are the
 * only order the request has.
 */
export const filterKey = (filters: DiscoverFilters): string =>
  new URLSearchParams(toDiscoverParams(filters)).toString()
