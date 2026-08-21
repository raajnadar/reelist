import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
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
import { StyleSheet, useWindowDimensions, View, type ImageStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppBar } from '@rootnative/components/appbar'
import { metaLine } from '../../lib/format'
import { getMovie } from '../../lib/api'
import { backdropUrl, posterUrl } from '../../lib/images'
import { Skeleton } from '@rootnative/components/skeleton'
import type { Movie } from '../../lib/types'

/**
 * Milliseconds between consecutive lines in a staggered entrance.
 *
 * One value for both cascades on this screen — the loading blocks and the
 * content that replaces them — so the two read as the same movement.
 */
const STAGGER_INTERVAL = 60

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

  const [movie, setMovie] = useState<Movie | null>(null)
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

  // The hero height. The image is 16:9, so one screen width gives it
  // `width * 9 / 16`. On a wide window — a desktop browser — that number grows
  // past the viewport and pushes the title and the overview below the fold, so
  // it is capped at 55% of the window height. The cap never applies on a phone,
  // where a 16:9 strip is always shorter than the screen.
  const { width, height } = useWindowDimensions()
  const heroHeight = Math.min(width * (9 / 16), height * 0.55)

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
  const heroStyle = useInterpolatedStyle(
    scrollY,
    {
      scale: [1.35, 1, 1],
      translateY: [0, 0, heroHeight * 0.5],
      opacity: [1, 1, 0.25],
    },
    { inputRange: [-heroHeight, 0, heroHeight], extrapolate: 'extend' },
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
            <View style={styles.body}>
              {/* `delay` holds the whole cascade back so the hero block lands
                  before the first line moves, which is what the old 80ms
                  starting offset did. `interval` then spaces the rest. */}
              <Stagger interval={STAGGER_INTERVAL} delay={STAGGER_INTERVAL}>
                <Skeleton height={26} width="70%" />
                <Skeleton height={16} width="40%" />
                <Skeleton height={76} style={styles.skeletonParagraph} />
              </Stagger>
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
                  // The cast mirrors the one in CarouselCard: the hook returns
                  // Reanimated's DefaultStyle union, which does not narrow to
                  // ImageStyle inside a style array.
                  style={[styles.backdrop, heroStyle as ImageStyle]}
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

            <View style={styles.body}>
              {/*
                Each line rises in just behind the one above it.

                `<Stagger>` owns the offsets, so no line names its own
                position. That is what the hardcoded 0 / 1 / 2 indices did, and
                the positions now re-derive from render order — so reordering
                these blocks, or making one conditional, cannot leave a line
                animating on another line's delay.
              */}
              <Stagger interval={STAGGER_INTERVAL}>
                <Motion.View
                  initial={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition="enter"
                >
                  <Typography variant="headlineSmallEmphasized">{movie.title}</Typography>
                </Motion.View>

                <Motion.View
                  initial={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition="enter"
                >
                  <Typography variant="labelLarge" color={theme.colors.onSurfaceVariant}>
                    {metaLine(movie.vote_average, movie.release_date)}
                  </Typography>
                </Motion.View>

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
  overview: { marginTop: 10 },
  skeletonParagraph: { marginTop: 10 },
})
