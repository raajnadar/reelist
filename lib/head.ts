import { toMetadata, type PageMeta, type PageMetadata } from '@rootnative/seo'
import {
  breadcrumbList,
  movie as movieSchema,
  person as personSchema,
  webSite,
} from '@rootnative/seo/schema'
import {
  BACKDROP_W780,
  POSTER_W500,
  PROFILE_H632,
  backdropUrl,
  posterUrl,
  profileUrl,
} from './images'
import { genreUrl, movieUrl, personUrl, shareTitle } from './share'
import { SITE_URL, site } from './site'
import type { MovieDetail, PersonDetail } from './types'

/** The most performers the film's structured data names. */
const ACTOR_LIMIT = 10

/**
 * The value of the `generateMetadata` export of a route. From Expo SDK 58 the
 * static export writes the head from it, not from `PageHead`. Each route
 * exports it with the same meta its `PageHead` renders, and keeps the
 * `PageHead` for the JSON-LD and for the head after a client navigation.
 */
export const metadataFor = (meta: PageMeta): PageMetadata => toMetadata(site, meta)

/** The head of a screen that a crawler must not index. */
export const noindexMeta = (title: string): PageMeta => ({ title, noindex: true })

const HOME_URL = `${SITE_URL}/`
const PRIVACY_URL = `${SITE_URL}/privacy`

/** The path from the home page to one page, as a search result shows it. */
const trail = (...crumbs: { name: string; url: string }[]) =>
  breadcrumbList([{ name: site.name, url: HOME_URL }, ...crumbs])

export const homeMeta: PageMeta = {
  title: 'Trending and popular films',
  description:
    'Find the films trending this week, the most popular films, and the top rated films. See the cast, the trailer, and where to watch each one.',
  url: HOME_URL,
  type: 'website',
  jsonLd: [
    webSite({
      name: site.name,
      url: HOME_URL,
      searchUrlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    }),
  ],
}

/**
 * Indexed, not `noindex` like the other utility screens: Google Play links to
 * this page, and a reviewer or a reader must be able to find it.
 */
export const privacyMeta: PageMeta = {
  title: 'Privacy policy',
  description:
    'Reelist has no accounts, no ads, and no analytics. Your watchlist stays on your device. This page tells you which services see a request, and why.',
  url: PRIVACY_URL,
  type: 'website',
  jsonLd: [trail({ name: 'Privacy policy', url: PRIVACY_URL })],
}

export const movieMeta = (movie: MovieDetail): PageMeta => {
  const backdrop = backdropUrl(movie.backdrop_path)
  const poster = posterUrl(movie.poster_path, 'w500')
  const genre = movie.genres[0]
  return {
    title: shareTitle(movie),
    description: movie.overview || movie.tagline || `${movie.title} on Reelist.`,
    url: movieUrl(movie.id),
    image: backdrop ?? poster,
    imageSize: backdrop ? BACKDROP_W780 : POSTER_W500,
    type: 'video.movie',
    jsonLd: [
      movieSchema({
        name: movie.title,
        url: movieUrl(movie.id),
        description: movie.overview,
        image: poster ?? undefined,
        datePublished: movie.release_date,
        genre: movie.genres.map((item) => item.name),
        durationMinutes: movie.runtime,
        actors: movie.cast
          .slice(0, ACTOR_LIMIT)
          .map((member) => ({ name: member.name, url: personUrl(member.id) })),
        // TMDB rates from 0 to 10, not on the schema.org default of 1 to 5.
        rating: {
          ratingValue: movie.vote_average,
          ratingCount: movie.vote_count,
          bestRating: 10,
          worstRating: 0,
        },
      }),
      trail(...(genre ? [{ name: genre.name, url: genreUrl(genre.id) }] : []), {
        name: movie.title,
        url: movieUrl(movie.id),
      }),
    ],
  }
}

export const personMeta = (person: PersonDetail): PageMeta => {
  const image = profileUrl(person.profile_path, 'h632')
  return {
    title: person.name,
    description:
      person.biography || `The films of ${person.name}, with a biography, on Reelist.`,
    url: personUrl(person.id),
    image,
    imageSize: PROFILE_H632,
    type: 'profile',
    jsonLd: [
      personSchema({
        name: person.name,
        url: personUrl(person.id),
        description: person.biography,
        image: image ?? undefined,
        birthDate: person.birthday,
        deathDate: person.deathday,
        birthPlace: person.place_of_birth,
        jobTitle: person.known_for_department,
      }),
      trail({ name: person.name, url: personUrl(person.id) }),
    ],
  }
}

export const genreMeta = (id: number, name: string): PageMeta => ({
  title: `${name} films`,
  description: `Browse ${name.toLowerCase()} films on Reelist. Filter them by language, decade, rating, and length.`,
  url: genreUrl(id),
  type: 'website',
  jsonLd: [trail({ name: `${name} films`, url: genreUrl(id) })],
})
