import { Card } from '@rootnative/components/card'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useRouter } from 'expo-router'
import { Image, StyleSheet, View } from 'react-native'
import { metaLine } from '../lib/format'
import { posterUrl } from '../lib/images'
import type { Movie } from '../lib/types'

export const CARD_WIDTH = 160

export function MovieCard({ movie }: { movie: Movie }) {
  const theme = useTheme()
  const router = useRouter()
  const uri = posterUrl(movie.poster_path)

  return (
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
  )
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH },
  // Matches CarouselCard.poster and the detail screen backdrop: the image
  // carries its own ratio rather than inheriting one from the slot.
  poster: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
