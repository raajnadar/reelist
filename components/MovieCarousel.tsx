import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import { useWindowDimensions } from '@rootnative/core'
import { Motion, useScroll } from '@rootnative/inertia'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type FlatList,
} from 'react-native'
import { LIFT_SPACE } from '../lib/motion'
import type { Movie } from '../lib/types'
import { useActiveSlot } from '../lib/useActiveSlot'
import { useAutoplay } from '../lib/useAutoplay'
import { CarouselBackdrop } from './CarouselBackdrop'
import { CarouselCaption } from './CarouselCaption'
import {
  CarouselCard,
  CAROUSEL_MAX_CARD_WIDTH,
  CAROUSEL_MIN_CARD_WIDTH,
  CAROUSEL_PEEK,
  CAROUSEL_POSTER_SHARE,
  CAROUSEL_SHADOW_ROOM,
  CAROUSEL_SPACING,
  CarouselStill,
} from './CarouselCard'
import { CarouselDots } from './CarouselDots'

/**
 * The narrowest web window that shows the previous and next buttons. A mouse
 * cannot swipe, and below this the window is a phone, where a finger can.
 */
const ARROWS_MIN_WIDTH = 768

/**
 * How many times the list repeats to make the loop.
 *
 * The reader starts in the middle copy, so an end is fifty copies of swipes
 * away in either direction. A short loop that jumps back to the middle needs
 * to know when a scroll comes to rest, and the web reports no such event.
 * Only the slots near the center are mounted, so the copies cost an array.
 */
const LOOP_COPIES = 101

/** Cards mounted around the center, in screen widths. The list default is 21. */
const WINDOW_SIZE = 5

const keyExtractor = (_movie: Movie, index: number) => String(index)

/**
 * The carousel geometry for a given window.
 *
 * This is exported so a test can assert the invariants below against the code
 * that actually ships. Inline arithmetic here would leave the test recomputing
 * the same formula, where it would agree with itself and prove nothing.
 */
export function carouselGeometry(width: number, height: number) {
  // Size the card from the screen, not from a constant. The width bound leaves
  // at least the peek strip plus one gap at each edge. The height bound keeps
  // the caption and the next row on the first screen. The ceiling stops the
  // card growing on a tablet rather than becoming one absurdly wide poster.
  const cardWidth = Math.floor(
    Math.min(
      width - 2 * (CAROUSEL_PEEK + CAROUSEL_SPACING),
      Math.max(
        CAROUSEL_MIN_CARD_WIDTH,
        Math.min(CAROUSEL_MAX_CARD_WIDTH, (height * CAROUSEL_POSTER_SHARE * 2) / 3),
      ),
    ),
  )

  return {
    cardWidth,
    snap: cardWidth + CAROUSEL_SPACING,
    // The inset that puts slot 0 under the viewport center, so slot `n` is
    // centred at scroll `n * snap`. The reader starts in the middle of the
    // loop, so on a wide window the cards of the copy before fill the left.
    centerPadding: (width - cardWidth) / 2,
  }
}

/**
 * The `cardWidth` of `carouselGeometry` as CSS, for the still card of the
 * static web page. The server has no window to measure, but the browser has.
 * `dvh` because react-native-web measures the visual viewport.
 */
export const STILL_CARD_WIDTH =
  `min(calc(100vw - ${2 * (CAROUSEL_PEEK + CAROUSEL_SPACING)}px), max(${CAROUSEL_MIN_CARD_WIDTH}px, min(${CAROUSEL_MAX_CARD_WIDTH}px, calc(100dvh * ${CAROUSEL_POSTER_SHARE} * 2 / 3))))` as DimensionValue

/**
 * The slots of the loop for `count` films, and the slot the reader starts on:
 * the first film of the middle copy. One film has nothing to loop through.
 */
export function loopLayout(count: number) {
  const copies = count > 1 ? LOOP_COPIES : 1
  return { total: count * copies, start: count * Math.floor(copies / 2) }
}

