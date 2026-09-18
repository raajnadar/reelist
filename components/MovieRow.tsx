import { Typography } from '@rootnative/components/typography'
import { useInView } from '@rootnative/inertia'
import { useRef } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { LIFT_SPACE } from '../lib/motion'
import type { Movie } from '../lib/types'
import { MovieCard } from './MovieCard'

export function MovieRow({ title, movies }: { title: string; movies: Movie[] }) {
  const ref = useRef<View>(null)

  /*
    The row, not the card, owns the trigger.

    useInView reads the NEAREST scroll container, and a MovieCard's nearest one
    is the horizontal FlatList below — which knows nothing about whether the row
    has been scrolled past vertically. Asking here, one level up, binds to the
    vertical scroller the row actually sits in. The cards then read the row's
    answer through `progress`.

    `amount` is low on purpose: a row is taller than its heading, and waiting
    for a fixed fraction of it would start the cascade only once the posters
    were well onto the screen.
  */
  const progress = useInView(ref, { amount: 0.1, transition: 'cascade' })

  if (!movies.length) return null

  return (
    <View ref={ref} style={styles.row}>
      <Typography variant="titleMediumEmphasized" style={styles.heading}>
        {title}
      </Typography>

      {/*
        Horizontal FlatList, not ScrollView: it mounts only the visible cards.
        With 20 posters across three rows that is ~9 images instead of 60.
      */}
      <FlatList
        data={movies}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item, index }) => (
          <MovieCard movie={item} index={index} progress={progress} />
        )}
        style={styles.scroller}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, marginBottom: 24 },
  heading: { paddingHorizontal: 16 },
  /*
    The scroller keeps room for the hover lift and gives it straight back.
    A horizontal scroller clips what leaves it on the vertical axis, so
    without the padding the lifted card loses its top corners. The negative
    margin cancels the padding in the layout, which keeps the gap under the
    heading and the space below the row at the values above. See LIFT_SPACE.
  */
  scroller: { marginVertical: -LIFT_SPACE },
  list: { paddingHorizontal: 16, paddingVertical: LIFT_SPACE },
  separator: { width: 12 },
})
