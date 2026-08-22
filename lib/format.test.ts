import { metaLine, ratingLabel, releaseYear, runtimeLabel } from './format'

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
