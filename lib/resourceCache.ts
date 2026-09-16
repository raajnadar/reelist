/**
 * The answers `useResource` already received, held for the life of the process.
 *
 * Without it every screen refetches on every visit: the home rows load again
 * each time the reader comes back from a film, and a search that was typed a
 * minute ago is asked for a second time. Nothing in the app writes to TMDB, so
 * a short-lived copy can never contradict a change the reader made.
 *
 * This module holds no React import on purpose. The hook needs it, and so does
 * jest.setup.js, which empties it between tests.
 */

/**
 * How long an answer counts as current.
 *
 * Five minutes sits under the ten the proxy already caches at its edge
 * (`CACHE_CONTROL` in proxy/api/tmdb.ts), so this layer never serves a copy
 * older than the one a fresh request would return anyway.
 */
export const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * The ceiling on stored answers.
 *
 * A search sends one entry per query, so an afternoon of typing would otherwise
 * grow this without limit. The oldest write is dropped at the ceiling, which is
 * enough for a store whose entries expire anyway.
 */
export const CACHE_MAX_ENTRIES = 50

type Entry = { value: unknown; time: number }

const entries = new Map<string, Entry>()

/**
 * A stored answer, and whether it is still current.
 *
 * The two travel together because the caller needs both: a stale copy is still
 * worth drawing while a new request runs, so `fresh: false` is not the same
 * answer as no entry at all.
 */
export type Cached<T> = { value: T; fresh: boolean }

export const readCache = <T>(key: string): Cached<T> | null => {
  const entry = entries.get(key)
  if (!entry) return null
  return { value: entry.value as T, fresh: Date.now() - entry.time < CACHE_TTL_MS }
}

export const writeCache = (key: string, value: unknown): void => {
  // Deleted before it is set, so the key moves to the end of the insertion
  // order. A Map iterates in that order, which is what makes the eviction below
  // drop the least recently written entry rather than an arbitrary one.
  entries.delete(key)
  entries.set(key, { value, time: Date.now() })

  if (entries.size > CACHE_MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest !== undefined) entries.delete(oldest)
  }
}

/** Drops one answer, so the next read has to ask again. */
export const evictCache = (key: string): void => {
  entries.delete(key)
}

export const clearCache = (): void => {
  entries.clear()
}
