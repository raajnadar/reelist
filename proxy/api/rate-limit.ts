/**
 * The rate limit.
 *
 * The proxy URL is public by design — it is an address, not a credential — so
 * anyone who reads it out of the web bundle can call it in a loop. The path
 * allowlist bounds *what* a caller can request. This file bounds *how much*.
 *
 * The edge cache already absorbs the repeated list requests, because one cached
 * copy serves every user. It does not help against `/search/movie?query=<random>`
 * or `/movie/<random id>`: each of those is a new cache key, so every one is a
 * miss that reaches TMDB. That is the path this limit closes, and the reason the
 * limit is applied before the upstream request rather than after it.
 *
 * The counter lives in Upstash Redis rather than in memory. An edge function
 * runs as many short-lived isolates across several regions, so an in-memory
 * counter would reset on every cold start and would never be shared between
 * regions — it would slow a naive caller and stop nobody.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * 30 requests each minute for each IP address.
 *
 * The app makes 3 requests to paint the home screen and 1 for each film opened.
 * A person browsing quickly stays near 10, so 30 leaves room for a shared
 * address — a household, an office, or a mobile carrier NAT, where many real
 * users appear as one IP — while it still cuts a scripted caller off early.
 *
 * A sliding window rather than a fixed one: a fixed window resets on a clock
 * boundary, so a caller can spend the whole allowance at the end of one window
 * and the whole allowance again at the start of the next, and pass twice the
 * limit in a moment.
 */
const LIMIT = 30
const WINDOW = '60 s'

/**
 * Whether Redis is configured at all. A deployment without it — and a local
 * `vercel dev` — should serve requests normally rather than fail, so the limit
 * is skipped rather than attempted. Without this check every request would pay
 * the retry-and-timeout delay before being allowed through anyway.
 */
const isConfigured = (): boolean =>
  Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  )

/**
 * The limiter, built on first use and then reused.
 *
 * `null` means "not built yet"; `false` means "tried once and failed, do not
 * try again". The three states are needed because a failed build must not be
 * retried on every request — a bad URL would throw for the whole life of the
 * deployment, so retrying only burns time on each call.
 */
let limiter: Ratelimit | null | false = null

/**
 * Built on the first request rather than at module scope, and wrapped, because
 * the constructor **does** throw on a malformed URL — a variable set to the
 * token by mistake, for instance. At module scope that throw happens while the
 * function is loading, which the runtime reports as FUNCTION_INVOCATION_FAILED
 * for every request. The rate limit would then be a total outage rather than a
 * cost control, which is exactly backwards.
 *
 * A missing variable behaves differently again: `Redis.fromEnv()` only warns
 * and defers that failure to the first command. `isConfigured` catches this
 * case earlier, so it never gets this far.
 *
 * The instance is cached rather than rebuilt per request because
 * `ephemeralCache` only works when it outlives the handler. That cache holds
 * identifiers Redis already refused, so a caller who is over the limit is
 * refused again in memory without a Redis round trip — which is what keeps a
 * flood from costing one Redis command per request.
 */
const getLimiter = (): Ratelimit | null => {
  if (limiter !== null) return limiter || null

  try {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
      prefix: 'reelist/tmdb',
      // Give up on a slow Redis after 1 second and let the request through. A
      // rate limit is a cost control, not a security boundary: making every
      // user wait on a struggling Redis would be a worse failure than briefly
      // not counting.
      timeout: 1000,
      // Off. It reports to Upstash on a background promise that the edge
      // runtime may cut short, and it is the only reason the handler would need
      // `context.waitUntil`. The limit works without it.
      analytics: false,
    })
    return limiter
  } catch {
    // Almost always a malformed UPSTASH_REDIS_REST_URL. Logged once, because
    // `false` stops this branch from being reached again.
    console.error(
      'The rate limit could not start. Check UPSTASH_REDIS_REST_URL is a https:// URL and not the token. Requests are not limited.',
    )
    limiter = false
    return null
  }
}

/**
 * Who is being counted.
 *
 * Vercel sets these headers itself and overwrites anything the caller sends, so
 * they cannot be spoofed to escape the count. `x-vercel-forwarded-for` is first
 * because it is the one that survives a proxy placed in front of Vercel.
 *
 * They are all absent under `vercel dev`, which is why this returns null and
 * the caller treats that as "do not count".
 */
const clientId = (request: Request): string | null =>
  request.headers.get('x-vercel-forwarded-for') ??
  request.headers.get('x-real-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  null

export type RateLimitResult = {
  /** False only when the caller is over the limit. */
  readonly ok: boolean
  /** Seconds until the caller may retry. Set only when `ok` is false. */
  readonly retryAfter?: number
}

const ALLOWED: RateLimitResult = { ok: true }

/**
 * Counts one request and reports whether it is allowed.
 *
 * This fails open on purpose: no Redis, a misconfigured Redis, no IP header, or
 * a Redis that errors all return `ok`. The limit protects the TMDB quota, and
 * losing the whole app because the counter is unreachable would trade a small
 * cost problem for a total outage.
 */
export const check = async (request: Request): Promise<RateLimitResult> => {
  if (!isConfigured()) return ALLOWED

  const id = clientId(request)
  if (!id) return ALLOWED

  const ratelimit = getLimiter()
  if (!ratelimit) return ALLOWED

  try {
    const { success, reset } = await ratelimit.limit(id)
    if (success) return ALLOWED

    // `reset` is an absolute Unix time in milliseconds, not a duration. A
    // caller reading it as a duration would be told to wait for decades.
    // Math.max keeps a clock skew from producing a negative Retry-After.
    return { ok: false, retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
  } catch {
    // `timeout` above does not cover this. It is a race against a timer with no
    // catch, so a Redis that *rejects* — refused connection, bad credentials —
    // rejects the race rather than falling open. Only a Redis that *hangs* hits
    // the timeout. This catch is what makes the failure open in both cases.
    console.error('The rate limit check failed. The request was allowed.')
    return ALLOWED
  }
}
