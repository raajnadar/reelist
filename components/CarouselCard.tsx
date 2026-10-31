import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import {
  Motion,
  useGesture,
  useInterpolatedStyle,
  useShadow,
  useTransform,
  type SharedValue,
} from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { Link } from 'expo-router'
import { memo } from 'react'
import { Platform, Pressable, StyleSheet, View, type DimensionValue } from 'react-native'
import { metaLine } from '../lib/format'
import { RemoteImage } from './RemoteImage'
import { POSTER_W500, posterUrl } from '../lib/images'
import type { Movie } from '../lib/types'
import type { KeyDownEvent } from '../lib/useWebKey'

/**
 * Ceiling on the centered card's width. The carousel sizes the card from the
 * screen so the leftover inset is just the peek strip; this stops that growth
 * on a tablet, where a full-width poster would dwarf the rows below it.
 */
export const CAROUSEL_MAX_CARD_WIDTH = 320
/**
 * Floor on the card's width, for a short window such as a phone held
 * sideways. The height share below would otherwise shrink the poster to a
 * thumbnail there.
 */
export const CAROUSEL_MIN_CARD_WIDTH = 180
/**
 * The largest share of the window height the poster can take. The caption and
 * the dots sit under the poster, and the next row's heading must still show on
 * the first screen, so the reader can see that the page scrolls.
 */
export const CAROUSEL_POSTER_SHARE = 0.45
/** Gap between card slots. Slot pitch = width + spacing. */
export const CAROUSEL_SPACING = 16
/**
 * Minimum of the neighbouring card left visible at each edge on a narrow
 * screen. The card is sized so that at least this much of the next card shows.
 */
export const CAROUSEL_PEEK = 48
/**
 * The scale of a card one slot from the center.
 *
 * The card only scales: it does not turn on its Y axis. A 3D turn made the
 * web draw the card at a lower resolution, and the centred poster went soft
 * as soon as a swipe moved it. A 2D scale keeps it as sharp as at rest.
 */
const SIDE_SCALE = 0.88
/**
 * The share of a slot, on each side of the center, where the card and its
 * poster keep their resting transform exactly.
 *
 * A transform that is not exact makes the screen resample the poster, and
 * that softens it. Without this zone, a finger that rested on the card moved
 * it a few points and the poster went soft under the reader's eyes. The scale
 * and the parallax start past the zone, where the card is clearly moving.
 */
const REST_ZONE = 0.12
/**
 * How dark a card one slot from the center is, as the opacity of a black
 * layer over its poster. A dark layer, not a lower card opacity: a see-through
 * card shows the blurred backdrop through the poster and looks disabled.
 */
const SIDE_SHADE = 0.45
/**
 * The zoom of the poster inside a card one slot from the center. The zoom is
 * also the room the poster has to move in: a picture at 1.12 is 6% wider than
 * the frame on each side.
 */
const SIDE_ZOOM = 1.12
/**
 * The share of that room the poster uses. Less than all of it, so a rounded
 * pixel at the end of the move cannot show the frame behind the picture.
 */
const DRIFT_SHARE = 0.9

const REST_SHADOW = { boxShadow: '0px 0px 0px rgba(0, 0, 0, 0)' }
const LIFT_SHADOW = { boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.35)' }

/**
 * The room the lift shadow needs under the card: its offset plus its blur.
 * The list clips its content on the vertical axis, so the list pads its bottom
 * by this much, or the shadow ends in a hard line.
 */
export const CAROUSEL_SHADOW_ROOM = 40

/**
 * A long press is the reader holding the card to read it. It must not open
 * the film when they let go, and a Pressable skips `onPress` after a press
 * that reached `onLongPress`.
 */
const keepOpen = () => {}

/** The focus ring of the library's `Card`: its width, and its gap to the edge. */
const RING_WIDTH = 3
const RING_OFFSET = 2
const RING_OUTSET = RING_OFFSET + RING_WIDTH

const ARROW_STEPS: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowRight: 1 }

/** The element of a card. On the web it is the anchor. */
export type CardElement = { focus: (options?: FocusOptions) => void }

