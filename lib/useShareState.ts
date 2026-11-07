import type { ShareState } from './share'
import { isWatched, useWatchlist } from './watchlist'

/**
 * What the reader did with one film, for the share text. Read from the
 * watchlist store here rather than passed down from DetailActions, so the
 * share button on both platforms has the same one-line source.
 */
export function useShareState(id: number): ShareState {
  const { movies } = useWatchlist()
  const stored = movies.find((m) => m.id === id)
  return { saved: stored !== undefined, watched: stored ? isWatched(stored) : false }
}
