import { genreMeta, homeMeta, movieMeta, personMeta } from './head'
import { mockMovieDetail, mockPerson } from './mock'
import { genreUrl, movieUrl, personUrl, SITE_URL } from './share'
import { site } from './site'

it('adds the site name to the tab title only', () => {
  expect(site.titleTemplate('Search')).toBe('Search · Reelist')
})

it('gives the home page a description and a canonical link', () => {
  expect(homeMeta.url).toBe(`${SITE_URL}/`)
  expect(homeMeta.description?.length).toBeLessThanOrEqual(site.descriptionLimit)
})

it('describes the site with a search box that opens the search sheet', () => {
  expect(homeMeta.jsonLd?.[0]).toMatchObject({
    '@type': 'WebSite',
    potentialAction: {
      '@type': 'SearchAction',
      target: { urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    },
  })
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

  it('sizes the share image by the TMDB ratio of the artwork it uses', () => {
    expect(movieMeta(mockMovieDetail).imageSize).toEqual({ width: 780, height: 439 })
    expect(movieMeta({ ...mockMovieDetail, backdrop_path: null }).imageSize).toEqual({
      width: 500,
      height: 750,
    })
  })

  it('describes the film as a schema.org Movie with its cast and rating', () => {
    const [movie, breadcrumbs] = movieMeta(mockMovieDetail).jsonLd ?? []
    expect(movie).toMatchObject({
      '@type': 'Movie',
      name: mockMovieDetail.title,
      url: movieUrl(mockMovieDetail.id),
      datePublished: mockMovieDetail.release_date,
      genre: ['Science Fiction', 'Adventure'],
      duration: 'PT2H47M',
      aggregateRating: {
        ratingValue: mockMovieDetail.vote_average,
        ratingCount: mockMovieDetail.vote_count,
        bestRating: 10,
        worstRating: 0,
      },
    })
    expect(movie?.actor).toHaveLength(mockMovieDetail.cast.length)
    expect(breadcrumbs).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Reelist' },
        { position: 2, name: 'Science Fiction' },
        { position: 3, name: mockMovieDetail.title },
      ],
    })
  })

  it('leaves out the rating, the cast, and the duration when the film has none', () => {
    const [movie] =
      movieMeta({ ...mockMovieDetail, vote_count: 0, cast: [], runtime: 0 }).jsonLd ?? []
    expect(movie).not.toHaveProperty('aggregateRating')
    expect(movie).not.toHaveProperty('actor')
    expect(movie).not.toHaveProperty('duration')
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

  it('describes the person as a schema.org Person', () => {
    const [person] = personMeta(mockPerson).jsonLd ?? []
    expect(person).toMatchObject({
      '@type': 'Person',
      name: mockPerson.name,
      url: personUrl(mockPerson.id),
      birthDate: mockPerson.birthday,
    })
    expect(person).not.toHaveProperty('deathDate')
  })
})

it('names the genre and links the address the chips link to', () => {
  const meta = genreMeta(878, 'Science Fiction')
  expect(meta.title).toBe('Science Fiction films')
  expect(meta.url).toBe(genreUrl({ id: 878, name: 'Science Fiction' }))
  expect(meta.url).toContain('?name=Science%20Fiction')
})
