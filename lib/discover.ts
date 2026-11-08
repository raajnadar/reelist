/**
 * The filters and the sort order the genre screen offers, and the TMDB
 * parameters they become.
 *
 * The choices live here rather than in the screen for the reason `pickTrailer`
 * lives in `lib/api.ts`: each one is a rule about the shape of a TMDB request.
 * The screen only draws the labels and stores the picks.
 *
 * Every filter is optional, and an unset one sends nothing. TMDB answers the
 * plain genre list for a request with no filter, which is what the screen shows
 * before the reader touches the row.
 */

export type SortOrder = 'popular' | 'rated' | 'newest'

/** Minutes. An unset end is open: `{ min: 120 }` is two hours or more. */
export type RuntimeRange = { min?: number; max?: number }

export type DiscoverFilters = {
  /** Unset is `popular`, which is the TMDB default. */
  sort?: Exclude<SortOrder, 'popular'>
  /** The first year of a decade: `2010` means 2010 to 2019. */
  decade?: number
  /** The lowest average vote a film may have, out of 10. */
  rating?: number
  /** ISO 639-1 codes of the original language, in the order of `LANGUAGES`. */
  languages?: string[]
  runtime?: RuntimeRange
}

export const EMPTY_FILTERS: DiscoverFilters = {}

export type FilterOption<T> = { value: T; label: string }

export const SORTS: FilterOption<SortOrder>[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'rated', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
]

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

/** The rating floors, lowest first, in the order the slider steps through them. */
export const RATINGS: FilterOption<number>[] = [5, 6, 7, 8, 9].map((value) => ({
  value,
  label: `${value}+`,
}))

/**
 * The languages the sheet offers. TMDB accepts any ISO 639-1 code, and a list
 * of all of them is over a hundred entries long. These cover the catalogues
 * with the most films, in the order a reader is likely to want them.
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

/** The runtime slider moves in quarter hours, from 0 to 4 hours. */
export const RUNTIME_STEP = 15
/** The top of the runtime slider. A thumb here leaves the upper end open. */
export const RUNTIME_LIMIT = 240

/**
 * The runtime bands that links made before the slider carry. A shared link
 * still opens with the band it named, as the nearest range on the slider.
 */
const RUNTIME_BANDS: Record<string, RuntimeRange> = {
  short: { max: 90 },
  medium: { min: 90, max: 120 },
  long: { min: 120 },
}

/**
 * The fewest votes a film needs before its average counts.
 *
 * Without this a rating floor or the "Top rated" order lifts the films with one
 * or two votes of 10 to the top of every genre, because a film nobody rated has
 * no bad votes. An average is only useful over a sample.
 */
export const MIN_VOTES = 100

/**
 * The fewest votes a film needs in the "Newest" order.
 *
 * TMDB holds many entries that nobody watched: uploads, fan edits, and titles
 * with no poster. A date order puts them first, because they are the newest.
 * Measured on 2026-11-08: at 10 votes the Action list starts with real
 * releases, and at 25 a new Tamil film with 25 votes drops out.
 */
export const NEWEST_MIN_VOTES = 10

/**
 * The range a slider position gives. A thumb at either end of the slider is
 * no bound at all, so a slider pulled back to its full width clears the filter.
 */
export const runtimeFromBounds = ([low, high]: [number, number]):
  RuntimeRange | undefined => {
  const range: RuntimeRange = {}
  if (low > 0) range.min = low
  if (high < RUNTIME_LIMIT) range.max = high
  return range.min === undefined && range.max === undefined ? undefined : range
}

/** The languages a set of codes names, each once, in the order of `LANGUAGES`. */
export const orderLanguages = (codes: string[]): string[] =>
  LANGUAGES.map((l) => l.value).filter((code) => codes.includes(code))

const languageLabel = (code: string): string =>
  LANGUAGES.find((l) => l.value === code)?.label ?? code