type Props = {
  movie: Movie
  /** The slot in the loop, not the film: each film has a slot in every copy. */
  index: number
  scrollX: SharedValue<number>
  /** Slot width for this screen. Narrower than the constant on small screens. */
  width: number
  /** Slot pitch, i.e. width + spacing. Must match the ScrollView's snap. */
  snap: number
  /** Told true while a finger or a pointer is down on the card, then false. */
  onHold?: (holding: boolean) => void
  /** True for the centred card. On the web it is the only card in the tab order. */
  current?: boolean
  /** Told -1 or 1 when the reader presses the left or right arrow key on the card. */
  onArrowKey?: (direction: -1 | 1) => void
  /** Told the element of the card when it mounts, and null when it unmounts. */
  onElement?: (index: number, element: CardElement | null) => void
}

/*
  Memo, because the list renders each card again when the centred card
  changes. Only the two cards whose `current` changed then do the work.
*/
export const CarouselCard = memo(function CarouselCard({
  movie,
  index,
  scrollX,
  width,
  snap,
  onHold,
  current = false,
  onArrowKey,
  onElement,
}: Props) {
  const theme = useTheme()
  const uri = posterUrl(movie.poster_path, 'w500')

  // Three stops: previous slot, this slot centered, next slot. The card reaches
  // its resting look only when its own slot sits under the viewport center.
  // The pitch comes from the parent so the peak always lands on the snap
  // point.
  const center = index * snap
  const inputRange = [center - snap, center, center + snap]
  // The transforms hold their resting value through the rest zone. The shade
  // and the shadow resample nothing, so they keep the plain three stops.
  const zone = snap * REST_ZONE
  const transformRange = [center - snap, center - zone, center + zone, center + snap]

  const scaleStyle = useInterpolatedStyle(
    scrollX,
    { scale: [SIDE_SCALE, 1, 1, SIDE_SCALE] },
    { inputRange: transformRange },
  )

  const focus = useTransform(scrollX, inputRange, [0, 1, 0])
  const liftStyle = useShadow({ from: REST_SHADOW, to: LIFT_SHADOW, progress: focus })

  const shadeStyle = useInterpolatedStyle(
    scrollX,
    { opacity: [SIDE_SHADE, 0, SIDE_SHADE] },
    { inputRange },
  )

  // The poster moves against the card, so it lags behind the frame as if it
  // sat further away. translateX comes before scale in the map, so the move is
  // in frame points and the zoom stays centred. The centred card shows the
  // whole poster at 1, with no crop.
  const drift = (width * (SIDE_ZOOM - 1) * DRIFT_SHARE) / 2
  const parallaxStyle = useInterpolatedStyle(
    scrollX,
    {
      translateX: [-drift, 0, 0, drift],
      scale: [SIDE_ZOOM, 1, 1, SIDE_ZOOM],
    },
    { inputRange: transformRange },
  )

  // The card is not a library `Card`, so it draws the ring of one itself.
  const { focusVisible, handlers: focusHandlers } = useGesture({ focusVisible: 'hover' })
  const ringStyle = useInterpolatedStyle(focusVisible, { opacity: [0, 1] })

  const onKeyDown = (event: KeyDownEvent) => {
    const { key = '', repeat, altKey, ctrlKey, metaKey } = event.nativeEvent
    const direction = ARROW_STEPS[key]
    // A held key counts once. With a modifier the key is a browser shortcut,
    // such as Alt and the left arrow for back.
    if (!direction || repeat || altKey || ctrlKey || metaKey) return
    // Without this the browser scrolls the list as well.
    event.preventDefault?.()
    onArrowKey?.(direction)
  }
  // Native has no key events, and its keyboard focus is left as it was.
  const keyProps =
    Platform.OS === 'web' ? ({ tabIndex: current ? 0 : -1, onKeyDown } as const) : {}

  return (
    <View style={[styles.slot, { width }]}>
      <Motion.View style={scaleStyle}>
        {/*
          The press scale lives on its own Motion.Pressable INSIDE the
          scroll-driven wrapper, rather than on the wrapper itself. Both effects
          write `transform`, so sharing one element would mean the gesture layer
          and the scroll interpolation overwrite each other's scale every frame.
          Nesting composes them: the outer element owns the scroll position, the
          inner one owns the touch response.

          A link, so the web renders an anchor a crawler can follow. The Link
          sets the role. The style is one object rather than an array, because
          the link's slot refuses an array on its child.
        */}
        <Link href={`/movie/${movie.id}`} asChild>
          <Motion.Pressable
            ref={(element: CardElement | null) => onElement?.(index, element)}
            accessibilityLabel={`${movie.title}. ${metaLine(movie.vote_average, movie.release_date)}`}
            gesture={{
              hovered: { scale: 1.03 },
              pressed: { scale: 0.97 },
            }}
            transition={{ pressed: 'press', hovered: 'hover' }}
            onPressIn={() => onHold?.(true)}
            onPressOut={() => onHold?.(false)}
            onLongPress={keepOpen}
            onFocus={focusHandlers.onFocus}
            onBlur={focusHandlers.onBlur}
            {...keyProps}
            style={styles.press}
          >
            {/*
              The shadow is a layer of its own inside the pressable, so it
              shrinks with the card under a finger. On the wrapper outside, it
              stayed full size and showed as a ring around the pressed card. It
              is not on the card itself: the card clips its corners with
              `overflow: hidden`, and on iOS that clips the shadow with them.
            */}
            <Animated.View style={[styles.lift, liftStyle]} />
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surfaceContainerHigh },
              ]}
            >
              {uri ? (
                <Animated.View style={[StyleSheet.absoluteFill, parallaxStyle]}>
                  <RemoteImage
                    testID="carousel-poster"
                    uri={uri}
                    alt={movie.title}
                    // The carousel is a FlatList too, so it recycles the same
                    // way a row does. See RemoteImage.
                    recyclingKey={String(movie.id)}
                    // The featured row is the first thing on the home screen,
                    // so its posters are the ones worth downloading first.
                    priority="high"
                    size={POSTER_W500}
                    style={styles.picture}
                  />
                </Animated.View>
              ) : (
                <NoPoster />
              )}
              <Animated.View style={[styles.shade, shadeStyle]} />
            </View>
            <Animated.View
              style={[styles.ring, { borderColor: theme.colors.secondary }, ringStyle]}
            />
          </Motion.Pressable>
        </Link>
      </Motion.View>
    </View>
  )
})

