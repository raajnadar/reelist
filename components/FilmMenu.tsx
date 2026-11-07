import { Menu } from '@rootnative/components/menu'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getMovie } from '../lib/api'
import type { Movie, MovieDetail } from '../lib/types'
import { filmKey, useFilmActions } from '../lib/useFilmActions'
import { useResource } from '../lib/useResource'

type Props = {
  movie: Movie
  visible: boolean
  onDismiss: () => void
  /** For a card in the search sheet. See MovieCard. */
  dismissTo?: boolean
}

/**
 * What a long press on a card offers on Android: the trailer, the watchlist,
 * and a share, in the order of the buttons on the film page. The handlers
 * are in useFilmActions, which the iOS context menu shares.
 *
 * The menu has no anchor element of its own. Its measured box fills the card
 * it sits in, so the menu opens against the card.
 *
 * A list sends no trailer, so the menu asks for the film when it mounts. The
 * answer goes into the store the film page reads, and a tap on the card after
 * that opens the page with no wait.
 */
export function FilmMenu({ movie, visible, onDismiss, dismissTo = false }: Props) {
  const { saved, watched, watchTrailer, toggleSaved, toggleWatched, share } =
    useFilmActions(movie, dismissTo)
  const insets = useSafeAreaInsets()

  const film = useResource<MovieDetail | null>(
    filmKey(movie.id),
    () => getMovie(movie.id),
    'Could not load the film',
  )
  // Grey only when the answer says the film has no trailer. While the request
  // runs, a press waits for it.
  const noTrailer = !film.loading && !film.failure && !film.data?.trailer

  return (
    <Menu
      visible={visible}
      onDismiss={onDismiss}
      anchor={null}
      anchorStyle={styles.anchor}
      align="center"
      // The Menu keeps 8 dp from the window edge, not from the system bars, so
      // a menu above a card near the top went under the status bar. The margin
      // applies to every edge. Remove it with the ui release that fixes
      // RootNative DX feedback R48.
      screenMargin={8 + Math.max(insets.top, insets.bottom)}
      testID="film-menu"
    >
      <Menu.Item
        label="Watch trailer"
        leadingIcon="play"
        disabled={noTrailer}
        onPress={watchTrailer}
      />
      <Menu.Item
        label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
        leadingIcon={saved ? 'bookmark-remove-outline' : 'bookmark-outline'}
        onPress={toggleSaved}
      />
      {saved ? (
        <Menu.Item
          label={watched ? 'Mark as not watched' : 'Mark as watched'}
          leadingIcon={watched ? 'eye-off-outline' : 'eye-check-outline'}
          onPress={toggleWatched}
        />
      ) : null}
      <Menu.Item label="Share" leadingIcon="share-variant" onPress={share} />
    </Menu>
  )
}

const styles = StyleSheet.create({
  // The box takes no touch, so a press still reaches the card under it.
  anchor: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
})
