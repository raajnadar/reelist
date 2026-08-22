import { Typography } from '@rootnative/components/typography'
import { useBreakpointValue, useTheme } from '@rootnative/core'
import {
  Motion,
  Presence,
  Stagger,
  useInterpolatedStyle,
  useScroll,
} from '@rootnative/inertia'
// The hero drives its own interpolated style rather than an `animate` prop, so
// it needs Reanimated's animated Image. A `Motion.Image` carrying only `style`
// has no motion prop, takes the library's zero-cost plain path, and renders a
// component that cannot read an animated style — the parallax silently does
// nothing. This subpath is the documented interop for exactly that case.
import { Animated } from '@rootnative/inertia/reanimated'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppBar } from '@rootnative/components/appbar'
import { GenreChips } from '../../components/GenreChips'
import { metaLine } from '../../lib/format'
import { getMovie } from '../../lib/api'
import { backdropUrl, posterUrl } from '../../lib/images'
import { Skeleton } from '@rootnative/components/skeleton'
import type { MovieDetail } from '../../lib/types'

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
 * this cap answers. The value is the body box, not the hero: the backdrop stays
 * full-bleed, so the picture still uses the whole window.
 */
const MAX_BODY_WIDTH = 1100

/** The poster column width in the two-column arrangement. */
const POSTER_WIDTH = 260

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

  const [movie, setMovie] = useState<MovieDetail | null>(null)
  const [loading, setLoading] = useState(validId)
  const [error, setError] = useState<string | null>(
    validId ? null : 'That link is not a valid movie',
  )

  useEffect(() => {
    if (!validId) return
    let active = true

    // Same shape as the home screen: async against static data today, ready for
    // the network later. See the note in lib/api.ts.
    getMovie(movieId)
      .then((result) => {
        if (!active) return
        if (result) setMovie(result)
        else setError('That movie is not in the list')
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Could not load the movie')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [movieId, validId])

  const backdrop = movie ? backdropUrl(movie.backdrop_path) : null
  const poster = movie ? posterUrl(movie.poster_path, 'w500') : null

  const { width, height } = useWindowDimensions()

  /**
   * Two columns — poster beside the text — only from `expanded` up.
   *
   * `medium` is a tablet: wide enough to want a longer measure than a phone, not
   * wide enough to put a 260px poster next to it and leave a readable column.
   * There the layout stays stacked and only the body cap applies.
   */
  const twoColumn = useBreakpointValue({ compact: false, medium: false, expanded: true })

  /**
   * The share of the window height the backdrop may take.
   *
   * On a phone the 16:9 strip is always shorter than this, so the cap never
   * fires and the mobile hero is exactly what it was. On a desktop window the
   * 16:9 height runs past the fold, and the old 55% still left the title and the
   * overview below it — hence 40% once there is a poster to carry the page.
   */
  const heroShare = useBreakpointValue({ compact: 0.55, medium: 0.5, expanded: 0.4 })

  // The image is 16:9, so one window width gives it `width * 9 / 16`. The share
  // above caps that on a window too wide for the ratio to stay on screen.
  const heroHeight = Math.min(width * (9 / 16), height * heroShare)

  // scrollY drives the hero on the UI thread, so the parallax holds during a
  // fling without a re-render per frame.
  const { scrollY, onScroll } = useScroll()

  // Two behaviours from one value, split at scroll position 0:
  //
  // - Pulled DOWN (negative scrollY): the hero grows and stays anchored to the
  //   top. This is the iOS-style stretch on overscroll.
  // - Scrolled UP (positive): the hero drifts at half speed and fades, so the
  //   text slides over it rather than pushing it off screen.
  //
  // `extrapolate: 'extend'` is required for the stretch: the default 'clamp'
  // would freeze the scale at 1 and the pull-down would do nothing.
  //
  // It is native-only on purpose. The stretch answers a rubber-band overscroll,
  // which is a touch gesture — a browser scrolls to 0 and stops, so on web the
  // extended range is unreachable and any value it produced would come from a
  // scroll position the user cannot reach. 'clamp' there keeps the drift-and-fade
  // half, which a mouse wheel does drive.
  const heroStyle = useInterpolatedStyle(
    scrollY,
    {
      scale: [1.35, 1, 1],
      translateY: [0, 0, heroHeight * 0.5],
      opacity: [1, 1, 0.25],
    },
    {
      inputRange: [-heroHeight, 0, heroHeight],
      extrapolate: Platform.OS === 'web' ? 'clamp' : 'extend',
    },
  )

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppBar
        title={movie?.title ?? 'Movie'}
        insetTop
        canGoBack
        // `router.back` alone dead-ends on a deep link, where this screen is the
        // first entry in the history and there is nothing to go back to.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Presence>
        {loading ? (
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <Skeleton height={heroHeight} shape="rectangle" />
            {/*
              `<Stagger>` owns the cascade, so no block carries its own delay.
              It assigns child `i` a delay of `i * interval` from render order,
              which is what the three hand-written `delay` values did — but
              re-derived every render, so adding or removing a line cannot
              leave a stale offset behind.
            */}
            {/*
              The placeholder holds the same box the content will: capped, centred,
              and split into two columns at the same breakpoint. A single-column
              skeleton followed by a two-column body would reflow the whole screen
              the moment the request lands.
            */}
            <View style={[styles.body, styles.bodyCap, twoColumn && styles.bodyRow]}>
              {twoColumn ? (
                <Skeleton height={POSTER_WIDTH * (3 / 2)} width={POSTER_WIDTH} />
              ) : null}
              <View style={styles.textColumn}>
                {/* `delay` holds the whole cascade back so the hero block lands
                    before the first line moves, which is what the old 80ms
                    starting offset did. `interval` then spaces the rest. */}
                <Stagger interval={STAGGER_INTERVAL} delay={STAGGER_INTERVAL}>
                  <Skeleton height={26} width="70%" />
                  <Skeleton height={16} width="40%" />
                  {/* The chip row. Two blocks at chip height, so the space the
                      genres will take is already reserved. */}
                  <View style={styles.skeletonChips}>
                    <Skeleton height={32} width={84} shape="rectangle" />
                    <Skeleton height={32} width={72} shape="rectangle" />
                  </View>
                  <Skeleton height={76} style={styles.skeletonParagraph} />
                </Stagger>
              </View>
            </View>
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
        ) : movie ? (
          <Motion.ScrollView
            key="content"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.fill}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          >
            {/*
              The hero sits in a fixed-height, clipped box. The image inside it
              is what scales, so the stretch never paints over the body text
              below — without `overflow: 'hidden'` the grown image would.
            */}
            <View style={[styles.heroClip, { height: heroHeight }]}>
              {/* 16:9 is the TMDB backdrop ratio. The poster is the fallback, so a
                  film with no backdrop still gets a hero instead of a blank strip. */}
              {backdrop || poster ? (
                <Animated.Image
                  source={{ uri: (backdrop ?? poster) as string }}
                  style={[styles.backdrop, heroStyle]}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.backdrop,
                    styles.fallback,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
                    No image
                  </Typography>
                </View>
              )}
            </View>

            {/*
              The body is capped and centred, so a wide window widens the margins
              rather than the text. The hero above is deliberately outside this
              box: the picture is the one element that should stay full-bleed.
            */}
            <View style={[styles.body, styles.bodyCap, twoColumn && styles.bodyRow]}>
              {/*
                The poster, alongside the text from `expanded` up.

                It is absent on a phone on purpose. The backdrop is already the
                hero there, and a second image of the same film would push the
                overview off the fold to say nothing new. On a wide window it is
                what fills the space beside a capped text column — the reason
                this layout has two columns at all.

                Rendered only when a poster path exists. There is no placeholder
                box: an empty rectangle beside the title is worse than a text
                column that simply uses the width.
              */}
              {twoColumn && poster ? (
                <Motion.View
                  initial={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition="enter"
                >
                  <Image
                    testID="detail-poster"
                    source={{ uri: poster }}
                    style={[
                      styles.poster,
                      {
                        borderRadius: theme.shape.cornerLarge,
                        backgroundColor: theme.colors.surfaceVariant,
                      },
                    ]}
                    resizeMode="cover"
                  />
                </Motion.View>
              ) : null}

              {/*
                Each line rises in just behind the one above it.

                `<Stagger>` owns the offsets, so no line names its own
                position. That is what the hardcoded 0 / 1 / 2 indices did, and
                the positions now re-derive from render order — so reordering
                these blocks, or making one conditional, cannot leave a line
                animating on another line's delay.

                `styles.textColumn` carries `flex: 1` and a `flexBasis` of 0. In
                the row arrangement that is what makes the column take the space
                the poster leaves instead of sizing to its longest line, and the
                zero basis stops a long unbroken overview from pushing the poster
                out of the row.
              */}
              <View style={styles.textColumn}>
                <Stagger interval={STAGGER_INTERVAL}>
                  <Motion.View
                    initial={{ opacity: 0, translateY: 16 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition="enter"
                  >
                    {/* The larger variant only where there is room for it. On a
                        phone the headline would wrap a long title to three lines. */}
                    <Typography
                      variant={
                        twoColumn ? 'headlineMediumEmphasized' : 'headlineSmallEmphasized'
                      }
                    >
                      {movie.title}
                    </Typography>
                  </Motion.View>

                  <Motion.View
                    initial={{ opacity: 0, translateY: 16 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition="enter"
                  >
                    <Typography
                      variant="labelLarge"
                      color={theme.colors.onSurfaceVariant}
                    >
                      {metaLine(movie.vote_average, movie.release_date, movie.runtime)}
                    </Typography>
                  </Motion.View>

                  {/*
                    The tagline, when the film has one. TMDB sends `""` for a film
                    with none, and `lib/api.ts` keeps that sentinel — so this is a
                    line that is simply absent rather than an empty row.
                  */}
                  {movie.tagline ? (
                    <Motion.View
                      initial={{ opacity: 0, translateY: 16 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition="enter"
                    >
                      <Typography
                        variant="bodyMedium"
                        color={theme.colors.onSurfaceVariant}
                        style={styles.tagline}
                      >
                        {movie.tagline}
                      </Typography>
                    </Motion.View>
                  ) : null}

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
                  >
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
  centered: { marginTop: 48, alignItems: 'center' },
  // Clips the hero so the pull-down stretch cannot paint over the body.
  heroClip: { width: '100%', overflow: 'hidden' },
  backdrop: {
    // The image fills the clip box rather than setting its own height from a
    // 16:9 aspect ratio. The box is capped on a wide window, so an aspect ratio
    // here would lay the image out taller than the box and the clip would cut
    // the frame instead of fitting it. `resizeMode="cover"` keeps the ratio.
    width: '100%',
    height: '100%',
    // Anchors the stretch to the top edge. The default origin is the center,
    // which would pull the image down off the app bar as it grows and leave a
    // gap at the top — the opposite of the intended effect.
    transformOrigin: 'top',
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  // Caps the measure and centres what is left over. `width: '100%'` is required
  // with `maxWidth`: without it the box shrinks to its content on a narrow
  // window, and `alignSelf: 'center'` then centres a column narrower than the
  // screen instead of filling it.
  bodyCap: { width: '100%', maxWidth: MAX_BODY_WIDTH, alignSelf: 'center' },
  // The two-column arrangement. `alignItems: 'flex-start'` keeps the poster at
  // its own height rather than stretching it to match the text column.
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 28, paddingTop: 28 },
  // `flexBasis: 0` with `flex: 1`: the column takes the leftover width rather
  // than sizing to its content, so a long overview cannot squeeze the poster.
  textColumn: { flex: 1, flexBasis: 0, gap: 6 },
  // 2:3 is the TMDB poster ratio, the same one MovieCard's media box uses.
  poster: { width: POSTER_WIDTH, aspectRatio: 2 / 3 },
  tagline: { fontStyle: 'italic', marginTop: 2 },
  overview: { marginTop: 10 },
  skeletonParagraph: { marginTop: 10 },
  skeletonChips: { flexDirection: 'row', gap: 8, marginTop: 4 },
})
