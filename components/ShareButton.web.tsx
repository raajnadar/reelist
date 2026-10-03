import { Button } from '@rootnative/components/button'
import { Divider } from '@rootnative/components/divider'
import { Menu } from '@rootnative/components/menu'
import { useSnackbar } from '@rootnative/components/snackbar'
import { Linking } from 'react-native'
import { copyMovieLink, hasShareSheet, shareMovie, shareTargets } from '../lib/share'
import type { MovieDetail } from '../lib/types'

/**
 * The share action in a browser: a menu, because the browser's own sheet is
 * not a given.
 *
 * Every phone browser has the Web Share API, and Firefox on a desktop does
 * not. The menu lists the browser sheet only where it exists, then the
 * clipboard, then Facebook, X, and email, which is the set IMDb offers. Each
 * site item opens in a new tab, so the film stays on this one.
 */
export function ShareButton({ movie }: { movie: MovieDetail }) {
  const snackbar = useSnackbar()
  const sheet = hasShareSheet()

  const copy = async () => {
    const copied = await copyMovieLink(movie)
    snackbar.show({
      message: copied ? 'Link copied' : 'Could not copy the link',
      replace: true,
    })
  }

  const share = async () => {
    if ((await shareMovie(movie)) === 'failed') {
      snackbar.show({ message: 'Could not share the link', replace: true })
    }
  }

  return (
    <Menu
      anchor={
        <Button
          variant="outlined"
          size="medium"
          leadingIcon="share-variant"
          accessibilityLabel="Share this movie"
          testID="share-button"
        >
          Share
        </Button>
      }
    >
      {sheet ? (
        <Menu.Item label="More apps" leadingIcon="share-variant" onPress={share} />
      ) : null}
      <Menu.Item label="Copy link" leadingIcon="content-copy" onPress={copy} />
      <Divider />
      {shareTargets(movie).map((target) => (
        <Menu.Item
          key={target.id}
          label={target.label}
          leadingIcon={target.icon}
          onPress={() => Linking.openURL(target.url)}
        />
      ))}
    </Menu>
  )
}
