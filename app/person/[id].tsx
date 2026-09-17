import { Typography } from '@rootnative/components/typography'
import { useBreakpointValue, useTheme } from '@rootnative/core'
import { Motion, Presence, useScroll } from '@rootnative/inertia'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DetailHeader, HEADER_HEIGHT } from '../../components/DetailHeader'
import { MovieCard } from '../../components/MovieCard'
import { PersonProfile, PersonProfileSkeleton } from '../../components/PersonProfile'
import { SkeletonGrid } from '../../components/Skeleton'
import { StateMessage } from '../../components/StateMessage'
import { getPerson } from '../../lib/api'
import { missingFailure, type Failure, type FailureKind } from '../../lib/errors'
import { GRID_GAP, GRID_PADDING, posterColumns } from '../../lib/grid'
import type { PersonDetail } from '../../lib/types'
import { useResource } from '../../lib/useResource'

/**
 * How each kind of failure is presented, and what it offers.
 *
 * The three never share an action: a dropped request retries, an unset proxy
 * URL is a setup mistake with no request to repeat, and a link that names
 * nobody — a bad id, or an id TMDB answered 404 for — leaves only the way out.
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
    title: 'Could not load the person',
    actionLabel: 'Try again',
    actionIcon: 'refresh',
  },
  setup: { icon: 'cog-outline', tone: 'neutral', title: 'Setup needed' },
  missing: {
    icon: 'link-off',
    tone: 'error',
    title: 'Person not found',
    actionLabel: 'Go home',
    actionIcon: 'home-outline',
  },
}

export default function PersonScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columns = posterColumns(width)

  const { id } = useLocalSearchParams<{ id: string }>()
  // A route parameter is a string from an untrusted source: a deep link can
  // carry anything. Derived from the param rather than stored, because a bad id
  // needs no request and no loading state.
  const personId = Number(id)
  const validId = Number.isInteger(personId) && personId > 0

  /**
   * The person, or nothing while the id names nobody.
   *
   * A null key for a bad parameter, so a link that points at no person sends no
   * request and shows no loading state. The failure for that case is built
   * below, where it is found.
   */
  const detail = useResource<PersonDetail | null>(
    validId ? `person:${personId}` : null,
    () => getPerson(personId),
    'Could not load the person',
  )

  const person = detail.data
  const loading = detail.loading

  /**
   * What went wrong, in the order the three causes can be known.
   *
   * A `null` answer is the 404 `lib/api.ts` returns: the id parsed and the
   * request succeeded, so a second attempt would return the same nothing, which
   * makes it `missing` rather than `transient`.
   */
  const failure: Failure | null = !validId
    ? missingFailure('That link does not point at a person.')
    : (detail.failure ??
      (!loading && person === null
        ? missingFailure('TMDB has nobody with that id.')
        : null))

  const wide = useBreakpointValue({ compact: false, medium: false, expanded: true })
  const photoWidth = wide ? 180 : 120

  // scrollY drives the header on the UI thread, so the bar arrives during a
  // fling without a re-render per frame.
  const { scrollY, onScroll } = useScroll()

  // The room the floating header needs. Nothing runs under this bar — there is
  // no backdrop on a person — so every state starts below it.
  const headerSpace = insets.top + HEADER_HEIGHT

  /**
   * Where the bar takes the name over from the profile.
   *
   * The name sits beside the photo, and the photo is the tallest thing in that
   * row, so the foot of the photo is the point past which the large name is
   * certainly gone. `1.5` is the 2:3 profile ratio inverted. Without this the
   * screen would show the name twice at once, which is the same mistake the
   * film screen made before it gained this bar.
   */
  const revealAt = photoWidth * 1.5

  // The handler behind REPORTS, which carries only the words. `setup` has none:
  // the fix is a file on the developer's disk and a restart, and no button on
  // this screen can apply it.
  const actions: Record<FailureKind, (() => void) | undefined> = {
    transient: detail.reload,
    setup: undefined,
    missing: () => router.replace('/'),
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/*
        Outside the Presence block: the back button has to answer a tap while
        the person is still loading and while an error is on screen.
      */}
      <DetailHeader
        title={person?.name ?? ''}
        scrollY={scrollY}
        revealAt={revealAt}
        // `router.back` alone dead-ends on a deep link, where this screen is
        // the first entry in the history and there is nothing to go back to.
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Presence>
        {loading ? (
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            {/* The placeholder holds the box the content will: the profile,
                then the grid of films under it. */}
            <View style={[styles.profilePlaceholder, { paddingTop: headerSpace }]}>
              <PersonProfileSkeleton photoWidth={photoWidth} />
            </View>
            <SkeletonGrid />
          </Motion.View>
        ) : failure ? (
          <StateMessage
            key="error"
            testID="person-error"
            icon={REPORTS[failure.kind].icon}
            tone={REPORTS[failure.kind].tone}
            title={REPORTS[failure.kind].title}
            body={failure.message}
            actionLabel={REPORTS[failure.kind].actionLabel}
            actionIcon={REPORTS[failure.kind].actionIcon}
            onAction={actions[failure.kind]}
            // The block centres in the room it is given, so the padding is what
            // keeps it clear of the floating header rather than a top margin
            // that would push it off centre.
            style={{ paddingTop: headerSpace }}
          />
        ) : person ? (
          <Motion.View
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.fill}
          >
            {/*
              One list, with the profile as its header, rather than a ScrollView
              holding a grid. A filmography runs to a hundred films for a
              working actor, and a grid inside a ScrollView mounts every card at
              once. The header scrolls away with the films, which is what the
              reader expects of a page about one person.
            */}
            <Motion.FlatList
              data={person.credits}
              onScroll={onScroll}
              // `key` forces a remount when the column count changes. FlatList
              // caches its layout per item and does not recompute on a
              // numColumns change alone, which leaves the old grid geometry
              // behind after a rotation or a browser resize.
              key={columns}
              numColumns={columns}
              keyExtractor={(movie) => String(movie.id)}
              renderItem={({ item, index }) => <MovieCard movie={item} index={index} />}
              columnWrapperStyle={columns > 1 ? styles.column : undefined}
              contentContainerStyle={[
                styles.list,
                { paddingTop: headerSpace, paddingBottom: insets.bottom + 16 },
              ]}
              ListHeaderComponent={
                <View style={styles.header}>
                  <PersonProfile person={person} photoWidth={photoWidth} wide={wide} />

                  {/*
                    The heading belongs to the grid, so it is absent when there
                    is no grid. A person TMDB lists no film work for gets the
                    line in its place — the screen is not empty, it has a
                    profile on it, so the centred block the other screens use
                    for an empty result would be wrong here.
                  */}
                  {person.credits.length ? (
                    <Typography variant="titleMediumEmphasized">Films</Typography>
                  ) : (
                    <Typography
                      testID="person-no-films"
                      variant="bodyMedium"
                      color={theme.colors.onSurfaceVariant}
                    >
                      TMDB lists no films for this person.
                    </Typography>
                  )}
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          </Motion.View>
        ) : null}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  list: { paddingHorizontal: GRID_PADDING, gap: GRID_GAP },
  column: { gap: GRID_GAP },
  // The list already pads itself, so the header only carries the space between
  // the profile and the first row of posters.
  header: { gap: 20, marginBottom: 4 },
  // The placeholder is outside the list, so it repeats the padding the list
  // gives its header, including the room for the floating bar.
  profilePlaceholder: { paddingHorizontal: GRID_PADDING, marginBottom: 24 },
})
