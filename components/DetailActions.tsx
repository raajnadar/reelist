import { Button } from '@rootnative/components/button'
import { Motion } from '@rootnative/inertia'
import { openURL } from 'expo-linking'
import { StyleSheet } from 'react-native'
import type { MovieDetail, Video } from '../lib/types'
import { isSaved, toggleSaved, useWatchlist } from '../lib/watchlist'

/**
 * Opens the trailer outside the app.
 *
 * `lib/api.ts` already established the video is a YouTube trailer, so this
 * builds the watch URL and nothing more. It takes the nullable type rather than
 * a narrowed one, because the caller reads `movie.trailer` inside a callback
 * and the guard around that callback does not narrow a property there.
 *
 * A rejected promise means no installed app can open a YouTube link. There is
 * no better answer than doing nothing, and an uncaught rejection would only
 * print a warning.
 */
const openTrailer = (video: Video | null) => {
  if (!video) return
  void openURL(`https://www.youtube.com/watch?v=${video.key}`).catch(() => {})
}

/**
 * What the reader can do with the film: watch the trailer, and keep it.
 *
 * One row rather than two children of the cascade, so the two buttons arrive
 * together. `<Stagger>` re-derives the whole cascade from render order, so this
 * needs no delay of its own.
 */
export function DetailActions({ movie }: { movie: MovieDetail }) {
  const { movies } = useWatchlist()
  const saved = isSaved(movies, movie.id)

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

        The link leaves the app. There is no in-app player: a YouTube video
        needs the YouTube frame, so an embedded one would take a new dependency
        and still hand playback to YouTube. `openURL` opens the YouTube app when
        it is installed and the browser when it is not.
      */}
      {movie.trailer ? (
        <Button
          variant="filled"
          size="m"
          leadingIcon="play"
          onPress={() => openTrailer(movie.trailer)}
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
        leadingIcon={saved ? 'bookmark' : 'bookmark-outline'}
        onPress={() => toggleSaved(movie)}
      >
        {saved ? 'Saved' : 'Save'}
      </Button>
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
