import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BrandMark } from '../components/BrandMark'
import { GenreChips } from '../components/GenreChips'
import { MovieCarousel } from '../components/MovieCarousel'
import { MovieRow } from '../components/MovieRow'
import { SkeletonRow } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { getGenres, getPopular, getTopRated, getTrending } from '../lib/api'
import { type FailureKind } from '../lib/errors'
import { useResource } from '../lib/useResource'
import type { Genre, Movie } from '../lib/types'

type Row = { title: string; movies: Movie[] }

/**
 * How each kind of failure is presented. The action itself is bound inside the
 * screen, because only `transient` has one here — an unset proxy URL is fixed
 * in a file on the developer's disk, and no button on this screen can do it.
 *
 * `missing` cannot occur: the screen asks for three fixed lists, not for an id.
 * It is listed so the record stays exhaustive and a new kind is a type error
 * rather than a blank state.
 */
const REPORTS: Record<
  FailureKind,
  { icon: string; tone: 'error' | 'neutral'; title: string }
> = {
  transient: { icon: 'cloud-off-outline', tone: 'error', title: 'Could not load movies' },
  setup: { icon: 'cog-outline', tone: 'neutral', title: 'Setup needed' },
  missing: { icon: 'movie-off-outline', tone: 'error', title: 'Nothing to show' },
}

export default function HomeScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  /**
   * The three film rows, as one resource.
   *
   * They load together because they are drawn together: a screen with two rows
   * and a gap is worse than a screen that waits. One failed request is a failed
   * screen here, which is why the genres below are a second resource.
   */
  const rows = useResource<Row[]>(
    'home:rows',
    async () => {
      const [trending, popular, topRated] = await Promise.all([
        getTrending(),
        getPopular(),
        getTopRated(),
      ])
      return [
        { title: 'Trending this week', movies: trending.results },
        { title: 'Popular', movies: popular.results },
        { title: 'Top rated', movies: topRated.results },
      ]
    },
    'Could not load movies',
  )

  /**
   * The genres load on their own, deliberately not inside the Promise.all above.
   *
   * Joining them would tie the whole screen to the weakest request: one failed
   * genre call would take the failure branch and replace three loaded film rows
   * with an error message. Here a failure only leaves the list empty, and
   * GenreChips renders nothing for an empty list — so the chips are simply
   * absent and the rest of the screen is untouched. Its `failure` is read by
   * nobody for that reason.
   */
  const genres = useResource<Genre[]>('home:genres', getGenres, 'Could not load genres')

  const retry = () => {
    rows.reload()
    // Reloaded as well, so a reader who presses the button after a network drop
    // does not get the rows back and keep an empty chip row for the session.
    genres.reload()
  }

  const failure = rows.failure

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.brand}>
          <BrandMark size={26} />
          <Typography variant="headlineMedium" style={styles.title}>
            Reelist
          </Typography>
        </View>
        {/* An IconButton rather than an AppBar `action`: this screen draws its
            own title with the top inset above it, and swapping in an AppBar
            would change the home layout to add one button. */}
        <IconButton
          icon="magnify"
          variant="standard"
          accessibilityLabel="Search movies"
          onPress={() => router.push('/search')}
        />
      </View>

      {/* Outside the Presence block below, for the reason the search button is:
          the chips do not depend on the film rows, so they must not wait for
          them, disappear while they load, or vanish when they fail. */}
      <GenreChips genres={genres.data ?? []} />

      {/*
        Presence animates the swap between the three states. Each branch needs
        its own stable `key` — that is how Presence tells a replaced child from
        a re-rendered one. Without distinct keys the skeleton would be treated
        as the same element as the content and neither would transition.
      */}
      <Presence>
        {rows.loading ? (
          <Motion.View
            key="loading"
            // No `initial`: the skeleton is on screen from the first frame, and
            // fading it in would add a delay before the app shows anything.
            exit={{ opacity: 0 }}
            transition="exit"
          >
            {/* Three rows, matching the three the screen loads. */}
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Motion.View>
        ) : failure ? (
          /*
            The failure states differ in more than their words. A dropped
            request offers the retry; an unset proxy URL is a setup mistake and
            offers nothing, because the fix is a file on the developer's disk
            and a restart, not a second request.
          */
          <StateMessage
            key="error"
            testID="home-error"
            icon={REPORTS[failure.kind].icon}
            tone={REPORTS[failure.kind].tone}
            title={REPORTS[failure.kind].title}
            body={failure.message}
            actionLabel={failure.kind === 'transient' ? 'Try again' : undefined}
            actionIcon="refresh"
            onAction={failure.kind === 'transient' ? retry : undefined}
          />
        ) : (
          <Motion.View
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // `flex: 1` is required, not decorative: this wrapper now sits
            // between the flexed screen and the ScrollView, and a wrapper with
            // no flex collapses to its content height and kills the scroll.
            style={styles.fill}
          >
            {/*
              Motion.ScrollView, not the plain one: it publishes its scroll
              offset to its descendants, which is what lets each MovieRow below
              ask `useInView` whether it has been reached. On native there is no
              IntersectionObserver, so a row outside a Motion scroller would
              treat itself as visible from mount and animate unseen.
            */}
            <Motion.ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            >
              {/*
                The first row gets the lightbox carousel as a featured treatment.
                The rest stay compact rows — the scale effect loses its weight if
                every row uses it.
              */}
              {(rows.data ?? []).map((row, index) =>
                index === 0 ? (
                  <MovieCarousel key={row.title} title={row.title} movies={row.movies} />
                ) : (
                  <MovieRow key={row.title} title={row.title} movies={row.movies} />
                ),
              )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
  },
  title: { paddingVertical: 12 },
})
