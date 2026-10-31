import { Button } from '@rootnative/components/button'
import type { MovieDetail } from '../lib/types'
import { BUTTON_SIZE } from '../lib/buttonSize'
import { useShareMovie } from '../lib/useShareMovie'

/**
 * The share action on a phone: one press, one system sheet. See
 * lib/useShareMovie.ts for what the button says after the sheet. The web has a
 * menu of its own in ShareButton.web.tsx, because a desktop browser often has
 * no sheet.
 */
export function ShareButton({ movie }: { movie: MovieDetail }) {
  const share = useShareMovie()

  return (
    <Button
      variant="outlined"
      size={BUTTON_SIZE.inline}
      leadingIcon="share-variant"
      onPress={() => share(movie)}
    >
      Share
    </Button>
  )
}
