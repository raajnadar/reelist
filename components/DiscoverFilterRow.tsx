import { Chip } from '@rootnative/components/chip'
import { useContentWidth } from '../lib/useContentWidth'
import { ScrollView, StyleSheet, View } from 'react-native'
import { appliedFilters, withoutFilter, type DiscoverFilters } from '../lib/discover'
import { gridInset } from '../lib/grid'
import { haptic } from '../lib/haptics'

/**
 * The chip row under the genre title: one chip that opens the filter sheet,
 * then one chip for each applied filter.
 *
 * A pick chip is an input chip, not a filter chip. A filter chip is a toggle,
 * and a screen reader names it "pressed", but a press here opens the sheet.
 * Its close icon clears that one pick without the sheet.
 *
 * A horizontal scroller rather than a wrap, so the grid starts at the same
 * height however many filters are on. The inset matches the grid below, so
 * the first chip lines up with the first card.
 */
export function DiscoverFilterRow({
  filters,
  onChange,
  onOpen,
}: {
  filters: DiscoverFilters
  onChange: (filters: DiscoverFilters) => void
  onOpen: () => void
}) {
  const width = useContentWidth()

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { paddingHorizontal: gridInset(width) }]}
      >
        <Chip
          variant="assist"
          leadingIcon="tune-variant"
          onPress={onOpen}
          testID="filter-open"
        >
          Filters
        </Chip>
        {appliedFilters(filters).map((applied) => (
          <Chip
            key={applied.param}
            variant="input"
            onPress={onOpen}
            onClose={() => {
              haptic('select')
              onChange(withoutFilter(filters, applied.param))
            }}
            accessibilityLabel={applied.description}
            closeAccessibilityLabel={`Remove ${applied.description}`}
            testID={`filter-${applied.param}`}
          >
            {applied.label}
          </Chip>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 8 },
})
