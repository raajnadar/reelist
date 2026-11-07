import { useSnackbar } from '@rootnative/components/snackbar'
import { shareMovie, type ShareFilm, type ShareState } from './share'

/**
 * Opens the system share sheet for one film, on a phone.
 *
 * The sheet reports its own result, so this speaks only for the two ends the
 * reader cannot see: a link that went to the clipboard instead of a sheet,
 * and a share that failed.
 */
export function useShareMovie(): (movie: ShareFilm, state?: ShareState) => Promise<void> {
  const snackbar = useSnackbar()

  return async (movie, state) => {
    const outcome = await shareMovie(movie, state)
    if (outcome === 'copied') {
      snackbar.show({ message: 'Link copied', replace: true })
    } else if (outcome === 'failed') {
      snackbar.show({ message: 'Could not share the link', replace: true })
    }
  }
}
