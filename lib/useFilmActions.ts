import { useSnackbar } from '@rootnative/components/snackbar'
import { useRouter, type Href } from 'expo-router'
import { getMovie } from './api'
import { haptic } from './haptics'
import { readCache, shareRequest, writeCache } from './resourceCache'
import type { Movie, MovieDetail } from './types'
import { useShareMovie } from './useShareMovie'
import { useToggleSaved } from './useToggleSaved'
import { isWatched, setWatched } from './watchlist'

export const filmKey = (id: number) => `movie:${id}`

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

  const key = filmKey(movie.id)
  const go = (href: Href) => (dismissTo ? router.dismissTo(href) : router.push(href))

  const watchTrailer = async () => {
    let detail = readCache<MovieDetail | null>(key)?.value
    if (!detail) {
      try {
        // Joins the request in flight, when the Android menu sent one.
        detail = await shareRequest(key, () => getMovie(movie.id))
        writeCache(key, detail)
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
    go(`/trailer/${trailer.key}?title=${encodeURIComponent(movie.title)}`)
  }

  const toggleWatched = () => {
    const next = !watched
    setWatched([movie.id], next)
    haptic(next ? 'save' : 'unsave')
    snackbar.show({
      message: next ? 'Marked as watched' : 'Marked as not watched',
      actionLabel: 'Undo',
      duration: 'long',
      replace: true,
      onAction: () => {
        setWatched([movie.id], watched)
        haptic(next ? 'unsave' : 'save')
      },
    })
  }

  return {
    saved,
    watched,
    watchTrailer,
    toggleSaved: toggle,
    toggleWatched,
    share: () => share(movie),
  }
}
