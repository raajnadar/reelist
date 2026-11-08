import {
  DECADES,
  EMPTY_FILTERS,
  LANGUAGES,
  MIN_VOTES,
  NEWEST_MIN_VOTES,
  RATINGS,
  RUNTIME_LIMIT,
  SORTS,
  appliedFilters,
  filterKey,
  filtersFromParams,
  filtersToParams,
  hasFilters,
  orderLanguages,
  runtimeFromBounds,
  runtimeLabel,
  toDiscoverParams,
  withoutFilter,
} from './discover'

const TODAY = new Date(2026, 10, 8)

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

  it('sends one language code', () => {
    expect(toDiscoverParams({ languages: ['ta'] })).toEqual({
      with_original_language: 'ta',
    })
  })

  // TMDB reads a pipe as "any of these". A comma matches nothing, because a
  // film has one original language.
  it('joins more than one language with a pipe, in the list order', () => {
    expect(toDiscoverParams({ languages: ['ml', 'ta'] })).toEqual({
      with_original_language: 'ta|ml',
    })
  })

  it.each([
    [{ max: 90 }, { 'with_runtime.lte': '90' }],
    [
      { min: 90, max: 120 },
      { 'with_runtime.gte': '90', 'with_runtime.lte': '120' },
    ],
    [{ min: 120 }, { 'with_runtime.gte': '120' }],
  ])('turns the runtime %j into its bounds', (runtime, expected) => {
    expect(toDiscoverParams({ runtime })).toEqual(expected)
  })

  // The same vote floor as the rating filter, for the same reason.
  it('orders by the average vote over a vote count floor', () => {
    expect(toDiscoverParams({ sort: 'rated' })).toEqual({
      sort_by: 'vote_average.desc',
      'vote_count.gte': String(MIN_VOTES),
    })
  })

  // TMDB lists films years before they come out, and holds many entries that
  // nobody watched. A date order would start with both.
  it('orders by release date up to today, over a small vote count floor', () => {
    expect(toDiscoverParams({ sort: 'newest' }, TODAY)).toEqual({
      sort_by: 'primary_release_date.desc',
      'primary_release_date.lte': '2026-11-08',
      'vote_count.gte': String(NEWEST_MIN_VOTES),
    })
  })

  it('keeps the end of a past decade when the order is by date', () => {
    expect(toDiscoverParams({ sort: 'newest', decade: 1990 }, TODAY)).toEqual({
      sort_by: 'primary_release_date.desc',
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
      'vote_count.gte': String(NEWEST_MIN_VOTES),
    })
  })

  it('keeps the higher vote floor of a rating filter in the date order', () => {
    expect(toDiscoverParams({ sort: 'newest', rating: 7 }, TODAY)['vote_count.gte']).toBe(
      String(MIN_VOTES),
    )
  })

  it('stops the current decade at today when the order is by date', () => {
    expect(
      toDiscoverParams({ sort: 'newest', decade: 2020 }, TODAY)[
        'primary_release_date.lte'
      ],
    ).toBe('2026-11-08')
  })

  it('combines every filter into one request', () => {
    const params = toDiscoverParams({
      sort: 'rated',
      decade: 2010,
      rating: 8,
      languages: ['ko'],
      runtime: { min: 120 },
    })

    expect(Object.keys(params).sort()).toEqual([
      'primary_release_date.gte',
      'primary_release_date.lte',
      'sort_by',
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

  it('is true for a sort order', () => {
    expect(hasFilters({ sort: 'newest' })).toBe(true)
  })

  it('is false for an empty language list', () => {
    expect(hasFilters({ languages: [] })).toBe(false)
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
    expect(filterKey({ languages: ['ml', 'ta'] })).toBe(
      filterKey({ languages: ['ta', 'ml'] }),
    )
  })

  it('differs when a pick differs', () => {
    expect(filterKey({ rating: 7 })).not.toBe(filterKey({ rating: 8 }))
    expect(filterKey({ sort: 'rated' })).not.toBe(filterKey({}))
  })
})

describe('the options', () => {
  it('lists the decades newest first, down to the 1950s', () => {
    const thisDecade = Math.floor(new Date().getFullYear() / 10) * 10

    expect(DECADES[0]).toEqual({ value: thisDecade, label: `${thisDecade}s` })
    expect(DECADES[DECADES.length - 1]).toEqual({ value: 1950, label: '1950s' })
  })

  it('lists the rating floors lowest first, for the slider', () => {
    expect(RATINGS.map((r) => r.value)).toEqual([5, 6, 7, 8, 9])
  })

  // A list keyed on the value needs each one to be unique.
  it.each([
    ['sorts', SORTS],
    ['decades', DECADES],
    ['ratings', RATINGS],
    ['languages', LANGUAGES],
  ])('has no duplicate %s', (_, options) => {
    const values = options.map((o) => String(o.value))

    expect(new Set(values).size).toBe(values.length)
  })
})

describe('runtimeFromBounds', () => {
  // A slider pulled back to its full width is no filter.
  it('is nothing for the full width of the slider', () => {
    expect(runtimeFromBounds([0, RUNTIME_LIMIT])).toBeUndefined()
  })

  it('leaves an end open when its thumb is at the end of the slider', () => {
    expect(runtimeFromBounds([0, 90])).toEqual({ max: 90 })
    expect(runtimeFromBounds([120, RUNTIME_LIMIT])).toEqual({ min: 120 })
  })

  it('keeps both ends when both thumbs moved', () => {
    expect(runtimeFromBounds([90, 120])).toEqual({ min: 90, max: 120 })
  })
})

describe('runtimeLabel', () => {
  it.each([
    [{}, 'Any length'],
    [{ max: 90 }, 'Up to 90 min'],
    [{ min: 120 }, '120 min or more'],
    [{ min: 90, max: 120 }, '90 to 120 min'],
  ])('names %j as %s', (range, label) => {
    expect(runtimeLabel(range)).toBe(label)
  })
})

describe('orderLanguages', () => {
  it('puts the codes in the list order, each once, and drops an unknown one', () => {
    expect(orderLanguages(['ml', 'xx', 'ta', 'ml'])).toEqual(['ta', 'ml'])
  })
})

describe('appliedFilters', () => {
  it('names nothing for no filters', () => {
    expect(appliedFilters(EMPTY_FILTERS)).toEqual([])
  })

  it('names each filter in the order of the sheet', () => {
    const applied = appliedFilters({
      languages: ['ta'],
      decade: 1990,
      runtime: { max: 90 },
      rating: 7,
      sort: 'rated',
    })

    expect(applied.map((a) => [a.param, a.label])).toEqual([
      ['sort', 'Top rated'],
      ['rating', '7+'],
      ['runtime', 'Up to 90 min'],
      ['decade', '1990s'],
      ['language', 'Tamil'],
    ])
  })

  // The chip stays short. The screen reader gets every name.
  it('names the first language and a count, and lists all of them for a screen reader', () => {
    const [languages] = appliedFilters({ languages: ['ml', 'ta', 'ko'] })

    expect(languages.label).toBe('Tamil +2')
    expect(languages.description).toBe('Languages: Tamil, Malayalam, Korean')
  })
})

describe('withoutFilter', () => {
  it('clears one filter and keeps the others', () => {
    expect(withoutFilter({ rating: 7, languages: ['ta'] }, 'language')).toEqual({
      rating: 7,
    })
    expect(withoutFilter({ rating: 7, sort: 'newest' }, 'sort')).toEqual({ rating: 7 })
  })
})

describe('filtersFromParams', () => {
  it('reads each filter the address names', () => {
    expect(
      filtersFromParams({
        sort: 'rated',
        decade: '1990',
        rating: '7',
        language: 'ta,ml',
        runtime: '90-120',
      }),
    ).toEqual({
      sort: 'rated',
      decade: 1990,
      rating: 7,
      languages: ['ta', 'ml'],
      runtime: { min: 90, max: 120 },
    })
  })

  it('reads nothing from an empty address', () => {
    expect(filtersFromParams({})).toEqual({})
  })

  // The default order is no filter, so the address does not carry it.
  it('reads the popular order as no sort', () => {
    expect(filtersFromParams({ sort: 'popular' })).toEqual({})
  })

  it.each([
    ['-90', { max: 90 }],
    ['120-', { min: 120 }],
    ['90-120', { min: 90, max: 120 }],
  ])('reads the runtime %s', (runtime, expected) => {
    expect(filtersFromParams({ runtime }).runtime).toEqual(expected)
  })

  // A link shared before the slider names a band.
  it.each([
    ['short', { max: 90 }],
    ['medium', { min: 90, max: 120 }],
    ['long', { min: 120 }],
  ])('reads the older runtime band %s as the nearest range', (runtime, expected) => {
    expect(filtersFromParams({ runtime }).runtime).toEqual(expected)
  })

  // A link is untrusted: a value the sheet does not offer is not a filter.
  it('drops a value the sheet does not offer', () => {
    expect(
      filtersFromParams({
        sort: 'revenue',
        decade: '1985',
        rating: '4',
        language: 'xx',
        runtime: 'epic',
      }),
    ).toEqual({})
  })

  it.each(['95-120', '120-90', '0-300', '-', 'a-b', '90'])(
    'drops the runtime %s, which the slider cannot make',
    (runtime) => {
      expect(filtersFromParams({ runtime })).toEqual({})
    },
  )

  it('keeps the known languages of a list that has an unknown one', () => {
    expect(filtersFromParams({ language: 'xx,ml' })).toEqual({ languages: ['ml'] })
  })

  it('takes the first value of a repeated parameter', () => {
    expect(filtersFromParams({ rating: ['8', '6'] })).toEqual({ rating: 8 })
  })
})

describe('filtersToParams', () => {
  it('names every parameter, with the unset ones undefined', () => {
    expect(filtersToParams({ decade: 2010, languages: ['hi'] })).toEqual({
      sort: undefined,
      decade: '2010',
      rating: undefined,
      language: 'hi',
      runtime: undefined,
    })
  })

  it('writes an open runtime end as nothing', () => {
    expect(filtersToParams({ runtime: { max: 90 } }).runtime).toBe('-90')
    expect(filtersToParams({ runtime: { min: 120 } }).runtime).toBe('120-')
  })

  it('round-trips through the address', () => {
    const filters = {
      sort: 'newest' as const,
      decade: 1970,
      rating: 6,
      languages: ['ko', 'ja'],
      runtime: { min: 75, max: 150 },
    }
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters)
  })
})
