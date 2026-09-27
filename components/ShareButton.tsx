import { Button } from '@rootnative/components/button'
import { useSnackbar } from '@rootnative/components/snackbar'
import { shareMovie } from '../lib/share'
import type { MovieDetail } from '../lib/types'

/**
 * The share action on a phone: one press, one system sheet.
 *
 * The sheet reports its own result, so the button speaks only for the two
 * ends the reader cannot see: a link that went to the clipboard instead of a
 * sheet, and a share that failed. The web has a menu of its own in
 * ShareButton.web.tsx, because a desktop browser often has no sheet.
 */
export function ShareButton({ movie }: { movie: MovieDetail }) {
  const snackbar = useSnackbar()

  const share = async () => {
    const outcome = await shareMovie(movie)
    if (outcome === 'copied') {
      snackbar.show({ message: 'Link copied', replace: true })
    } else if (outcome === 'failed') {
      snackbar.show({ message: 'Could not share the link', replace: true })
    }
  }

  return (
    <Button variant="outlined" size="m" leadingIcon="share-variant" onPress={share}>
      Share
    </Button>
  )
}
