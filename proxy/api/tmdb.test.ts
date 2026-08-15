import handler from './tmdb'

/**
 * The proxy is the only thing standing between a public URL and a private key,
 * so its rules are tested rather than trusted. `fetch` is mocked, so no test
 * here reaches TMDB.
 */

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

const KEY = 'server-side-key'

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  process.env.TMDB_API_KEY = KEY
})

const get = (query: string) =>
  handler(new Request(`https://proxy.example.com/api/tmdb?${query}`))

/** The URL the handler actually requested from TMDB. */
const upstreamUrl = () => new URL(String(mockFetch.mock.calls[0][0]))

describe('the allowlist', () => {
  it.each([
    '/trending/movie/week',
    '/movie/popular',
    '/movie/top_rated',
    '/search/movie',
    '/movie/550',
  ])('forwards %s', async (path) => {
    const response = await get(`path=${encodeURIComponent(path)}`)

    expect(response.status).toBe(200)
    expect(upstreamUrl().pathname).toBe(`/3${path}`)
  })

  // Without the list this endpoint is an open TMDB relay under this project's
  // key. These are the paths that must never pass.
  it.each([
    ['/account', 'a path the app does not use'],
    ['/authentication/token/new', 'an auth endpoint'],
    ['/movie/550/../../account', 'a traversal attempt'],
    ['/movie/abc', 'a non-numeric id'],
    ['/movie/', 'an empty id'],
  ])('rejects %s (%s)', async (path) => {
    const response = await get(`path=${encodeURIComponent(path)}`)

    expect(response.status).toBe(403)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects a request with no path', async () => {
    expect((await get('')).status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('the key', () => {
  it('adds the server key to the upstream request', async () => {
    await get('path=%2Fmovie%2Fpopular')

    expect(upstreamUrl().searchParams.get('api_key')).toBe(KEY)
  })

  /**
   * The reason this proxy exists. The key must not appear in anything the
   * caller receives — not in the body, and not in a header.
   */
  it('never returns the key to the caller', async () => {
    const response = await get('path=%2Fmovie%2Fpopular')
    const body = await response.text()

    expect(body).not.toContain(KEY)
    expect(JSON.stringify([...response.headers])).not.toContain(KEY)
  })

  // A caller must not be able to substitute their own key and bill the usage
  // to this deployment, nor to override the server key with a broken one.
  it('ignores an api_key supplied by the caller', async () => {
    await get('path=%2Fmovie%2Fpopular&api_key=INJECTED')

    expect(upstreamUrl().searchParams.get('api_key')).toBe(KEY)
  })

  // Only the parameters the app uses are forwarded. Anything else is dropped.
  it('drops a parameter that is not on the list', async () => {
    await get('path=%2Fsearch%2Fmovie&query=dune&language=de-DE')

    const params = upstreamUrl().searchParams
    expect(params.get('query')).toBe('dune')
    expect(params.has('language')).toBe(false)
  })

  it('reports a missing server key without saying why', async () => {
    delete process.env.TMDB_API_KEY

    const response = await get('path=%2Fmovie%2Fpopular')
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain('TMDB_API_KEY')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('the response', () => {
  // The app branches on the status: getMovie turns a 404 into null.
  it('passes the upstream status through', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status_message: 'Not found.' }), { status: 404 }),
    )

    expect((await get('path=%2Fmovie%2F999')).status).toBe(404)
  })

  it('caches a success but not an error', async () => {
    const good = await get('path=%2Fmovie%2Fpopular')
    expect(good.headers.get('cache-control')).toContain('s-maxage')

    // Caching an error would pin a transient failure for the whole window.
    mockFetch.mockResolvedValue(new Response('{}', { status: 500 }))
    const bad = await get('path=%2Fmovie%2Fpopular')
    expect(bad.headers.get('cache-control')).toBeNull()
  })

  it('answers a dropped upstream connection with 502', async () => {
    mockFetch.mockRejectedValue(new TypeError('network'))

    expect((await get('path=%2Fmovie%2Fpopular')).status).toBe(502)
  })

  it('rejects a method other than GET', async () => {
    const response = await handler(
      new Request('https://proxy.example.com/api/tmdb?path=%2Fmovie%2Fpopular', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
