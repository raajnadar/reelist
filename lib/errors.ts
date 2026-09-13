import { MissingProxyUrlError } from './config'

/**
 * What kind of failure it is, which is the one thing a screen cannot work out
 * for itself — and the thing that decides what it may offer the reader.
 *
 * - `transient` — the request failed, and another one can succeed. Retry.
 * - `setup` — the app is not configured. There is no request to repeat, and the
 *   message carries the instruction that fixes it.
 * - `missing` — the app asked for something that is not there: a bad route
 *   parameter, or an id TMDB answered 404 for. A second attempt returns the
 *   same nothing.
 *
 * Without the distinction every failure would offer a "Try again" button. Under
 * a setup instruction, or under a broken link, that button cannot work.
 */
export type FailureKind = 'transient' | 'setup' | 'missing'

/** A failure, in the shape the screen that reports it needs. */
export type Failure = {
  kind: FailureKind
  message: string
}

/**
 * Classifies a thrown value.
 *
 * `fallback` covers the throw that is not an `Error` at all. It counts as
 * transient: an unclassified failure is more often a passing one than a
 * permanent one, and a second attempt costs one request.
 */
export function toFailure(error: unknown, fallback: string): Failure {
  if (error instanceof MissingProxyUrlError) {
    return { kind: 'setup', message: error.message }
  }

  if (error instanceof Error) return { kind: 'transient', message: error.message }

  return { kind: 'transient', message: fallback }
}

/** A `missing` failure, for the case the app finds without making a request. */
export const missingFailure = (message: string): Failure => ({
  kind: 'missing',
  message,
})
