import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, useInterpolatedStyle, type SharedValue } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { Image, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
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

type Props = {
  movie: Movie
  index: number
  scrollX: SharedValue<number>
  /** Slot width for this screen. Narrower than the constant on small screens. */
  width: number
  /** Slot pitch, i.e. width + spacing. Must match the ScrollView's snap. */
  snap: number
}

export function CarouselCard({ movie, index, scrollX, width, snap }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const uri = posterUrl(movie.poster_path, 'w500')

  // Three stops: previous slot, this slot centered, next slot. The card reaches
  // full scale only when its own slot sits under the viewport center. The pitch
  // comes from the parent so the scale peak always lands on the snap point.
  const inputRange = [(index - 1) * snap, index * snap, (index + 1) * snap]

  // One shared value, four style keys, all on the UI thread. No re-render per
  // frame, so the row stays smooth regardless of how many cards are mounted.
  const animatedStyle = useInterpolatedStyle(
    scrollX,
    {
      scale: [0.84, 1, 0.84],
      opacity: [0.45, 1, 0.45],
      translateY: [18, 0, 18],
    },
    { inputRange },
  )

  // The hook returns Reanimated's DefaultStyle, a union that also covers text
  // keys, so it does not narrow to ViewStyle inside a style array. The map above
  // emits only transform and opacity, so the cast is safe. Remove it when
  // @rootnative/inertia types the return against the map it was given.
  const cardStyle = animatedStyle as ViewStyle

  return (
    <Motion.View style={[styles.slot, { width }, cardStyle]}>
      <Pressable
        onPress={() => router.push(`/movie/${movie.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${movie.title}. ${metaLine(movie.vote_average, movie.release_date)}`}
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
      </Pressable>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  slot: { marginRight: CAROUSEL_SPACING },
  card: { borderRadius: 20, overflow: 'hidden' },
  poster: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  meta: { paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
})
