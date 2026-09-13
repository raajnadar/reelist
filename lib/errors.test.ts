import { MissingProxyUrlError } from './config'
import { TmdbError } from './tmdb'
import { missingFailure, toFailure } from './errors'

/**
 * The classifier decides which button a failed screen offers. Getting it wrong
 * is invisible in a type check and visible only as a "Try again" button that
 * cannot work — so each branch is pinned here.
 */

it('treats an unset proxy URL as a setup mistake', () => {
  const failure = toFailure(new MissingProxyUrlError(), 'Could not load movies')

  expect(failure.kind).toBe('setup')
  // The instruction that fixes it, not the generic line: a developer who sees
  // "Could not load movies" goes to check their connection.
  expect(failure.message).toContain('EXPO_PUBLIC_TMDB_PROXY_URL')
})

it('treats a failed request as transient', () => {
  const failure = toFailure(
    new TmdbError('TMDB is unavailable', 503),
    'Could not load movies',
  )

  expect(failure).toEqual({ kind: 'transient', message: 'TMDB is unavailable' })
})

// A thrown string, or anything else that is not an Error, carries no message
// worth printing. It counts as transient: one more request is cheap, and an
// unclassified failure is more often a passing one.
it.each([
  ['a string', 'boom'],
  ['a number', 42],
  ['undefined', undefined],
  ['null', null],
])('falls back to the generic message for %s', (_name, thrown) => {
  expect(toFailure(thrown, 'Could not load movies')).toEqual({
    kind: 'transient',
    message: 'Could not load movies',
  })
})

it('marks a failure the app found itself as missing', () => {
  expect(missingFailure('That link does not point at a movie.')).toEqual({
    kind: 'missing',
    message: 'That link does not point at a movie.',
  })
})
