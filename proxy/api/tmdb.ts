/**
 * The TMDB proxy.
 *
 * The app calls this function; this function calls TMDB. The key is read from
 * the server environment and never leaves it, which is the whole point: a key
 * shipped inside a mobile or web bundle can always be extracted from it, so the
 * only way to keep this one private is to keep it off the device.
 *
 * The app sends the TMDB path as `?path=/movie/popular`. This function checks
 * that path against a fixed list, adds the key, and returns what TMDB answers.
 */

// The edge runtime, declared in the file rather than in vercel.json, which is
// where Vercel reads it from. It starts with no cold delay and is enough for a
// function that only forwards a request.
export const config = { runtime: 'edge' }

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

/**
 * Only these paths are forwarded. Without this list the endpoint is an open
 * TMDB relay: anyone who finds the URL gets unmetered use of the key, and the
 * abuse is billed to this project's rate limit rather than theirs.
 *
 * `/movie/{id}` is matched by a pattern because the id is unbounded. The
 * pattern requires digits, so `/movie/../account` cannot pass through it.
 */
const ALLOWED_EXACT = new Set([
  '/trending/movie/week',
  '/movie/popular',
  '/movie/top_rated',
  '/search/movie',
])

const ALLOWED_PATTERNS = [/^\/movie\/\d+$/]

const isAllowed = (path: string): boolean =>
  ALLOWED_EXACT.has(path) || ALLOWED_PATTERNS.some((p) => p.test(path))

/**
 * Only these query parameters reach TMDB. An unknown parameter is dropped
 * rather than forwarded, so a caller cannot append `api_key` of their own or
 * reach a TMDB feature this app does not use.
 */
const ALLOWED_PARAMS = new Set(['query', 'page'])

/**
 * How long a response stays cached, in seconds.
 *
 * `s-maxage` caches on Vercel's edge, not in the browser, so one cached copy
 * serves every user. Trending and the film lists change daily at most, so 10
 * minutes is conservative and cuts the request count sharply.
 *
 * `stale-while-revalidate` keeps serving the old copy while a new one is
 * fetched, so a cache miss never makes a user wait.
 */
const CACHE_CONTROL = 's-maxage=600, stale-while-revalidate=3600'

const json = (body: unknown, status: number, cache?: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // The app runs on a different origin in the browser, so the web build
      // needs CORS. The native builds ignore it.
      'access-control-allow-origin': '*',
      ...(cache ? { 'cache-control': cache } : {}),
    },
  })

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
      },
    })
  }

  if (request.method !== 'GET') {
    return json({ status_message: 'Method not allowed.' }, 405)
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    // A configuration mistake on the server. The client is told the service is
    // unavailable and not why, because the reason is not the caller's business.
    console.error('TMDB_API_KEY is not set on the server.')
    return json({ status_message: 'The service is not configured.' }, 500)
  }

  const path = new URL(request.url).searchParams.get('path')
  if (!path) {
    return json({ status_message: 'Missing the path parameter.' }, 400)
  }

  if (!isAllowed(path)) {
    return json({ status_message: 'That path is not available.' }, 403)
  }

  const upstream = new URL(TMDB_BASE_URL + path)
  for (const [key, value] of new URL(request.url).searchParams) {
    if (ALLOWED_PARAMS.has(key)) upstream.searchParams.set(key, value)
  }
  upstream.searchParams.set('api_key', apiKey)

  let response: Response
  try {
    response = await fetch(upstream, { headers: { accept: 'application/json' } })
  } catch {
    return json({ status_message: 'Could not reach TMDB.' }, 502)
  }

  const body = await response.text()

  // The upstream status is passed through so the app keeps its own branches:
  // getMovie turns a 404 into null, and the screens report anything else.
  // Only a success is cached — caching an error would pin a transient failure
  // in place for the whole cache window.
  return new Response(body, {
    status: response.status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      ...(response.ok ? { 'cache-control': CACHE_CONTROL } : {}),
    },
  })
}
