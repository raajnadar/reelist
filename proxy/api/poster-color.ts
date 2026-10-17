/**
 * The main colour of a film poster.
 *
 * The film page takes its theme from this colour. The app cannot read the
 * pixels of an image without a native module, and a native module cannot
 * reach the store build by EAS Update, so this function reads them instead.
 *
 *   GET /api/poster-color?poster=/abc123.jpg  ->  { "color": "#1e3a8a" }
 *
 * `color` is null for a poster with no colour to use, such as a black and
 * white one. The app then keeps its own theme.
 *
 * The colour comes from the same two steps Android uses to take a theme from a
 * wallpaper: the Celebi quantizer finds the main colours, and the scorer ranks
 * them for use in a theme.
 */

import {
  QuantizerCelebi,
  Score,
  argbFromRgb,
  hexFromArgb,
} from '@material/material-color-utilities'
import { decode } from 'jpeg-js'
import { check as checkRateLimit } from './rate-limit'

export const config = { runtime: 'edge' }

/**
 * The smallest poster TMDB serves: 92 by 138 pixels, about 6 KB.
 *
 * Android scales a wallpaper down to 112 by 112 pixels before it quantizes it,
 * and this poster has almost the same number of pixels. In a test of 40
 * posters, the w185 size took three times as long to decode and score.
 */
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w92'

/**
 * A TMDB poster path: one slash, letters and digits, and `.jpg`.
 *
 * The function fetches only from the TMDB image host, so a bad path cannot
 * reach another site. The check stops a path that climbs out of the poster
 * folder, and keeps each cache entry to one real poster.
 */
const POSTER_PATH = /^\/[A-Za-z0-9]{1,64}\.jpg$/

/** The most colours the quantizer keeps. Android uses the same number. */
const MAX_COLORS = 128

/**
 * The value the scorer returns when no colour in the poster is good for a
 * theme. A decoded pixel is always opaque, and this value has an alpha of 0,
 * so no real colour can be equal to it.
 */
const NO_COLOR = 0

/**
 * A poster path names one image forever: TMDB gives a new poster a new path.
 * So the answer never changes, and one copy serves every reader for a year.
 * `s-maxage` keeps it in the Vercel cache, and `max-age` in the browser.
 */
const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable'

/** How long the poster request can take before the function stops it. */
const POSTER_TIMEOUT_MS = 5000

const json = (body: unknown, status: number, cache?: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      ...(cache ? { 'cache-control': cache } : {}),
    },
  })

/**
 * The seed colour of an image, from its pixels as RGBA bytes, or null when no
 * colour in it is good for a theme.
 *
 * The scorer drops a colour with too little chroma, or a hue that too few
 * pixels share. A grey poster loses every colour that way.
 */
export function seedFromPixels(rgba: Uint8Array): string | null {
  const pixels: number[] = []
  for (let i = 0; i < rgba.length; i += 4) {
    pixels.push(argbFromRgb(rgba[i], rgba[i + 1], rgba[i + 2]))
  }

  const [best] = Score.score(QuantizerCelebi.quantize(pixels, MAX_COLORS), {
    desired: 1,
    fallbackColorARGB: NO_COLOR,
    filter: true,
  })

  return best === NO_COLOR ? null : hexFromArgb(best)
}

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

  const poster = new URL(request.url).searchParams.get('poster')
  if (!poster || !POSTER_PATH.test(poster)) {
    return json(
      { status_message: 'The poster parameter is not a TMDB poster path.' },
      400,
    )
  }

  // Counted for the same reason as in ./tmdb: from here on the request costs
  // an upstream fetch. A cached answer never runs this function.
  const limit = await checkRateLimit(request)
  if (!limit.ok) {
    return new Response(
      JSON.stringify({ status_message: 'Too many requests. Please slow down.' }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          ...(limit.retryAfter ? { 'retry-after': String(limit.retryAfter) } : {}),
        },
      },
    )
  }

  let response: Response
  try {
    response = await fetch(POSTER_BASE_URL + poster, {
      signal: AbortSignal.timeout(POSTER_TIMEOUT_MS),
    })
  } catch {
    return json({ status_message: 'Could not reach the TMDB image host.' }, 502)
  }

  // Not cached. A path can name a poster that TMDB has not published yet.
  if (response.status === 404) {
    return json({ status_message: 'TMDB has no poster at that path.' }, 404)
  }
  if (!response.ok) {
    return json({ status_message: 'The TMDB image host refused the request.' }, 502)
  }

  let color: string | null
  try {
    const { data } = decode(new Uint8Array(await response.arrayBuffer()), {
      useTArray: true,
      formatAsRGBA: true,
      // A w92 poster is 0.013 megapixels. The limits stop a wrong file from
      // using the memory of the function.
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 16,
    })
    color = seedFromPixels(data)
  } catch {
    return json({ status_message: 'Could not read the poster.' }, 502)
  }

  return json({ color }, 200, CACHE_CONTROL)
}
