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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchTmdb(tmdbPath) {
  const url = new URL(proxyUrl)
  url.searchParams.set('path', tmdbPath)

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url)
    if (response.ok) return response.json()
    if (response.status !== 429) {
      throw new Error(`${tmdbPath} failed with status ${response.status}`)
    }
    // The proxy names the seconds until the window resets in `Retry-After`.
    const retryAfter = Number(response.headers.get('retry-after') ?? '60')
    console.log(`Rate limited on ${tmdbPath}. Waiting ${retryAfter} s.`)
    await sleep(retryAfter * 1000)
  }
  throw new Error(`${tmdbPath} stayed rate limited after three attempts`)
}

const toEntry = (raw) => ({
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
    movies[id] = toEntry(await fetchTmdb(`/movie/${id}`))
    await sleep(REQUEST_GAP_MS)
  }

  fs.writeFileSync(OUTPUT, JSON.stringify({ movies, lists, genres }, null, 2) + '\n')
  console.log(
    `Wrote ${ids.length} films, ${genres.length} genres to ${path.relative(process.cwd(), OUTPUT)}.`,
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