export const runtimeLabel = ({ min, max }: RuntimeRange): string => {
  if (min !== undefined && max !== undefined) return `${min} to ${max} min`
  if (max !== undefined) return `Up to ${max} min`
  if (min !== undefined) return `${min} min or more`
  return 'Any length'
}

export const hasFilters = (filters: DiscoverFilters): boolean =>
  filters.sort !== undefined ||
  filters.decade !== undefined ||
  filters.rating !== undefined ||
  (filters.languages?.length ?? 0) > 0 ||
  filters.runtime !== undefined

/** The local date as TMDB writes it: `2026-11-08`. */
const isoDate = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

/**
 * The query parameters for one set of filters, in the names TMDB uses on
 * `/discover/movie`. Each name must also be in `ALLOWED_PARAMS` in
 * `proxy/api/tmdb.ts`, and each `sort_by` value in `ALLOWED_PARAM_VALUES`, or
 * the proxy drops it and TMDB answers the unfiltered list with no error.
 *
 * `today` is a parameter so a test can fix the date. "Newest" stops at it,
 * because TMDB lists films years before their release, and a date order
 * would start with films that nobody can see yet.
 */
export const toDiscoverParams = (
  filters: DiscoverFilters,
  today: Date = new Date(),
): Record<string, string> => {
  const params: Record<string, string> = {}

  if (filters.decade !== undefined) {
    params['primary_release_date.gte'] = `${filters.decade}-01-01`
    params['primary_release_date.lte'] = `${filters.decade + 9}-12-31`
  }

  if (filters.sort === 'newest') {
    params.sort_by = 'primary_release_date.desc'
    const end = params['primary_release_date.lte']
    const now = isoDate(today)
    params['primary_release_date.lte'] = end !== undefined && end < now ? end : now
    // A rating floor below sets the higher MIN_VOTES over this one.
    params['vote_count.gte'] = String(NEWEST_MIN_VOTES)
  }

  if (filters.rating !== undefined) {
    params['vote_average.gte'] = String(filters.rating)
    params['vote_count.gte'] = String(MIN_VOTES)
  }

  if (filters.sort === 'rated') {
    params.sort_by = 'vote_average.desc'
    params['vote_count.gte'] = String(MIN_VOTES)
  }

  if (filters.languages?.length) {
    // A pipe is "any of these" to TMDB. A comma is "all of these", and a film
    // has one original language, so a comma would match nothing.
    params['with_original_language'] = orderLanguages(filters.languages).join('|')
  }

  if (filters.runtime !== undefined) {
    const { min, max } = filters.runtime
    if (min !== undefined) params['with_runtime.gte'] = String(min)
    if (max !== undefined) params['with_runtime.lte'] = String(max)
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

/**
 * The names the filters take in the address:
 * `/genre/28?sort=rated&decade=1990&rating=7&language=ta,ml&runtime=90-120`.
 */
const FILTER_PARAMS = ['sort', 'decade', 'rating', 'language', 'runtime'] as const

export type FilterParam = (typeof FILTER_PARAMS)[number]

/** One applied filter, as the chip row under the genre title names it. */
export type AppliedFilter = {
  param: FilterParam
  label: string
  /** The label with its category, for a screen reader. */
  description: string
}

/** The applied filters, in the order the sheet lists them. */
export const appliedFilters = (filters: DiscoverFilters): AppliedFilter[] => {
  const applied: AppliedFilter[] = []
  const sort = SORTS.find((s) => s.value === filters.sort)
  if (sort) {
    applied.push({ param: 'sort', label: sort.label, description: `Sort: ${sort.label}` })
  }
  if (filters.rating !== undefined) {
    const label = `${filters.rating}+`
    applied.push({ param: 'rating', label, description: `Minimum rating: ${label}` })
  }
  if (filters.runtime !== undefined) {
    const label = runtimeLabel(filters.runtime)
    applied.push({ param: 'runtime', label, description: `Runtime: ${label}` })
  }
  if (filters.decade !== undefined) {
    const label = `${filters.decade}s`
    applied.push({ param: 'decade', label, description: `Decade: ${label}` })
  }
  const languages = orderLanguages(filters.languages ?? []).map(languageLabel)
  if (languages.length) {
    applied.push({
      param: 'language',
      // The row scrolls sideways, but a chip with six names would fill it.
      label:
        languages.length === 1
          ? languages[0]
          : `${languages[0]} +${languages.length - 1}`,
      description: `Languages: ${languages.join(', ')}`,
    })
  }
  return applied
}

/** The filters with one of them cleared, for the close icon on its chip. */
export const withoutFilter = (
  filters: DiscoverFilters,
  param: FilterParam,
): DiscoverFilters => {
  const next = { ...filters }
  if (param === 'language') delete next.languages
  else delete next[param]
  return next
}

/** A route parameter, as Expo Router reads it: one value, or one per repeat. */
type RouteParams = Partial<Record<FilterParam, string | string[]>>

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const pick = <T extends string | number>(
  options: FilterOption<T>[],
  value: string | undefined,
): T | undefined => options.find((o) => String(o.value) === value)?.value

/** A slider stop, or nothing: a value between two stops was not made here. */
const runtimeStop = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) return undefined
  const minutes = Number(value)
  return minutes % RUNTIME_STEP === 0 && minutes <= RUNTIME_LIMIT ? minutes : undefined
}

