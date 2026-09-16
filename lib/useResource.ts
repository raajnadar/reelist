import { useCallback, useEffect, useRef, useState } from 'react'
import { toFailure, type Failure } from './errors'
import { evictCache, readCache, writeCache } from './resourceCache'

/**
 * One asynchronous answer, in the shape a screen draws.
 *
 * `data` and `failure` are never both set: a request either answered or it did
 * not. `loading` is derived rather than stored, so it cannot disagree with the
 * other two.
 */
export type Resource<T> = {
  data: T | null
  failure: Failure | null
  loading: boolean
  reload: () => void
}

/**
 * Loads `key` through `fetcher`, and keeps the answer.
 *
 * Every screen wrote the same block before this: a `useState` for the data, one
 * for the failure, one for the loading flag, an `attempt` counter for the retry
 * button, and an `active` flag in the effect to keep a late answer off a screen
 * the reader has left. Three of the four also tagged the stored answer with the
 * thing it described, because an id or a query can change while a request is in
 * flight. All of that lives here now.
 *
 * `key` identifies what is being asked for, and `null` means there is nothing
 * to ask: an empty search box, or a route parameter that names no film. An
 * idle resource sends no request and reports no failure.
 *
 * `fetcher` is read through a ref, so a screen can write it inline without
 * making every render start a new request. `key` is what decides that.
 */
export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  fallbackMessage: string,
): Resource<T> {
  /**
   * The finished answer, tagged with the key it belongs to.
   *
   * Tagged rather than cleared when the key changes: clearing would set state
   * during the commit and cascade a render, and one value for the key, the data
   * and the failure means the three can never disagree.
   */
  const [outcome, setOutcome] = useState<{
    key: string
    data: T | null
    failure: Failure | null
  } | null>(null)

  /** Bumped by `reload`, and read by the request effect as a dependency. */
  const [attempt, setAttempt] = useState(0)

  const fetcherRef = useRef(fetcher)
  // Declared above the request effect so React runs it first in the same
  // commit. A key change and the new fetcher that goes with it arrive in one
  // render, and the request below must not call the previous one.
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    if (key === null) return

    const cached = readCache<T>(key)
    // A current copy is the whole point of the store. The screen already drew
    // it in the render below, so there is nothing to request and nothing to set.
    if (cached?.fresh) return

    let active = true

    fetcherRef
      .current()
      .then((value) => {
        // Written before the `active` check: the answer is worth keeping even
        // when the screen that asked for it has gone, and the next visit then
        // draws it with no wait.
        writeCache(key, value)
        if (active) setOutcome({ key, data: value, failure: null })
      })
      .catch((e: unknown) => {
        if (!active) return
        // A stale copy on screen outranks the report of a failed refresh. The
        // reader has the films in front of them, and replacing them with an
        // error would take away working content to announce a request they
        // never asked for.
        if (cached) return
        // A MissingProxyUrlError and a TmdbError each carry a message written
        // for the person who sees it, and toFailure says which of the two a
        // second attempt can clear. See lib/errors.ts.
        setOutcome({ key, data: null, failure: toFailure(e, fallbackMessage) })
      })

    return () => {
      active = false
    }
  }, [key, attempt, fallbackMessage])

  const reload = useCallback(() => {
    // The stored answer goes first. Without this the effect below would find a
    // current copy and return, and the retry button would do nothing.
    if (key !== null) evictCache(key)
    // Clearing the outcome is what puts the placeholders back, because
    // `loading` is derived from "a key with no answer yet".
    setOutcome(null)
    setAttempt((n) => n + 1)
  }, [key])

  // The outcome counts only while it describes the key being asked for. One for
  // a previous key is ignored rather than cleared.
  const current = outcome && outcome.key === key ? outcome : null
  const cached = key === null ? null : readCache<T>(key)

  return {
    data: current?.data ?? cached?.value ?? null,
    failure: current?.failure ?? null,
    // There is something to ask for, and neither an answer nor a stored copy to
    // draw. A stale copy is not a loading state: it is on screen while the
    // request that replaces it runs.
    loading: key !== null && !current && !cached,
    reload,
  }
}
