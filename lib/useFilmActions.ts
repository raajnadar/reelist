import { useSnackbar } from '@rootnative/components/snackbar'
import { useRouter, type Href } from 'expo-router'
import { trailerHref } from './navigation'
import { getMovie } from './api'
import { haptic } from './haptics'
import { fetchShared, movieKey, readCache } from './resourceCache'
import type { Movie, MovieDetail } from './types'
import { undoSnackbar } from './undo'
import { useShareMovie } from './useShareMovie'
import { useToggleSaved } from './useToggleSaved'
import { isWatched, setWatched } from './watchlist'

/**
 * What a film's menu offers, on both platforms: the trailer, the watchlist,
 * the watched mark, and a share. The Android `FilmMenu` and the iOS context
 * menu of a card call the same handlers, so one film reads the same from both.
 *
 * The trailer is not in the list a card comes from. A press reads the store
 * the film page fills, and asks for the film when the store has nothing. The
 * hook itself sends no request: a list of cards declares a menu for each one,
 * and a request per card would be a request per poster on screen.
 */
export function useFilmActions(movie: Movie, dismissTo = false) {
  const router = useRouter()
  const snackbar = useSnackbar()
  const share = useShareMovie()
  const { saved, stored, toggle } = useToggleSaved(movie, dismissTo)
  const watched = saved && isWatched(stored)

  const key = movieKey(movie.id)
  const go = (href: Href) => (dismissTo ? router.dismissTo(href) : router.push(href))

  const watchTrailer = async () => {
    let detail = readCache<MovieDetail | null>(key)?.value
    if (!detail) {
      try {
        // Joins the request in flight, when the Android menu sent one.
        detail = await fetchShared(key, () => getMovie(movie.id))
      } catch {
        snackbar.show({ message: 'Could not load the trailer', replace: true })
        return
      }
    }
    const trailer = detail?.trailer
    if (!trailer) {
      snackbar.show({ message: 'This film has no trailer', replace: true })
      return
    }
    go(trailerHref(trailer.key, movie.title))
  }

  const toggleWatched = () => {
    const next = !watched
    setWatched([movie.id], next)
    haptic(next ? 'save' : 'unsave')
    snackbar.show(
      undoSnackbar(next ? 'Marked as watched' : 'Marked as not watched', () => {
        setWatched([movie.id], watched)
        haptic(next ? 'unsave' : 'save')
      }),
    )
  }

  return {
    saved,
    watched,
    watchTrailer,
    toggleSaved: toggle,
    toggleWatched,
    // With the film in the store, the share also has the runtime, the genres,
    // and the tagline. It does not wait for a request, so the sheet opens at
    // once, with the list facts when the film is not there.
    share: () =>
      share(readCache<MovieDetail | null>(key)?.value ?? movie, { saved, watched }),
  }
}
