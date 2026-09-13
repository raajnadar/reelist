import { AppBar } from '@rootnative/components/appbar'
import { TextField } from '@rootnative/components/text-field'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard, CARD_WIDTH } from '../components/MovieCard'
import { SkeletonGrid } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { searchMovies } from '../lib/api'
import { toFailure, type Failure, type FailureKind } from '../lib/errors'
import { useDebounced } from '../lib/useDebounced'
import type { Movie } from '../lib/types'

const GAP = 12
const PADDING = 16

/**
 * How each kind of failure is presented. The action is bound inside the screen:
 * only `transient` has one, because a search reaches no id and an unset proxy
 * URL is fixed off the screen.
 *
 * `missing` cannot occur — a search with no match is an empty result, not a
 * failure. It is listed so a new kind is a type error rather than a blank state.
 */
const REPORTS: Record<
  FailureKind,
  { icon: string; tone: 'error' | 'neutral'; title: string }
> = {
  transient: { icon: 'cloud-off-outline', tone: 'error', title: 'Search failed' },
  setup: { icon: 'cog-outline', tone: 'neutral', title: 'Setup needed' },
  missing: { icon: 'movie-off-outline', tone: 'error', title: 'Nothing to show' },
}

/**
 * How many poster columns fit in `width`.
 *
 * The results are a grid rather than a horizontal row, because a search answer
 * is a set to scan, not a shelf to browse. The column count is derived from the
 * window so one layout serves a phone and a desktop browser; a fixed count would
 * leave a wide window mostly empty.
 *
 * Two is the floor. One column on a narrow window would give each poster the
 * full width, which reads as a list of billboards instead of a grid.
 */
export function searchColumnCount(width: number) {
  const available = width - PADDING * 2
  return Math.max(2, Math.floor((available + GAP) / (CARD_WIDTH + GAP)))
}

export default function SearchScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columns = searchColumnCount(width)

  const [query, setQuery] = useState('')
  // The field reads `query` so it answers every keystroke. The fetch reads this,
  // so it fires once the typing stops. See lib/useDebounced.ts.
  const debouncedQuery = useDebounced(query)
  const trimmed = debouncedQuery.trim()

  /**
   * The finished answer to one query, or null when no search has finished.
   *
   * `query` is stored beside the data rather than compared against the live box,
   * which is what makes a stale render impossible: an outcome is only shown when
   * its `query` still matches the one being searched. Holding the two in one
   * state value also means they can never disagree, which three separate
   * `useState` calls could.
   */
  const [outcome, setOutcome] = useState<{
    query: string
    results: Movie[]
    failure: Failure | null
  } | null>(null)

  /**
   * Bumped by the retry button. The effect below reads it as a dependency, so a
   * press re-runs the same search without a change to the box.
   */
  const [attempt, setAttempt] = useState(0)

  const retry = () => {
    // Clearing the outcome is what puts the placeholders back: `loading` below
    // is derived from "a query with no answer yet", not stored.
    setOutcome(null)
    setAttempt((n) => n + 1)
  }

  useEffect(() => {
    // An empty box is not a search. Returning before any setState leaves the
    // last outcome in place, and `current` below ignores it because its query no
    // longer matches — so the screen falls back to the prompt with no reset and
    // no cascading render.
    if (!trimmed) return

    let active = true

    searchMovies(trimmed)
      .then((paged) => {
        // The guard keeps the answers in order. Two searches can be in flight
        // when a slow request for "int" resolves after a fast one for
        // "interstellar"; without it the older answer would overwrite the newer
        // one and the grid would contradict the box.
        if (!active) return
        setOutcome({ query: trimmed, results: paged.results, failure: null })
      })
      .catch((e: unknown) => {
        if (!active) return
        setOutcome({
          query: trimmed,
          results: [],
          // Same contract as the other screens: a MissingProxyUrlError and a
          // TmdbError each carry a message written for the person reading it,
          // and toFailure says which of the two a retry can clear.
          failure: toFailure(e, 'Could not search movies'),
        })
      })

    return () => {
      active = false
    }
  }, [trimmed, attempt])

  // The outcome counts only while it describes the query in the box.
  const current = outcome && outcome.query === trimmed ? outcome : null
  // Derived, not stored: there is a query to answer and no answer for it yet.
  // A `loading` state set inside the effect would be the cascading render the
  // structure above avoids.
  const loading = Boolean(trimmed) && !current
  const failure = current?.failure ?? null
  const results = current?.results ?? []

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppBar
        title="Search"
        insetTop
        canGoBack
        // Matches the detail screen: `router.back` alone dead-ends when this
        // screen is the first entry in the history, as it is on a deep link.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <View style={styles.field}>
        <TextField
          label="Search movies"
          variant="outlined"
          value={query}
          onChangeText={setQuery}
          leadingIcon="magnify"
          // The clear icon appears only when there is text to clear, so the
          // field does not offer an action that would do nothing.
          trailingIcon={query ? 'close' : undefined}
          onTrailingIconPress={() => setQuery('')}
          // Not "Clear search": the no-results state below draws a button with
          // that label, and two controls of the same name on one screen give a
          // screen reader no way to tell them apart.
          trailingIconAccessibilityLabel="Clear the search box"
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <Presence>
        {loading ? (
          // A grid of placeholders, not a spinner: it holds the shape the
          // results will take, so the layout does not jump when they arrive.
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <SkeletonGrid />
          </Motion.View>
        ) : failure ? (
          <StateMessage
            key="error"
            testID="search-error"
            icon={REPORTS[failure.kind].icon}
            tone={REPORTS[failure.kind].tone}
            title={REPORTS[failure.kind].title}
            body={failure.message}
            actionLabel={failure.kind === 'transient' ? 'Try again' : undefined}
            actionIcon="refresh"
            onAction={failure.kind === 'transient' ? retry : undefined}
          />
        ) : results.length ? (
          <Motion.View
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.fill}
          >
            <FlatList
              data={results}
              // `key` forces a remount when the column count changes. FlatList
              // caches its layout per item and does not recompute on a numColumns
              // change alone, which leaves the old grid geometry behind after a
              // rotation or a browser resize.
              key={columns}
              numColumns={columns}
              keyExtractor={(m) => String(m.id)}
              renderItem={({ item, index }) => <MovieCard movie={item} index={index} />}
              columnWrapperStyle={columns > 1 ? styles.column : undefined}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            />
          </Motion.View>
        ) : current ? (
          /*
            Searched, and found nothing. `current` is the signal that separates
            this from the prompt below: both states show an empty grid, so a
            count of zero cannot tell them apart.

            The action clears the box rather than repeating the search. The
            request succeeded — there is nothing to retry — and a new query is
            the only thing that can change the answer.
          */
          <StateMessage
            key="no-results"
            testID="search-no-results"
            icon="movie-search-outline"
            title="No matches"
            body={`Nothing here matches "${trimmed}". Check the spelling, or try a shorter title.`}
            actionLabel="Clear search"
            actionIcon="close"
            onAction={() => setQuery('')}
          />
        ) : (
          <StateMessage
            key="prompt"
            testID="search-prompt"
            icon="movie-open-outline"
            title="Search for a movie"
            body="Type a title above. The results appear as you type."
          />
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  field: { paddingHorizontal: PADDING, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: PADDING, gap: GAP },
  column: { gap: GAP },
})
