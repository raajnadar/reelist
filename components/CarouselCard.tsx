import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, useInterpolatedStyle, type SharedValue } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { Image, StyleSheet, View } from 'react-native'
import { metaLine } from '../lib/format'
import { posterUrl } from '../lib/images'
import type { Movie } from '../lib/types'

/**
 * Ceiling on the centered card's width. The carousel sizes the card from the
 * screen so the leftover inset is just the peek strip; this stops that growth
 * on a tablet, where a full-width poster would dwarf the rows below it.
 */
export const CAROUSEL_MAX_CARD_WIDTH = 320
/** Gap between card slots. Slot pitch = width + spacing. */
export const CAROUSEL_SPACING = 16
/**
 * Minimum of the neighbouring card left visible at each edge. The centering
 * inset is (width - CARD) / 2, so on a wide screen the centered card floats in
 * blank space. Capping the inset at this value fills the edges with the next
 * card instead. See MovieCarousel for how the cap interacts with centering.
 */
export const CAROUSEL_PEEK = 48
/**
 * Degrees the card turns on its Y axis at one full slot from the center. The
 * centered card is always square on at 0; this is the tilt at the neighbouring
 * stop. Past roughly 20 degrees the poster art starts to read as distorted
 * rather than angled, and the text under it becomes hard to scan.
 */
export const CAROUSEL_TILT = 14

type Props = {
  movie: Movie
  index: number
  scrollX: SharedValue<number>
  /** Slot width for this screen. Narrower than the constant on small screens. */
  width: number
  /** Slot pitch, i.e. width + spacing. Must match the ScrollView's snap. */
  snap: number
  /**
   * Scroll distance between slot 0 and the viewport center on a screen where
   * the centering inset was capped. Zero when the row centers normally.
   */
  centerOffset: number
}

export function CarouselCard({
  movie,
  index,
  scrollX,
  width,
  snap,
  centerOffset,
}: Props) {
  const theme = useTheme()
  const router = useRouter()
  const uri = posterUrl(movie.poster_path, 'w500')

  // Three stops: previous slot, this slot centered, next slot. The card reaches
  // full scale only when its own slot sits under the viewport center. The pitch
  // comes from the parent so the scale peak always lands on the snap point.
  // centerOffset shifts the stops when the parent capped its centering inset,
  // because slot 0 then starts left of the viewport center.
  const center = index * snap - centerOffset
  const inputRange = [center - snap, center, center + snap]

  // One shared value, five style keys, all on the UI thread. No re-render per
  // frame, so the row stays smooth regardless of how many cards are mounted.
  //
  // rotateY turns the card away from the viewer as it leaves the center, so the
  // row reads as posters standing on a curved surface rather than a flat strip.
  // The sign flips across the center stop: the card on the left turns its right
  // edge toward the viewer, the card on the right turns its left edge, and the
  // centered card sits square on at 0. Without the flip both neighbours would
  // lean the same way and the row would look skewed instead of curved.
  const animatedStyle = useInterpolatedStyle(
    scrollX,
    {
      rotateY: [CAROUSEL_TILT, 0, -CAROUSEL_TILT],
      scale: [0.84, 1, 0.84],
      opacity: [0.45, 1, 0.45],
      translateY: [18, 0, 18],
    },
    { inputRange },
  )

  return (
    /*
      Two elements, because perspective and rotateY cannot share one here.
      useInterpolatedStyle builds the whole `transform` array itself, so a
      static `perspective` entry in the same style array is overwritten rather
      than merged, and the rotation renders as a flat horizontal squash with no
      depth. Putting perspective on the parent instead makes it the projection
      for the child's rotation, which is what gives the card its near and far
      edge. The parent also keeps the layout box (width and gap) unrotated, so
      the slot pitch the ScrollView snaps to never changes.
    */
    <View style={[styles.slot, { width }, styles.stage]}>
      <Motion.View style={animatedStyle}>
        {/*
          The press scale lives on its own Motion.Pressable INSIDE the
          scroll-driven wrapper, rather than on the wrapper itself. Both effects
          write `transform`, so sharing one element would mean the gesture layer
          and the scroll interpolation overwrite each other's scale every frame.
          Nesting composes them: the outer element owns the scroll position, the
          inner one owns the touch response.
        */}
        <Motion.Pressable
          onPress={() => router.push(`/movie/${movie.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${movie.title}. ${metaLine(movie.vote_average, movie.release_date)}`}
          gesture={{
            hovered: { scale: 1.03 },
            pressed: { scale: 0.97 },
          }}
          transition={{ pressed: 'press', hovered: 'hover' }}
          style={[styles.card, { backgroundColor: theme.colors.surfaceContainerHigh }]}
        >
          {uri ? (
            <Image source={{ uri }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View
              style={[
                styles.poster,
                styles.fallback,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
                No poster
              </Typography>
            </View>
          )}

          <View style={styles.meta}>
            <Typography variant="titleSmall" numberOfLines={1}>
              {movie.title}
            </Typography>
            <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
              {metaLine(movie.vote_average, movie.release_date)}
            </Typography>
          </View>
        </Motion.Pressable>
      </Motion.View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: { marginRight: CAROUSEL_SPACING },
  /**
   * The projection the child's rotateY is drawn through. A larger number moves
   * the viewer away and flattens the turn; a smaller one exaggerates it until
   * the far edge distorts. 800 keeps the near edge only slightly larger than
   * the far one, which is the effect we want — a card resting on an incline,
   * not a card seen through a wide lens.
   */
  stage: { transform: [{ perspective: 800 }] },
  card: { borderRadius: 20, overflow: 'hidden' },
  poster: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  meta: { paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
})
