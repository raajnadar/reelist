import { Motion } from '@rootnative/inertia'
import type { ComponentProps } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { GRID_GAP, gridInset, posterColumns } from '../lib/grid'

type Props<T extends { id: number }> = Omit<
  ComponentProps<typeof Motion.FlatList<T>>,
  'numColumns' | 'columnWrapperStyle' | 'contentContainerStyle' | 'keyExtractor'
> & {
  /** The content width, from lib/useContentWidth.ts. It sets the column count. */
  width: number
  /** The padding around the posters. The horizontal inset is added here. */
  contentStyle?: StyleProp<ViewStyle>
}

/**
 * The poster grid: search, genre, the watchlist, a franchise, and a person
 * draw the same set of films to scan. See lib/grid.ts for the numbers.
 *
 * `key` forces a remount when the column count changes. FlatList caches its
 * layout per item and does not recompute on a numColumns change alone, which
 * leaves the old grid geometry behind after a rotation or a browser resize.
 */
export function PosterGrid<T extends { id: number }>({
  width,
  contentStyle,
  ...rest
}: Props<T>) {
  const columns = posterColumns(width)
  return (
    <Motion.FlatList<T>
      keyExtractor={(item) => String(item.id)}
      showsVerticalScrollIndicator={false}
      {...rest}
      key={columns}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.column : undefined}
      contentContainerStyle={[
        styles.list,
        { paddingHorizontal: gridInset(width) },
        contentStyle,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  list: { gap: GRID_GAP },
  column: { gap: GRID_GAP },
})
