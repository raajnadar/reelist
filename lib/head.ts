import type { PageMeta } from '@rootnative/seo'
import {
  breadcrumbList,
  movie as movieSchema,
  person as personSchema,
  webSite,
} from '@rootnative/seo/schema'
import { backdropUrl, posterUrl, profileUrl } from './images'
import { prerenderedGenres } from './prerender'
import { SITE_URL, genreUrl, movieUrl, personUrl, shareTitle } from './share'
import { site } from './site'
import type { MovieDetail, PersonDetail } from './types'

/** The most performers the film's structured data names. */
const ACTOR_LIMIT = 10

/**
 * The sizes of the share images, from the TMDB ratios: a backdrop is 16:9,
 * and a poster or a profile is 2:3. The `w` and `h` sizes fix one side.
 */
const BACKDROP_W780 = { width: 780, height: 439 }
const POSTER_W500 = { width: 500, height: 750 }
const PROFILE_H632 = { width: 421, height: 632 }

const HOME_URL = `${SITE_URL}/`

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
      trail(...(genre ? [{ name: genre.name, url: genreUrl(genre) }] : []), {
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

/**
 * The genre name for an id, from the prerender seed. A genre link from the
 * app carries the name as a parameter, but a link typed or shared without it
 * does not, and the static export renders the page with no query at all.
 */
export const seededGenreName = (id: number) =>
  prerenderedGenres()?.find((genre) => genre.id === id)?.name

export const genreMeta = (id: number, name: string): PageMeta => ({
  title: `${name} films`,
  description: `Browse ${name.toLowerCase()} films on Reelist. Filter them by language, decade, rating, and length.`,
  url: genreUrl({ id, name }),
  type: 'website',
  jsonLd: [trail({ name: `${name} films`, url: genreUrl({ id, name }) })],
})
