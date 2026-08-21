import { Grid } from '@rootnative/components/layout'
import { useBreakpointValue } from '@rootnative/core'
import { Skeleton as SkeletonBlock } from '@rootnative/components/skeleton'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
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
export function SkeletonCard({ stretch = false }: { stretch?: boolean }) {
  return (
    // In a Grid the cell already sets the width, so the card fills it. In a
    // horizontal row there is no cell, so it keeps MovieCard's fixed width.
    <View style={stretch ? styles.cardStretch : styles.card}>
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
 * A loading stand-in for a poster grid, sized to the window.
 *
 * `Grid` takes a breakpoint map rather than a measured column count: the
 * placeholders only have to hold the right shape, and a map is resolved by the
 * library against the MD3 window size classes. The real results grid still
 * measures, because its column count has to match the card width exactly.
 *
 * `rows` of placeholders, so the grid fills the viewport at every width instead
 * of showing a fixed number of cards that a wide window leaves half empty.
 */
export function SkeletonGrid({ rows = 2 }: { rows?: number }) {
  // The same map Grid resolves, read here so the card count matches the column
  // count. Rendering a fixed worst-case count instead would build six rows on a
  // phone to show two, and rely on clipping to hide the rest.
  const columns = useBreakpointValue(SKELETON_COLUMNS)

  return (
    /*
      Each card is a direct child of the Grid, not grouped under a wrapper.
      Grid maps over its own children and puts each one in a cell View sized
      to `100 / columns` percent, so a single wrapper element would become one
      cell holding every card — a column rather than a grid.

      That is also why `<Stagger>` is not used here. It renders no host view
      and assigns delays from its own children's render order, so it can
      neither sit inside the Grid (it would collapse to one cell) nor around it
      (it would see one child). The cards pulse together instead, which is what
      the library block does on its own.
    */
    <Grid columns={SKELETON_COLUMNS} gap={ROW_GAP} style={styles.grid}>
      {Array.from({ length: columns * rows }, (_, i) => (
        <SkeletonCard key={i} stretch />
      ))}
    </Grid>
  )
}

/**
 * Placeholder columns per MD3 window size class.
 *
 * Two is the floor for the same reason the results grids use it: one column
 * would give each poster the full width, which reads as a list of billboards
 * rather than a grid.
 */
const SKELETON_COLUMNS = { compact: 2, medium: 3, expanded: 4, large: 6 } as const

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, gap: 8 },
  cardStretch: { width: '100%', gap: 8 },
  // The TMDB poster ratio, matching MovieCard's media box, so the skeleton
  // occupies the same space the real card will.
  posterBox: { width: '100%', aspectRatio: 2 / 3 },
  // Matches the Card's corner.
  poster: { borderRadius: 12 },
  // `overflow: 'hidden'` keeps the last card clipped at the edge. Without it the
  // overflowing card widens the page on web and adds a horizontal scrollbar the
  // real FlatList row does not have.
  row: { gap: 12, marginBottom: 24, overflow: 'hidden' },
  heading: { marginHorizontal: ROW_PADDING },
  rowCards: { flexDirection: 'row', gap: ROW_GAP, paddingHorizontal: ROW_PADDING },
  grid: { paddingHorizontal: ROW_PADDING },
})
