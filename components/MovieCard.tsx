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
      {/* 2:3 is the TMDB poster ratio. The slot sizes the region and stretches
          its child, so neither the image nor the fallback needs a style. */}
      <Card.Media aspectRatio={2 / 3}>
        {uri ? (
          <Image source={{ uri }} resizeMode="cover" />
        ) : (
          <View style={[styles.fallback, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
              No poster
            </Typography>
          </View>
        )}
      </Card.Media>

      <Card.Content>
        <Typography variant="labelLargeEmphasized" numberOfLines={2}>
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
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
