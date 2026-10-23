import { Card } from '@rootnative/components/card'
import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import {
  Motion,
  useInView,
  useInterpolatedStyle,
  useMotionValue,
  type SharedValue,
} from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { cascadeWindow, LIFT_SPACE } from '../lib/motion'
import type { Video } from '../lib/types'
import { useServerPainted } from '../lib/useServerPainted'
import { STILL_WIDTH } from './GalleryRow'

/** The shape of the frame YouTube plays in. */
const VIDEO_ASPECT = 16 / 9

type Props = {
  /** The film title. The player prints it in its bar. */
  title: string
  videos: Video[]
  /** The video the trailer button plays, or null when the film has none. */
  trailer: Video | null
}

/**
 * The videos of the film, as a horizontal row that opens the player.
 *
 * It mirrors GalleryRow rather than sharing code with it, for the reason
 * CastRow records.
 *
 * A card shows no frame from its video. A YouTube thumbnail comes from a
 * Google server, and the privacy screen tells the reader that the app loads
 * YouTube only when they open a video.
 */
export function VideoRow({ title, videos, trailer }: Props) {
  const theme = useTheme()
  const ref = useRef<View>(null)

  // The row owns the in-view trigger, for the reason MovieRow explains.
  const inView = useInView(ref, { amount: 0.1, transition: 'cascade' })

  // At rest on the static page, for the reason MovieRow gives.
  const atRest = useMotionValue(1)
  const progress = useServerPainted() ? atRest : inView

  // Absent, not empty. A row that holds only the trailer repeats the button
  // above it, so that row is absent too.
  const onlyTrailer = videos.length === 1 && videos[0].key === trailer?.key
  if (!videos.length || onlyTrailer) return null

  return (
    <View ref={ref} style={styles.row}>
      <View style={styles.head}>
        <Typography variant="titleMediumEmphasized" level={2}>
          Videos
        </Typography>
        <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
          {videos.length === 1 ? '1 video' : `${videos.length} videos`}
        </Typography>
      </View>

      <FlatList
        data={videos}
        horizontal
        showsHorizontalScrollIndicator={false}
        // TMDB can list one YouTube video twice, so the key alone is not unique.
        keyExtractor={(video, index) => `${video.key}-${index}`}
        renderItem={({ item, index }) => (
          <VideoCard video={item} index={index} title={title} progress={progress} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

function VideoCard({
  video,
  index,
  title,
  progress,
}: {
  video: Video
  index: number
  title: string
  progress: SharedValue<number>
}) {
  const theme = useTheme()
  const router = useRouter()

  const entrance = useInterpolatedStyle(
    progress,
    { opacity: [0, 1], translateY: [24, 0] },
    { inputRange: cascadeWindow(index) },
  )

  return (
    // Two nested elements, for the reason MovieCard gives.
    <Motion.View style={[styles.slot, entrance]}>
      <Motion.View
        gesture={{
          hovered: { scale: 1.03, translateY: -4 },
          pressed: { scale: 0.97 },
        }}
        transition={{ pressed: 'press', hovered: 'hover' }}
      >
        {/* The same player route as the trailer button. */}
        <Card
          testID="video-card"
          variant="filled"
          style={styles.card}
          accessibilityLabel={`Play ${video.name}. ${video.type}`}
          onPress={() =>
            router.push(`/trailer/${video.key}?title=${encodeURIComponent(title)}`)
          }
        >
          <Card.Media aspectRatio={VIDEO_ASPECT}>
            <View
              style={[styles.frame, { backgroundColor: theme.colors.secondaryContainer }]}
            >
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <Icon source="play" size={28} color={theme.colors.onPrimary} />
              </View>
            </View>
          </Card.Media>

          <Card.Content>
            {/* A fixed height, for the reason CastCard gives. */}
            <Typography
              variant="labelLargeEmphasized"
              numberOfLines={2}
              style={{ height: theme.typography.labelLargeEmphasized.lineHeight * 2 }}
            >
              {video.name}
            </Typography>
            <Typography
              variant="labelSmall"
              color={theme.colors.onSurfaceVariant}
              numberOfLines={1}
            >
              {video.type}
            </Typography>
          </Card.Content>
        </Card>
      </Motion.View>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // See CastRow for why the list padding is the gap under the heading.
  row: { marginBottom: 24 - LIFT_SPACE },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  list: { paddingHorizontal: 16, paddingVertical: LIFT_SPACE },
  separator: { width: 12 },
  // The width of a still, so the two media rows draw cards of one size.
  slot: { width: STILL_WIDTH },
  card: { width: STILL_WIDTH },
  frame: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