/**
 * The centred card as the static web page draws it, until hydration ends.
 *
 * The export server has no window, so the carousel has no slot width, and
 * HTML holds no scroll position, so the list cannot centre a card there.
 * `width` is CSS that the browser resolves to the width `carouselGeometry`
 * gives the centred card. The list that replaces this card then draws the
 * same poster in the same place.
 */
export function CarouselStill({ movie, width }: { movie: Movie; width: DimensionValue }) {
  const theme = useTheme()
  const uri = posterUrl(movie.poster_path, 'w500')

  return (
    <View style={{ width }}>
      <Link href={`/movie/${movie.id}`} asChild>
        <Pressable
          accessibilityLabel={`${movie.title}. ${metaLine(movie.vote_average, movie.release_date)}`}
          style={styles.press}
        >
          <View style={[styles.lift, LIFT_SHADOW]} />
          <View
            style={[styles.card, { backgroundColor: theme.colors.surfaceContainerHigh }]}
          >
            {uri ? (
              <RemoteImage
                testID="carousel-poster"
                uri={uri}
                alt={movie.title}
                recyclingKey={String(movie.id)}
                priority="high"
                size={POSTER_W500}
                style={styles.picture}
              />
            ) : (
              <NoPoster />
            )}
          </View>
        </Pressable>
      </Link>
    </View>
  )
}

function NoPoster() {
  const theme = useTheme()

  return (
    <View style={[styles.fallback, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
        No poster
      </Typography>
    </View>
  )
}

const fill = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } as const

const styles = StyleSheet.create({
  slot: { marginRight: CAROUSEL_SPACING },
  // On the web the browser draws a ring of its own as an outline, beside the
  // drawn ring. The width alone does not remove it: Chrome draws it with
  // `outline-style: auto`, which ignores the width.
  press: { borderRadius: 20, outlineStyle: 'solid', outlineWidth: 0 },
  // The radius matches the card's, so the shadow follows the rounded corners.
  lift: { ...fill, borderRadius: 20, pointerEvents: 'none' },
  card: { width: '100%', aspectRatio: 2 / 3, borderRadius: 20, overflow: 'hidden' },
  // Both sides set: on the web the picture is an `<img>`, and an absolute
  // `<img>` with an `auto` size keeps the size of the file. See RemoteImage.
  picture: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shade: { ...fill, backgroundColor: '#000', pointerEvents: 'none' },
  // Outside the card, so the card's clip does not cut it. The corner grows by
  // the same distance as the edge, so the ring stays even all the way round.
  ring: {
    position: 'absolute',
    top: -RING_OUTSET,
    bottom: -RING_OUTSET,
    left: -RING_OUTSET,
    right: -RING_OUTSET,
    borderWidth: RING_WIDTH,
    borderRadius: 20 + RING_OUTSET,
    pointerEvents: 'none',
  },
})
