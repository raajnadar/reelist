import {
  clipDescription,
  DESCRIPTION_LIMIT,
  documentTitle,
  genreMeta,
  homeMeta,
  movieMeta,
  personMeta,
} from './head'
import { mockMovieDetail, mockPerson } from './mock'
import { genreUrl, movieUrl, personUrl, SITE_URL } from './share'

describe('clipDescription', () => {
  it('keeps a short text as it is', () => {
    expect(clipDescription('A short line.')).toBe('A short line.')
  })

  it('cuts a long text to the limit and ends it with an ellipsis', () => {
    const clipped = clipDescription('word '.repeat(100))
    expect(clipped).toHaveLength(DESCRIPTION_LIMIT)
    expect(clipped.endsWith('…')).toBe(true)
  })

  it('folds line breaks into single spaces', () => {
    expect(clipDescription('One.\n\nTwo.')).toBe('One. Two.')
  })
})

it('adds the site name to the tab title only', () => {
  expect(documentTitle('Search')).toBe('Search · Reelist')
})

it('gives the home page a description and a canonical link', () => {
  expect(homeMeta.url).toBe(`${SITE_URL}/`)
  expect(homeMeta.description?.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT)
})

describe('movieMeta', () => {
  it('names the film and the year, and links the film page', () => {
    const meta = movieMeta(mockMovieDetail)
    expect(meta.title).toBe('Dune: Part Two (2024)')
    expect(meta.url).toBe(movieUrl(mockMovieDetail.id))
    expect(meta.type).toBe('video.movie')
  })

  it('falls back to the tagline, then to the title', () => {
    expect(movieMeta({ ...mockMovieDetail, overview: '' }).description).toBe(
      mockMovieDetail.tagline,
    )
    expect(movieMeta({ ...mockMovieDetail, overview: '', tagline: '' }).description).toBe(
      `${mockMovieDetail.title} on Reelist.`,
    )
  })
})

describe('personMeta', () => {
  it('names the person, links the person page, and shows the photo', () => {
    const meta = personMeta(mockPerson)
    expect(meta.title).toBe(mockPerson.name)
    expect(meta.url).toBe(personUrl(mockPerson.id))
    expect(meta.image).toContain('/h632/')
    expect(meta.type).toBe('profile')
  })

  it('writes a description when TMDB has no biography', () => {
    expect(personMeta({ ...mockPerson, biography: '' }).description).toContain(
      mockPerson.name,
    )
  })

  it('has no image when the person has no photo', () => {
    expect(personMeta({ ...mockPerson, profile_path: null }).image).toBeNull()
  })
})

it('names the genre and links the address the chips link to', () => {
  const meta = genreMeta(878, 'Science Fiction')
  expect(meta.title).toBe('Science Fiction films')
  expect(meta.url).toBe(genreUrl({ id: 878, name: 'Science Fiction' }))
  expect(meta.url).toContain('?name=Science%20Fiction')
})
