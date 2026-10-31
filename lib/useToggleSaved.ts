import { useSnackbar } from '@rootnative/components/snackbar'
import { useRouter } from 'expo-router'
import { haptic } from './haptics'
import type { Movie } from './types'
import { restoreSaved, toggleSaved, useWatchlist, type SavedMovie } from './watchlist'

/**
 * Saves the film, or removes it, and says so in a snackbar.
 *
 * The film page and the menu of a card share it, so a save reads the same
 * from both. `dismissTo` is for a card in the search sheet: the snackbar
 * action then closes the sheet as the watchlist opens. See MovieCard.
 */
export function useToggleSaved(
  movie: Movie,
  dismissTo = false,
): { saved: boolean; stored: SavedMovie; toggle: () => void } {
  const router = useRouter()
  const snackbar = useSnackbar()
  const { movies } = useWatchlist()
  const savedAt = movies.findIndex((m) => m.id === movie.id)
  const saved = savedAt !== -1
  // The undo puts back the stored copy, not `movie`: only the stored copy
  // carries the watched mark.
  const stored = saved ? movies[savedAt] : movie

  const toggle = () => {
    toggleSaved(movie)
    haptic(saved ? 'unsave' : 'save')

    // Both directions report, so a save and an unsave read the same. A save
    // has nothing to undo, so its action opens the list it went into.
    //
    // `long`, because the library makes a snackbar with an action wait
    // forever by default, and it would then stay on the screens the reader
    // opens next. `replace`, so a fast save and unsave does not queue two.
    snackbar.show(
      saved
        ? {
            message: 'Removed from your watchlist',
            actionLabel: 'Undo',
            duration: 'long',
            replace: true,
            onAction: () => {
              restoreSaved([stored], savedAt)
              haptic('save')
            },
          }
        : {
            message: 'Saved to your watchlist',
            actionLabel: 'View',
            duration: 'long',
            replace: true,
            onAction: () =>
              dismissTo ? router.dismissTo('/watchlist') : router.push('/watchlist'),
          },
    )
  }

  return { saved, stored, toggle }
}
