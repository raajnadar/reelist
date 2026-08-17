import { Card } from '@rootnative/components/card'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { Image, StyleSheet, View } from 'react-native'
import { metaLine } from '../lib/format'
import { entranceTransition } from '../lib/motion'
import { posterUrl } from '../lib/images'
import type { Movie } from '../lib/types'

export const CARD_WIDTH = 160

export function MovieCard({ movie, index = 0 }: { movie: Movie; index?: number }) {
  const theme = useTheme()
  const router = useRouter()
  const uri = posterUrl(movie.poster_path)

  return (
    // The Motion.View wraps the Card rather than replacing it: Card owns the
    // M3 surface (elevation, shape, state layer), and this owns the movement.
    // Animating the wrapper also keeps the transform off the Card's own
    // press handling.
    <Motion.View
      // Rise and fade in, staggered by position in the row.
      initial={{ opacity: 0, translateY: 24 }}
      animate={{ opacity: 1, translateY: 0 }}
      // `hovered` is a no-op on native and drives the web pointer state; the
      // one declaration covers both platforms.
      gesture={{
        hovered: { scale: 1.04, translateY: -6 },
        pressed: { scale: 0.96 },
      }}
      // Per-key map, not a single config — see entranceTransition for why the
      // entrance spring cannot sit at the top level next to a gesture layer.
      // The stagger delay stays on the entrance keys; on the gesture layers it
      // would delay the answer to a tap.
      transition={{
        ...entranceTransition(index),
        // A press answers fast; a hover eases. See lib/motion.ts.
        pressed: 'press',
        hovered: 'hover',
      }}
      style={styles.slot}
    >
      <Card
        variant="filled"
        style={styles.card}
        onPress={() => router.push(`/movie/${movie.id}`)}
        accessibilityLabel={`${movie.title}. ${metaLine(movie.vote_average, movie.release_date)}`}
      >
        {/* 2:3 is the TMDB poster ratio.

          The Image needs its own size. React Native does not measure a remote
          image before it loads, so an Image with no dimensions lays out at zero
          height and the poster never appears, whatever the parent sets. The
          fallback View below is fine with `flex: 1`, because a View has no
          intrinsic size to wait for. */}
        <Card.Media aspectRatio={2 / 3}>
          {uri ? (
            <Image
              testID="movie-poster"
              source={{ uri }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[styles.fallback, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
                No poster
              </Typography>
            </View>
          )}
        </Card.Media>

        <Card.Content>
          {/* The title box is always two lines tall, even when the title needs
            one. numberOfLines caps the text but reserves no space, so without
            a fixed height a short title makes a shorter card, and a horizontal
            row of cards ends up ragged along the bottom. The height comes from
            the theme, so a change to the type scale keeps the two lines. */}
          <Typography
            variant="labelLargeEmphasized"
            numberOfLines={2}
            style={{ height: theme.typography.labelLargeEmphasized.lineHeight * 2 }}
          >
            {movie.title}
          </Typography>
          <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
            {metaLine(movie.vote_average, movie.release_date)}
          </Typography>
        </Card.Content>
      </Card>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // The animated wrapper carries the width so the hover lift scales the whole
  // card. The Card keeps its own width for the case where it renders alone.
  slot: { width: CARD_WIDTH },
  card: { width: CARD_WIDTH },
  // Matches CarouselCard.poster and the detail screen backdrop: the image
  // carries its own ratio rather than inheriting one from the slot.
  poster: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
