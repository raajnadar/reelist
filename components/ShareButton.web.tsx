import { Button } from '@rootnative/components/button'
import { Divider } from '@rootnative/components/divider'
import { Menu } from '@rootnative/components/menu'
import { useSnackbar } from '@rootnative/components/snackbar'
import { Linking } from 'react-native'
import {
  copyMovieLink,
  copyShareMessage,
  hasShareSheet,
  shareMovie,
  shareTargets,
} from '../lib/share'
import type { MovieDetail } from '../lib/types'
import { BUTTON_SIZE } from '../lib/buttonSize'
import { useShareState } from '../lib/useShareState'

/**
 * The share action in a browser: a menu, because the browser's own sheet is
 * not a given.
 *
 * Every phone browser has the Web Share API, and Firefox on a desktop does
 * not. The menu lists the browser sheet only where it exists, then the
 * clipboard, then Facebook, X, and email, which is the set IMDb offers. Each
 * site item opens in a new tab, so the film stays on this one.
 *
 * The clipboard gets two items. "Copy link" is the bare address, for a paste
 * into an address bar. "Copy message" is the share text with the link, for a
 * paste into a chat or a post. See `shareMessage` in lib/share.ts.
 */
export function ShareButton({ movie }: { movie: MovieDetail }) {
  const snackbar = useSnackbar()
  const sheet = hasShareSheet()
  const state = useShareState(movie.id)

  const copy = async () => {
    const copied = await copyMovieLink(movie)
    snackbar.show({
      message: copied ? 'Link copied' : 'Could not copy the link',
      replace: true,
    })
  }

  const copyMessage = async () => {
    const copied = await copyShareMessage(movie, state)
    snackbar.show({
      message: copied ? 'Message copied' : 'Could not copy the message',
      replace: true,
    })
  }

  const share = async () => {
    if ((await shareMovie(movie, state)) === 'failed') {
      snackbar.show({ message: 'Could not share the link', replace: true })
    }
  }

  return (
    <Menu
      anchor={
        <Button
          variant="outlined"
          size={BUTTON_SIZE.inline}
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
      <Menu.Item
        label="Copy message"
        leadingIcon="text-box-outline"
        onPress={copyMessage}
      />
      <Divider />
      {shareTargets(movie, state).map((target) => (
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
