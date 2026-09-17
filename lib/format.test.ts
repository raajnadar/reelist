import {
  lifeSpan,
  metaLine,
  ratingLabel,
  releaseLine,
  releaseYear,
  runtimeLabel,
} from './format'

// The two TMDB sentinel values drive every case here: an empty `release_date`
// for an unreleased film, and a `0` rating for an unrated one. Both must never
// reach the screen as "" or "0".

describe('releaseYear', () => {
  it('takes the year from a full date', () => {
    expect(releaseYear('2024-02-27')).toBe('2024')
  })

  it('returns null for the empty date TMDB sends for an unreleased film', () => {
    expect(releaseYear('')).toBeNull()
  })

  it('returns null for a string too short to hold a year', () => {
    expect(releaseYear('202')).toBeNull()
  })

  it('accepts a bare year, which is the shortest valid input', () => {
    expect(releaseYear('2024')).toBe('2024')
  })
})

describe('ratingLabel', () => {
  it('rounds to one decimal', () => {
    expect(ratingLabel(8.15)).toBe('8.2')
  })

  it('keeps a trailing zero so the width does not jump between cards', () => {
    expect(ratingLabel(8)).toBe('8.0')
  })

  it('returns null for the 0 rating TMDB sends for an unrated film', () => {
    expect(ratingLabel(0)).toBeNull()
  })
})

describe('runtimeLabel', () => {
  it('splits minutes into hours and minutes', () => {
    expect(runtimeLabel(167)).toBe('2h 47m')
  })

  it('drops the hour part under an hour', () => {
    expect(runtimeLabel(48)).toBe('48m')
  })

  it('drops the minute part on an exact hour', () => {
    expect(runtimeLabel(120)).toBe('2h')
  })

  it('returns null for the 0 runtime TMDB sends for a film with no cut yet', () => {
    expect(runtimeLabel(0)).toBeNull()
  })

  // Defensive: TMDB has no negative runtime, but a null mapped through
  // arithmetic could produce one, and "-1m" on screen is worse than no segment.
  it('returns null for a negative runtime', () => {
    expect(runtimeLabel(-5)).toBeNull()
  })
})

describe('metaLine', () => {
  it('joins the rating and the year', () => {
    expect(metaLine(8.1, '2023-07-19')).toBe('★ 8.1 · 2023')
  })

  it('drops the rating when the film is unrated', () => {
    expect(metaLine(0, '2023-07-19')).toBe('2023')
  })

  it('drops the year when the film is unreleased', () => {
    expect(metaLine(8.1, '')).toBe('★ 8.1')
  })

  // Both sentinels at once. This is the case that renders as an empty line if
  // the fallback is ever dropped, which looks like a layout bug, not a data gap.
  it('falls back to "Not rated" when both are absent', () => {
    expect(metaLine(0, '')).toBe('Not rated')
  })

  // The runtime is the third segment and optional, because only the detail
  // endpoint sends it. The cards call this with two arguments.
  it('appends the runtime when one is given', () => {
    expect(metaLine(8.1, '2023-07-19', 181)).toBe('★ 8.1 · 2023 · 3h 1m')
  })

  it('omits the runtime when the caller passes none', () => {
    expect(metaLine(8.1, '2023-07-19')).toBe('★ 8.1 · 2023')
  })

  it('drops the runtime segment for a film with no runtime', () => {
    expect(metaLine(8.1, '2023-07-19', 0)).toBe('★ 8.1 · 2023')
  })

  // The runtime alone still carries the line, so a film with no rating and no
  // date does not fall back to "Not rated" when it does have a length.
  it('reports the runtime alone when the other two are absent', () => {
    expect(metaLine(0, '', 95)).toBe('1h 35m')
  })
})

/**
 * The detail screen's line. It is `metaLine` without the rating, because that
 * screen sets the rating apart as a badge — see app/movie/[id].tsx.
 */
describe('releaseLine', () => {
  it('joins the year and the runtime', () => {
    expect(releaseLine('2023-07-19', 181)).toBe('2023 · 3h 1m')
  })

  it('drops the runtime for a film with no cut yet', () => {
    expect(releaseLine('2023-07-19', 0)).toBe('2023')
  })

  it('drops the year for an unreleased film', () => {
    expect(releaseLine('', 181)).toBe('3h 1m')
  })

  // Both sentinels at once. The empty string is the signal to the caller that
  // there is no line to draw — a separator on its own would read as a defect.
  it('returns an empty string when the film has neither', () => {
    expect(releaseLine('', 0)).toBe('')
  })

  it('omits the runtime when the caller passes none', () => {
    expect(releaseLine('2023-07-19')).toBe('2023')
  })
})

/**
 * The person screen's line. TMDB reports the two dates in four combinations,
 * and each one has to read as a statement about a person rather than as a bare
 * number beside their name.
 */
describe('lifeSpan', () => {
  it('joins the two years for a person who has died', () => {
    expect(lifeSpan('1930-08-25', '2014-08-11')).toBe('1930–2014')
  })

  // The common case: TMDB sends `deathday: null` for a living person, which
  // lib/api.ts maps to the empty sentinel.
  it('names the birth year alone for a living person', () => {
    expect(lifeSpan('1995-12-27', '')).toBe('Born 1995')
  })

  /**
   * TMDB holds a death date for some people whose birth date it does not know,
   * which is common for an early performer. The word is what keeps that year
   * from reading as a year of birth.
   */
  it('names the death year alone when the birth date is unknown', () => {
    expect(lifeSpan('', '1968-03-04')).toBe('Died 1968')
  })

  // The empty string is the signal to the caller that there is no line to
  // draw. A separator or a stray dash on its own would read as a defect.
  it('returns an empty string when neither date is known', () => {
    expect(lifeSpan('', '')).toBe('')
  })
})
