import { AppBar } from '@rootnative/components/appbar'
import { LoadingIndicator } from '@rootnative/components/loading-indicator'
import { useSnackbar } from '@rootnative/components/snackbar'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../lib/language'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DiscoverFilterRow } from '../../../components/DiscoverFilterRow'
import { FilterSheet } from '../../../components/FilterSheet'
import { MovieCard } from '../../../components/MovieCard'
import { PullToRefresh } from '../../../components/PullToRefresh'
import { PageHead } from '@rootnative/seo/expo-router'
import { SkeletonGrid } from '../../../components/Skeleton'
import { StateMessage } from '../../../components/StateMessage'
import { FailureMessage } from '../../../components/FailureMessage'
import { PosterGrid } from '../../../components/PosterGrid'
import { getGenres, getMoviesByGenre } from '../../../lib/api'
import { GENRES_KEY } from '../../../lib/resourceCache'
import {
  EMPTY_FILTERS,
  filterKey,
  filtersFromParams,
  filtersToParams,
  hasFilters,
  type DiscoverFilters,
  type FilterParam,
} from '../../../lib/discover'
import { missingFailure } from '../../../lib/errors'
import { GRID_GAP } from '../../../lib/grid'
import { haptic } from '../../../lib/haptics'
import { useBarScroll } from '../../../lib/floatingBar'
import { genreMeta, metadataFor, noindexMeta } from '../../../lib/head'
import { genreEntry, loadSeed } from '../../../lib/prerender'
import { useContentWidth } from '../../../lib/useContentWidth'
import { usePrerendered } from '../../../lib/usePrerendered'
import { useResource } from '../../../lib/useResource'
import { useAddressKey, useAddressParams } from '../../../lib/useAddressParams'
import { useUrlState } from '../../../lib/useUrlState'
import type { Genre, Movie, Paged } from '../../../lib/types'
import { useGoBack } from '../../../lib/useGoBack'

/**
 * The genres the static web export writes a page for: the chip row of the
 * seed. See lib/prerender.ts.
 *
 * Each film page links to its genres, so without a file here every one of
 * those links gets a 404 status from the host. The page has the head tags and
 * the heading only. The films load from the proxy after the page starts.
 */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return (await loadSeed()).genres.map((genre) => ({ id: String(genre.id) }))
}

/**
 * The genre from the seed, which the export writes into its page. A link
 * typed or shared without the `name` parameter gets the name from here, and
 * the export renders the page with no query at all.
 */
export async function loader(_request: unknown, params: { id: string }) {
  return genreEntry(await loadSeed(), params.id)
}

/** The headline, and the page title, for an id that names no genre. */
const MISSING_TITLE = 'Broken link'

