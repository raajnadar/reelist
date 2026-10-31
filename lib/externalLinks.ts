import type { MovieDetail } from './types'

/**
 * One link off the site: the label the button prints, its icon, and where it
 * goes. `icon` is a Material Design Icons name.
 */
export type ExternalLink = {
  id: 'imdb' | 'homepage'
  label: string
  icon: string
  url: string
}

/** The IMDb title page for one `tt` id. */
export const imdbUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`

/**
 * The links the film page offers, in the order it prints them. Each one is
 * absent when TMDB holds no value for it, so a film with neither gets an
 * empty list and the section draws nothing.
 *
 * A homepage that is not `http` or `https` is dropped. TMDB holds a few typed
 * by hand, and a `javascript:` or a bare host would open nothing or worse.
 */
export const externalLinks = (
  movie: Pick<MovieDetail, 'imdb_id' | 'homepage'>,
): ExternalLink[] => {
  const links: ExternalLink[] = []
  if (/^tt\d+$/.test(movie.imdb_id)) {
    links.push({
      id: 'imdb',
      label: 'IMDb',
      icon: 'movie-open-outline',
      url: imdbUrl(movie.imdb_id),
    })
  }
  if (/^https?:\/\//i.test(movie.homepage)) {
    links.push({
      id: 'homepage',
      label: 'Official site',
      icon: 'web',
      url: movie.homepage,
    })
  }
  return links
}
