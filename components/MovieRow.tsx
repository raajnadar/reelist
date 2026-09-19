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
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  /*
    The list pads itself by LIFT_SPACE, and that padding IS the gap under the
    heading — the row declares no `gap` of its own. A hovered card grows and
    rises into this padding, so the space has to be real: a negative margin
    that pulled the same amount back would put the card over the heading.
    The margin below carries the rest of the 24 the row keeps under it.
  */
  row: { marginBottom: 24 - LIFT_SPACE },
  heading: { paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingVertical: LIFT_SPACE },
  separator: { width: 12 },
})
