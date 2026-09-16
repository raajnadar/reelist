import { AppBar } from '@rootnative/components/appbar'
import { TextField } from '@rootnative/components/text-field'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard } from '../components/MovieCard'
import { SkeletonGrid } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { searchMovies } from '../lib/api'
import { type FailureKind } from '../lib/errors'
import { GRID_GAP, GRID_PADDING, posterColumns } from '../lib/grid'
import { useDebounced } from '../lib/useDebounced'
import { useResource } from '../lib/useResource'
import type { Paged } from '../lib/types'

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

export default function SearchScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columns = posterColumns(width)

  const [query, setQuery] = useState('')
  // The field reads `query` so it answers every keystroke. The fetch reads this,
  // so it fires once the typing stops. See lib/useDebounced.ts.
  const debouncedQuery = useDebounced(query)
  const trimmed = debouncedQuery.trim()

  /**
   * The search, or nothing while the box is empty.
   *
   * A null key is what makes an empty box not a search: the hook sends no
   * request and reports no failure, and the prompt below is drawn from the
   * absence of an answer rather than from a cleared state.
   *
   * The key carries the query, so an answer is only ever drawn against the
   * query it belongs to. Two searches can be in flight when a slow request for
   * "int" resolves after a fast one for "interstellar"; the tag is what keeps
   * the older answer from contradicting the box.
   */
  const search = useResource<Paged>(
    trimmed ? `search:${trimmed}` : null,
    () => searchMovies(trimmed),
    'Could not search movies',
  )

  const failure = search.failure
  const results = search.data?.results ?? []
  // Searched, and the answer is in. This is what separates "no matches" from
  // the opening prompt: both show an empty grid, so a count of zero cannot
  // tell them apart.
  const searched = search.data !== null

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
        {search.loading ? (
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
            onAction={failure.kind === 'transient' ? search.reload : undefined}
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
        ) : searched ? (
          /*
            Searched, and found nothing.

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
  field: { paddingHorizontal: GRID_PADDING, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: GRID_PADDING, gap: GRID_GAP },
  column: { gap: GRID_GAP },
})
