import { useWindowDimensions } from '@rootnative/core'
import { Skeleton as SkeletonBlock } from '@rootnative/components/skeleton'
import { StyleSheet, View } from 'react-native'
import { GRID_GAP, gridInset, posterColumns } from '../lib/grid'
import { LIFT_SPACE } from '../lib/motion'
import { CARD_WIDTH } from './MovieCard'

/**
 * One poster-shaped placeholder: image block plus the two text lines the real
 * card shows under it. The sizes match MovieCard so the layout does not shift
 * when the data arrives.
 *
 * The blocks come from `@rootnative/components/skeleton`. It owns the pulse —
 * a `surfaceContainerHighest` block on the theme's `durationExtraLong4` /
 * `easingStandard` loop, hidden from the accessibility tree, collapsing to a
 * static block under reduced motion. The local version reproduced all of that
 * by hand; only the sizes below are this app's concern.
 */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      {/*
        The 2:3 ratio lives on this wrapper, not on the block.

        Skeleton always writes a concrete `{ width, height }` style (`height`
        defaults to 16) ahead of the caller's `style`, and in React Native an
        explicit height beats `aspectRatio` — so a ratio-only block collapses
        to a 16dp strip. The wrapper owns the ratio and the block fills it, so
        the poster keeps its shape at a fixed width and at a percentage one.

        `borderRadius` is overridden for a related reason: `rounded` resolves
        to the theme's `cornerSmall`, tighter than the 12dp corner MovieCard's
        media box draws.
      */}
      <View style={styles.posterBox}>
        <SkeletonBlock height="100%" style={styles.poster} />
      </View>
      <SkeletonBlock height={14} width="85%" />
      <SkeletonBlock height={12} width="55%" />
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
      <SkeletonBlock height={20} width={180} style={styles.heading} />
      <View style={styles.rowCards}>
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    </View>
  )
}

/**
 * A loading stand-in for a poster grid, in the geometry of the grid it stands
 * in for.
 *
 * `width` is the width the results will lay out in: the content width on a
 * page, the window on the search sheet. The column count and the inset come
 * from lib/grid.ts, the same as the results, so each placeholder stands
 * where a card will and nothing moves when the data lands. An earlier
 * version resolved its columns from a breakpoint map and stretched each card
 * to its cell: on a phone the placeholders were full width and 16 from the
 * edge, and the 160 wide results then jumped in by 17.
 *
 * `rows` of placeholders, so the grid fills the viewport at every width
 * instead of showing a fixed number of cards that a wide window leaves half
 * empty. The rows are laid out one by one, as FlatList lays out the results,
 * rather than wrapped: a window too narrow for two columns then overflows
 * the same way the results do, instead of dropping to one.
 */
export function SkeletonGrid({ width, rows = 2 }: { width: number; rows?: number }) {
  const columns = posterColumns(width)

  return (
    <View
      testID="skeleton-grid"
      style={[styles.grid, { paddingHorizontal: gridInset(width) }]}
    >
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: columns }, (_, column) => (
            <SkeletonCard key={column} />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, gap: 8 },
  // The TMDB poster ratio, matching MovieCard's media box, so the skeleton
  // occupies the same space the real card will.
  posterBox: { width: '100%', aspectRatio: 2 / 3 },
  // Matches the Card's corner.
  poster: { borderRadius: 12 },
  // `overflow: 'hidden'` keeps the last card clipped at the edge. Without it the
  // overflowing card widens the page on web and adds a horizontal scrollbar the
  // real FlatList row does not have.
  // The gap matches the real row, where the space under the heading is the
  // list's own LIFT_SPACE padding rather than a gap.
  row: { gap: LIFT_SPACE, marginBottom: 24, overflow: 'hidden' },
  heading: { marginHorizontal: ROW_PADDING },
  rowCards: { flexDirection: 'row', gap: ROW_GAP, paddingHorizontal: ROW_PADDING },
  // The same top inset and the same gap as the results list, so the
  // placeholder stands where the cards will. Clipped for the overflow case
  // the comment on SkeletonGrid describes.
  grid: { paddingTop: GRID_GAP, gap: GRID_GAP, overflow: 'hidden' },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
})
