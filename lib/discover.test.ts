import {
  DECADES,
  EMPTY_FILTERS,
  LANGUAGES,
  MIN_VOTES,
  RATINGS,
  RUNTIMES,
  filterKey,
  hasFilters,
  toDiscoverParams,
} from './discover'

describe('toDiscoverParams', () => {
  it('sends nothing for no filters', () => {
    expect(toDiscoverParams(EMPTY_FILTERS)).toEqual({})
  })

  it('turns a decade into a date range', () => {
    expect(toDiscoverParams({ decade: 1990 })).toEqual({
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
    })
  })

  // A floor on the average alone lifts films with one vote of 10 to the top.
  it('pairs a rating floor with a vote count floor', () => {
    expect(toDiscoverParams({ rating: 7 })).toEqual({
      'vote_average.gte': '7',
      'vote_count.gte': String(MIN_VOTES),
    })
  })

  it('sends the language code', () => {
    expect(toDiscoverParams({ language: 'ta' })).toEqual({
      with_original_language: 'ta',
    })
  })

  it.each([
    ['short', { 'with_runtime.lte': '89' }],
    ['medium', { 'with_runtime.gte': '90', 'with_runtime.lte': '120' }],
    ['long', { 'with_runtime.gte': '121' }],
  ] as const)('turns the %s runtime band into its bounds', (runtime, expected) => {
    expect(toDiscoverParams({ runtime })).toEqual(expected)
  })

  it('combines every filter into one request', () => {
    const params = toDiscoverParams({
      decade: 2010,
      rating: 8,
      language: 'ko',
      runtime: 'long',
    })

    expect(Object.keys(params).sort()).toEqual([
      'primary_release_date.gte',
      'primary_release_date.lte',
      'vote_average.gte',
      'vote_count.gte',
      'with_original_language',
      'with_runtime.gte',
    ])
  })
})

describe('hasFilters', () => {
  it('is false for no filters', () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('is true for any one filter', () => {
    expect(hasFilters({ rating: 6 })).toBe(true)
  })
})

describe('filterKey', () => {
  it('is empty for no filters', () => {
    expect(filterKey(EMPTY_FILTERS)).toBe('')
  })

  // Two objects with the same picks must share one cache entry.
  it('does not depend on the order of the picks', () => {
    expect(filterKey({ decade: 2000, rating: 7 })).toBe(
      filterKey({ rating: 7, decade: 2000 }),
    )
  })

  it('differs when a pick differs', () => {
    expect(filterKey({ rating: 7 })).not.toBe(filterKey({ rating: 8 }))
  })
})

describe('the options', () => {
  it('lists the decades newest first, down to the 1950s', () => {
    const thisDecade = Math.floor(new Date().getFullYear() / 10) * 10

    expect(DECADES[0]).toEqual({ value: thisDecade, label: `${thisDecade}s` })
    expect(DECADES[DECADES.length - 1]).toEqual({ value: 1950, label: '1950s' })
  })

  // A menu keyed on the value needs each one to be unique.
  it.each([
    ['decades', DECADES],
    ['ratings', RATINGS],
    ['languages', LANGUAGES],
    ['runtimes', RUNTIMES],
  ])('has no duplicate %s', (_, options) => {
    const values = options.map((o) => String(o.value))

    expect(new Set(values).size).toBe(values.length)
  })
})
