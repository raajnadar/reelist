import { Button } from '@rootnative/components/button'
import { useSnackbar } from '@rootnative/components/snackbar'
import { Motion } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import type { MovieDetail } from '../lib/types'
import { BookmarkIcon } from './BookmarkIcon'
import { ShareButton } from './ShareButton'
import { restoreSaved, toggleSaved, useWatchlist } from '../lib/watchlist'

/**
 * What the reader can do with the film: watch the trailer, keep it, and send
 * it on.
 *
 * One row rather than three children of the cascade, so the buttons arrive
 * together. `<Stagger>` re-derives the whole cascade from render order, so this
 * needs no delay of its own.
 */
export function DetailActions({ movie }: { movie: MovieDetail }) {
  const router = useRouter()
  const snackbar = useSnackbar()
  const { movies } = useWatchlist()
  const savedAt = movies.findIndex((m) => m.id === movie.id)
  const saved = savedAt !== -1
  const [pops, setPops] = useState(0)

  const toggle = () => {
    toggleSaved(movie)
    if (!saved) {
      setPops((n) => n + 1)
      return
    }

    // `long`, because the library makes a snackbar with an action wait
    // forever by default, and it would then stay on the screens the reader
    // opens next. `replace`, so a fast save and unsave does not queue two.
    snackbar.show({
      message: 'Removed from your watchlist',
      actionLabel: 'Undo',
      duration: 'long',
      replace: true,
      onAction: () => restoreSaved([movie], savedAt),
    })
  }

  // Read into a const before the callback below reads it. `movie.trailer` is a
  // property, and the guard in the JSX does not narrow a property inside a
  // handler that runs later.
  const trailer = movie.trailer

  return (
    <Motion.View
      initial={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.actions}
    >
      {/*
        The trailer, when the film has one on YouTube. `lib/api.ts` chose it, so
        this line has no filtering to do and `null` means the button is simply
        absent.

        It opens the player screen, which keeps the reader in the app and keeps
        this screen underneath with its scroll position. The title travels with
        it so the player can name the film without a request of its own.
      */}
      {trailer ? (
        <Button
          variant="filled"
          size="m"
          leadingIcon="play"
          onPress={() =>
            router.push(
              `/trailer/${trailer.key}?title=${encodeURIComponent(movie.title)}`,
            )
          }
        >
          Watch trailer
        </Button>
      ) : null}

      {/*
        The label states what the film is now, not what the button will do. A
        control that reads "Save" while the film is already saved would report
        the list wrongly, and the icon fills at the same moment for a reader who
        does not read the label.

        `tonal` beside the filled trailer button: the trailer is the one action
        the screen leads with, and two filled buttons side by side would leave
        neither of them first.
      */}
      <Button
        variant={saved ? 'filled' : 'tonal'}
        size="m"
        leadingIcon={(props) => <BookmarkIcon saved={saved} pop={pops} {...props} />}
        onPress={toggle}
      >
        {saved ? 'Saved' : 'Save'}
      </Button>

      {/*
        The quietest of the three: a share is the action the reader takes
        last, after the film is watched or saved. It is a sheet on a phone
        and a menu in a browser, which is the component's own split.
      */}
      <ShareButton movie={movie} />
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // `alignSelf` keeps the buttons at their own width. A Button in a column with
  // `align: stretch` spans the whole measure, which reads as a banner rather
  // than an action. `wrap`, because the two together outrun a narrow column
  // beside the poster.
  actions: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
})
