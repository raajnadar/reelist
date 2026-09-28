import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import { useBreakpoint, useWindowDimensions } from '@rootnative/core'
import {
  Motion,
  Presence,
  useAnimator,
  useInterpolatedStyle,
  useMotionValue,
  useScroll,
  type SharedValue,
  type TransitionConfig,
} from '@rootnative/inertia'
import { useAnimatedStyle } from '@rootnative/inertia/reanimated'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type ViewToken,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { backdropUrl } from '../lib/images'
import { ON_STAGE, STAGE } from '../lib/stage'
import type { GalleryImage } from '../lib/types'
import { RemoteImage } from './RemoteImage'

/** The height of the control row over the pictures. */
const BAR_HEIGHT = 56

/**
 * How far a still has to be dragged down, or up, before letting go closes the
 * viewer. Short of it the still springs back. A flick counts as well, at the
 * velocity below in points per second, so a quick short pull also closes.
 */
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 900

/**
 * How far a finger travels before the stage claims the touch from whatever is
 * under it.
 *
 * Below this a touch is still a tap, which the page under the finger answers.
 * A vertical move past it is a pull, and the stage takes over; a horizontal
 * one stays with the pager, which is scrolling by then.
 */
const DRAG_CLAIM = 10

/** How much a double tap enlarges the still. */
const ZOOM = 2.4

/** The longest gap between two taps that still counts as a double tap. */
const DOUBLE_TAP_MS = 280

/** The filmstrip thumbnail. The same 16:9 as the still, at a size for a thumb. */
const THUMB_WIDTH = 56
const THUMB_HEIGHT = 32
const THUMB_GAP = 6

/**
 * A write with no animation, for the shared values the finger drives.
 *
 * The values come from a hook, and the React Compiler rules forbid assigning
 * to them directly. `useAnimator` is the sanctioned setter, and with this
 * config it sets the value in one step, which is what a move event needs.
 */
const INSTANT: TransitionConfig = { type: 'no-animation' }

/**
 * How far the pull has to travel before the chrome is fully gone. Shorter than
 * the dismiss distance, so the bar and the strip clear the picture while the
 * reader is still deciding.
 */
const CHROME_FADE = 80

/**
 * The still one page away, as the pager sees it: smaller and dimmer than the
 * one in front. The gap between the two is what gives the swipe its depth.
 */
const NEIGHBOUR_SCALE = 0.86
const NEIGHBOUR_OPACITY = 0.35

/**
 * How much slower the picture travels than its page, as a share of the page
 * width. The page clips it, so the lag reads as the still sliding under the
 * edge of the frame rather than as a card moving across the screen.
 */
const PARALLAX = 0.3

type Props = {
  images: GalleryImage[]
  /** The film, for the bar. */
  title: string
  initialIndex: number
  onClose: () => void
}

/**
 * The full-screen viewer: one still per page, swiped sideways.
 *
 * The movement is the point of the screen, and each part of it is a separate
 * mechanism:
 *
 * - The pager is a `Motion.FlatList`, so every page reads the scroll offset
 *   on the UI thread and scales, fades, and lags the still as it passes.
 * - A pull up or down drags the whole stage, shrinks it, and dims the
 *   backdrop. Let go past the threshold and it leaves the screen; short of it,
 *   it springs back. The gesture is a PanResponder rather than a drag hook,
 *   because it has to yield to the pager for a sideways swipe and to the page
 *   for a tap — a hook that claims every touch would take both.
 * - A double tap zooms the still about the point that was tapped, and the same
 *   responder then pans it inside its bounds. The pager is locked meanwhile,
 *   or a pan across a zoomed still would turn the page.
 * - The filmstrip and the counter follow the page, and the strip drives it
 *   back: a tap on a thumbnail scrolls the pager there.
 */
