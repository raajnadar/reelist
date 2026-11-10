import { AppBar } from '@rootnative/components/appbar'
import { useSnackbar } from '@rootnative/components/snackbar'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { PageHead } from '@rootnative/seo/expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GenreGrid } from '../../components/GenreGrid'
import { MovieRow } from '../../components/MovieRow'
import { PullToRefresh } from '../../components/PullToRefresh'
import { SkeletonRow } from '../../components/Skeleton'
import { FailureMessage } from '../../components/FailureMessage'
import { getGenres, getNowPlaying, getUpcoming } from '../../lib/api'
import { GENRES_KEY } from '../../lib/resourceCache'
import { useBarScroll } from '../../lib/floatingBar'
import { exploreMeta, metadataFor } from '../../lib/head'
import { regionName, useRegion } from '../../lib/region'
import { useResource } from '../../lib/useResource'
import type { Genre, Movie } from '../../lib/types'

export const generateMetadata = () => metadataFor(exploreMeta)

type Row = { title: string; movies: Movie[] }

/**
 * The ways into the catalogue that are not a film row on the home: the
 * cinemas of the reader's country, and every genre.
 *
 * The country is the one "Where to watch" reads, so the about screen's region
 * setting moves both. The code is in the resource key, so a change of region
 * is a new request, and a return to a previous one draws from the store.
 */
export default function ExploreScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { onScroll } = useBarScroll()
  const { code: region } = useRegion()

  /**
   * The two cinema rows, as one resource, for the reason the home loads its
   * rows together: two rows and a gap is worse than a screen that waits.
   */
  const rows = useResource<Row[]>(
    `explore:rows:${region}`,
    async () => {
      const [nowPlaying, upcoming] = await Promise.all([
        getNowPlaying(region),
        getUpcoming(region),
      ])
      return [
        { title: `In cinemas in ${regionName(region)}`, movies: nowPlaying.results },
        { title: 'Coming soon', movies: upcoming.results },
      ]
    },
    'Could not load films',
  )

  /**
   * The genres load on their own, as on the home: one failed genre call must
   * not replace two loaded film rows with an error. A failure leaves the grid
   * out, and the rest of the screen stands.
   */
  const genres = useResource<Genre[]>(GENRES_KEY, getGenres, 'Could not load genres')

  const retry = () => {
    rows.reload()
    genres.reload()
  }

  const snackbar = useSnackbar()

  const refresh = async () => {
    const [rowsOk] = await Promise.all([rows.refresh(), genres.refresh()])
    if (!rowsOk) {
      snackbar.show({ message: 'Could not refresh', duration: 'short', replace: true })
    }
  }

  const loading = rows.loading && rows.data === null
  const failure = rows.data === null ? rows.failure : null

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PageHead {...exploreMeta} />
      {/* A destination, like the home: no way back in the bar. The navigation
          around the screen is the way to every other page. */}
      <AppBar title="Explore" insetTop />

      <Presence>
        {loading ? (
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <SkeletonRow />
            <SkeletonRow />
          </Motion.View>
        ) : failure ? (
          <FailureMessage
            key="error"
            testID="explore-error"
            failure={failure}
            title="Could not load films"
            onRetry={retry}
          />
        ) : (
          <Motion.View
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // `flex: 1` keeps the scroll: see the same wrapper on the home.
            style={styles.fill}
          >
            {/* Motion.ScrollView, so each MovieRow can tell when it is
                reached. See the home screen. */}
            <Motion.ScrollView
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + 16 },
              ]}
              refreshControl={
                <PullToRefresh
                  refreshing={rows.refreshing}
                  onRefresh={() => void refresh()}
                />
              }
            >
              {(rows.data ?? []).map((row) => (
                <MovieRow key={row.title} title={row.title} movies={row.movies} />
              ))}
              <GenreGrid genres={genres.data ?? []} />
            </Motion.ScrollView>
          </Motion.View>
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  // The bar pads its own bottom, so the first row needs the gap the home's
  // chips give it there.
  content: { paddingTop: 8 },
})
