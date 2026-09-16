import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  clearCache,
  evictCache,
  readCache,
  writeCache,
} from './resourceCache'

// The store outlives a test, and jest.setup.js already empties it before each
// one. This suite states the same thing rather than depending on it, because a
// leaked entry here would be read as a cache hit by the next assertion.
beforeEach(() => {
  clearCache()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('returns nothing for a key that was never written', () => {
  expect(readCache('absent')).toBeNull()
})

it('returns a written value as fresh', () => {
  writeCache('a', { title: 'Dune' })

  expect(readCache('a')).toEqual({ value: { title: 'Dune' }, fresh: true })
})

it('keeps the value but drops the freshness once the TTL passes', () => {
  writeCache('a', 'kept')

  jest.advanceTimersByTime(CACHE_TTL_MS)

  // The value stays readable on purpose. A stale copy is still worth drawing
  // while the request that replaces it runs.
  expect(readCache('a')).toEqual({ value: 'kept', fresh: false })
})

it('is still fresh one millisecond before the TTL', () => {
  writeCache('a', 'kept')

  jest.advanceTimersByTime(CACHE_TTL_MS - 1)

  expect(readCache<string>('a')?.fresh).toBe(true)
})

it('restarts the life of an entry on a second write', () => {
  writeCache('a', 'first')
  jest.advanceTimersByTime(CACHE_TTL_MS - 1)
  writeCache('a', 'second')
  jest.advanceTimersByTime(CACHE_TTL_MS - 1)

  expect(readCache('a')).toEqual({ value: 'second', fresh: true })
})

it('forgets an evicted key', () => {
  writeCache('a', 'gone')

  evictCache('a')

  expect(readCache('a')).toBeNull()
})

it('drops the least recently written entry at the ceiling', () => {
  for (let i = 0; i < CACHE_MAX_ENTRIES; i += 1) writeCache(`k${i}`, i)

  // Touched again, so it is no longer the oldest write. This is the assertion
  // that separates the eviction from a plain "drop the first key inserted".
  writeCache('k0', 0)
  writeCache('overflow', 'new')

  expect(readCache('k0')).not.toBeNull()
  expect(readCache('k1')).toBeNull()
  expect(readCache('overflow')).not.toBeNull()
})
