import { Skeleton } from '@rootnative/components/skeleton'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Stagger } from '@rootnative/inertia'
import { StyleSheet, View } from 'react-native'
import { ratingLabel, releaseLine } from '../lib/format'
import { posterUrl } from '../lib/images'
import { STAGGER_INTERVAL } from '../lib/motion'
import type { MovieDetail } from '../lib/types'
import { RemoteImage } from './RemoteImage'

/**
 * The poster and the title, and the same box with nothing in it.
 *
 * The two live in one file because they are one arrangement: the placeholder
 * has to hold the box the content will take, or the screen reflows the moment
 * the request lands. Splitting them would leave the flex rules in two places to
 * keep in step by hand.
 */

type Props = {
  movie: MovieDetail
  posterWidth: number
  /** The wide arrangement, from the `expanded` breakpoint up. */
  wide: boolean
}

export function DetailIdentity({ movie, posterWidth, wide }: Props) {
  const theme = useTheme()
  const poster = posterUrl(movie.poster_path, 'w500')
  const rating = ratingLabel(movie.vote_average)
  const release = releaseLine(movie.release_date, movie.runtime)

  return (
    <Motion.View
      initial={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.identity}
    >
      {/*
        The poster, at every width.

        It is the anchor of the masthead rather than a second copy of the
        artwork: it overlaps the backdrop, carries the portrait shape the film
        is sold under, and gives the title beside it a baseline to sit on. A
        film with no poster keeps the arrangement and loses only the image — an
        empty rectangle reads as a broken one.
      */}
      {poster ? (
        <RemoteImage
          testID="detail-poster"
          uri={poster}
          recyclingKey={String(movie.id)}
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
        {/* The larger variant only where there is room for it. On a phone the
            headline would wrap a long title to three lines. */}
        <Typography variant={wide ? 'headlineLargeEmphasized' : 'titleLargeEmphasized'}>
          {movie.title}
        </Typography>

        <View style={styles.metaRow}>
          {/*
            The rating as a badge rather than the first segment of a meta line.
            It is the one number a viewer scans for, and the cards already print
            the joined line where there is no room to set it apart.
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
            <Typography variant="labelLarge" color={theme.colors.onSurfaceVariant}>
              {release}
            </Typography>
          ) : null}
        </View>
      </View>
    </Motion.View>
  )
}

/** The same box, before the film arrives. */
export function DetailIdentitySkeleton({ posterWidth }: { posterWidth: number }) {
  const theme = useTheme()

  return (
    <View style={styles.identity}>
      {/*
        The ratio lives on the wrapper, not the block: Skeleton writes a
        concrete height ahead of the caller's style, and in React Native an
        explicit height beats `aspectRatio`.

        The wrapper also carries the page colour. The poster placeholder rides
        up over the backdrop placeholder, and two blocks of the same pulsing
        surface would read as one shape.
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
        <Skeleton height="100%" style={{ borderRadius: theme.shape.cornerLarge }} />
      </View>

      <View style={styles.identityText}>
        {/*
          `<Stagger>` owns the cascade, so no block carries its own delay. It
          assigns child `i` a delay of `i * interval` from render order,
          re-derived every render — so adding or removing a line cannot leave a
          stale offset behind.
        */}
        <Stagger interval={STAGGER_INTERVAL} delay={STAGGER_INTERVAL}>
          <Skeleton height={28} width="80%" />
          <Skeleton height={18} width="55%" />
        </Stagger>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
})
