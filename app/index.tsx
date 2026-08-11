import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCarousel } from '../components/MovieCarousel'
import { MovieRow } from '../components/MovieRow'
import { getPopular, getTopRated, getTrending } from '../lib/api'
import type { Movie } from '../lib/types'

type Row = { title: string; movies: Movie[] }

export default function HomeScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Promise.all and the loading state do nothing useful against static data.
  // That is the point: when lib/api.ts starts hitting the network, this screen
  // already handles the latency and the failure.
  useEffect(() => {
    let active = true

    Promise.all([getTrending(), getPopular(), getTopRated()])
      .then(([trending, popular, topRated]) => {
        if (!active) return
        setRows([
          { title: 'Trending this week', movies: trending.results },
          { title: 'Popular', movies: popular.results },
          { title: 'Top rated', movies: topRated.results },
        ])
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Could not load movies')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
      ]}
    >
      <Typography variant="headlineMedium" style={styles.title}>
        Reelist
      </Typography>

      {loading ? (
        <ActivityIndicator style={styles.centered} color={theme.colors.primary} />
      ) : error ? (
        <View style={styles.centered}>
          <Typography variant="bodyMedium" color={theme.colors.error}>
            {error}
          </Typography>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {/*
            The first row gets the lightbox carousel as a featured treatment.
            The rest stay compact rows — the scale effect loses its weight if
            every row uses it.
          */}
          {rows.map((row, index) =>
            index === 0 ? (
              <MovieCarousel key={row.title} title={row.title} movies={row.movies} />
            ) : (
              <MovieRow key={row.title} title={row.title} movies={row.movies} />
            ),
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { paddingHorizontal: 16, paddingVertical: 12 },
  centered: { marginTop: 48, alignItems: 'center' },
})
