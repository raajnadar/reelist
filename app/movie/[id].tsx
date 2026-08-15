import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppBar } from '@rootnative/components/appbar'
import { metaLine } from '../../lib/format'
import { getMovie } from '../../lib/api'
import { backdropUrl, posterUrl } from '../../lib/images'
import type { Movie } from '../../lib/types'

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

      {loading ? (
        <ActivityIndicator style={styles.centered} color={theme.colors.primary} />
      ) : error ? (
        <View style={styles.centered}>
          <Typography variant="bodyMedium" color={theme.colors.error}>
            {error}
          </Typography>
        </View>
      ) : movie ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* 16:9 is the TMDB backdrop ratio. The poster is the fallback, so a
              film with no backdrop still gets a hero instead of a blank strip. */}
          {backdrop ? (
            <Image
              source={{ uri: backdrop }}
              style={styles.backdrop}
              resizeMode="cover"
            />
          ) : poster ? (
            <Image source={{ uri: poster }} style={styles.backdrop} resizeMode="cover" />
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

          <View style={styles.body}>
            <Typography variant="headlineSmallEmphasized">{movie.title}</Typography>
            <Typography variant="labelLarge" color={theme.colors.onSurfaceVariant}>
              {metaLine(movie.vote_average, movie.release_date)}
            </Typography>

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
          </View>
        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { marginTop: 48, alignItems: 'center' },
  backdrop: { width: '100%', aspectRatio: 16 / 9 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 6 },
  overview: { marginTop: 10 },
})
