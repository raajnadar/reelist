import { Skeleton } from '@rootnative/components/skeleton'
import { useBreakpointValue, useTheme } from '@rootnative/core'
import { Motion, Presence, Stagger, useScroll } from '@rootnative/inertia'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CastRow } from '../../components/CastRow'
import { DetailActions } from '../../components/DetailActions'
import { DetailHeader, HEADER_HEIGHT } from '../../components/DetailHeader'
import { DetailHero } from '../../components/DetailHero'
import { DetailIdentity, DetailIdentitySkeleton } from '../../components/DetailIdentity'
import { DetailOverview } from '../../components/DetailOverview'
import { GenreChips } from '../../components/GenreChips'
import { MovieRow } from '../../components/MovieRow'
import { SkeletonRow } from '../../components/Skeleton'
import { StateMessage } from '../../components/StateMessage'
import { getMovie } from '../../lib/api'
import { missingFailure, type Failure, type FailureKind } from '../../lib/errors'
import { backdropUrl, posterUrl } from '../../lib/images'
import { STAGGER_INTERVAL } from '../../lib/motion'
import type { MovieDetail } from '../../lib/types'
import { useResource } from '../../lib/useResource'

/**
 * The widest the body ever grows, whatever the window does.
 *
 * A line of text is comfortable to read at roughly 60 to 75 characters. On a
 * 1600px window a full-width paragraph runs past 150, which is the complaint
 * this cap answers. The backdrop stays outside it, so the picture still uses
 * the whole window.
 */
const MAX_BODY_WIDTH = 1100

