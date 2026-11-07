import { Platform, Share } from 'react-native'
import { ratingLabel, releaseYear, runtimeLabel } from './format'
import { SITE_URL } from './site'
import type { Movie, MovieDetail } from './types'

/** The canonical web page for one film. */
export const movieUrl = (id: number) => `${SITE_URL}/movie/${id}`

/** The canonical web page for one person. */
export const personUrl = (id: number) => `${SITE_URL}/person/${id}`

/** The canonical web page for one franchise. */
export const collectionUrl = (id: number) => `${SITE_URL}/collection/${id}`

/**
 * The canonical web page for one genre, with no query. The export writes the
 * name into each genre page. The genre chips still add `?name=`, so an in-app
 * visit shows the name before any data loads.
 */
export const genreUrl = (id: number) => `${SITE_URL}/genre/${id}`

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
 * What the reader has done with the film. The share text says so, because a
 * film a friend watched or kept is a stronger lead than a film they found.
 */
export type ShareState = { saved?: boolean; watched?: boolean }

/**
 * The film a share can describe. The three detail fields are optional, because
 * the menu of a card has only a list `Movie` until the film loads, and a share
 * from there drops the lines that need them.
 */
export type ShareFilm = Pick<Movie, 'id' | 'title' | 'release_date' | 'vote_average'> &
  Partial<Pick<MovieDetail, 'genres' | 'runtime' | 'tagline'>>

/**
 * The lines that promote the app, by state. The link follows each one. Two or
 * three per state, so a reader who shares often does not send the same
 * line every time. The film id picks one, so the same film always reads the
 * same, and so a test can assert the text.
 */
const NOTES: Record<'watched' | 'saved' | 'found', readonly string[]> = {
  watched: [
    'I watched this on Reelist. Your turn:',
    'Watched, and marked off on Reelist. See what you think:',
  ],
  saved: [
    'On my Reelist watchlist. Trailers, cast, and more:',
    'Kept on Reelist for the next movie night:',
    'Saved this one on Reelist. Watch it with me?',
  ],
  found: [
    'Found this on Reelist, a free movie tracker:',
    'Spotted on Reelist. Trailer, cast, and where to watch:',
    'Reelist put this on my radar:',
  ],
}

/**
 * The line that promotes the app in a share, chosen by what the reader did
 * with the film. A watched film outranks a saved one: a watched film is in the
 * watchlist too, and "watched" is the stronger claim.
 */
export const shareNote = (id: number, state: ShareState = {}) => {
  const lines = NOTES[state.watched ? 'watched' : state.saved ? 'saved' : 'found']
  return lines[Math.abs(id) % lines.length]
}

/**
 * The share text, without the link. The caller puts the link where the
 * platform reads it: a field of its own on iOS and the web, the last line on
 * Android and in an email.
 *
 * ```
 * 🎬 Dune: Part Two (2024)
 * ★ 8.2 · 2h 47m · Science Fiction, Adventure
 * "Long live the fighters."
 *
 * On my Reelist watchlist. Trailers, cast, and more:
 * ```
 *
 * The link unfurls with the poster and the overview, so the text does not
 * describe the film. It gives the facts a card does not show at a glance, and
 * the note that names the app. Each line is dropped when its facts are absent,
 * so an announced film with no rating, no cut, and no tagline sends the title
 * and the note.
 */
export const shareMessage = (movie: ShareFilm, state: ShareState = {}) => {
  const rating = ratingLabel(movie.vote_average)
  const length = runtimeLabel(movie.runtime ?? 0)
  const genres = movie.genres?.map((g) => g.name).join(', ')
  const facts = [rating ? `★ ${rating}` : null, length, genres || null].filter(Boolean)
  const lines = [
    `🎬 ${shareTitle(movie)}`,
    facts.length ? facts.join(' · ') : null,
    movie.tagline ? `"${movie.tagline}"` : null,
    '',
    shareNote(movie.id, state),
  ]
  return lines.filter((line) => line !== null).join('\n')
}

/**
 * Puts the whole share text on the clipboard, link included, for a paste into
 * a chat or a post. False when the browser refuses.
 */
export const copyShareMessage = (movie: ShareFilm, state: ShareState = {}) =>
  copyToClipboard(`${shareMessage(movie, state)}\n${movieUrl(movie.id)}`)

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
export const shareTargets = (movie: ShareFilm, state: ShareState = {}): ShareTarget[] => {
  const url = movieUrl(movie.id)
  const title = shareTitle(movie)
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  // X has a 280 character limit and shows the link as a card of its own, so
  // it gets the title, the tagline, and the app name, not the whole message.
  const post = [title, movie.tagline ? `"${movie.tagline}"` : null, 'via Reelist']
    .filter(Boolean)
    .join('\n')

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
      url: `https://x.com/intent/post?text=${encodeURIComponent(post)}&url=${u}`,
    },
    {
      id: 'email',
      label: 'Email',
      icon: 'email-outline',
      url: `mailto:?subject=${t}&body=${encodeURIComponent(`${shareMessage(movie, state)}\n${url}`)}`,
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
  movie: ShareFilm,
  state: ShareState = {},
): Promise<ShareOutcome> {
  const url = movieUrl(movie.id)
  const title = shareTitle(movie)
  const message = shareMessage(movie, state)
  const content =
    Platform.OS === 'android' ? { message: `${message}\n${url}` } : { message, url }

  try {
    const result = await Share.share(content, { dialogTitle: title, subject: title })
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared'
  } catch {
    return (await copyToClipboard(url)) ? 'copied' : 'failed'
  }
}
