// Writes lib/prerender.json: the films the web export renders a static page
// for, the three home rows, and the genre chips. The deploy runs this before
// `expo export`. The shape is `PrerenderSeed` in lib/prerender.ts, and the two
// must stay in step.
//
// The films are the three home lists: trending, popular, and top rated. Those
// are the films a reader is most likely to search for, and the set is small
// enough to fetch on every deploy. Each film is trimmed to the fields the
// static HTML needs.
//
// The requests go through the proxy, the same as the app. The proxy allows 30
// requests per minute from one address, so the script paces itself under that
// limit rather than failing halfway with a 429.
//
// Each film also gets the main colour of its poster, from the proxy route
// beside the TMDB one. The static page then draws in the film colours from its
// first frame. A colour that fails leaves that film in the app colours, and
// does not stop the deploy.
//
// The script runs on plain Node. It does not import lib/api.ts, because Node
// cannot resolve that file's extensionless imports without a bundler. The
// field mapping below repeats `toMovie` from lib/api.ts for that reason.
const fs = require('node:fs')
const path = require('node:path')

const OUTPUT = path.join(__dirname, '..', 'lib', 'prerender.json')
const LISTS = {
  trending: '/trending/movie/week',
  popular: '/movie/popular',
  topRated: '/movie/top_rated',
}
const REQUEST_GAP_MS = 2200

const proxyUrl = (process.env.EXPO_PUBLIC_TMDB_PROXY_URL ?? '').replace(/\/$/, '')

if (!proxyUrl) {
  console.error(
    'No TMDB proxy URL. Set EXPO_PUBLIC_TMDB_PROXY_URL, then run this script again.',
  )
  process.exit(1)
}

// `.../api/tmdb` becomes `.../api/poster-color`, as in lib/tmdb.ts.
const colorUrl = proxyUrl.replace(/\/[^/]*$/, '/poster-color')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** The response to `url`. A 429 waits for the window, up to three times. */
async function fetchPaced(url, label) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url)
    if (response.status !== 429) return response
    // The proxy names the seconds until the window resets in `Retry-After`.
    const retryAfter = Number(response.headers.get('retry-after') ?? '60')
    console.log(`Rate limited on ${label}. Waiting ${retryAfter} s.`)
    await sleep(retryAfter * 1000)
  }
  throw new Error(`${label} stayed rate limited after three attempts`)
}

async function fetchTmdb(tmdbPath) {
  const url = new URL(proxyUrl)
  url.searchParams.set('path', tmdbPath)

  const response = await fetchPaced(url, tmdbPath)
  if (!response.ok) {
    throw new Error(`${tmdbPath} failed with status ${response.status}`)
  }
  return response.json()
}

/**
 * The poster colour of one film, or null.
 *
 * The answer for a poster never changes, so the Vercel cache keeps it for a
 * year. A cached answer does not run the function and costs nothing against
 * the rate limit, so the pause after it is skipped. That makes a deploy after
 * the first one almost as fast as before the colour existed.
 */
async function fetchPosterColor(posterPath) {
  if (!posterPath) return null

  const url = new URL(colorUrl)
  url.searchParams.set('poster', posterPath)

  try {
    const response = await fetchPaced(url, `the colour of ${posterPath}`)
    if (response.headers.get('x-vercel-cache') !== 'HIT') await sleep(REQUEST_GAP_MS)
    if (!response.ok) return null
    const { color } = await response.json()
    return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : null
  } catch (error) {
    console.log(`No colour for ${posterPath}: ${error.message}`)
    return null
  }
}

const toEntry = (raw, posterColor) => ({
  id: raw.id,
  title: raw.title ?? '',
  poster_path: raw.poster_path ?? null,
  backdrop_path: raw.backdrop_path ?? null,
  vote_average: raw.vote_average ?? 0,
  release_date: raw.release_date ?? '',
  overview: raw.overview ?? '',
  genres: (raw.genres ?? []).map((g) => ({ id: g.id, name: g.name })),
  runtime: raw.runtime ?? 0,
  tagline: raw.tagline ?? '',
  vote_count: raw.vote_count ?? 0,
  poster_color: posterColor,
})

async function main() {
  const lists = {}
  for (const [name, tmdbPath] of Object.entries(LISTS)) {
    const page = await fetchTmdb(tmdbPath)
    lists[name] = (page.results ?? []).map((film) => film.id)
    await sleep(REQUEST_GAP_MS)
  }

  const genreList = await fetchTmdb('/genre/movie/list')
  const genres = (genreList.genres ?? []).map((g) => ({ id: g.id, name: g.name }))
  await sleep(REQUEST_GAP_MS)

  const ids = [...new Set(Object.values(lists).flat())].sort((a, b) => a - b)
  console.log(`Fetching ${ids.length} films.`)

  const movies = {}
  for (const id of ids) {
    const raw = await fetchTmdb(`/movie/${id}`)
    await sleep(REQUEST_GAP_MS)
    movies[id] = toEntry(raw, await fetchPosterColor(raw.poster_path))
  }

  fs.writeFileSync(OUTPUT, JSON.stringify({ movies, lists, genres }, null, 2) + '\n')
  const colored = Object.values(movies).filter((movie) => movie.poster_color).length
  console.log(
    `Wrote ${ids.length} films (${colored} with a poster colour), ${genres.length} genres to ${path.relative(process.cwd(), OUTPUT)}.`,
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