/** The head the static export writes. The seed genre, or the missing-genre head. */
export async function generateMetadata(_request: unknown, params: { id: string }) {
  const genre = genreEntry(await loadSeed(), params.id)
  return metadataFor(genre ? genreMeta(genre.id, genre.name) : noindexMeta(MISSING_TITLE))
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

export default function GenreRoute() {
  const key = useAddressKey()
  return <GenreScreen key={key} />
}

function GenreScreen() {
  const theme = useTheme()
  const snackbar = useSnackbar()
  const router = useRouter()
  const goBack = useGoBack()
  const insets = useSafeAreaInsets()
  const { onScroll } = useBarScroll()
  const width = useContentWidth()

  const params = useAddressParams<
    { id: string; name?: string } & Partial<Record<FilterParam, string>>
  >()
  const genreId = Number(params.id)

  // A route parameter is a string from an untrusted source: a deep link can
  // carry anything. Derived from the param rather than stored, because a bad id
  // needs no request and no loading state.
  const validId = Number.isInteger(genreId) && genreId > 0

  /**
   * The filters the reader picked, read from the address once and written
   * back on each pick, so a reload or a shared link keeps them. Screen state
   * in between: a pick is a change to this screen, not a new entry in the
   * history.
   *
   * A link with no filter starts on the reader's preferred film language,
   * when they set one on the about screen. It is a start value only: the row
   * can change or clear it for this visit, and a change to the preference
   * reaches the next visit.
   */
  const { code: preferredLanguage } = useLanguage()
  const [filters, setFilters] = useState<DiscoverFilters>(() => {
    const linked = filtersFromParams(params)
    if (hasFilters(linked)) return linked
    return preferredLanguage ? { languages: [preferredLanguage] } : EMPTY_FILTERS
  })
  useUrlState(filtersToParams(filters))
  const [sheetOpen, setSheetOpen] = useState(false)

  const applyFilters = (next: DiscoverFilters) => {
    setSheetOpen(false)
    if (filterKey(next) !== filterKey(filters)) haptic('select')
    setFilters(next)
  }

  /**
   * What is being asked for: one genre under one set of filters.
   *
   * A null key while the id is bad: a deep link can carry anything, TMDB
   * answers an unparseable `with_genres` with an unfiltered list, and a request
   * that cannot be trusted is better not sent. The failure for that case is
   * built below, where it is found.
   *
   * The filters are part of the key, so a pick is a new request and a return to
   * a previous pick draws from the store.
   */
  const key = validId ? `genre:${genreId}:${filterKey(filters)}` : null

  /** The first page. */
  const first = useResource<Paged>(
    key,
    () => getMoviesByGenre(genreId, 1, filters),
    'Could not load movies',
  )

  /**
   * The pages after the first, tagged with the key they belong to.
   *
   * They stay outside the hook because they are not the answer to one request:
   * the hook holds one answer per key, and this is a list that grows as the
   * reader scrolls. Leaving the first page with the hook is what lets a return
   * to the same genre draw immediately.
   */
  const [appended, setAppended] = useState<{
    key: string
    movies: Movie[]
    page: number
    totalPages: number
  } | null>(null)

  const [loadingMore, setLoadingMore] = useState(false)

  /**
   * The key on screen right now, readable from inside a promise.
   *
   * `loadMore` is a callback rather than an effect, so it has no cleanup to
   * cancel a request when the reader opens another genre or picks a filter.
   * This is what a late page is checked against.
   */
  const keyRef = useRef(key)
  useEffect(() => {
    keyRef.current = key
  }, [key])

  // The appended pages count only while they describe the key being shown.
  const more = appended && appended.key === key ? appended : null
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
   * The pull to refresh. The grid stays on screen while the first page loads
   * again. The pages after it go when the new first page lands: the reader
   * pulled at the top, and the list starts from there again.
   */
  const refresh = async () => {
    const ok = await first.refresh()
    if (ok) {
      setAppended(null)
    } else {
      snackbar.show({ message: 'Could not refresh', duration: 'short', replace: true })
    }
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
    if (key === null || loading || loadingMore || failure) return
    if (page >= totalPages) return

    setLoadingMore(true)

    getMoviesByGenre(genreId, page + 1, filters)
      .then((paged) => {
        // A page that lands after the reader opened another genre or picked a
        // filter is dropped. Appending it would show one list's films under
        // another's name.
        if (keyRef.current !== key) return
        setAppended((prev) => ({
          key,
          // Read through the updater, so the merge sees the pages actually
          // stored. A list left over from a previous key is not one of them.
          movies: mergePages(prev && prev.key === key ? prev.movies : [], paged.results),
          page: paged.page,
          totalPages: paged.total_pages,
        }))
      })
      .catch(() => {
        // A failed page is not a failed screen. The films already loaded stay,
        // and the next scroll to the end tries again — so this needs no message.
      })
      .finally(() => setLoadingMore(false))
  }, [key, genreId, filters, page, totalPages, loading, loadingMore, failure])

  const seeded = usePrerendered<Genre>(`/(main)/genre/${params.id}`)
  const known = params.name ?? seeded?.name

  /**
   * The name from the genre list, for a link that carries none: a shared
   * link, or a web address typed by hand for a genre the export did not
   * write. The key is the one the home screen uses, so a reader who came
   * through the chips is answered from the store. A null key while the name
   * is already known: there is nothing to ask.
   */
  const list = useResource<Genre[]>(
    known || !validId ? null : GENRES_KEY,
    getGenres,
    'Could not load genres',
  )
  const name = known ?? list.data?.find((genre) => genre.id === genreId)?.name
  const title = name ?? 'Genre'

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* A missing genre gets `noindex`, for the reason the film screen gives. */}
      {failure?.kind === 'missing' ? (
        <PageHead title={MISSING_TITLE} noindex />
      ) : validId && name ? (
        <PageHead {...genreMeta(genreId, name)} />
      ) : null}
      <AppBar title={title} insetTop canGoBack onBackPress={goBack} />

      {/*
        Above the states rather than inside the grid, so the row stays while the
        placeholders show and after a pick that matched nothing. A bad id has
        no list to filter, so it gets no row.
      */}
      {validId ? (
        <>
          <DiscoverFilterRow
            filters={filters}
            onChange={setFilters}
            onOpen={() => setSheetOpen(true)}
          />
          <FilterSheet
            visible={sheetOpen}
            filters={filters}
            onApply={applyFilters}
            onDismiss={() => setSheetOpen(false)}
          />
        </>
      ) : null}

      <Presence>
        {loading ? (
          // A grid of placeholders, not a spinner: it holds the shape the
          // results will take, so the layout does not jump when they arrive.
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <SkeletonGrid width={width} />
          </Motion.View>
        ) : failure ? (
          /*
            Three failures share this branch and none of them share an action.
            A dropped request retries; an unset proxy URL is a setup mistake
            with no request to repeat; a bad link has no genre to load at all,
            and the only move left is out of the screen.
          */
          <FailureMessage
            key="error"
            testID="genre-error"
            failure={failure}
            title="Could not load movies"
            onRetry={retry}
            missingTitle={MISSING_TITLE}
          />
        ) : movies.length ? (
          <Motion.View
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.fill}
          >
            <PosterGrid
              data={movies}
              width={width}
              renderItem={({ item, index }) => <MovieCard movie={item} index={index} />}
              contentStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
              refreshControl={
                <PullToRefresh
                  refreshing={first.refreshing}
                  onRefresh={() => void refresh()}
                />
              }
              onScroll={onScroll}
              onEndReached={loadMore}
              // Half a screen of runway. Lower and the user reaches the end
              // before the next page lands; higher and the screen fetches
              // pages nobody scrolled to.
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footer}>
                    <LoadingIndicator accessibilityLabel="Loading more films" />
                  </View>
                ) : undefined
              }
            />
          </Motion.View>
        ) : hasFilters(filters) ? (
          /* A pick that matched nothing. The way out is the pick itself, so the
             action clears every filter rather than sending the reader back. */
          <StateMessage
            key="no-match"
            testID="genre-no-match"
            icon="filter-off-outline"
            title="No matches"
            body="No movie in this genre matches these filters."
            actionLabel="Clear filters"
            actionIcon="filter-remove-outline"
            onAction={() => setFilters(EMPTY_FILTERS)}
          />
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
  /*
    The top inset is inside the scroller, not above it: a vertical scroller
    clips at its own top edge, so a card in the first row that grows under the
    pointer would come back cut off. GRID_GAP is the room it needs — see
    LIFT_SPACE — and it is the same space that separates two rows.
  */
  list: { paddingTop: GRID_GAP },
  footer: { paddingVertical: 20, alignItems: 'center' },
})
