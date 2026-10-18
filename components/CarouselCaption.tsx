import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useInterpolatedStyle, type SharedValue } from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { StyleSheet, View } from 'react-native'
import { metaLine } from '../lib/format'
import type { Movie } from '../lib/types'
import { nearSlots } from '../lib/useActiveSlot'

/** How far a caption slides as it leaves, in points. */
const SLIDE = 24

type Props = {
  movies: Movie[]
  scrollX: SharedValue<number>
  snap: number
  /** The slot under the viewport center. */
  active: number
  /** The number of slots in the loop. */
  total: number
}

/**
 * One caption under the carousel, for the centred film.
 *
 * Each caption fades and slides with its card. A caption is gone half a slot
 * from the center, so two captions never overlap: at the midpoint of a swipe
 * neither shows.
 *
 * The captions are stacked, so the stack takes its height from an invisible
 * sizer of the same lines: one title line, one meta line, and two overview
 * lines. A short overview then does not move the content below, and the
 * height follows the reader's font size.
 */
export function CarouselCaption({ movies, scrollX, snap, active, total }: Props) {
  return (
    <View style={styles.stack}>
      {/* Letters, not spaces: the web collapses a line that holds only a
          space, and the stack then came out one line short. */}
      <View aria-hidden style={[styles.lines, styles.sizer]}>
        <Typography variant="titleLarge" numberOfLines={1}>
          M
        </Typography>
        <Typography variant="labelLarge">M</Typography>
        <Typography variant="bodyMedium" numberOfLines={2}>
          {'M\nM'}
        </Typography>
      </View>
      {nearSlots(active, total).map((slot) => (
        <CaptionLayer
          key={slot}
          movie={movies[slot % movies.length]}
          slot={slot}
          scrollX={scrollX}
          snap={snap}
          // The card's own label already names the film, so only the centred
          // caption is read. The others are still on screen at zero opacity.
          hidden={slot !== active}
        />
      ))}
    </View>
  )
}

function CaptionLayer({
  movie,
  slot,
  scrollX,
  snap,
  hidden,
}: {
  movie: Movie
  slot: number
  scrollX: SharedValue<number>
  snap: number
  hidden: boolean
}) {
  const theme = useTheme()
  const center = slot * snap
  const style = useInterpolatedStyle(
    scrollX,
    { opacity: [0, 1, 0], translateX: [SLIDE, 0, -SLIDE] },
    { inputRange: [center - snap / 2, center, center + snap / 2] },
  )

  return (
    <Animated.View aria-hidden={hidden} style={[styles.lines, styles.layer, style]}>
      <Typography variant="titleLarge" numberOfLines={1} style={styles.text}>
        {movie.title}
      </Typography>
      <Typography
        variant="labelLarge"
        color={theme.colors.onSurfaceVariant}
        style={styles.text}
      >
        {metaLine(movie.vote_average, movie.release_date)}
      </Typography>
      <Typography
        variant="bodyMedium"
        numberOfLines={2}
        color={theme.colors.onSurfaceVariant}
        style={styles.text}
      >
        {movie.overview}
      </Typography>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  stack: { alignSelf: 'center', width: '100%', maxWidth: 560, paddingHorizontal: 24 },
  lines: { gap: 4 },
  sizer: { opacity: 0 },
  layer: { position: 'absolute', top: 0, left: 24, right: 24 },
  text: { textAlign: 'center' },
})
