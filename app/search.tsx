import { AppBar } from '@rootnative/components/appbar'
import { TextField } from '@rootnative/components/text-field'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard, CARD_WIDTH } from '../components/MovieCard'
import { SkeletonGrid } from '../components/Skeleton'
import { searchMovies } from '../lib/api'
import { useDebounced } from '../lib/useDebounced'
import type { Movie } from '../lib/types'

const GAP = 12
const PADDING = 16

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
    error: string | null
  } | null>(null)

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
        setOutcome({ query: trimmed, results: paged.results, error: null })
      })
      .catch((e: unknown) => {
        if (!active) return
        setOutcome({
          query: trimmed,
          results: [],
          // Same contract as the other two screens: a MissingProxyUrlError and a
          // TmdbError each carry a message written for the person reading it.
          error: e instanceof Error ? e.message : 'Could not search movies',
        })
      })

    return () => {
      active = false
    }
  }, [trimmed])

  // The outcome counts only while it describes the query in the box.
  const current = outcome && outcome.query === trimmed ? outcome : null
  // Derived, not stored: there is a query to answer and no answer for it yet.
  // A `loading` state set inside the effect would be the cascading render the
  // structure above avoids.
  const loading = Boolean(trimmed) && !current
  const error = current?.error ?? null
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
          trailingIconAccessibilityLabel="Clear search"
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
        ) : (
          <Motion.View
            key="empty"
            initial={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition="enter"
            style={styles.centered}
          >
            <Typography variant="bodyMedium" color={theme.colors.onSurfaceVariant}>
              {/* `current` is the "searched and found nothing" signal. Both
                  empty states show an empty grid, so a count of zero cannot
                  tell them apart and they must not share their words. */}
              {current ? `No movies match "${trimmed}"` : 'Type to search for a movie'}
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
  field: { paddingHorizontal: PADDING, paddingTop: 8, paddingBottom: 12 },
  centered: { marginTop: 48, alignItems: 'center', paddingHorizontal: PADDING },
  list: { paddingHorizontal: PADDING, gap: GAP },
  column: { gap: GAP },
})
