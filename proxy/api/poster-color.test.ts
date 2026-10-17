/**
 * The poster colour route. `fetch` is mocked, so no test here reaches TMDB. The
 * posters are small JPEG files that each test encodes from known pixels.
 *
 * The rate limit is mocked for the reason given in tmdb.test.ts.
 */

jest.mock('./rate-limit', () => ({ check: jest.fn() }))

/* eslint-disable import/first */
import { Hct, argbFromHex } from '@material/material-color-utilities'
import { encode } from 'jpeg-js'
import handler, { seedFromPixels } from './poster-color'
import { check } from './rate-limit'
/* eslint-enable import/first */

const mockRateLimit = check as jest.MockedFunction<typeof check>

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

const WIDTH = 92
const HEIGHT = 138

type Rgb = [number, number, number]

/** RGBA bytes for a poster: the top `share` of the rows in `main`, the rest in `rest`. */
const pixels = (main: Rgb, rest: Rgb, share = 1): Uint8Array<ArrayBuffer> => {
  const data = new Uint8Array(WIDTH * HEIGHT * 4)
  for (let row = 0; row < HEIGHT; row++) {
    const [r, g, b] = row < HEIGHT * share ? main : rest
    for (let col = 0; col < WIDTH; col++) {
      const i = (row * WIDTH + col) * 4
      data.set([r, g, b, 255], i)
    }
  }
  return data
}

const jpegOf = (data: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(encode({ data, width: WIDTH, height: HEIGHT }, 90).data)

const posterResponse = (body: Uint8Array<ArrayBuffer>, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'image/jpeg' } })

const NAVY: Rgb = [0x1e, 0x3a, 0x8a]
const WHITE: Rgb = [0xff, 0xff, 0xff]
const GREY: Rgb = [0x80, 0x80, 0x80]
const BLACK: Rgb = [0x10, 0x10, 0x10]

const hueOf = (hex: string) => Hct.fromInt(argbFromHex(hex)).hue

const get = (query: string, method = 'GET') =>
  handler(new Request(`https://proxy.example.com/api/poster-color?${query}`, { method }))

beforeEach(() => {
  mockRateLimit.mockReset()
  mockRateLimit.mockResolvedValue({ ok: true })
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(posterResponse(jpegOf(pixels(NAVY, WHITE, 0.6))))
})

describe('seedFromPixels', () => {
  it('returns the colour of a poster in one colour', () => {
    expect(seedFromPixels(pixels(NAVY, NAVY))).toBe('#1e3a8a')
  })

  // White has no chroma, so the scorer drops it however many pixels it has.
  it('ignores the white part of a poster', () => {
    expect(seedFromPixels(pixels(NAVY, WHITE, 0.2))).toBe('#1e3a8a')
  })

  it('returns null for a poster with no colour', () => {
    expect(seedFromPixels(pixels(GREY, BLACK, 0.5))).toBeNull()
  })
})

describe('the route', () => {
  it('returns the seed of the poster', async () => {
    const response = await get('poster=/kqjL17yufvn9OVLyXYpvtyrFfak.jpg')

    expect(response.status).toBe(200)
    const { color } = await response.json()
    // JPEG moves the bytes a little, so the check is on the hue.
    expect(Math.abs(hueOf(color) - hueOf('#1e3a8a'))).toBeLessThan(5)
  })

  it('asks TMDB for the w92 poster at that path', async () => {
    await get('poster=/kqjL17yufvn9OVLyXYpvtyrFfak.jpg')

    expect(String(mockFetch.mock.calls[0][0])).toBe(
      'https://image.tmdb.org/t/p/w92/kqjL17yufvn9OVLyXYpvtyrFfak.jpg',
    )
  })

  it('answers null for a poster with no colour', async () => {
    mockFetch.mockResolvedValue(posterResponse(jpegOf(pixels(GREY, BLACK, 0.5))))

    const response = await get('poster=/grey.jpg')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ color: null })
  })

  // A path names one poster forever, so the answer can stay in the cache.
  it('caches a colour for a year', async () => {
    const response = await get('poster=/kqjL17yufvn9OVLyXYpvtyrFfak.jpg')

    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, s-maxage=31536000, immutable',
    )
  })

  it('allows the web build to read the answer', async () => {
    const response = await get('poster=/kqjL17yufvn9OVLyXYpvtyrFfak.jpg')

    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('the poster check', () => {
  it.each([
    ['no parameter', ''],
    ['an empty path', 'poster='],
    ['a path that climbs out', `poster=${encodeURIComponent('/../3/movie/550.jpg')}`],
    ['another host', `poster=${encodeURIComponent('//example.com/a.jpg')}`],
    ['a PNG', 'poster=/abc.png'],
    ['no slash', 'poster=abc.jpg'],
  ])('refuses %s', async (_name, query) => {
    const response = await get(query)

    expect(response.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // A refused request reaches nothing upstream, so it costs no allowance.
  it('does not count a refused request', async () => {
    await get('poster=abc.jpg')

    expect(mockRateLimit).not.toHaveBeenCalled()
  })
})

describe('the failures', () => {
  it('passes a 404 on, and does not cache it', async () => {
    mockFetch.mockResolvedValue(posterResponse(new Uint8Array(), 404))

    const response = await get('poster=/missing.jpg')

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBeNull()
  })

  it('answers 502 when the image host fails', async () => {
    mockFetch.mockResolvedValue(posterResponse(new Uint8Array(), 503))

    const response = await get('poster=/abc.jpg')

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBeNull()
  })

  it('answers 502 when the image host cannot be reached', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))

    const response = await get('poster=/abc.jpg')

    expect(response.status).toBe(502)
  })

  it('answers 502 for a file that is not a JPEG', async () => {
    mockFetch.mockResolvedValue(posterResponse(new TextEncoder().encode('<html>')))

    const response = await get('poster=/abc.jpg')

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBeNull()
  })

  it('answers 429 over the rate limit, before it fetches', async () => {
    mockRateLimit.mockResolvedValue({ ok: false, retryAfter: 12 })

    const response = await get('poster=/abc.jpg')

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('12')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('the methods', () => {
  it('answers a CORS preflight', async () => {
    const response = await get('poster=/abc.jpg', 'OPTIONS')

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
  })

  it('refuses a POST', async () => {
    const response = await get('poster=/abc.jpg', 'POST')

    expect(response.status).toBe(405)
  })
})