export function GalleryViewer({ images, title, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()

  // Arrow buttons at the sides for a pointer, which has no swipe. `compact` is
  // a phone, where the buttons would cover the still's edges.
  const roomy = useBreakpoint() !== 'compact'

  const count = images.length
  const [index, setIndex] = useState(() => clamp(initialIndex, 0, count - 1))
  const [chrome, setChrome] = useState(true)
  const [zoomed, setZoomed] = useState(false)

  const pager = useRef<FlatList<GalleryImage>>(null)
  const strip = useRef<FlatList<GalleryImage>>(null)

  // scrollX drives every page on the UI thread, so a fling shows the depth
  // effect without a re-render per frame.
  const { scrollX, onScroll } = useScroll()

  /** The pull, in points, and where the zoomed still has been panned to. */
  const dragY = useMotionValue(0)
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  const animate = useAnimator()

  // The room the pictures have between the two chrome rows. A still is sized
  // to fit it, so the zoom bounds below are measured against it as well.
  const stageHeight = height - insets.top - insets.bottom - 2 * BAR_HEIGHT

  /**
   * How far the zoomed still may pan before its edge would leave the page.
   *
   * The still is fitted inside the stage first, then enlarged about its centre.
   * Whatever that puts past the edge is the travel available on that axis, and
   * an axis with nothing past the edge does not move at all.
   */
  const bounds = useMemo(() => {
    const ratio = images[index]?.aspect_ratio ?? 16 / 9
    const fitted = Math.min(width, stageHeight * ratio)
    const fittedHeight = fitted / ratio
    return {
      x: Math.max(0, (fitted * ZOOM - width) / 2),
      y: Math.max(0, (fittedHeight * ZOOM - stageHeight) / 2),
    }
  }, [images, index, width, stageHeight])

  const goTo = useCallback(
    (target: number) => {
      const next = clamp(target, 0, count - 1)
      if (next === index) return
      pager.current?.scrollToIndex({ index: next, animated: true })
    },
    [count, index],
  )

  const close = useCallback(() => onClose(), [onClose])

  /**
   * Where the still was when the finger landed, so a move is added to it.
   *
   * Shared values rather than a ref, because the responder callbacks below are
   * built inside `useMemo`, and the React Compiler rules read a ref written
   * there as a ref written during render. A shared value is written the same
   * way the drag itself is.
   */
  const originX = useMotionValue(0)
  const originY = useMotionValue(0)

  /**
   * The pull and the pan, as one responder on the stage.
   *
   * It claims a touch only once the finger has moved, and only in the way it
   * wants: a mostly vertical move while the still is at rest, or any move while
   * it is zoomed. A tap never reaches the threshold, so the page's own press
   * still fires, and a sideways swipe at rest is left to the pager.
   */
  const responder = useMemo(() => {
    const claims = (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const dx = Math.abs(g.dx)
      const dy = Math.abs(g.dy)
      if (zoomed) return dx > DRAG_CLAIM || dy > DRAG_CLAIM
      return dy > DRAG_CLAIM && dy > dx * 1.2
    }

    const settle = (g: PanResponderGestureState) => {
      if (zoomed) {
        animate(panX, clamp(panX.value, -bounds.x, bounds.x), 'snap')
        animate(panY, clamp(panY.value, -bounds.y, bounds.y), 'snap')
        return
      }

      const y = dragY.value
      const flick = Math.abs(g.vy * 1000) > DISMISS_VELOCITY
      if (Math.abs(y) > DISMISS_DISTANCE || flick) {
        // The stage leaves the way it was pulled, and the route fades out
        // over it. Closing at once rather than after the slide keeps the
        // back stack in step with what the reader sees.
        animate(dragY, Math.sign(y || g.vy) * height, 'exit')
        close()
        return
      }
      animate(dragY, 0, 'snap')
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: claims,
      onPanResponderGrant: () => {
        animate(originX, panX.value, INSTANT)
        animate(originY, zoomed ? panY.value : dragY.value, INSTANT)
      },
      onPanResponderMove: (_e, g) => {
        const x = originX.value
        const y = originY.value
        if (zoomed) {
          // Past the bound the still moves at a quarter of the finger, which
          // is how it says there is nothing further to see there.
          animate(panX, rubberBand(x + g.dx, bounds.x), INSTANT)
          animate(panY, rubberBand(y + g.dy, bounds.y), INSTANT)
          return
        }
        animate(dragY, y + g.dy, INSTANT)
      },
      onPanResponderRelease: (_e, g) => settle(g),
      onPanResponderTerminate: (_e, g) => settle(g),
    })
  }, [zoomed, bounds, height, animate, dragY, panX, panY, originX, originY, close])

  /**
   * The zoom, on and off.
   *
   * Zooming in carries the tapped point with it: the still grows about its
   * centre, so the pan is set to whatever keeps that point under the finger,
   * held within the bounds. Zooming out returns the pan to rest on the same
   * spring, so the two movements read as one.
   */
  const toggleZoom = useCallback(
    (x: number, y: number) => {
      if (zoomed) {
        setZoomed(false)
        animate(panX, 0, 'zoom')
        animate(panY, 0, 'zoom')
        return
      }
      setZoomed(true)
      const toX = clamp(-(x - width / 2) * (ZOOM - 1), -bounds.x, bounds.x)
      const toY = clamp(-(y - stageHeight / 2) * (ZOOM - 1), -bounds.y, bounds.y)
      animate(panX, toX, 'zoom')
      animate(panY, toY, 'zoom')
    },
    [zoomed, width, stageHeight, bounds, animate, panX, panY],
  )

  const toggleChrome = useCallback(() => setChrome((on) => !on), [])

  /**
   * Which page is in front, from the list's own visibility tracking.
   *
   * This rather than a scroll-end event, because the web build fires none
   * that a snap can be trusted to end with. Both values are stable on purpose:
   * FlatList throws if either changes after mount.
   *
   * A page turn leaves the zoom behind, so the next still arrives at rest.
   * That is done here, at the event, rather than in an effect on `index`.
   */
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), [])
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]
      if (!first || first.index === null) return
      setIndex(first.index)
      setZoomed(false)
      animate(panX, 0, INSTANT)
      animate(panY, 0, INSTANT)
    },
    [animate, panX, panY],
  )

  // The strip keeps the current thumbnail in the middle.
  useEffect(() => {
    if (count < 2) return
    strip.current?.scrollToOffset({ offset: stripOffset(index), animated: true })
  }, [index, count])

  /**
   * The first centring of the strip, once it has content to scroll.
   *
   * The effect above runs at mount too, but on web that is before the list
   * has laid out, and a scroll on an empty list is dropped. The list then does
   * its own `initialScrollIndex` scroll when the content lays out, and that
   * one puts the thumbnail at the left edge, not in the middle. It calls this
   * right after, in the same tick, so the centred position is the one drawn.
   */
  const stripCentred = useRef(false)
  const centreStripOnce = useCallback(() => {
    if (stripCentred.current || count < 2) return
    stripCentred.current = true
    strip.current?.scrollToOffset({ offset: stripOffset(index), animated: false })
  }, [index, count])

  // A resize — a phone turned sideways, a browser window dragged — changes
  // the page width, and the pager would otherwise land between two pages.
  useEffect(() => {
    pager.current?.scrollToIndex({ index, animated: false })
    // Only the width may re-run this. Following `index` as well would scroll
    // to the page the reader is already on, and fight the swipe that got there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width])

  // The arrow keys and Escape, on a keyboard. Native has no keyboard events to
  // listen for, and no `window` to listen on.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goTo(index + 1)
      else if (event.key === 'ArrowLeft') goTo(index - 1)
      else if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, index, close])

  /**
   * The stage follows the pull and shrinks as it goes. The range is the window
   * height, so the still is still on screen wherever the finger stops, and the
   * scale it reaches at the dismiss distance is a visible nudge rather than a
   * collapse.
   */
  const stageStyle = useInterpolatedStyle(
    dragY,
    { translateY: [-height, 0, height], scale: [0.6, 1, 0.6] },
    { inputRange: [-height, 0, height] },
  )

  // The backdrop clears as the still is pulled away, so the screen underneath
  // shows through and says where the still is going.
  const backdropStyle = useInterpolatedStyle(
    dragY,
    { opacity: [0.2, 1, 0.2] },
    { inputRange: [-height * 0.4, 0, height * 0.4] },
  )

  // The chrome is gone by the time the pull is a quarter of the way to the
  // dismiss point, and back the moment the still springs home.
  const chromeStyle = useInterpolatedStyle(
    dragY,
    { opacity: [0, 1, 0] },
    { inputRange: [-CHROME_FADE, 0, CHROME_FADE] },
  )

  const getItemLayout = useCallback(
    (_: ArrayLike<GalleryImage> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  )

  // Half the window each side, less half a thumb, so the first and the last
  // thumbnail can sit in the middle like the rest.
  const stripInset = (width - THUMB_WIDTH) / 2

  // The offset counts from the start of the content, and the inset is part of
  // it. Without the inset in the sum, `scrollToIndex` centres a point half a
  // window short of the thumbnail it was asked for.
  const getThumbLayout = useCallback(
    (_: ArrayLike<GalleryImage> | null | undefined, i: number) => ({
      length: THUMB_WIDTH + THUMB_GAP,
      offset: stripInset + (THUMB_WIDTH + THUMB_GAP) * i,
      index: i,
    }),
    [stripInset],
  )

  return (
    <View style={styles.screen} testID="gallery-viewer">
      <Motion.View style={[styles.backdrop, backdropStyle]} />

      {/*
        The stage: everything the pull moves. It arrives with a small zoom out
        of the fade the route plays, so the still opens onto the screen rather
        than appearing on it.

        Two layers, because the entrance and the pull both write `transform`
        and one element cannot take both: the outer plays the entrance once,
        the inner follows the finger.
      */}
      <Motion.View
        style={styles.fill}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition="enter"
      >
        <Motion.View style={[styles.fill, stageStyle]} {...responder.panHandlers}>
          <Motion.FlatList
            ref={pager}
            data={images}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!zoomed}
            onScroll={onScroll}
            initialScrollIndex={index}
            getItemLayout={getItemLayout}
            keyExtractor={(image) => image.file_path}
            viewabilityConfig={viewability}
            onViewableItemsChanged={onViewableItemsChanged}
            // Three pages in memory: the one in front and one each side, so a
            // swipe never lands on a still that has not started to load.
            windowSize={3}
            initialNumToRender={1}
            renderItem={({ item, index: i }) => (
              <Page
                image={item}
                index={i}
                count={count}
                width={width}
                stageHeight={stageHeight}
                scrollX={scrollX}
                // Only the page in front is ever zoomed, and only it pans.
                zoomed={zoomed && i === index}
                panX={panX}
                panY={panY}
                onTap={toggleChrome}
                onDoubleTap={toggleZoom}
              />
            )}
            // The pages sit between the two chrome rows rather than under them,
            // so a still fitted to the stage is never covered by the bar.
            style={{
              marginTop: insets.top + BAR_HEIGHT,
              marginBottom: insets.bottom + BAR_HEIGHT,
            }}
          />
        </Motion.View>
      </Motion.View>

      {/*
        The chrome, outside the stage: it stays put while the still is pulled,
        and fades instead. Two layers, one for each thing that hides it — the
        tap, which the inner `animate` answers, and the pull, which the outer
        interpolation answers — because one element cannot take both.
      */}
      <Motion.View style={[styles.chrome, chromeStyle]} pointerEvents="box-none">
        <Motion.View
          testID="gallery-chrome"
          style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          animate={{ opacity: chrome ? 1 : 0 }}
          transition="hover"
          pointerEvents={chrome ? 'box-none' : 'none'}
        >
          <View style={styles.bar}>
            {/*
              Each IconButton on this screen sits in a column frame that
              centres it. The button pins itself to the top of its parent with
              `alignSelf: 'flex-start'`, which wins over the row's
              `alignItems`. Same fix as the search and about screens; filed
              as R1 in the RootNative DX feedback.
            */}
            <View style={styles.buttonFrame}>
              <IconButton
                icon="close"
                variant="standard"
                iconColor={ON_STAGE}
                accessibilityLabel="Close the gallery"
                onPress={close}
              />
            </View>
            <Typography variant="titleMedium" numberOfLines={1} style={styles.title}>
              {title}
            </Typography>
            <Counter index={index} count={count} />
          </View>

          <View style={styles.middle} pointerEvents="box-none">
            {roomy ? (
              <>
                <View style={styles.arrowFrame} pointerEvents="box-none">
                  <IconButton
                    icon="chevron-left"
                    variant="tonal"
                    size="m"
                    accessibilityLabel="Previous still"
                    disabled={index === 0}
                    onPress={() => goTo(index - 1)}
                  />
                </View>
                <View style={styles.arrowFrame} pointerEvents="box-none">
                  <IconButton
                    icon="chevron-right"
                    variant="tonal"
                    size="m"
                    accessibilityLabel="Next still"
                    disabled={index === count - 1}
                    onPress={() => goTo(index + 1)}
                  />
                </View>
              </>
            ) : null}
          </View>

          {/*
            No side padding on this row: the strip's inset is worked out from
            the window width, and padding here would shift its centre.
          */}
          <View style={styles.stripBar}>
            {count > 1 ? (
              <FlatList
                ref={strip}
                data={images}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(image) => image.file_path}
                getItemLayout={getThumbLayout}
                initialScrollIndex={index}
                onContentSizeChange={centreStripOnce}
                contentContainerStyle={[
                  styles.stripContent,
                  { paddingHorizontal: stripInset },
                ]}
                renderItem={({ item, index: i }) => (
                  <Thumb image={item} index={i} active={i === index} onPress={goTo} />
                )}
              />
            ) : null}
          </View>
        </Motion.View>
      </Motion.View>
    </View>
  )
}

