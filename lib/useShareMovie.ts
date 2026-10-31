import { useSnackbar } from '@rootnative/components/snackbar'
import { shareMovie } from './share'
import type { Movie } from './types'

/**
 * Opens the system share sheet for one film, on a phone.
 *
 * The sheet reports its own result, so this speaks only for the two ends the
 * reader cannot see: a link that went to the clipboard instead of a sheet,
 * and a share that failed.
 */
export function useShareMovie(): (
  movie: Pick<Movie, 'id' | 'title' | 'release_date'>,
) => Promise<void> {
  const snackbar = useSnackbar()

  return async (movie) => {
    const outcome = await shareMovie(movie)
    if (outcome === 'copied') {
      snackbar.show({ message: 'Link copied', replace: true })
    } else if (outcome === 'failed') {
      snackbar.show({ message: 'Could not share the link', replace: true })
    }
  }
}
