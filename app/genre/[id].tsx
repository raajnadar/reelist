import { AppBar } from '@rootnative/components/appbar'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard } from '../../components/MovieCard'
import { SkeletonGrid } from '../../components/Skeleton'
import { StateMessage } from '../../components/StateMessage'
import { getMoviesByGenre } from '../../lib/api'
import { missingFailure, type FailureKind } from '../../lib/errors'
import { GRID_GAP, GRID_PADDING, posterColumns } from '../../lib/grid'
import { useResource } from '../../lib/useResource'
import type { Movie, Paged } from '../../lib/types'

/**
 * How each kind of failure is presented, and what it offers.
 *
 * The three never share an action: a dropped request retries, an unset proxy
 * URL is a setup mistake with no request to repeat, and a link that names no
 * genre leaves only the way out. A record keyed by kind rather than three
 * nested conditions spread across five props.
 */
const REPORTS: Record<
  FailureKind,
  {
    icon: string
    tone: 'error' | 'neutral'
    title: string
    actionLabel?: string
    actionIcon?: string
  }
> = {
  transient: {
    icon: 'cloud-off-outline',
    tone: 'error',
    title: 'Could not load movies',
    actionLabel: 'Try again',
    actionIcon: 'refresh',
  },
  setup: { icon: 'cog-outline', tone: 'neutral', title: 'Setup needed' },
  missing: {
    icon: 'link-off',
    tone: 'error',
    title: 'Broken link',
    actionLabel: 'Go home',
    actionIcon: 'home-outline',
  },
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
  const columns = posterColumns(width)

  const params = useLocalSearchParams<{ id: string; name?: string }>()
  const genreId = Number(params.id)

  // A route parameter is a string from an untrusted source: a deep link can
  // carry anything. Derived from the param rather than stored, because a bad id
  // needs no request and no loading state.
  const validId = Number.isInteger(genreId) && genreId > 0

  /**
   * The first page.
   *
   * A null key while the id is bad: a deep link can carry anything, TMDB
   * answers an unparseable `with_genres` with an unfiltered list, and a request
   * that cannot be trusted is better not sent. The failure for that case is
   * built below, where it is found.
   */
  const first = useResource<Paged>(
    validId ? `genre:${genreId}` : null,
    () => getMoviesByGenre(genreId, 1),
    'Could not load movies',
  )

  /**
   * The pages after the first, tagged with the genre they belong to.
   *
   * They stay outside the hook because they are not the answer to one request:
   * the hook holds one answer per key, and this is a list that grows as the
   * reader scrolls. Leaving the first page with the hook is what lets a return
   * to the same genre draw immediately.
   */
  const [appended, setAppended] = useState<{
    genreId: number
    movies: Movie[]
    page: number
    totalPages: number
  } | null>(null)

  const [loadingMore, setLoadingMore] = useState(false)

  /**
   * The genre on screen right now, readable from inside a promise.
   *
   * `loadMore` is a callback rather than an effect, so it has no cleanup to
   * cancel a request when the reader opens another genre. This is what a late
   * page is checked against.
   */
  const genreRef = useRef(genreId)
  useEffect(() => {
    genreRef.current = genreId
  }, [genreId])

  // The appended pages count only while they describe the genre being shown.
  const more = appended && appended.genreId === genreId ? appended : null
  // The first page dedupes the rest. TMDB pages a ranking, not a snapshot, so a
  // film can move between pages while the reader scrolls and arrive twice.
  const movies = mergePages(first.data?.results ?? [], more?.movies ?? [])
  const page = more?.page ?? first.data?.page ?? 1
  const totalPages = more?.totalPages ?? first.data?.total_pages ?? 1

  // A bad route parameter is a failure with no request behind it, so it is
  // classified where it is found rather than lifted from a rejection.
  const failure = validId
    ? first.failure
    : missingFailure('That link does not point at a genre.')
  const loading = first.loading

  const retry = () => {
    setAppended(null)
    first.reload()
  }

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
    if (loading || loadingMore || failure) return
    if (page >= totalPages) return

    setLoadingMore(true)

    getMoviesByGenre(genreId, page + 1)
      .then((paged) => {
        // A page that lands after the reader opened another genre is dropped.
        // Appending it would show one genre's films under another's name.
        if (genreRef.current !== genreId) return
        setAppended((prev) => ({
          genreId,
          // Read through the updater, so the merge sees the pages actually
          // stored. A list left over from a previous genre is not one of them.
          movies: mergePages(
            prev && prev.genreId === genreId ? prev.movies : [],
            paged.results,
          ),
          page: paged.page,
          totalPages: paged.total_pages,
        }))
      })
      .catch(() => {
        // A failed page is not a failed screen. The films already loaded stay,
        // and the next scroll to the end tries again — so this needs no message.
      })
      .finally(() => setLoadingMore(false))
  }, [genreId, page, totalPages, loading, loadingMore, failure])

  const title = params.name ?? 'Genre'

  // The handler behind REPORTS, which carries only the words. `setup` has none:
  // the fix is a file on the developer's disk and a restart, and no button on
  // this screen can apply it.
  const actions: Record<FailureKind, (() => void) | undefined> = {
    transient: retry,
    setup: undefined,
    missing: () => router.replace('/'),
  }

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
            <SkeletonGrid />
          </Motion.View>
        ) : failure ? (
          /*
            Three failures share this branch and none of them share an action.
            A dropped request retries; an unset proxy URL is a setup mistake
            with no request to repeat; a bad link has no genre to load at all,
            and the only move left is out of the screen.
          */
          <StateMessage
            key="error"
            testID="genre-error"
            icon={REPORTS[failure.kind].icon}
            tone={REPORTS[failure.kind].tone}
            title={REPORTS[failure.kind].title}
            body={failure.message}
            actionLabel={REPORTS[failure.kind].actionLabel}
            actionIcon={REPORTS[failure.kind].actionIcon}
            onAction={actions[failure.kind]}
          />
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
          /* The request succeeded and returned nothing, so there is nothing to
             retry. The AppBar already carries the way back, and a second exit
             in the middle of the screen would only repeat it. */
          <StateMessage
            key="empty"
            testID="genre-empty"
            icon="movie-off-outline"
            title="Nothing here yet"
            body="TMDB lists no movies in this genre."
          />
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  list: { paddingHorizontal: GRID_PADDING, gap: GRID_GAP },
  column: { gap: GRID_GAP },
  footer: { paddingVertical: 20 },
})