/**
 * One page of the pager.
 *
 * Three nested motion layers, each for a transform the others cannot share:
 * the page itself scales, fades, and lags with the scroll; the pan layer moves
 * the zoomed still; the zoom layer grows it. Reanimated composes one
 * `transform` array per element, so a layer per transform is the only way to
 * drive the three from three sources.
 */
function Page({
  image,
  index,
  count,
  width,
  stageHeight,
  scrollX,
  zoomed,
  panX,
  panY,
  onTap,
  onDoubleTap,
}: {
  image: GalleryImage
  index: number
  count: number
  width: number
  stageHeight: number
  scrollX: SharedValue<number>
  zoomed: boolean
  panX: SharedValue<number>
  panY: SharedValue<number>
  onTap: () => void
  onDoubleTap: (x: number, y: number) => void
}) {
  const depth = useInterpolatedStyle(
    scrollX,
    {
      scale: [NEIGHBOUR_SCALE, 1, NEIGHBOUR_SCALE],
      opacity: [NEIGHBOUR_OPACITY, 1, NEIGHBOUR_OPACITY],
      translateX: [-width * PARALLAX, 0, width * PARALLAX],
    },
    { inputRange: [(index - 1) * width, index * width, (index + 1) * width] },
  )

  const pan = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }],
  }))

  /**
   * One tap or two. A second tap inside the window cancels the first, so a
   * double tap zooms without first hiding the chrome. The one-tap action waits
   * the length of the window, which is the cost of telling the two apart.
   */
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(pending.current ?? undefined), [])

  const press = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent
    if (pending.current) {
      clearTimeout(pending.current)
      pending.current = null
      onDoubleTap(locationX, locationY)
      return
    }
    pending.current = setTimeout(() => {
      pending.current = null
      onTap()
    }, DOUBLE_TAP_MS)
  }

  // The largest frame of the still's shape that the stage holds.
  const fitted = Math.min(width, stageHeight * image.aspect_ratio)

  return (
    <Motion.View style={[styles.page, { width, height: stageHeight }, depth]}>
      <Pressable
        testID="gallery-page"
        accessibilityRole="image"
        accessibilityLabel={`Still ${index + 1} of ${count}`}
        accessibilityHint="Double tap to zoom"
        onPress={press}
        style={styles.fill}
      >
        <Motion.View style={[styles.centre, pan]}>
          <Motion.View
            animate={{ scale: zoomed ? ZOOM : 1 }}
            transition="zoom"
            style={{ width: fitted, aspectRatio: image.aspect_ratio }}
          >
            {/*
              `contain` is the default fit here through the frame's own shape:
              the box already has the still's ratio, so `cover` in RemoteImage
              crops nothing.
            */}
            <RemoteImage
              uri={backdropUrl(image.file_path, 'w1280') ?? ''}
              recyclingKey={image.file_path}
              priority="high"
              style={styles.fill}
            />
          </Motion.View>
        </Motion.View>
      </Pressable>
    </Motion.View>
  )
}

