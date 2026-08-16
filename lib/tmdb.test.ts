// lib/config.ts reads the proxy URL once at module load, so a top-level import
// would capture whatever the environment held at that moment and every later
// test would share it. Each test loads the module itself, after setting the
// value it needs. This is why there is no `import { tmdbFetch }` at the top.
const load = (url: string) => {
  jest.resetModules()
  process.env.EXPO_PUBLIC_TMDB_PROXY_URL = url
  return {
    ...(require('./tmdb') as typeof import('./tmdb')),
    config: require('./config') as typeof import('./config'),
  }
}

const PROXY = 'https://proxy.example.com/api/tmdb'

const originalUrl = process.env.EXPO_PUBLIC_TMDB_PROXY_URL
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

beforeEach(() => {
  mockFetch.mockReset()
})

afterAll(() => {
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_TMDB_PROXY_URL
  else process.env.EXPO_PUBLIC_TMDB_PROXY_URL = originalUrl
})

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

const failing = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: async () => body,
})

describe('the request', () => {
  it('sends the TMDB path and the params to the proxy', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue(ok({ results: [] }))

    await tmdbFetch('/search/movie', { query: 'fight club' })

    const url = new URL(mockFetch.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe(PROXY)
    expect(url.searchParams.get('path')).toBe('/search/movie')
    expect(url.searchParams.get('query')).toBe('fight club')
  })

  /**
   * The app must never hold the key, so no request it makes may carry one. This
   * asserts the absence directly: if someone reintroduces a key on the client,
   * this test fails rather than the leak reaching a build.
   */
  it('never sends an api_key, and never calls TMDB directly', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue(ok({ results: [] }))

    await tmdbFetch('/movie/popular')

    const called = String(mockFetch.mock.calls[0][0])
    expect(called).not.toContain('api_key')
    expect(called).not.toContain('api.themoviedb.org')
    expect(called.startsWith(PROXY)).toBe(true)
  })

  it('does not produce a double slash when the URL has a trailing slash', async () => {
    const { tmdbFetch } = load(`${PROXY}/`)
    mockFetch.mockResolvedValue(ok({}))

    await tmdbFetch('/movie/550')

    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/tmdb?')
  })

  it('returns the parsed body', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue(ok({ id: 550 }))

    await expect(tmdbFetch('/movie/550')).resolves.toEqual({ id: 550 })
  })
})

describe('the failure branches', () => {
  // A setup mistake must not read as a network failure, so it is a distinct
  // type and the request is never sent.
  it('throws MissingProxyUrlError and sends nothing when the URL is absent', async () => {
    const { tmdbFetch, config } = load('')

    await expect(tmdbFetch('/movie/550')).rejects.toBeInstanceOf(
      config.MissingProxyUrlError,
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // status_message names the problem far better than the status line does. The
  // proxy passes the upstream body through, so this still applies.
  it('uses the status_message from the response', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue(failing(403, { status_message: 'Not available.' }))

    await expect(tmdbFetch('/movie/550')).rejects.toThrow('Not available.')
  })

  /**
   * The proxy refuses a caller who is over its rate limit with a 429 and a
   * status_message. The screens print `error.message`, so this is the whole
   * path from the limit to the text the user reads — no screen needs its own
   * branch for it.
   */
  it('reports the proxy rate limit in words the user can read', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue(
      failing(429, { status_message: 'Too many requests. Please slow down.' }),
    )

    await expect(tmdbFetch('/movie/popular')).rejects.toMatchObject({
      message: 'Too many requests. Please slow down.',
      status: 429,
    })
  })

  it('carries the status so a caller can branch on 404', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue(failing(404, { status_message: 'Not found.' }))

    await expect(tmdbFetch('/movie/1')).rejects.toMatchObject({ status: 404 })
  })

  // A gateway can answer with HTML. Reporting the failure must not itself fail.
  it('falls back to the status line when the error body is not JSON', async () => {
    const { tmdbFetch } = load(PROXY)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })

    await expect(tmdbFetch('/movie/550')).rejects.toThrow(
      'The request failed with status 502',
    )
  })

  it('reports a dropped connection as a TmdbError with no status', async () => {
    const { tmdbFetch, ...mod } = load(PROXY)
    mockFetch.mockRejectedValue(new TypeError('Network request failed'))

    await expect(tmdbFetch('/movie/550')).rejects.toBeInstanceOf(mod.TmdbError)
    await expect(tmdbFetch('/movie/550')).rejects.toMatchObject({
      status: undefined,
    })
  })
})