/** `90-120`, `-90`, or `120-`, or one of the bands an older link carries. */
const parseRuntime = (value: string | undefined): RuntimeRange | undefined => {
  if (value === undefined) return undefined
  if (RUNTIME_BANDS[value]) return RUNTIME_BANDS[value]
  const match = /^(\d*)-(\d*)$/.exec(value)
  if (!match) return undefined
  const low = match[1] === '' ? 0 : runtimeStop(match[1])
  const high = match[2] === '' ? RUNTIME_LIMIT : runtimeStop(match[2])
  if (low === undefined || high === undefined || low > high) return undefined
  return runtimeFromBounds([low, high])
}

const formatRuntime = ({ min, max }: RuntimeRange): string => `${min ?? ''}-${max ?? ''}`

/**
 * The filters a link carries. A link comes from an untrusted source, so each
 * value must be one the sheet offers, and any other value reads as unset. TMDB
 * would answer an unknown language with an empty list, not with an error.
 */
export const filtersFromParams = (params: RouteParams): DiscoverFilters => {
  const filters: DiscoverFilters = {}
  const sort = pick(SORTS, firstValue(params.sort))
  const decade = pick(DECADES, firstValue(params.decade))
  const rating = pick(RATINGS, firstValue(params.rating))
  const languages = orderLanguages(firstValue(params.language)?.split(',') ?? [])
  const runtime = parseRuntime(firstValue(params.runtime))
  if (sort !== undefined && sort !== 'popular') filters.sort = sort
  if (decade !== undefined) filters.decade = decade
  if (rating !== undefined) filters.rating = rating
  if (languages.length) filters.languages = languages
  if (runtime !== undefined) filters.runtime = runtime
  return filters
}

/**
 * The route parameters for one set of filters. Every name is present, and an
 * unset filter is `undefined`: `router.setParams` merges, and only an explicit
 * `undefined` takes a cleared filter out of the address.
 */
export const filtersToParams = (
  filters: DiscoverFilters,
): Record<FilterParam, string | undefined> => ({
  sort: filters.sort,
  decade: filters.decade === undefined ? undefined : String(filters.decade),
  rating: filters.rating === undefined ? undefined : String(filters.rating),
  language: filters.languages?.length
    ? orderLanguages(filters.languages).join(',')
    : undefined,
  runtime: filters.runtime === undefined ? undefined : formatRuntime(filters.runtime),
})
