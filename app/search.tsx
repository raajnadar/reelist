import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { IconButton } from '@rootnative/components/icon-button'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassLayer } from '../components/GlassLayer'
import { MovieCard } from '../components/MovieCard'
import { SkeletonGrid } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { searchMovies } from '../lib/api'
import { type FailureKind } from '../lib/errors'
import { GRID_GAP, GRID_PADDING, gridInset, posterColumns } from '../lib/grid'
import { clearSearchOrigin, readSearchOrigin } from '../lib/searchOrigin'
import { useDebounced } from '../lib/useDebounced'
import { useKeyboardHeight } from '../lib/useKeyboardHeight'
import { useResource } from '../lib/useResource'
import type { Paged } from '../lib/types'

/**
 * Where the field's top edge sits, measured from the top of the window.
 *
 * From the window, not from the safe area: the field is the one thing on the
 * sheet, and it should sit in the same place on every device. 100 clears the
 * tallest status bar with room to spare.
 */
const FIELD_TOP = 100

/**
 * The MD3 search bar: 56 tall, a full pill, and a 24 icon centred in the first
 * 56, so the text starts where the icon's box ends.
 */
const FIELD_HEIGHT = 56
const ICON_SIZE = 24

/**
 * The pill's lift: the MD3 level 3 shadow, the search bar's own, as the two
 * layers the spec draws it with.
 *
 * A `boxShadow` string rather than the theme's `elevation.level3`. That token
 * is the `shadow*` set of props, which react-native-web now reports as
 * deprecated on every render, and `boxShadow` draws the same on the web and
 * on the new architecture. Inertia carries it as a static style.
 */
const PILL_SHADOW = '0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15)'

/**
 * The widest the field grows. A search box the width of a desktop window is a
 * line the eye cannot follow, and the grid below it is centred anyway.
 */
const FIELD_MAX_WIDTH = 560

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
 * The search, as a sheet over the screen it was opened from.
 *
 * The route is a `transparentModal` (see app/_layout.tsx), so the screen below
 * stays mounted and visible through the glass. The field starts as a pill
 * drawn over the button that opened it, flies to the top of the window, and
 * widens into the search bar; the results appear under it once it is wide.
 */
