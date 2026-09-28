import { Chip } from '@rootnative/components/chip'
import { Menu } from '@rootnative/components/menu'
import { useWindowDimensions } from '@rootnative/core'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
  DECADES,
  LANGUAGES,
  RATINGS,
  RUNTIMES,
  type DiscoverFilters,
  type FilterOption,
} from '../lib/discover'
import { gridInset } from '../lib/grid'

/**
 * One filter: a chip that names the pick, and the menu that changes it.
 *
 * The chip reads as the category until the reader picks, and then as the pick.
 * The close icon the filter variant adds on selection is the way to clear one
 * filter without the menu, and the first item in the menu is the same clear for
 * a reader who opened it.
 */
function FilterMenu<T extends string | number>({
  id,
  name,
  options,
  value,
  onSelect,
}: {
  id: string
  name: string
  options: FilterOption<T>[]
  value: T | undefined
  onSelect: (value: T | undefined) => void
}) {
  const current = options.find((o) => o.value === value)

  return (
    <Menu
      // The language list is the long one, and every item of it fits on a
      // phone. The cap keeps it from filling the screen on a tablet.
      maxHeight={320}
      anchor={
        <Chip
          variant="filter"
          selected={current !== undefined}
          onClose={() => onSelect(undefined)}
          accessibilityLabel={current ? `${name}: ${current.label}` : name}
          testID={`filter-${id}`}
        >
          {current ? current.label : name}
        </Chip>
      }
    >
      <Menu.Item
        label={`Any ${name.toLowerCase()}`}
        trailingIcon={current === undefined ? 'check' : undefined}
        onPress={() => onSelect(undefined)}
      />
      {options.map((o) => (
        <Menu.Item
          key={String(o.value)}
          label={o.label}
          trailingIcon={o.value === value ? 'check' : undefined}
          onPress={() => onSelect(o.value)}
        />
      ))}
    </Menu>
  )
}

/**
 * The filter chips under the genre title.
 *
 * A horizontal scroller rather than a wrap: four chips fit one phone width
 * only while none is picked, and a pick with a long label pushes the last one
 * off the edge. The inset matches the grid below, so the first chip lines up
 * with the first card.
 */
export function DiscoverFilterRow({
  filters,
  onChange,
}: {
  filters: DiscoverFilters
  onChange: (filters: DiscoverFilters) => void
}) {
  const { width } = useWindowDimensions()

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { paddingHorizontal: gridInset(width) }]}
      >
        <FilterMenu
          id="decade"
          name="Decade"
          options={DECADES}
          value={filters.decade}
          onSelect={(decade) => onChange({ ...filters, decade })}
        />
        <FilterMenu
          id="rating"
          name="Rating"
          options={RATINGS}
          value={filters.rating}
          onSelect={(rating) => onChange({ ...filters, rating })}
        />
        <FilterMenu
          id="language"
          name="Language"
          options={LANGUAGES}
          value={filters.language}
          onSelect={(language) => onChange({ ...filters, language })}
        />
        <FilterMenu
          id="runtime"
          name="Runtime"
          options={RUNTIMES}
          value={filters.runtime}
          onSelect={(runtime) => onChange({ ...filters, runtime })}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 8 },
})