/**
 * The position, as "3 / 12", with each change sliding the old number out and
 * the new one in. The box is fixed, and both numbers are absolute inside it,
 * so a page turn never shifts the bar.
 */
function Counter({ index, count }: { index: number; count: number }) {
  return (
    <View
      style={styles.counter}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Still ${index + 1} of ${count}`}
    >
      <Presence>
        <Motion.View
          key={index}
          style={styles.counterSlot}
          initial={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -10 }}
          transition={{ opacity: 'exit', translateY: 'snap' }}
        >
          <Typography variant="labelLarge" color={ON_STAGE} style={styles.counterText}>
            {`${index + 1} / ${count}`}
          </Typography>
        </Motion.View>
      </Presence>
    </View>
  )
}

/** One thumbnail on the filmstrip: bright and a little larger when in front. */
function Thumb({
  image,
  index,
  active,
  onPress,
}: {
  image: GalleryImage
  index: number
  active: boolean
  onPress: (index: number) => void
}) {
  return (
    <Pressable
      testID="gallery-thumb"
      accessibilityRole="button"
      accessibilityLabel={`Go to still ${index + 1}`}
      accessibilityState={{ selected: active }}
      onPress={() => onPress(index)}
      style={styles.thumbSlot}
    >
      <Motion.View
        animate={{ scale: active ? 1.18 : 1, opacity: active ? 1 : 0.55 }}
        transition="snap"
        style={styles.thumb}
      >
        <RemoteImage
          uri={backdropUrl(image.file_path) ?? ''}
          recyclingKey={image.file_path}
          priority="low"
          style={styles.fill}
        />
      </Motion.View>
    </Pressable>
  )
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high)

/**
 * The scroll offset that puts thumbnail `index` in the middle of the strip.
 *
 * The inset at the start of the content is half the window less half a
 * thumb, and the middle of the window is half the window in, so the two
 * cancel and the offset does not depend on the width. That is why this is an
 * offset and not `scrollToIndex` with a view position: the list works the
 * latter out from its own measured length, which on web is not yet known when
 * the content first lays out, and the strip lands half a window short.
 */
const stripOffset = (index: number) => (THUMB_WIDTH + THUMB_GAP) * index + THUMB_GAP / 2

/**
 * `value` held inside `±limit`, with the overshoot let through at a quarter of
 * its length. The still follows the finger past its edge, but slowly, which is
 * the feel of a bound rather than a wall.
 */
const rubberBand = (value: number, limit: number) => {
  if (value > limit) return limit + (value - limit) * 0.25
  if (value < -limit) return -limit + (value + limit) * 0.25
  return value
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: STAGE },
  page: { overflow: 'hidden' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chrome: { ...StyleSheet.absoluteFill },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  // See the trailer screen for why the line height is dropped: it puts the
  // title on the same centreline as the close button.
  title: { flex: 1, flexBasis: 0, color: ON_STAGE, lineHeight: undefined },
  buttonFrame: { height: BAR_HEIGHT, justifyContent: 'center' },
  stripBar: { height: BAR_HEIGHT, justifyContent: 'center' },
  middle: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  // Stretched to the row's height, so the arrow centres on the still.
  arrowFrame: { justifyContent: 'center' },
  counter: { width: 72, height: BAR_HEIGHT, marginRight: 8 },
  counterSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  counterText: { lineHeight: undefined },
  stripContent: { alignItems: 'center' },
  thumbSlot: { width: THUMB_WIDTH + THUMB_GAP, alignItems: 'center' },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#222222',
  },
})
