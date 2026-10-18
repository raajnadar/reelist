import { useTheme } from '@rootnative/core'
import { useInterpolatedStyle, type SharedValue } from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import { posterUrl } from '../lib/images'
import type { Movie } from '../lib/types'
import { nearSlots } from '../lib/useActiveSlot'
import { Scrim, type ScrimStop } from './Scrim'

/** The blur, in points. Large enough that no shape or face can be read. */
const BLUR = 48

/** Milliseconds a layer takes to dissolve in once its file arrives. */
const FADE_MS = 300

/**
 * How far the colour runs on under the next row, in points. The fade then
 * ends behind the next heading instead of in the empty space above it, so the
 * section has no lower edge to see.
 */
const BLEED = 56

/**
 * The page colour over the blurred pictures, top to bottom. The edges are
 * solid, so the colour starts and ends in the page colour. The steps between
 * follow a smoothstep curve: a straight ramp shows a line where it starts.
 *
 * The middle lets most of the colour through, behind the posters. The caption
 * sits on the lower ramp, where the page colour is back to most of its
 * strength, so its text stays readable in both schemes.
 */
const VEIL: readonly ScrimStop[] = [
  [0, 1],
  [0.06, 0.95],
  [0.12, 0.82],
  [0.18, 0.66],
  [0.24, 0.5],
  [0.3, 0.37],
  [0.36, 0.32],
  [0.52, 0.32],
  [0.6, 0.37],
  [0.68, 0.5],
  [0.76, 0.66],
  [0.84, 0.82],
  [0.92, 0.95],
  [1, 1],
]

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
 * The colour of the centred poster, spread behind the whole carousel.
 *
 * Each slot has a blurred layer whose opacity peaks when its card is centred,
 * so the page colour changes under the finger, on the UI thread, as the row
 * moves. Only the centred slot and its two neighbours are mounted: a swipe
 * crosses one neighbour at a time, and a full-width blurred picture costs a
 * lot on the web, where each is a CSS filter.
 *
 * The picture is the poster, not the backdrop. The colour then matches the
 * card the reader looks at, and the file is the one the card already loaded.
 * A backdrop is often a dim still that blurs to a flat grey.
 */
export function CarouselBackdrop({ movies, scrollX, snap, active, total }: Props) {
  const theme = useTheme()

  return (
    <View aria-hidden style={styles.root}>
      <View style={styles.frame}>
        {nearSlots(active, total).map((slot) => (
          <BackdropLayer
            key={slot}
            movie={movies[slot % movies.length]}
            slot={slot}
            scrollX={scrollX}
            snap={snap}
          />
        ))}
      </View>
      <Scrim color={theme.colors.background} stops={VEIL} />
    </View>
  )
}

function BackdropLayer({
  movie,
  slot,
  scrollX,
  snap,
}: {
  movie: Movie
  slot: number
  scrollX: SharedValue<number>
  snap: number
}) {
  const center = slot * snap
  const style = useInterpolatedStyle(
    scrollX,
    { opacity: [0, 1, 0] },
    { inputRange: [center - snap, center, center + snap] },
  )
  const uri = posterUrl(movie.poster_path, 'w500')

  if (!uri) return null

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={{ uri }}
        style={styles.picture}
        contentFit="cover"
        blurRadius={BLUR}
        transition={FADE_MS}
        cachePolicy="memory-disk"
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Later siblings draw over it, so the bleed passes under the next row.
  root: {
    position: 'absolute',
    top: 0,
    bottom: -BLEED,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  // One point short of the scrim at the top and the bottom. The section can
  // end on a half pixel, and there the blurred picture showed under the solid
  // edge of the scrim as a thin line.
  frame: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  // Larger than the frame on every side. A blur fades the edge of a picture
  // to transparent, and the frame cuts that soft edge off.
  picture: {
    position: 'absolute',
    top: '-15%',
    bottom: '-15%',
    left: '-15%',
    right: '-15%',
  },
})
