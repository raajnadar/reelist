import { Platform, Share } from 'react-native'
import { releaseYear } from './format'
import type { Movie } from './types'

/**
 * The public address of the web build, with no trailing slash.
 *
 * A shared link points here on every platform, not at the `reelist://` scheme.
 * A web link opens for a reader who does not have the app, and the same page
 * carries the meta tags a crawler reads. The scheme link does neither.
 */
export const SITE_URL = 'https://raajnadar.github.io/reelist'

/** The canonical web page for one film. */
export const movieUrl = (id: number) => `${SITE_URL}/movie/${id}`

/** The canonical web page for one person. */
export const personUrl = (id: number) => `${SITE_URL}/person/${id}`

/**
 * The canonical web page for one genre. It keeps the name in the query, the
 * same as the genre chips, so the two agree.
 */
export const genreUrl = (genre: { id: number; name: string }) =>
  `${SITE_URL}/genre/${genre.id}?name=${encodeURIComponent(genre.name)}`

/**
 * The `hrefAttrs` of a link to another site, for a component inside
 * `<Link asChild>`. The web opens it in a new tab, as `Linking.openURL` did.
 * Native ignores it.
 */
export const NEW_TAB = { target: '_blank', rel: 'noopener' }

/**
 * The line that names the film in a share: `Dune: Part Two (2024)`.
 *
 * The year is dropped for an announced film with no date, which TMDB sends
 * as an empty `release_date`.
 */
export const shareTitle = (movie: Pick<Movie, 'title' | 'release_date'>) => {
  const year = releaseYear(movie.release_date)
  return year ? `${movie.title} (${year})` : movie.title
}

/**
 * How a share ended, so the caller can tell the reader what happened.
 *
 * `copied` is the web fallback: a browser without the Web Share API gets the
 * link on the clipboard instead. `dismissed` is iOS only, where the sheet
 * reports a cancel. `failed` covers a browser with neither API and a native
 * sheet that threw.
 */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed'

/**
 * Whether the browser has the Web Share API.
 *
 * Every phone browser has it. On a desktop, Chrome and Safari have it and
 * Firefox does not, so the web offers the list of targets below as well.
 */
export const hasShareSheet = () => typeof globalThis.navigator?.share === 'function'

/** Puts the film's link on the clipboard. False when the browser refuses. */
export const copyMovieLink = (movie: Pick<Movie, 'id'>) =>
  copyToClipboard(movieUrl(movie.id))

/**
 * One place the web can send a link to without the system sheet.
 *
 * `icon` is a Material Design Icons name, and `url` is the site's share
 * intent, which opens in a new tab with the film filled in.
 */
export type ShareTarget = { id: string; label: string; icon: string; url: string }

/**
 * The places the web menu lists, in the order they appear.
 *
 * Each one is a plain link into the site's own share page, so no SDK and no
 * script from the site is loaded. The set is the one IMDb offers: Facebook,
 * X, and email, beside the copy link that is in the menu itself.
 */
export const shareTargets = (
  movie: Pick<Movie, 'id' | 'title' | 'release_date'>,
): ShareTarget[] => {
  const url = movieUrl(movie.id)
  const title = shareTitle(movie)
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)

  return [
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'facebook',
      url: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      id: 'x',
      label: 'X',
      icon: 'twitter',
      url: `https://x.com/intent/post?text=${t}&url=${u}`,
    },
    {
      id: 'email',
      label: 'Email',
      icon: 'email-outline',
      url: `mailto:?subject=${t}&body=${encodeURIComponent(`${title}\n${url}`)}`,
    },
  ]
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard?.writeText) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Opens the system share sheet for one film.
 *
 * On the web this is the browser's sheet, and the button falls back to the
 * clipboard when the browser has none. components/ShareButton.web.tsx offers
 * the menu of targets beside it.
 *
 * The URL travels in the `url` field on iOS and the web, where the sheet reads
 * it. Android reads only `message`, so the link is appended there.
 */
export async function shareMovie(
  movie: Pick<Movie, 'id' | 'title' | 'release_date'>,
): Promise<ShareOutcome> {
  const url = movieUrl(movie.id)
  const title = shareTitle(movie)
  const content =
    Platform.OS === 'android' ? { message: `${title}\n${url}` } : { message: title, url }

  try {
    const result = await Share.share(content, { dialogTitle: title, subject: title })
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared'
  } catch {
    return (await copyToClipboard(url)) ? 'copied' : 'failed'
  }
}
