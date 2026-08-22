import { Chip } from '@rootnative/components/chip'
import { Motion } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { FlatList, StyleSheet, View } from 'react-native'
import { entranceTransition } from '../lib/motion'
import type { Genre } from '../lib/types'

/**
 * The genre shortcuts under the home header.
 *
 * The row renders nothing at all when the list is empty. Genres are a secondary
 * way into the catalogue — the film rows below are the primary one — so a failed
 * or still-loading genre request leaves no gap, no placeholder, and no error.
 * The caller passes an empty array for every one of those cases.
 *
 * `suggestion` is the variant, not `filter`: these chips navigate to another
 * screen rather than narrow what is on this one, and a filter chip carries a
 * selected state that would never be set here.
 *
 * `inset` is the row's own horizontal padding, which the home screen needs and
 * the detail screen does not: there the chips sit inside a body that already
 * pads itself, and a second inset would step them in from the title above them.
 * `gutter` is the space below the row, for the same reason — the detail body
 * spaces its own children.
 */
export function GenreChips({
  genres,
  inset = 16,
  gutter = 20,
}: {
  genres: Genre[]
  inset?: number
  gutter?: number
}) {
  const router = useRouter()

  if (!genres.length) return null

  return (
    <View style={{ marginBottom: gutter }}>
      <FlatList
        data={genres}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(g) => String(g.id)}
        contentContainerStyle={{ paddingHorizontal: inset }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => (
          // The same staggered entrance the cards use, so the chips arrive as
          // part of the screen rather than as a separate element appearing over it.
          <Motion.View
            initial={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={entranceTransition(index)}
          >
            <Chip
              variant="suggestion"
              onPress={() =>
                router.push(`/genre/${item.id}?name=${encodeURIComponent(item.name)}`)
              }
            >
              {item.name}
            </Chip>
          </Motion.View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  separator: { width: 8 },
})
