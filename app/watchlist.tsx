import { AppBar } from '@rootnative/components/appbar'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard } from '../components/MovieCard'
import { SkeletonGrid } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { GRID_GAP, GRID_PADDING, posterColumns } from '../lib/grid'
import { useWatchlist } from '../lib/watchlist'

export default function WatchlistScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columns = posterColumns(width)

  /**
   * The saved films come from the device, not from TMDB.
   *
   * This screen makes no request and has no failure state for that reason: a
   * saved film carries the fields its card draws, so the grid needs nothing
   * from the network. The only wait is the read, and `loaded` is what the
   * placeholders below stand in for.
   */
  const { movies, loaded } = useWatchlist()

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppBar
        title="Watchlist"
        insetTop
        canGoBack
        // Matches search, genre, and detail: `router.back` alone dead-ends when
        // this screen is the first entry in the history, as it is on a deep
        // link.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Presence>
        {!loaded ? (
          /*
            The device read is fast, and on a cold start it is not instant. The
            placeholders are here so a reader with a full watchlist never sees
            "Nothing saved yet" for a frame before their films arrive.
          */
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <SkeletonGrid />
          </Motion.View>
        ) : movies.length ? (
          <Motion.View
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.fill}
          >
            <FlatList
              data={movies}
              // `key` forces a remount when the column count changes. FlatList
              // caches its layout per item and does not recompute on a
              // numColumns change alone, which leaves the old grid geometry
              // behind after a rotation or a browser resize.
              key={columns}
              numColumns={columns}
              keyExtractor={(m) => String(m.id)}
              renderItem={({ item, index }) => <MovieCard movie={item} index={index} />}
              columnWrapperStyle={columns > 1 ? styles.column : undefined}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
              showsVerticalScrollIndicator={false}
            />
          </Motion.View>
        ) : (
          /*
            Nothing saved. The action opens search rather than the home screen:
            a reader on an empty watchlist has a film in mind, and the AppBar
            already carries the way back.
          */
          <StateMessage
            key="empty"
            testID="watchlist-empty"
            icon="bookmark-outline"
            title="Nothing saved yet"
            body="Open a movie and press Save. The films you keep appear here."
            actionLabel="Find a movie"
            actionIcon="magnify"
            onAction={() => router.push('/search')}
          />
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  /*
    The top inset is inside the scroller, not above it: a vertical scroller
    clips at its own top edge, so a card in the first row that grows under the
    pointer would come back cut off. GRID_GAP is the room it needs — see
    LIFT_SPACE — and it is the same space that separates two rows.
  */
  list: { paddingHorizontal: GRID_PADDING, paddingTop: GRID_GAP, gap: GRID_GAP },
  column: { gap: GRID_GAP },
})
