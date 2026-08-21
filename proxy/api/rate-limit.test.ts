/**
 * The rate limit is a cost control that must never become an outage, so the
 * tests here care as much about the paths that allow a request as the one that
 * refuses it. Redis is mocked; no test reaches the network.
 */

const mockLimit = jest.fn()
/**
 * Stands in for the Ratelimit constructor, so a test can count how often it
 * runs and can make it throw the way a malformed URL does.
 */
const mockConstructor = jest.fn()

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    // Annotated because the inferred type would reference itself through the
    // class, which TypeScript refuses (TS7022).
    static slidingWindow: () => string = () => 'sliding-window'
    limit = mockLimit

    constructor() {
      mockConstructor()
    }
  },
}))

jest.mock('@upstash/redis', () => ({
  Redis: { fromEnv: jest.fn(() => ({})) },
}))

const URL_VAR = 'UPSTASH_REDIS_REST_URL'
const TOKEN_VAR = 'UPSTASH_REDIS_REST_TOKEN'

/**
 * The module reads the environment when `check` runs, not at import, so the
 * tests set it per case. It is loaded fresh in each test anyway to keep the
 * module-scope limiter from carrying state between them.
 *
 * `require` inside `isolateModules` rather than a dynamic `import`: this
 * project runs Jest without `--experimental-vm-modules`, where `import()`
 * throws.
 */
type Check = (request: Request) => Promise<{ ok: boolean; retryAfter?: number }>

const loadCheck = (): Check => {
  let check!: Check
  jest.isolateModules(() => {
    // require(), not import(): isolateModules is synchronous, and import()
    // throws without --experimental-vm-modules. See the comment above.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    check = (require('./rate-limit') as { check: Check }).check
  })
  return check
}

/** A request as Vercel presents it: the platform sets the IP header. */
const request = (ip: string | null = '203.0.113.7') =>
  new Request('https://proxy.example.com/api/tmdb?path=%2Fmovie%2Fpopular', {
    headers: ip ? { 'x-vercel-forwarded-for': ip } : {},
  })

beforeEach(() => {
  mockLimit.mockReset()
  mockConstructor.mockReset()
  mockLimit.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 })
  process.env[URL_VAR] = 'https://redis.example.com'
  process.env[TOKEN_VAR] = 'redis-token'
})

afterEach(() => {
  delete process.env[URL_VAR]
  delete process.env[TOKEN_VAR]
})

describe('counting', () => {
  it('allows a request that is under the limit', async () => {
    const check = loadCheck()

    expect(await check(request())).toEqual({ ok: true })
  })

  it('refuses a request that is over the limit', async () => {
    // 30 seconds ahead of the clock the code compares against.
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 })
    const check = loadCheck()

    const result = await check(request())

    expect(result.ok).toBe(false)
    expect(result.retryAfter).toBe(30)
  })

  it('counts each address separately', async () => {
    const check = loadCheck()
    await check(request('203.0.113.7'))
    await check(request('198.51.100.4'))

    expect(mockLimit).toHaveBeenNthCalledWith(1, '203.0.113.7')
    expect(mockLimit).toHaveBeenNthCalledWith(2, '198.51.100.4')
  })
})

describe('retryAfter', () => {
  /**
   * `reset` is an absolute Unix time in milliseconds. Reporting it as a
   * duration would tell a caller to wait about fifty years, so this is the
   * conversion worth pinning.
   */
  it('reports seconds to wait, not the reset timestamp', async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 45_000 })
    const check = loadCheck()

    const { retryAfter } = await check(request())

    expect(retryAfter).toBeGreaterThan(40)
    expect(retryAfter).toBeLessThanOrEqual(45)
  })

  // A reset already in the past, from clock skew, must not become a negative
  // or zero Retry-After.
  it('never reports less than a second', async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() - 5_000 })
    const check = loadCheck()

    expect((await check(request())).retryAfter).toBe(1)
  })
})

/**
 * The important half. Every one of these must allow the request: the limit
 * protects the TMDB quota, and a broken counter must not take the app down
 * with it.
 */
