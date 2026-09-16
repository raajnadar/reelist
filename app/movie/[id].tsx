import { Button } from '@rootnative/components/button'
import { Skeleton } from '@rootnative/components/skeleton'
import { Typography } from '@rootnative/components/typography'
import { useBreakpointValue, useTheme } from '@rootnative/core'
import { Motion, Presence, Stagger, useScroll } from '@rootnative/inertia'
import { openURL } from 'expo-linking'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CastRow } from '../../components/CastRow'
import { DetailHeader, HEADER_HEIGHT } from '../../components/DetailHeader'
import { GenreChips } from '../../components/GenreChips'
import { MovieRow } from '../../components/MovieRow'
import { Scrim, type ScrimStop } from '../../components/Scrim'
import { RemoteImage } from '../../components/RemoteImage'
import { SkeletonRow } from '../../components/Skeleton'
import { StateMessage } from '../../components/StateMessage'
import { getMovie } from '../../lib/api'
import { missingFailure, type Failure, type FailureKind } from '../../lib/errors'
import { isSaved, toggleSaved, useWatchlist } from '../../lib/watchlist'
import { useResource } from '../../lib/useResource'
import { ratingLabel, releaseLine } from '../../lib/format'
import { backdropUrl, posterUrl } from '../../lib/images'
import type { MovieDetail, Video } from '../../lib/types'

/**
 * Milliseconds between consecutive lines in a staggered entrance.
 *
 * One value for both cascades on this screen — the loading blocks and the
 * content that replaces them — so the two read as the same movement.
 */
const STAGGER_INTERVAL = 60

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

/**
 * The scrim that dissolves the backdrop into the page.
 *
 * The stops are weighted to the bottom third: the top half of the frame is left
 * alone, and the last quarter reaches the page colour before the image ends, so
 * there is no seam where the picture stops. This is what replaced the parallax —
 * the hero now reads as part of the page rather than as a panel sliding behind
 * it.
 */
const BACKDROP_SCRIM: readonly ScrimStop[] = [
  [0, 0],
  [0.45, 0.08],
  [0.65, 0.34],
  [0.82, 0.76],
  [1, 1],
]

/**
 * A short wash under the status bar, so the back button and the clock stay
 * legible on a bright frame. It is the theme `scrim` (black), not the page
 * colour: this one darkens the picture rather than fading it out.
 */
const TOP_SCRIM: readonly ScrimStop[] = [
  [0, 0.4],
  [1, 0],
]

/**
 * Opens the trailer outside the app.
 *
 * `lib/api.ts` already established the video is a YouTube trailer, so this
 * builds the watch URL and nothing more. It takes the nullable type rather than
 * a narrowed one, because the caller reads `movie.trailer` inside a callback
 * and the guard around that callback does not narrow a property there.
 *
 * A rejected promise means no installed app can open a YouTube link. There is
 * no better answer than doing nothing, and an uncaught rejection would only
 * print a warning.
 */
