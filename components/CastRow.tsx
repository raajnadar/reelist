import { Typography } from '@rootnative/components/typography'
import { useInView } from '@rootnative/inertia'
import { useRef } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import type { CastMember } from '../lib/types'
import { CastCard } from './CastCard'

/**
 * The billed cast, as a horizontal row.
 *
 * This mirrors MovieRow rather than sharing code with it. The two rows differ
 * in their data type and their card, which is all a shared version would take
 * as parameters, and the repository already keeps GenreChips separate for the
 * same reason.
 */
export function CastRow({ title, cast }: { title: string; cast: CastMember[] }) {
  const ref = useRef<View>(null)

  // The row owns the in-view trigger, for the reason MovieRow explains: a
  // card's nearest scroll container is the horizontal list, which cannot say
  // whether the row has been reached. This row is always well below the fold on
  // the detail screen, so without the trigger its cascade always ran unseen.
  const progress = useInView(ref, { amount: 0.1, transition: 'cascade' })

  // Absent, not empty. A film with no billed cast — an announced one — shows no
  // heading at all rather than a heading above nothing.
  if (!cast.length) return null

  return (
    <View ref={ref} style={styles.row}>
      <Typography variant="titleMediumEmphasized" style={styles.heading}>
        {title}
      </Typography>

      {/*
        Horizontal FlatList for the reason MovieRow uses one: a large film bills
        over a hundred people, and only the visible faces should mount.
      */}
      <FlatList
        data={cast}
        horizontal
        showsHorizontalScrollIndicator={false}
        // The person id alone is not unique here. An actor credited twice in one
        // film — a dual role, or a voice part beside a screen part — appears
        // twice with the same id, and FlatList then warns and reuses one row.
        keyExtractor={(member, index) => `${member.id}-${index}`}
        renderItem={({ item, index }) => (
          <CastCard member={item} index={index} progress={progress} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, marginBottom: 24 },
  heading: { paddingHorizontal: 16 },
  list: { paddingHorizontal: 16 },
  separator: { width: 12 },
})
