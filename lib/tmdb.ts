import { requireProxyUrl } from './config'

/**
 * The HTTP layer. `lib/api.ts` is the seam the screens import; this file is the
 * transport underneath it, so a screen never builds a URL or reads a status.
 *
 * Requests go to the proxy, not to TMDB. The proxy adds the key. See
 * lib/config.ts for why the key cannot live in the app.
 */

/** A failed request that is not a setup mistake: a bad status, or no network. */
export class TmdbError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TmdbError'
    this.status = status
  }
}

/**
 * TMDB answers an error with a JSON body that explains it far better than the
 * status line does, and the proxy passes that body through. `status_message` is
 * the field worth showing.
 */
const errorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { status_message?: string }
    if (body.status_message) return body.status_message
  } catch {
    // A non-JSON error body is possible: a gateway can answer with HTML. Fall
    // through to the status line rather than fail while reporting a failure.
  }
  return `The request failed with status ${response.status}`
}

export const tmdbFetch = async <T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> => {
  // requireProxyUrl throws MissingProxyUrlError, which is deliberately not
  // caught here. A setup mistake must not be reported as a network failure.
  const url = new URL(requireProxyUrl())
  // The TMDB path travels as a parameter. The proxy checks it against a fixed
  // list before it forwards anything.
  url.searchParams.set('path', path)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  let response: Response
  try {
    response = await fetch(url.toString())
  } catch {
    // fetch rejects only when the request never completed: no network, DNS
    // failure, or a dropped connection. There is no status to report.
    throw new TmdbError('Could not reach the server. Check your connection.')
  }

  if (!response.ok) {
    throw new TmdbError(await errorMessage(response), response.status)
  }

  return (await response.json()) as T
}

/**
 * How long the film page waits for the poster colour.
 *
 * The colour arrives after the film, and the page keeps its skeleton until
 * both are in. A colour that is later than this is dropped, and the page keeps
 * the app colours. A late colour would repaint a page that the reader already
 * reads.
 */
const POSTER_COLOR_TIMEOUT_MS = 1200

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * The main colour of a poster, from the proxy, or null.
 *
 * The proxy has a second route beside the TMDB one: `.../api/tmdb` becomes
 * `.../api/poster-color`. The path is built as a string, because the React
 * Native `URL` adds a relative path to the end of the base instead of
 * replacing its last segment.
 *
 * It never throws. The colour is decoration: a film page in the app colours is
 * correct, so a failure here must not fail the film.
 */
export const fetchPosterColor = async (posterPath: string): Promise<string | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POSTER_COLOR_TIMEOUT_MS)

  try {
    const url = new URL(requireProxyUrl().replace(/\/[^/]*$/, '/poster-color'))
    url.searchParams.set('poster', posterPath)

    const response = await fetch(url.toString(), { signal: controller.signal })
    if (!response.ok) return null

    const { color } = (await response.json()) as { color?: unknown }
    return typeof color === 'string' && HEX_COLOR.test(color) ? color : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
