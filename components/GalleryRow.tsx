import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import {
  Motion,
  useInView,
  useInterpolatedStyle,
  type SharedValue,
} from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { backdropUrl } from '../lib/images'
import { cascadeWindow, LIFT_SPACE } from '../lib/motion'
import type { GalleryImage } from '../lib/types'
import { RemoteImage } from './RemoteImage'

/**
 * The width of one still in the row.
 *
 * Wider than a poster card, because a still is landscape: at poster width a
 * 16:9 frame is 90 points tall, which is a strip rather than a picture. At this
 * width a phone shows one and a half, which is what tells the reader the row
 * scrolls.
 */
export const STILL_WIDTH = 224

/** Every backdrop TMDB accepts is 16:9, so the slot is drawn at that shape. */
const STILL_ASPECT = 16 / 9

type Props = {
  /** The film the stills belong to. The viewer route reads it back from the cache. */
  movieId: number
  images: GalleryImage[]
}

/**
 * The stills, as a horizontal row that opens the viewer.
 *
 * It mirrors CastRow and MovieRow rather than sharing code with them, for the
 * reason CastRow records: the three rows differ in their data type and their
 * card, which is all a shared version would take as parameters.
 */
export function GalleryRow({ movieId, images }: Props) {
  const theme = useTheme()
  const ref = useRef<View>(null)

  // The row owns the in-view trigger, for the reason MovieRow explains: a
  // card's nearest scroll container is the horizontal list, which cannot say
  // whether the row has been reached.
  const progress = useInView(ref, { amount: 0.1, transition: 'cascade' })

  // Absent, not empty. A film with no stills — an announced one — shows no
  // heading above nothing.
  if (!images.length) return null

  return (
    <View ref={ref} style={styles.row}>
      <View style={styles.head}>
        <Typography variant="titleMediumEmphasized">Gallery</Typography>
        <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
          {images.length === 1 ? '1 still' : `${images.length} stills`}
        </Typography>
      </View>

      <FlatList
        data={images}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(image) => image.file_path}
        renderItem={({ item, index }) => (
          <Still
            image={item}
            index={index}
            count={images.length}
            movieId={movieId}
            progress={progress}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

function Still({
  image,
  index,
  count,
  movieId,
  progress,
}: {
  image: GalleryImage
  index: number
  count: number
  movieId: number
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
    /*
      Two nested elements, the arrangement MovieCard spells out: the entrance
      and the gesture layer both write `transform`, so one element cannot hold
      both. The outer owns the entrance, the inner owns the pointer response.
    */
    <Motion.View style={[styles.slot, entrance]}>
      <Motion.View
        gesture={{
          hovered: { scale: 1.03, translateY: -4 },
          pressed: { scale: 0.97 },
        }}
        transition={{ pressed: 'press', hovered: 'hover' }}
      >
        {/*
          The still opens the viewer at its own position. The viewer is a
          route, so it gets the back gesture for free and keeps this screen
          underneath with its scroll position intact — the same reason the
          trailer is a route.
        */}
        <Pressable
          testID="gallery-still"
          accessibilityRole="imagebutton"
          accessibilityLabel={`Still ${index + 1} of ${count}`}
          onPress={() => router.push(`/gallery/${movieId}?at=${index}`)}
          style={[
            styles.frame,
            {
              borderRadius: theme.shape.cornerMedium,
              backgroundColor: theme.colors.surfaceVariant,
            },
          ]}
        >
          {/*
            `w780`, the size the masthead uses, so a still that is also the
            film's backdrop is decoded once. The viewer's filmstrip reuses the
            same URL for the same reason.
          */}
          <RemoteImage
            uri={backdropUrl(image.file_path) ?? ''}
            recyclingKey={image.file_path}
            style={styles.picture}
          />
        </Pressable>
      </Motion.View>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // The list pads itself by LIFT_SPACE, which is the gap under the heading —
  // see CastRow for why the space has to be real rather than pulled back.
  row: { marginBottom: 24 - LIFT_SPACE },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  list: { paddingHorizontal: 16, paddingVertical: LIFT_SPACE },
  separator: { width: 12 },
  slot: { width: STILL_WIDTH },
  // Clips the picture to the corner. The image itself carries no radius so
  // the corner and the press state stay on one element.
  frame: { width: STILL_WIDTH, aspectRatio: STILL_ASPECT, overflow: 'hidden' },
  picture: { width: '100%', height: '100%' },
})
