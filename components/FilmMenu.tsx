import { Menu } from '@rootnative/components/menu'
import { useSnackbar } from '@rootnative/components/snackbar'
import { useRouter, type Href } from 'expo-router'
import { StyleSheet } from 'react-native'
import { getMovie } from '../lib/api'
import { haptic } from '../lib/haptics'
import { shareRequest, writeCache } from '../lib/resourceCache'
import type { Movie, MovieDetail } from '../lib/types'
import { useResource } from '../lib/useResource'
import { useShareMovie } from '../lib/useShareMovie'
import { useToggleSaved } from '../lib/useToggleSaved'
import { isWatched, setWatched } from '../lib/watchlist'

type Props = {
  movie: Movie
  visible: boolean
  onDismiss: () => void
  /** For a card in the search sheet. See MovieCard. */
  dismissTo?: boolean
}

/**
 * What a long press on a card offers: the trailer, the watchlist, and a
 * share, in the order of the buttons on the film page.
 *
 * The menu has no anchor element of its own. Its measured box fills the card
 * it sits in, so the menu opens against the card.
 *
 * A list sends no trailer, so the menu asks for the film when it mounts. The
 * answer goes into the store the film page reads, and a tap on the card after
 * that opens the page with no wait.
 */
export function FilmMenu({ movie, visible, onDismiss, dismissTo = false }: Props) {
  const router = useRouter()
  const snackbar = useSnackbar()
  const share = useShareMovie()
  const { saved, stored, toggle } = useToggleSaved(movie, dismissTo)
  const watched = saved && isWatched(stored)

  const key = `movie:${movie.id}`
  const fetchFilm = () => getMovie(movie.id)
  const film = useResource<MovieDetail | null>(key, fetchFilm, 'Could not load the film')
  // Grey only when the answer says the film has no trailer. While the request
  // runs, a press waits for it.
  const noTrailer = !film.loading && !film.failure && !film.data?.trailer

  const go = (href: Href) => (dismissTo ? router.dismissTo(href) : router.push(href))

  const watchTrailer = async () => {
    let detail = film.data
    if (!detail) {
      try {
        // The request the menu sent when it mounted, or a new one after a
        // failure.
        detail = await shareRequest(key, fetchFilm)
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
        onPress={toggle}
      />
      {saved ? (
        <Menu.Item
          label={watched ? 'Mark as not watched' : 'Mark as watched'}
          leadingIcon={watched ? 'eye-off-outline' : 'eye-check-outline'}
          onPress={toggleWatched}
        />
      ) : null}
      <Menu.Item label="Share" leadingIcon="share-variant" onPress={() => share(movie)} />
    </Menu>
  )
}

const styles = StyleSheet.create({
  // The box takes no touch, so a press still reaches the card under it.
  anchor: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
})
