import { Typography } from '@rootnative/components/typography'
import { FlatList, StyleSheet, View } from 'react-native'
import type { Movie } from '../lib/types'
import { MovieCard } from './MovieCard'

export function MovieRow({ title, movies }: { title: string; movies: Movie[] }) {
  if (!movies.length) return null

  return (
    <View style={styles.row}>
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
        renderItem={({ item }) => <MovieCard movie={item} />}
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
