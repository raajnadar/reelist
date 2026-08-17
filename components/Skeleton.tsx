import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native'
import { CARD_WIDTH } from './MovieCard'

/**
 * A placeholder block that pulses while real content loads.
 *
 * The pulse is an opacity loop rather than a translating highlight bar. A
 * moving gradient needs a masked overlay sized to the block and a linear
 * gradient dependency; opacity reads as the same "loading" signal, animates on
 * the UI thread, and costs one property.
 */
export function Skeleton({
  style,
  delay = 0,
}: {
  style?: ViewStyle | ViewStyle[]
  /** Offsets the loop so a group of blocks does not pulse in lockstep. */
  delay?: number
}) {
  const theme = useTheme()

  return (
    <Motion.View
      // The keyframe array is the sequence form: dim, bright, dim. With
      // `repeat: 'infinite'` and `alternate` left off, each cycle replays from
      // the start rather than bouncing, which keeps the two ends at the same
      // brightness and hides the seam.
      animate={{ opacity: [0.35, 0.7, 0.35] }}
      transition={{ ...shimmerLoop, delay }}
      style={[
        styles.block,
        { backgroundColor: theme.colors.surfaceContainerHighest },
        style,
      ]}
    />
  )
}

/**
 * One poster-shaped placeholder: image block plus the two text lines the real
 * card shows under it. The sizes match MovieCard so the layout does not shift
 * when the data arrives.
 */
export function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <View style={styles.card}>
      <Skeleton style={styles.poster} delay={index * 90} />
      <Skeleton style={styles.titleLine} delay={index * 90 + 60} />
      <Skeleton style={styles.metaLine} delay={index * 90 + 120} />
    </View>
  )
}

const ROW_GAP = 12
const ROW_PADDING = 16

/**
 * How many placeholder cards a row of `width` needs to reach the right edge.
 *
 * The real row is a horizontal FlatList over 20 movies, so it always fills the
 * viewport however wide the window is. A fixed count does not: four 160px cards
 * cover a phone but leave most of a desktop window empty, and the skeleton then
 * reads as a short row rather than as a loading one.
 *
 * The count rounds up, because the card that crosses the edge is what makes the
 * row look like it continues past it.
 */
export function skeletonCardCount(width: number) {
  const available = width - ROW_PADDING * 2
  const perCard = CARD_WIDTH + ROW_GAP
  // A zero or negative width happens before the first measurement on native.
  // One card is the floor: an empty row would flash as a bare heading.
  return Math.max(1, Math.ceil((available + ROW_GAP) / perCard))
}

/**
 * A loading stand-in for one horizontal row, including its heading block.
 *
 * The cards past the right edge are clipped rather than wrapped, which is why
 * the row overflows by design instead of counting exactly.
 */
export function SkeletonRow({ count }: { count?: number }) {
  const { width } = useWindowDimensions()
  const cards = count ?? skeletonCardCount(width)

  return (
    <View style={styles.row}>
      <Skeleton style={styles.heading} />
      <View style={styles.rowCards}>
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </View>
    </View>
  )
}

const shimmerLoop = { type: 'timing', duration: 1100, repeat: 'infinite' } as const

const styles = StyleSheet.create({
  block: { borderRadius: 8, overflow: 'hidden' },
  card: { width: CARD_WIDTH, gap: 8 },
  // Matches MovieCard's poster ratio and the Card's corner, so the skeleton
  // occupies the same box the real card will.
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 12 },
  titleLine: { height: 14, width: '85%' },
  metaLine: { height: 12, width: '55%' },
  // `overflow: 'hidden'` keeps the last card clipped at the edge. Without it the
  // overflowing card widens the page on web and adds a horizontal scrollbar the
  // real FlatList row does not have.
  row: { gap: 12, marginBottom: 24, overflow: 'hidden' },
  heading: { height: 20, width: 180, marginHorizontal: ROW_PADDING },
  rowCards: { flexDirection: 'row', gap: ROW_GAP, paddingHorizontal: ROW_PADDING },
})
