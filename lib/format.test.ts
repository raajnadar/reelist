import { metaLine, ratingLabel, releaseYear } from './format'

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
})