const openTrailer = (video: Video | null) => {
  if (!video) return
  void openURL(`https://www.youtube.com/watch?v=${video.key}`).catch(() => {})
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

  const retry = detail.reload

  const { movies: watchlist } = useWatchlist()
  const saved = movie ? isSaved(watchlist, movie.id) : false

  const backdrop = movie ? backdropUrl(movie.backdrop_path) : null
  const poster = movie ? posterUrl(movie.poster_path, 'w500') : null
  // The backdrop is the hero and the poster is the fallback for it, so a film
  // with only one of the two still gets a complete masthead.
  const artwork = backdrop ?? poster

  const { width, height } = useWindowDimensions()

  /**
   * The wide arrangement, from `expanded` up.
   *
   * It changes the size of the masthead, not its shape: the poster and the
   * title sit side by side at every width. `medium` is a tablet, wide enough
   * for a longer measure than a phone and not wide enough for a 200px poster.
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
    transient: retry,
    setup: undefined,
    missing: () => router.replace('/'),
  }

  const rating = movie ? ratingLabel(movie.vote_average) : null
  const release = movie ? releaseLine(movie.release_date, movie.runtime) : ''

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
              <View style={styles.identity}>
                {/*
                  The ratio lives on the wrapper, not the block: Skeleton writes
                  a concrete height ahead of the caller's style, and in React
                  Native an explicit height beats `aspectRatio`.

                  The wrapper also carries the page colour. The poster
                  placeholder rides up over the backdrop placeholder, and two
                  blocks of the same pulsing surface would read as one shape.
                */}
                <View
                  style={[
                    styles.posterPlaceholder,
                    {
                      width: posterWidth,
                      borderRadius: theme.shape.cornerLarge,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                >
                  <Skeleton
                    height="100%"
                    style={{ borderRadius: theme.shape.cornerLarge }}
                  />
                </View>

                <View style={styles.identityText}>
                  {/*
                    `<Stagger>` owns the cascade, so no block carries its own
                    delay. It assigns child `i` a delay of `i * interval` from
                    render order, re-derived every render — so adding or
                    removing a line cannot leave a stale offset behind.
                  */}
                  <Stagger interval={STAGGER_INTERVAL} delay={STAGGER_INTERVAL}>
                    <Skeleton height={28} width="80%" />
                    <Skeleton height={18} width="55%" />
                  </Stagger>
                </View>
              </View>

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
            {/*
              The masthead: one frame of artwork that fades into the page, with
              the poster and the title riding up over its lower edge.

              The picture no longer moves against the scroll. A backdrop that
              drifts at half speed reads as a panel behind the page, and it put
              the title over a moving image for the whole first screen.
            */}
            <View style={[styles.heroArt, { height: heroHeight }]}>
              {artwork ? (
                /*
                  A slow settle out of a slight zoom, played once on arrival.
                  The wrapper owns it rather than the picture: `Motion.View`
                  takes the animated path because `animate` is present, and
                  RemoteImage is not a Motion primitive.

                  The zoom is all the wrapper does. The fade belongs to the
                  image, which cross-dissolves when the bytes land — timed to
                  the download rather than to the mount, so a slow connection
                  no longer fades an empty box in and then snaps the picture
                  into it.
                */
                <Motion.View
                  style={styles.fill}
                  initial={{ scale: 1.06 }}
                  animate={{ scale: 1 }}
                  transition="enter"
                >
                  <RemoteImage
                    testID="detail-backdrop"
                    uri={artwork}
                    recyclingKey={String(movieId)}
                    // The picture the screen is built around.
                    priority="high"
                    style={styles.fill}
                  />
                </Motion.View>
              ) : (
                <View
                  style={[
                    styles.fill,
                    styles.fallback,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
                    No image
                  </Typography>
                </View>
              )}

              <Scrim color={theme.colors.background} stops={BACKDROP_SCRIM} />

              <View style={[styles.topScrim, { height: headerSpace }]}>
                <Scrim color={theme.colors.scrim} stops={TOP_SCRIM} />
              </View>
            </View>

            {/*
              The body is capped and centred, so a wide window widens the
              margins rather than the text. The negative margin is the overlap:
              it lifts the whole block over the lower edge of the artwork.
            */}
            <View style={[styles.body, styles.bodyCap, { marginTop: -overlap }]}>
              <Stagger interval={STAGGER_INTERVAL}>
                <Motion.View
                  initial={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition="enter"
                  style={styles.identity}
                >
                  {/*
                    The poster, at every width.

                    It is the anchor of the masthead rather than a second copy
                    of the artwork: it overlaps the backdrop, carries the
                    portrait shape the film is sold under, and gives the title
                    beside it a baseline to sit on. A film with no poster keeps
                    the arrangement and loses only the image — an empty
                    rectangle reads as a broken one.
                  */}
                  {poster ? (
                    <RemoteImage
                      testID="detail-poster"
                      uri={poster}
                      recyclingKey={String(movieId)}
                      priority="high"
                      style={[
                        styles.poster,
                        {
                          width: posterWidth,
                          borderRadius: theme.shape.cornerLarge,
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: theme.colors.outlineVariant,
                        },
                      ]}
                    />
                  ) : null}

                  <View style={styles.identityText}>
                    {/* The larger variant only where there is room for it. On a
                        phone the headline would wrap a long title to three lines. */}
                    <Typography
                      variant={wide ? 'headlineLargeEmphasized' : 'titleLargeEmphasized'}
                    >
                      {movie.title}
                    </Typography>

                    <View style={styles.metaRow}>
                      {/*
                        The rating as a badge rather than the first segment of a
                        meta line. It is the one number a viewer scans for, and
                        the cards already print the joined line where there is
                        no room to set it apart.
                      */}
                      {rating ? (
                        <View
                          style={[
                            styles.rating,
                            {
                              backgroundColor: theme.colors.primaryContainer,
                              borderRadius: theme.shape.cornerFull,
                            },
                          ]}
                        >
                          <Typography
                            variant="labelLargeEmphasized"
                            color={theme.colors.onPrimaryContainer}
                          >
                            {`★ ${rating}`}
                          </Typography>
                        </View>
                      ) : null}

                      {release ? (
                        <Typography
                          variant="labelLarge"
                          color={theme.colors.onSurfaceVariant}
                        >
                          {release}
                        </Typography>
                      ) : null}
                    </View>
                  </View>
                </Motion.View>

                {/*
                  The trailer, when the film has one on YouTube. `lib/api.ts`
                  chose it, so this line has no filtering to do and `null` means
                  the button is simply absent.

                  The link leaves the app. There is no in-app player: a YouTube
                  video needs the YouTube frame, so an embedded one would take a
                  new dependency and still hand playback to YouTube. `openURL`
                  opens the YouTube app when it is installed and the browser
                  when it is not.

                  A new child needs no delay of its own — `<Stagger>` re-derives
                  the whole cascade from render order, so the lines below this
                  one move back by one interval on their own.
                */}
                <Motion.View
                  initial={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition="enter"
                  style={styles.actions}
                >
                  {movie.trailer ? (
                    <Button
                      variant="filled"
                      size="m"
                      leadingIcon="play"
                      onPress={() => openTrailer(movie.trailer)}
                    >
                      Watch trailer
                    </Button>
                  ) : null}
                  {/*
                    The label states what the film is now, not what the button
                    will do. A control that reads "Save" while the film is
                    already saved would report the list wrongly, and the icon
                    fills at the same moment for a reader who does not read the
                    label.

                    `tonal` beside the filled trailer button: the trailer is the
                    one action the screen leads with, and two filled buttons
                    side by side would leave neither of them first.
                  */}
                  <Button
                    variant={saved ? 'filled' : 'tonal'}
                    size="m"
                    leadingIcon={saved ? 'bookmark' : 'bookmark-outline'}
                    onPress={() => toggleSaved(movie)}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                </Motion.View>

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

                <Motion.View
                  initial={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition="enter"
                  style={styles.section}
                >
                  {/*
                    A heading, so the overview is a section like the two rows
                    below it rather than a paragraph that starts without warning.
                  */}
                  <Typography variant="titleMediumEmphasized">Overview</Typography>

                  {/*
                    The tagline, when the film has one. TMDB sends `""` for a
                    film with none, and `lib/api.ts` keeps that sentinel — so
                    this is a line that is simply absent rather than an empty row.
                  */}
                  {movie.tagline ? (
                    <Typography
                      variant="bodyLarge"
                      color={theme.colors.primary}
                      style={styles.tagline}
                    >
                      {movie.tagline}
                    </Typography>
                  ) : null}

                  {movie.overview ? (
                    <Typography variant="bodyMedium" style={styles.overview}>
                      {movie.overview}
                    </Typography>
                  ) : (
                    <Typography
                      variant="bodyMedium"
                      color={theme.colors.onSurfaceVariant}
                      style={styles.overview}
                    >
                      No overview yet.
                    </Typography>
                  )}
                </Motion.View>
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
  // Clips the scrim and the zoom-out entrance to the frame. Without it the
  // image starts 6% wider than the window and widens the page on web.
  heroArt: { width: '100%', overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  // Pinned to the top of the frame rather than filling it, so the wash under
  // the status bar ends where the header does.
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  body: { paddingHorizontal: 16, gap: 20 },
  // Caps the measure and centres what is left over. `width: '100%'` is required
  // with `maxWidth`: without it the box shrinks to its content on a narrow
  // window, and `alignSelf: 'center'` then centres a column narrower than the
  // screen instead of filling it.
  bodyCap: { width: '100%', maxWidth: MAX_BODY_WIDTH, alignSelf: 'center' },
  // The poster beside the title. `flex-end` sets the two on one baseline, so
  // the title sits at the foot of the poster however tall either one is.
  identity: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  // `flexBasis: 0` with `flex: 1`: the column takes the leftover width rather
  // than sizing to its content, so a long title cannot squeeze the poster.
  identityText: { flex: 1, flexBasis: 0, gap: 10 },
  // 2:3 is the TMDB poster ratio, the same one MovieCard's media box uses. The
  // hairline separates the poster from a dark frame behind it.
  poster: { aspectRatio: 2 / 3, borderWidth: StyleSheet.hairlineWidth },
  // The loading stand-in for it: the same box, on the page colour, clipped so
  // the block inside keeps the corner.
  posterPlaceholder: { aspectRatio: 2 / 3, overflow: 'hidden' },
  // `wrap`, because the badge and the date line together outrun a narrow column
  // beside a poster.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rating: { paddingHorizontal: 10, paddingVertical: 3 },
  // `alignSelf` keeps the buttons at their own width. A Button in a column with
  // `align: stretch` spans the whole measure, which reads as a banner rather
  // than an action. `wrap`, because the two together outrun a narrow column
  // beside the poster.
  actions: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: { gap: 8 },
  tagline: { fontStyle: 'italic' },
  overview: { marginTop: 2 },
  // The gap the body already has, carried over the seam into the rows below.
  rows: { marginTop: 28 },
  skeletonChips: { flexDirection: 'row', gap: 8 },
})
