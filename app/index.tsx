import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BrandMark } from '../components/BrandMark'
import { GenreChips } from '../components/GenreChips'
import { MovieCarousel } from '../components/MovieCarousel'
import { MovieRow } from '../components/MovieRow'
import { SkeletonRow } from '../components/Skeleton'
import { getGenres, getPopular, getTopRated, getTrending } from '../lib/api'
import type { Genre, Movie } from '../lib/types'

type Row = { title: string; movies: Movie[] }

export default function HomeScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [genres, setGenres] = useState<Genre[]>([])

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
        // A MissingKeyError and a TmdbError both carry a message written for
        // the person who sees it: the first says how to set the key, the
        // second repeats what TMDB reported. Only an unknown throw falls back
        // to the generic line.
        setError(e instanceof Error ? e.message : 'Could not load movies')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  /**
   * The genres load on their own, deliberately not inside the Promise.all above.
   *
   * Joining them would tie the whole screen to the weakest request: one failed
   * genre call would take the `.catch` branch and replace three loaded film rows
   * with an error message. Here a failure only empties the list, and GenreChips
   * renders nothing for an empty list — so the chips are simply absent and the
   * rest of the screen is untouched.
   */
  useEffect(() => {
    let active = true

    getGenres()
      .then((list) => {
        if (active) setGenres(list)
      })
      .catch(() => {
        // Swallowed on purpose. There is no message to show for a missing
        // shortcut row, and reporting it would suggest the screen is broken.
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
      <View style={styles.header}>
        <View style={styles.brand}>
          <BrandMark size={26} />
          <Typography variant="headlineMedium" style={styles.title}>
            Reelist
          </Typography>
        </View>
        {/* An IconButton rather than an AppBar `action`: this screen draws its
            own title with the top inset above it, and swapping in an AppBar
            would change the home layout to add one button. */}
        <IconButton
          icon="magnify"
          variant="standard"
          accessibilityLabel="Search movies"
          onPress={() => router.push('/search')}
        />
      </View>

      {/* Outside the Presence block below, for the reason the search button is:
          the chips do not depend on the film rows, so they must not wait for
          them, disappear while they load, or vanish when they fail. */}
      <GenreChips genres={genres} />

      {/*
        Presence animates the swap between the three states. Each branch needs
        its own stable `key` — that is how Presence tells a replaced child from
        a re-rendered one. Without distinct keys the skeleton would be treated
        as the same element as the content and neither would transition.
      */}
      <Presence>
        {loading ? (
          <Motion.View
            key="loading"
            // No `initial`: the skeleton is on screen from the first frame, and
            // fading it in would add a delay before the app shows anything.
            exit={{ opacity: 0 }}
            transition="exit"
          >
            {/* Three rows, matching the three the screen loads. */}
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Motion.View>
        ) : error ? (
          <Motion.View
            key="error"
            initial={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition="enter"
            style={styles.centered}
          >
            <Typography variant="bodyMedium" color={theme.colors.error}>
              {error}
            </Typography>
          </Motion.View>
        ) : (
          <Motion.View
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // `flex: 1` is required, not decorative: this wrapper now sits
            // between the flexed screen and the ScrollView, and a wrapper with
            // no flex collapses to its content height and kills the scroll.
            style={styles.fill}
          >
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
          </Motion.View>
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
  },
  title: { paddingVertical: 12 },
  centered: { marginTop: 48, alignItems: 'center' },
})
