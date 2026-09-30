import { backdropUrl, posterUrl, profileUrl } from './images'
import { prerenderedGenres } from './prerender'
import { SITE_URL, genreUrl, movieUrl, personUrl, shareTitle } from './share'
import type { MovieDetail, PersonDetail } from './types'

/**
 * What one screen puts in the document head. See components/PageHead.web.tsx.
 *
 * `title` is the page name without the site name: the tab title adds
 * ` · Reelist`, and the Open Graph title does not, because the card shows the
 * site name on a line of its own. A page with no `url` gets no canonical link
 * and no share card. That is correct for a `noindex` overlay, which has no
 * address of its own that a crawler must keep.
 */
export type PageMeta = {
  title: string
  description?: string
  url?: string
  image?: string | null
  type?: 'website' | 'video.movie' | 'profile'
  noindex?: boolean
}

/** The longest description a search result shows before it cuts the text. */
export const DESCRIPTION_LIMIT = 160

export const clipDescription = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= DESCRIPTION_LIMIT) return flat
  return `${flat.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
}

export const documentTitle = (title: string) => `${title} · Reelist`

export const homeMeta: PageMeta = {
  title: 'Trending and popular films',
  description:
    'Find the films trending this week, the most popular films, and the top rated films. See the cast, the trailer, and where to watch each one.',
  url: `${SITE_URL}/`,
  type: 'website',
}

export const movieMeta = (movie: MovieDetail): PageMeta => ({
  title: shareTitle(movie),
  description: clipDescription(
    movie.overview || movie.tagline || `${movie.title} on Reelist.`,
  ),
  url: movieUrl(movie.id),
  image: backdropUrl(movie.backdrop_path) ?? posterUrl(movie.poster_path, 'w500'),
  type: 'video.movie',
})

export const personMeta = (person: PersonDetail): PageMeta => ({
  title: person.name,
  description: clipDescription(
    person.biography || `The films of ${person.name}, with a biography, on Reelist.`,
  ),
  url: personUrl(person.id),
  image: profileUrl(person.profile_path, 'h632'),
  type: 'profile',
})

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
})
