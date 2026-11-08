import { Menu } from '@rootnative/components/menu'
import { StyleSheet } from 'react-native'
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
 * The menu has no anchor element of its own. Its measured box is a line
 * across the middle of the card, so the menu opens over the card. A card is
 * about as tall as half the screen, and a box that filled it left too little
 * room above or below for four items: the menu then scrolled, with Share out
 * of view.
 *
 * A list sends no trailer, so the menu asks for the film when it mounts. The
 * answer goes into the store the film page reads, and a tap on the card after
 * that opens the page with no wait.
 */
export function FilmMenu({ movie, visible, onDismiss, dismissTo = false }: Props) {
  const { saved, watched, watchTrailer, toggleSaved, toggleWatched, share } =
    useFilmActions(movie, dismissTo)

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
  anchor: {
    position: 'absolute',
    start: 0,
    end: 0,
    top: '50%',
    height: 0,
    pointerEvents: 'none',
  },
})