export default function SearchScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columns = posterColumns(width)
  const fieldWidth = Math.min(width - GRID_PADDING * 2, FIELD_MAX_WIDTH)
  /**
   * The keyboard is up for the whole search, so the list pads its bottom by
   * its height and the last row stays reachable. Only the list: the prompt
   * and the messages are text, and moving them with the keyboard would be a
   * second movement while the pill is still on its way. See
   * lib/useKeyboardHeight.ts for why this is not a KeyboardAvoidingView.
   *
   * The keyboard covers the bottom inset, so the two do not add up below:
   * the larger one is the one that matters.
   */
  const keyboard = useKeyboardHeight()

  /**
   * Where the pill starts, read once on mount. See lib/searchOrigin.ts for why
   * the read and the clear are separate steps.
   */
  const [origin] = useState(readSearchOrigin)
  useEffect(clearSearchOrigin, [])

  /**
   * The pill's start, relative to where it comes to rest. Centre to centre, so
   * the change of size on the way grows it around its middle rather than from
   * a corner. The frame below centres the resting pill, which is what makes
   * the window's centre line its own.
   */
  const start = origin && {
    translateX: origin.x + origin.width / 2 - width / 2,
    translateY: origin.y + origin.height / 2 - (FIELD_TOP + FIELD_HEIGHT / 2),
    width: origin.width,
    height: origin.height,
  }

  /**
   * The input's type, without the token's line height.
   *
   * iOS places a text input's glyphs by the line box, not by the box's
   * height: with a 24 line height inside a 56 field, the text landed a few
   * points below the icons on either side of it. Without a line height the
   * input centres the glyphs itself, on every platform.
   */
  const { lineHeight: _lineHeight, ...inputType } = theme.typography.bodyLarge

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

  // Matches the about screen: `router.back` alone dead-ends when this screen is
  // the first entry in the history, as it is on a deep link.
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'))

  return (
    <View style={styles.layer}>
      <GlassLayer onPress={dismiss} testID="search-glass" />

      {/*
        `box-none` on the column and the frame: a press between the field and
        the results, or beside the field, has to reach the glass and dismiss.
      */}
      <View style={styles.column}>
        <View style={styles.frame}>
          {/*
            Without an origin — a deep link — there is nothing to fly from, so
            the pill fades in where it rests, at its full size.

            Each property has its own transition. The trip and the widening are
            different movements, and `expand` carries a delay so the widening
            starts near the end of the trip rather than at the same moment.
          */}
          <Motion.View
            testID="search-pill"
            initial={
              start
                ? { ...start, opacity: 1 }
                : { opacity: 0, scale: 0.92, width: fieldWidth, height: FIELD_HEIGHT }
            }
            animate={{
              translateX: 0,
              translateY: 0,
              width: fieldWidth,
              height: FIELD_HEIGHT,
              opacity: 1,
              scale: 1,
            }}
            transition={{
              translateX: 'travel',
              translateY: 'travel',
              width: 'expand',
              height: 'expand',
              opacity: { type: 'timing', duration: 180 },
              scale: 'enter',
            }}
            style={[
              styles.pill,
              {
                backgroundColor: theme.colors.surfaceContainerHigh,
                borderRadius: theme.shape.cornerFull,
                boxShadow: PILL_SHADOW,
              },
            ]}
          >
            {/*
              The icon's box is the leading 56 of the bar, so the icon starts
              off the pill's centre by half the difference in size and rides to
              its place on the same spring as the widening.
            */}
            <Motion.View
              initial={
                start
                  ? {
                      translateX: (start.width - FIELD_HEIGHT) / 2,
                      translateY: (start.height - FIELD_HEIGHT) / 2,
                    }
                  : false
              }
              animate={{ translateX: 0, translateY: 0 }}
              transition="expand"
              style={styles.iconBox}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={ICON_SIZE}
                color={theme.colors.onSurfaceVariant}
              />
            </Motion.View>

            <Motion.View
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition="reveal"
              style={styles.row}
            >
              {/*
                A plain input rather than TextField: the pill is the field, and
                the bar's own outline, label, and icon slots would fight the
                icon that just flew in. TextField also forwards no ref, so a
                screen cannot focus it once the widening ends; `autoFocus` is
                the only timing it offers. Filed as R3 in the RootNative
                workspace, DX-FEEDBACK-reelist.md.
              */}
              <TextInput
                accessibilityLabel="Search movies"
                placeholder="Search movies"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={query}
                onChangeText={setQuery}
                style={[styles.input, inputType, { color: theme.colors.onSurface }]}
                autoFocus
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {/*
                The clear appears only when there is text to clear, so the bar
                does not offer an action that would do nothing. A filled circle
                rather than a bare cross: it is the clear control iOS readers
                know from every search field, and the bare cross beside it
                closes the sheet, so the two must not look alike.

                Not "Clear search": the no-results state below draws a button
                with that label, and two controls of the same name on one
                screen give a screen reader no way to tell them apart.
              */}
              {/*
                Each button gets a column frame that centres it. IconButton
                pins itself to the top of its parent with `alignSelf:
                'flex-start'`, which wins over the row's `alignItems`, so
                without the frame the two sit above the text. A column, not a
                row: `alignSelf` sets the cross axis, and in a column that is
                the horizontal one, which leaves `justifyContent` free to
                centre the height. Same fix as the about screen's close button.
              */}
              {query ? (
                <View style={styles.buttonFrame}>
                  <IconButton
                    icon="close-circle"
                    variant="standard"
                    accessibilityLabel="Clear the search box"
                    onPress={() => setQuery('')}
                  />
                </View>
              ) : null}
              <View style={styles.buttonFrame}>
                <IconButton
                  icon="close"
                  variant="standard"
                  accessibilityLabel="Close search"
                  testID="search-close"
                  onPress={dismiss}
                />
              </View>
            </Motion.View>
          </Motion.View>
        </View>

        <Motion.View
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition="reveal"
          style={styles.results}
        >
          <Presence>
            {search.loading ? (
              // A grid of placeholders, not a spinner: it holds the shape the
              // results will take, so the layout does not jump when they arrive.
              //
              // Absolute, not in the column. The message it replaces is still
              // there for its exit fade, and a skeleton in the flow would take
              // its room and push the fading message up under the field.
              <Motion.View
                key="loading"
                exit={{ opacity: 0 }}
                transition="exit"
                style={StyleSheet.absoluteFill}
              >
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
                  renderItem={({ item, index }) => (
                    <MovieCard movie={item} index={index} />
                  )}
                  columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
                  contentContainerStyle={[
                    styles.list,
                    {
                      paddingHorizontal: gridInset(width),
                      paddingBottom: Math.max(insets.bottom, keyboard) + 16,
                    },
                  ]}
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
        </Motion.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  /*
    Transparent: the navigator made the route see-through, and the glass is
    the first child.

    Clipped, because the pill leaves the window for a few frames. It starts
    at the button, which sits at the right edge, and it begins to widen before
    the trip ends, so its right edge passes the window's. On the web that
    overflow grew the document, and the browser answered with a scrollbar and
    a white strip of page behind the app — a flash at the right on every
    press. Nothing on the sheet is meant to draw past the window.
  */
  layer: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  column: {
    position: 'absolute',
    top: FIELD_TOP,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  // A fixed-height frame, so the pill keeps its centre while its height grows.
  frame: {
    height: FIELD_HEIGHT,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  /*
    Not clipped. `overflow: 'hidden'` would cut the shadow off on iOS, and the
    pill needs no clipping: the row inside is invisible until `reveal` fades it
    in, by which time the pill is wide, and the icon rides inside the pill for
    the whole trip.
  */
  pill: {},
  iconBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FIELD_HEIGHT,
    height: FIELD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 8 on the right, not 16: the button's 24 icon sits in a 40 box, which adds
  // the other 8, so the cross ends 16 from the edge, where the icon on the
  // left begins.
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: FIELD_HEIGHT,
    paddingRight: 8,
  },
  // The outline is for the web, where a focused input draws the browser's ring
  // around a box that is already the whole pill. The width alone does not
  // remove it: Chrome's ring is `outline-style: auto`, which ignores the width,
  // so the style has to be set as well.
  input: {
    flex: 1,
    height: FIELD_HEIGHT,
    paddingVertical: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  buttonFrame: { height: FIELD_HEIGHT, justifyContent: 'center' },
  results: { flex: 1, alignSelf: 'stretch', pointerEvents: 'box-none' },
  /*
    The top inset is inside the scroller, not above it: a vertical scroller
    clips at its own top edge, so a card in the first row that grows under the
    pointer would come back cut off. GRID_GAP is the room it needs — see
    LIFT_SPACE — and it is the same space that separates two rows.
  */
  // The horizontal inset comes from the window; see gridInset.
  list: { paddingTop: GRID_GAP, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
})
