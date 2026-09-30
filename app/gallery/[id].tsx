import { LoadingIndicator } from '@rootnative/components/loading-indicator'
import { Presence } from '@rootnative/inertia'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { GalleryViewer } from '../../components/GalleryViewer'
import { StateMessage } from '../../components/StateMessage'
import { PageHead } from '../../components/PageHead'
import { getMovie } from '../../lib/api'
import { missingFailure, type Failure } from '../../lib/errors'
import { ON_STAGE, STAGE } from '../../lib/stage'
import type { MovieDetail } from '../../lib/types'
import { useResource } from '../../lib/useResource'

/**
 * The gallery screen: the film's stills, one at a time.
 *
 * A route rather than an overlay on the detail screen, for the reason the
 * trailer is one: it gets the system back gesture and the Android back button
 * for free, and the detail screen stays underneath with its scroll position.
 *
 * It asks for the film under the same key the detail screen used, so the
 * answer comes from the cache and the stills are on screen in the first frame.
 * A deep link straight here is the one case that sends a request, and the
 * loading and failure states below exist for it.
 */
export default function GalleryScreen() {
  const router = useRouter()
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>()

  // The same parse the detail screen does: TMDB ids are numeric, so a
  // non-numeric param is a bad link and sends no request.
  const movieId = Number(id)
  const validId = Number.isInteger(movieId)

  // A missing or unparseable position opens on the first still.
  const initialIndex = Number(at) || 0

  const detail = useResource<MovieDetail | null>(
    validId ? `movie:${movieId}` : null,
    () => getMovie(movieId),
    'Could not load the gallery',
  )

  const movie = detail.data
  const loading = detail.loading

  // Back to the film when there is a screen to go back to, and to the film's
  // page when this is the first entry — a deep link. A bad id has no film to
  // go to, and falls back to home.
  const close = () => {
    if (router.canGoBack()) router.back()
    else if (validId) router.replace(`/movie/${movieId}`)
    else router.replace('/')
  }

  const failure: Failure | null = !validId
    ? missingFailure('That link does not point at a movie.')
    : (detail.failure ??
      (!loading && movie === null
        ? missingFailure('TMDB has no movie with that id.')
        : null))

  return (
    <View style={styles.screen}>
      <PageHead title={movie ? `${movie.title} gallery` : 'Gallery'} noindex />
      {/*
        `fullScreenModal` and a fade, the same as the trailer: a sheet would
        round the corners over the picture and show the film behind its top
        edge, and neither belongs on a viewer.
      */}
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'fade' }} />

      {/* The stage is black whatever the theme says. See the trailer screen. */}
      <StatusBar style="light" />

      <Presence>
        {loading ? (
          <View key="loading" style={styles.centre}>
            <LoadingIndicator contentColor={ON_STAGE} accessibilityLabel="Loading" />
          </View>
        ) : failure ? (
          <StateMessage
            key="error"
            testID="gallery-error"
            icon="link-off"
            tone="error"
            title="Could not open the gallery"
            body={failure.message}
            actionLabel="Go back"
            actionIcon="arrow-left"
            onAction={close}
          />
        ) : movie && movie.images.length ? (
          <GalleryViewer
            key="viewer"
            images={movie.images}
            title={movie.title}
            initialIndex={initialIndex}
            onClose={close}
          />
        ) : (
          /* A real film with nothing in its images block. There is no request
             to retry, so the only action is the way out. */
          <StateMessage
            key="empty"
            testID="gallery-empty"
            icon="image-off-outline"
            title="No stills for this film"
            body="TMDB has no backdrops for it yet."
            actionLabel="Go back"
            actionIcon="arrow-left"
            onAction={close}
          />
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: STAGE },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