describe('failing open', () => {
  it('allows the request when Redis is not configured', async () => {
    delete process.env[URL_VAR]
    delete process.env[TOKEN_VAR]
    const check = loadCheck()

    expect(await check(request())).toEqual({ ok: true })
    // Not merely allowed — not attempted. Calling a Redis that cannot answer
    // would add the retry delay to every request.
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('allows the request when only the URL is set', async () => {
    delete process.env[TOKEN_VAR]
    const check = loadCheck()

    expect(await check(request())).toEqual({ ok: true })
    expect(mockLimit).not.toHaveBeenCalled()
  })

  /**
   * `vercel dev` sets no IP header. Without this the local proxy would either
   * refuse everything or count every local request as one caller.
   */
  it('allows the request when no IP header is present', async () => {
    const check = loadCheck()

    expect(await check(request(null))).toEqual({ ok: true })
    expect(mockLimit).not.toHaveBeenCalled()
  })

  /**
   * The one the library's own `timeout` option does not cover. `timeout` races
   * against a timer with no catch, so a refused connection or a bad credential
   * rejects rather than falling open. This catch is the difference between a
   * Redis outage and a total outage.
   */
  it('allows the request when Redis rejects', async () => {
    mockLimit.mockRejectedValue(new TypeError('fetch failed'))
    const check = loadCheck()

    expect(await check(request())).toEqual({ ok: true })
  })

  /**
   * This one was found in production, not in review. The Upstash constructor
   * throws on a malformed URL — the mistake that produces it is setting
   * UPSTASH_REDIS_REST_URL to the token value.
   *
   * The limiter used to be built at module scope, so that throw happened while
   * the function was loading and the runtime answered every single request with
   * FUNCTION_INVOCATION_FAILED. A misconfigured rate limit took the whole proxy
   * down. It is built lazily and wrapped now, and this test holds that line.
   */
  it('allows the request when the limiter cannot be built', async () => {
    mockConstructor.mockImplementation(() => {
      throw new Error('Upstash Redis client was passed an invalid URL.')
    })
    const check = loadCheck()

    expect(await check(request())).toEqual({ ok: true })
  })

  // The constructor is not retried after it fails. A bad URL throws for the
  // life of the deployment, so retrying would only add work to every request.
  it('does not rebuild a limiter that already failed', async () => {
    mockConstructor.mockImplementation(() => {
      throw new Error('Upstash Redis client was passed an invalid URL.')
    })
    const check = loadCheck()

    await check(request())
    await check(request())

    expect(mockConstructor).toHaveBeenCalledTimes(1)
  })
})

describe('the identifier', () => {
  // Vercel overwrites these headers, so a caller cannot set one to escape the
  // count. The order matters: x-vercel-forwarded-for is the one that survives
  // a proxy placed in front of Vercel.
  it('prefers x-vercel-forwarded-for over the others', async () => {
    const check = loadCheck()
    await check(
      new Request('https://proxy.example.com/api/tmdb', {
        headers: {
          'x-vercel-forwarded-for': '203.0.113.7',
          'x-real-ip': '198.51.100.4',
          'x-forwarded-for': '192.0.2.1',
        },
      }),
    )

    expect(mockLimit).toHaveBeenCalledWith('203.0.113.7')
  })

  it('falls back to x-real-ip', async () => {
    const check = loadCheck()
    await check(
      new Request('https://proxy.example.com/api/tmdb', {
        headers: { 'x-real-ip': '198.51.100.4', 'x-forwarded-for': '192.0.2.1' },
      }),
    )

    expect(mockLimit).toHaveBeenCalledWith('198.51.100.4')
  })

  // x-forwarded-for can carry a list. The client is the first entry.
  it('takes the first address from an x-forwarded-for list', async () => {
    const check = loadCheck()
    await check(
      new Request('https://proxy.example.com/api/tmdb', {
        headers: { 'x-forwarded-for': '192.0.2.1, 70.41.3.18, 150.172.238.178' },
      }),
    )

    expect(mockLimit).toHaveBeenCalledWith('192.0.2.1')
  })
})