/**
 * How each kind of failure is presented, and what it offers.
 *
 * The three never share an action: a dropped request retries, an unset proxy
 * URL is a setup mistake with no request to repeat, and a link that names no
 * film — a bad id, or an id TMDB has nothing for — leaves only the way out.
 * A record keyed by kind rather than three nested conditions spread across five
 * props.
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
    title: 'Could not load the movie',
    actionLabel: 'Try again',
    actionIcon: 'refresh',
  },
  setup: { icon: 'cog-outline', tone: 'neutral', title: 'Setup needed' },
  missing: {
    icon: 'link-off',
    tone: 'error',
    title: 'Movie not found',
    actionLabel: 'Go home',
    actionIcon: 'home-outline',
  },
}

export default function MovieScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  // The route param is always a string. TMDB ids are numeric, so a non-numeric
  // param is a bad link, not a missing film — it must not reach the data layer.
  // This is derived from the param, so it is computed here rather than stored:
  // a bad id needs no fetch and no loading state.
  const movieId = Number(id)
  const validId = Number.isInteger(movieId)

  /**
   * The film, or nothing while the id names none.
   *
   * A null key for a bad parameter, so a link that points at no film sends no
   * request and shows no loading state. The failure for that case is built
   * below, where it is found.
   */
  const detail = useResource<MovieDetail | null>(
    validId ? `movie:${movieId}` : null,
    () => getMovie(movieId),
    'Could not load the movie',
  )

  const movie = detail.data
  const loading = detail.loading

  /**
   * What went wrong, in the order the three causes can be known.
   *
   * A bad route parameter is decided at render time and needs no request. A
   * `null` answer is the 404 `lib/api.ts` returns: the id parsed and the
   * request succeeded, so a second attempt would return the same nothing, and
   * that makes it `missing` rather than `transient`.
   */
  const failure: Failure | null = !validId
    ? missingFailure('That link does not point at a movie.')
    : (detail.failure ??
      (!loading && movie === null
        ? missingFailure('TMDB has no movie with that id.')
        : null))

  const { width, height } = useWindowDimensions()

  /**
   * The wide arrangement, from `expanded` up.
   *
   * It drives the poster size, the overlap, and the title variant together, so
   * the three cannot disagree about which layout is on screen.
   */
  const wide = useBreakpointValue({ compact: false, medium: false, expanded: true })

  /**
   * The backdrop height, as a fraction of the window width.
   *
   * A phone gets a frame taller than the 16:9 source, cropped at the sides,
   * because a 16:9 strip on a 390pt window is 219pt — a band rather than a
   * masthead. A desktop window needs the opposite: the ratio alone would run
   * the picture past the fold.
   */
  const heroAspect = useBreakpointValue({ compact: 0.78, medium: 0.6, expanded: 0.46 })

  // The window height caps the frame whatever the width asks for, so the title
  // is always on the first screen.
  const heroHeight = Math.min(width * heroAspect, height * 0.55)

  const posterWidth = wide ? 200 : 112

  /**
   * How far the poster rides up over the backdrop.
   *
   * The overlap is what ties the two images into one masthead. It stays under
   * half the poster height, so the title beside it lands on the page colour
   * rather than on the picture and needs no scrim of its own.
   */
  const overlap = wide ? 120 : 72

  // The backdrop is the hero and the poster is the fallback for it, so a film
  // with only one of the two still gets a complete masthead.
  const artwork = movie
    ? (backdropUrl(movie.backdrop_path) ?? posterUrl(movie.poster_path, 'w500'))
    : null

  // scrollY drives the header on the UI thread, so the bar arrives during a
  // fling without a re-render per frame.
  const { scrollY, onScroll } = useScroll()

  // The room the floating header needs, for the states that have no artwork to
  // run under it.
  const headerSpace = insets.top + HEADER_HEIGHT

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
        the film is still loading and while an error is on screen.

        The title reveals as the masthead leaves, which is why it is not also
        drawn under the bar. The screen showed the title twice before — once
        here and once in the body — and the two sat on top of each other.
      */}
      <DetailHeader
        title={movie?.title ?? ''}
        scrollY={scrollY}
        revealAt={heroHeight - overlap}
        // `router.back` alone dead-ends on a deep link, where this screen is the
        // first entry in the history and there is nothing to go back to.
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Presence>
        {loading ? (
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            {/*
              The placeholder holds the same box the content will — the same
              backdrop height, the same poster riding up over it, the same
              capped body. A different shape would reflow the whole screen the
              moment the request lands.
            */}
            <Skeleton height={heroHeight} shape="rectangle" />

            <View style={[styles.body, styles.bodyCap, { marginTop: -overlap }]}>
              <DetailIdentitySkeleton posterWidth={posterWidth} />

              {/* The action row. */}
              <Skeleton height={40} width={168} shape="rectangle" />

              {/* The chip row. Two blocks at chip height, so the space the
                  genres will take is already reserved. */}
              <View style={styles.skeletonChips}>
                <Skeleton height={32} width={84} shape="rectangle" />
                <Skeleton height={32} width={72} shape="rectangle" />
              </View>

              <Skeleton height={76} />
            </View>

            {/* One row placeholder for the two that follow the body. Two would
                reserve more height than most films fill, and the screen scrolls
                past the second before the request lands. */}
            <SkeletonRow />
          </Motion.View>
        ) : failure ? (
          /* The block centres in the room it is given, so the padding is what
             keeps it clear of the floating header rather than a top margin
             that would push it off centre. */
          <StateMessage
            key="error"
            testID="detail-error"
            icon={REPORTS[failure.kind].icon}
            tone={REPORTS[failure.kind].tone}
            title={REPORTS[failure.kind].title}
            body={failure.message}
            actionLabel={REPORTS[failure.kind].actionLabel}
            actionIcon={REPORTS[failure.kind].actionIcon}
            onAction={actions[failure.kind]}
            style={{ paddingTop: headerSpace }}
          />
        ) : movie ? (
          <Motion.ScrollView
            key="content"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.fill}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          >
            <DetailHero
              uri={artwork}
              height={heroHeight}
              headerSpace={headerSpace}
              recyclingKey={String(movieId)}
            />

            {/*
              The body is capped and centred, so a wide window widens the
              margins rather than the text. The negative margin is the overlap:
              it lifts the whole block over the lower edge of the artwork.
            */}
            <View style={[styles.body, styles.bodyCap, { marginTop: -overlap }]}>
              {/*
                `<Stagger>` owns the cascade, so no block below carries its own
                delay. It assigns child `i` a delay of `i * interval` from render
                order, re-derived every render — so adding or removing a section
                cannot leave a stale offset behind, and each one is free to be a
                component of its own.
              */}
              <Stagger interval={STAGGER_INTERVAL}>
                <DetailIdentity movie={movie} posterWidth={posterWidth} wide={wide} />

                <DetailActions movie={movie} />

                {/*
                  The genre row, which doubles as navigation: each chip opens the
                  genre screen. The film carries its own genres from the detail
                  endpoint, so this needs no second request.

                  `inset={0}` because the body already pads itself — the default
                  16 is the home screen's, where the row spans the full width.
                  GenreChips renders nothing for an empty list, so a film with no
                  genres leaves no gap.
                */}
                <GenreChips genres={movie.genres} inset={0} gutter={0} />

                <DetailOverview movie={movie} />
              </Stagger>
            </View>

            {/*
              Both rows sit outside the body box, not inside it: they span the
              full width and pad themselves, so `styles.body` would double the
              16. The cap is applied on its own, so on a wide window the rows
              start where the text above them does instead of at the window edge.

              Each returns nothing for an empty list, so a film with no cast and
              no recommendation ends at the overview.
            */}
            <View style={[styles.bodyCap, styles.rows]}>
              <CastRow title="Cast" cast={movie.cast} />
              <MovieRow title="More like this" movies={movie.recommendations} />
            </View>
          </Motion.ScrollView>
        ) : null}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  body: { paddingHorizontal: 16, gap: 20 },
  // Caps the measure and centres what is left over. `width: '100%'` is required
  // with `maxWidth`: without it the box shrinks to its content on a narrow
  // window, and `alignSelf: 'center'` then centres a column narrower than the
  // screen instead of filling it.
  bodyCap: { width: '100%', maxWidth: MAX_BODY_WIDTH, alignSelf: 'center' },
  // The gap the body already has, carried over the seam into the rows below.
  rows: { marginTop: 28 },
  skeletonChips: { flexDirection: 'row', gap: 8 },
})