export function MovieCarousel({ title, movies }: { title: string; movies: Movie[] }) {
  const { width, height } = useWindowDimensions()
  const listRef = useRef<FlatList<Movie>>(null)

  // scrollX updates on the UI thread, so every card and every layer
  // interpolates without a React re-render.
  const { scrollX, onScroll } = useScroll()

  const { cardWidth, snap, centerPadding } = carouselGeometry(width, height)
  const count = movies.length
  const { total, start } = loopLayout(count)
  const active = useActiveSlot(scrollX, snap, total, start)

  const slots = useMemo(
    () => Array.from({ length: total }, (_, index) => movies[index % count]),
    [movies, total, count],
  )

  // Where the last step is going. `active` changes only halfway there, so a
  // second press before that counts from here, and two quick presses move two
  // films. A drag clears it: the reader then decides where the list goes.
  const target = useRef<number | null>(null)
  useEffect(() => {
    if (target.current === active) target.current = null
  }, [active])

  const step = (direction: -1 | 1) => {
    const list = listRef.current
    if (!list || count < 2) return
    let from = target.current ?? active
    // Fifty copies out, the reader is at an end. The same film in the middle
    // copy has the same cards on both sides, so the jump there cannot be seen.
    if (from + direction < count || from + direction >= total - count) {
      from = start + (from % count)
      list.scrollToOffset({ offset: from * snap, animated: false })
    }
    target.current = from + direction
    list.scrollToOffset({ offset: target.current * snap, animated: true })
  }

  const autoplay = useAutoplay(count > 1, active, () => step(1))
  const onScrollBeginDrag = () => {
    target.current = null
    autoplay.dragHandlers.onScrollBeginDrag()
  }

  /*
    The list scrolls to `initialScrollIndex` once, when it mounts. On a static
    web page the first render has a window 0 wide, so that scroll uses a pitch
    that is not real and lands nowhere. This puts the centred film back under
    the center each time the pitch changes: when the real size arrives, and
    when the window is resized. A layout effect, so the wrong place is never
    painted.

    It sets `scrollX` too, on the first mount as well. The list reports its
    new offset one frame or more after it moves, and until then the caption,
    the backdrop and the dots read the old offset and show no film.
  */
  const film = count ? active % count : 0
  const filmRef = useRef(film)
  useEffect(() => {
    filmRef.current = film
  })
  const placed = useRef<string | null>(null)
  useLayoutEffect(() => {
    const key = `${snap}:${start}`
    if (key === placed.current) return
    const mounting = placed.current === null
    placed.current = key
    if (snap <= 0) return
    const offset = (start + filmRef.current) * snap
    scrollX.set(offset)
    // On the first mount `initialScrollIndex` moves the list.
    if (!mounting) listRef.current?.scrollToOffset({ offset, animated: false })
  }, [snap, start, scrollX])

  const { onCardHold } = autoplay
  const renderItem = useCallback(
    ({ item, index }: { item: Movie; index: number }) => (
      <CarouselCard
        movie={item}
        index={index}
        scrollX={scrollX}
        width={cardWidth}
        snap={snap}
        onHold={onCardHold}
      />
    ),
    [scrollX, cardWidth, snap, onCardHold],
  )

  // The offset leaves out the list's padding on purpose. The list's own
  // scroll to an index puts the slot at this offset, and for slot `n` that is
  // `n * snap`, the scroll that centres it.
  const getItemLayout = useCallback(
    (_: ArrayLike<Movie> | null | undefined, index: number) => ({
      length: snap,
      offset: snap * index,
      index,
    }),
    [snap],
  )

  // Below the hooks: an early return above them would change hook order
  // between an empty and a populated row.
  if (!count) return null

  const arrows = Platform.OS === 'web' && width >= ARROWS_MIN_WIDTH && count > 1

  return (
    <View style={styles.wrapper} {...autoplay.holdHandlers}>
      <CarouselBackdrop
        movies={movies}
        scrollX={scrollX}
        snap={snap}
        active={active}
        total={total}
      />

      <Typography variant="titleMediumEmphasized" style={styles.heading}>
        {title}
      </Typography>

      <View style={styles.stage}>
        {/* No pitch is the static web page before hydration. See CarouselStill. */}
        {snap > 0 ? (
          <Motion.FlatList
            ref={listRef}
            data={slots}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={autoplay.dragHandlers.onScrollEndDrag}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={start}
            windowSize={WINDOW_SIZE}
            // Snap to the slot pitch so a card always lands centered.
            snapToInterval={snap}
            decelerationRate="fast"
            disableIntervalMomentum
            // Every slot is one fixed pitch wide, so the list can place a card
            // without measuring it. This is what keeps the peaks aligned while
            // cards mount and unmount during a fling.
            getItemLayout={getItemLayout}
            contentContainerStyle={{
              paddingLeft: centerPadding,
              // The trailing marginRight on the last slot completes the inset.
              paddingRight: centerPadding - CAROUSEL_SPACING,
              paddingTop: LIFT_SPACE,
              paddingBottom: CAROUSEL_SHADOW_ROOM,
            }}
          />
        ) : (
          <View style={styles.still}>
            <CarouselStill movie={movies[0]} width={STILL_CARD_WIDTH} />
          </View>
        )}
        {arrows ? (
          <View style={styles.arrows}>
            <IconButton
              icon="chevron-left"
              variant="tonal"
              size="medium"
              accessibilityLabel="Previous film"
              onPress={() => step(-1)}
            />
            <IconButton
              icon="chevron-right"
              variant="tonal"
              size="medium"
              accessibilityLabel="Next film"
              onPress={() => step(1)}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <CarouselCaption
          movies={movies}
          scrollX={scrollX}
          snap={snap}
          active={active}
          total={total}
        />
        {count > 1 ? (
          <View style={styles.controls}>
            <View>
              <CarouselDots
                count={count}
                scrollX={scrollX}
                snap={snap}
                active={active}
                progress={autoplay.enabled ? autoplay.progress : null}
              />
              {autoplay.enabled ? (
                <IconButton
                  icon={autoplay.paused ? 'play' : 'pause'}
                  variant="standard"
                  size="extraSmall"
                  accessibilityLabel={
                    autoplay.paused ? 'Play the carousel' : 'Pause the carousel'
                  }
                  onPress={autoplay.togglePaused}
                  style={styles.pause}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

/** The height of an `extraSmall` icon button. */
const PAUSE_SIZE = 32

const styles = StyleSheet.create({
  /*
    No `gap` above the list: the list pads itself by LIFT_SPACE, and that
    padding is both the space under the heading and the room the centered card
    grows into when the pointer is over it.
  */
  wrapper: { paddingTop: 8, paddingBottom: 24 },
  heading: { paddingHorizontal: 16 },
  // The caption moves up into the shadow room. It draws after the list, so the
  // shadow passes under it, and the room is only clear of the list's clip.
  stage: { marginBottom: LIFT_SPACE - CAROUSEL_SHADOW_ROOM },
  // The same vertical padding as the list, so the caption does not move when
  // the list replaces the still card.
  still: {
    alignItems: 'center',
    paddingTop: LIFT_SPACE,
    paddingBottom: CAROUSEL_SHADOW_ROOM,
  },
  footer: { gap: 12 },
  // As tall as the pause button, so the row does not change height when the
  // button is absent.
  controls: { height: PAUSE_SIZE, alignItems: 'center', justifyContent: 'center' },
  // Beside the dots rather than in the row with them, so the dots stay centred
  // under the caption.
  pause: {
    position: 'absolute',
    left: '100%',
    top: '50%',
    marginLeft: 8,
    marginTop: -PAUSE_SIZE / 2,
  },
  // Over the list, inside its vertical padding, so the buttons centre on the
  // poster. `box-none` lets a swipe between the buttons reach the list.
  arrows: {
    position: 'absolute',
    top: LIFT_SPACE,
    bottom: CAROUSEL_SHADOW_ROOM,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
})
