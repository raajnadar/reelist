import { backdropUrl, posterUrl, profileUrl } from './images'

// TMDB returns a path fragment, never a URL. The null case is the one that
// matters: a film with no artwork must produce null so the caller can render a
// fallback, not the string "null" as an image source.

describe('posterUrl', () => {
  it('builds a URL at the default size', () => {
    expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg')
  })

  it('uses the size it is given', () => {
    expect(posterUrl('/abc.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/abc.jpg')
  })

  it('returns null when the film has no poster', () => {
    expect(posterUrl(null)).toBeNull()
  })
})

describe('backdropUrl', () => {
  it('builds a URL at the backdrop size', () => {
    expect(backdropUrl('/xyz.jpg')).toBe('https://image.tmdb.org/t/p/w780/xyz.jpg')
  })

  it('returns null when the film has no backdrop', () => {
    expect(backdropUrl(null)).toBeNull()
  })
})

describe('profileUrl', () => {
  it('builds a URL at the default size', () => {
    expect(profileUrl('/face.jpg')).toBe('https://image.tmdb.org/t/p/w185/face.jpg')
  })

  it('uses the size it is given', () => {
    expect(profileUrl('/face.jpg', 'h632')).toBe(
      'https://image.tmdb.org/t/p/h632/face.jpg',
    )
  })

  // The common case for a cast list: TMDB has no photo on file for a person.
  it('returns null when the person has no photo', () => {
    expect(profileUrl(null)).toBeNull()
  })
})
