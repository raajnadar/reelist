import { AppBar } from '@rootnative/components/appbar'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard, CARD_WIDTH } from '../../components/MovieCard'
import { SkeletonCard } from '../../components/Skeleton'
import { getMoviesByGenre } from '../../lib/api'
import type { Movie } from '../../lib/types'

const GAP = 12
const PADDING = 16

/**
 * How many poster columns fit in `width`.
 *
 * The same rule the search grid uses, and the same floor of two: one column on
 * a narrow window would give each poster the full width, which reads as a list
 * of billboards rather than a grid.
 */
export function genreColumnCount(width: number) {
  const available = width - PADDING * 2
  return Math.max(2, Math.floor((available + GAP) / (CARD_WIDTH + GAP)))
}

/**
 * Appends the films of a newly loaded page, dropping any already on screen.
 *
 * TMDB pages a ranking, not a snapshot. A film can move between pages while the
 * user reads, and then arrive twice — which gives FlatList two children with the
 * same key. That is a real defect rather than a cosmetic one: React warns, and
 * the duplicate card takes the wrong press target.
 */
export function mergePages(seen: Movie[], incoming: Movie[]): Movie[] {
  const ids = new Set(seen.map((m) => m.id))
  return [...seen, ...incoming.filter((m) => !ids.has(m.id))]
}

export default function GenreScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columns = genreColumnCount(width)

  const params = useLocalSearchParams<{ id: string; name?: string }>()
  const genreId = Number(params.id)

  /**
   * Everything one genre's request produced, tagged with the genre it belongs
   * to.
   *
   * Tagged rather than reset, which is the search screen's structure and for
   * the same two reasons. Clearing state at the top of the effect would set
   * state synchronously during the commit and cascade a render; and holding the
   * films, the page, and the id in one value means they can never disagree, as
   * four separate `useState` calls could when a second genre opens over a first.
   */
  const [outcome, setOutcome] = useState<{
    genreId: number
    movies: Movie[]
    page: number
    totalPages: number
    error: string | null
  } | null>(null)

  const [loadingMore, setLoadingMore] = useState(false)

  // A route parameter is a string from an untrusted source: a deep link can
  // carry anything. TMDB answers an unparseable `with_genres` with an
  // unfiltered list, so the check happens here rather than being left to a
  // response that looks successful.
  const validId = Number.isInteger(genreId) && genreId > 0

  // The first page. Keyed on the id so opening a second genre from a deep link
  // reloads rather than showing the previous genre's films.
  useEffect(() => {
    if (!validId) return

    let active = true

    getMoviesByGenre(genreId, 1)
      .then((paged) => {
        if (!active) return
        setOutcome({
          genreId,
          movies: paged.results,
          page: paged.page,
          totalPages: paged.total_pages,
          error: null,
        })
      })
      .catch((e: unknown) => {
        if (!active) return
        setOutcome({
          genreId,
          movies: [],
          page: 1,
          totalPages: 1,
          // The same contract as the other screens: a MissingProxyUrlError and
          // a TmdbError each carry a message written for the person reading it.
          error: e instanceof Error ? e.message : 'Could not load movies',
        })
      })

    return () => {
      active = false
    }
  }, [genreId, validId])

  // The outcome counts only while it describes the genre being shown. An
  // outcome for the previous genre is ignored rather than cleared.
  const current = outcome && outcome.genreId === genreId ? outcome : null
  const movies = current?.movies ?? []
  const page = current?.page ?? 1
  const totalPages = current?.totalPages ?? 1
  // Derived, not stored: a bad id is known at render time, and there is a
  // request outstanding whenever a valid genre has no outcome yet.
  const error = validId ? (current?.error ?? null) : 'That genre does not exist.'
  const loading = validId && !current

  /**
   * The next page, requested when the grid nears its end.
   *
   * `loadingMore` is the lock as well as the spinner flag. FlatList fires
   * `onEndReached` more than once for a single approach to the end, and without
   * the guard each firing would request the same page again.
   *
   * `lib/api.ts` clamps `total_pages` to the TMDB ceiling of 500, so this
   * comparison is the only stop condition the screen needs.
   */
  const loadMore = useCallback(() => {
    if (loading || loadingMore || error) return
    if (page >= totalPages) return

    setLoadingMore(true)
    const next = page + 1

    getMoviesByGenre(genreId, next)
      .then((paged) => {
        // Written through the updater so the merge reads the films actually on
        // screen. The genre is checked again inside it: a page can land after
        // the user opened a different genre, and appending it there would show
        // one genre's films under another's name.
        setOutcome((prev) =>
          prev && prev.genreId === genreId
            ? {
                ...prev,
                movies: mergePages(prev.movies, paged.results),
                page: paged.page,
                totalPages: paged.total_pages,
              }
            : prev,
        )
      })
      .catch(() => {
        // A failed page is not a failed screen. The films already loaded stay,
        // and the next scroll to the end tries again — so this needs no message.
      })
      .finally(() => setLoadingMore(false))
  }, [genreId, page, totalPages, loading, loadingMore, error])

  const title = params.name ?? 'Genre'

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppBar
        title={title}
        insetTop
        canGoBack
        // Matches search and detail: `router.back` alone dead-ends when this
        // screen is the first entry in the history, as it is on a deep link.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Presence>
        {loading ? (
          // A grid of placeholders, not a spinner: it holds the shape the
          // results will take, so the layout does not jump when they arrive.
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <View style={styles.skeletonGrid}>
              {Array.from({ length: columns * 2 }, (_, i) => (
                <SkeletonCard key={i} index={i} />
              ))}
            </View>
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
              onEndReached={loadMore}
              // Half a screen of runway. Lower and the user reaches the end
              // before the next page lands; higher and the screen fetches
              // pages nobody scrolled to.
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footer}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : null
              }
              showsVerticalScrollIndicator={false}
            />
          </Motion.View>
        ) : (
          <Motion.View
            key="empty"
            initial={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition="enter"
            style={styles.centered}
          >
            <Typography variant="bodyMedium" color={theme.colors.onSurfaceVariant}>
              No movies in this genre yet
            </Typography>
          </Motion.View>
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  centered: { marginTop: 48, alignItems: 'center', paddingHorizontal: PADDING },
  list: { paddingHorizontal: PADDING, gap: GAP },
  column: { gap: GAP },
  footer: { paddingVertical: 20 },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PADDING,
    // Clips the row that crosses the bottom edge, the same way SkeletonRow
    // clips the card past the right edge.
    overflow: 'hidden',
  },
})
