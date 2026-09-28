import { Typography } from '@rootnative/components/typography'
import { useWindowDimensions } from '@rootnative/core'
import { Motion, useScroll } from '@rootnative/inertia'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { LIFT_SPACE } from '../lib/motion'
import type { Movie } from '../lib/types'
import {
  CarouselCard,
  CAROUSEL_MAX_CARD_WIDTH,
  CAROUSEL_PEEK,
  CAROUSEL_SPACING,
} from './CarouselCard'

const keyExtractor = (movie: Movie) => String(movie.id)

/**
 * The carousel geometry for a given screen width.
 *
 * This is exported so a test can assert the invariant below against the code
 * that actually ships. Inline arithmetic here would leave the test recomputing
 * the same formula, where it would agree with itself and prove nothing.
 */
export function carouselGeometry(width: number) {
  // Size the card from the screen, not from a constant: the leftover inset is
  // then exactly the peek strip plus one gap. Widening the card is what creates
  // the peek. The ceiling stops the card growing on a tablet rather than
  // becoming one absurdly wide poster.
  const cardWidth = Math.min(
    CAROUSEL_MAX_CARD_WIDTH,
    width - 2 * (CAROUSEL_PEEK + CAROUSEL_SPACING),
  )

  // Side padding centers the first and last slot. Without this, slot 0 sits at
  // the left edge and can never reach the center stop of its input range.
  //
  // On a wide screen the card stops at the ceiling, so this inset grows without
  // limit and leaves the centered card alone in blank space. The cap keeps the
  // neighbouring card visible at each edge instead. Once capped the row scrolls
  // off-center, so the scale peak must move with it: the parent shifts the
  // interpolation by whole slots.
  const centerPadding = (width - cardWidth) / 2
  const sidePadding = Math.min(centerPadding, CAROUSEL_PEEK + CAROUSEL_SPACING)
  const snap = cardWidth + CAROUSEL_SPACING

  return {
    cardWidth,
    sidePadding,
    snap,
    // How far the capped inset moved slot 0 away from the viewport center,
    // rounded to whole slots. Each card subtracts this from its input range so
    // full scale lands on the card nearest the center of the screen.
    //
    // Whole slots, because the list snaps by whole slots. A peak at the exact
    // viewport center is a position no scroll stop reaches once the inset is
    // capped: on a 1440 window it fell between two stops, and every card sat
    // at rest scaled down and faded. The stop nearest the center is at most
    // half a slot from it.
    centerOffset: Math.round((centerPadding - sidePadding) / snap) * snap,
  }
}

export function MovieCarousel({ title, movies }: { title: string; movies: Movie[] }) {
  const { width } = useWindowDimensions()

  // scrollX updates on the UI thread, so every card interpolates without a
  // React re-render.
  const { scrollX, onScroll } = useScroll()

  const { cardWidth, sidePadding, snap, centerOffset } = carouselGeometry(width)

  const renderItem = useCallback(
    ({ item, index }: { item: Movie; index: number }) => (
      <CarouselCard
        movie={item}
        index={index}
        scrollX={scrollX}
        width={cardWidth}
        snap={snap}
        centerOffset={centerOffset}
      />
    ),
    [scrollX, cardWidth, snap, centerOffset],
  )

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
  if (!movies.length) return null

  return (
    <View style={styles.wrapper}>
      <Typography variant="titleMediumEmphasized" style={styles.heading}>
        {title}
      </Typography>

      <Motion.FlatList
        data={movies}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        onScroll={onScroll}
        showsHorizontalScrollIndicator={false}
        // Snap to the slot pitch so a card always lands centered.
        snapToInterval={snap}
        decelerationRate="fast"
        disableIntervalMomentum
        // Every slot is one fixed pitch wide, so the list can place a card
        // without measuring it. This is what keeps the scale peaks aligned
        // while cards mount and unmount during a fling.
        getItemLayout={getItemLayout}
        contentContainerStyle={{
          paddingHorizontal: sidePadding,
          // The trailing marginRight on the last slot doubles the end padding.
          paddingRight: sidePadding - CAROUSEL_SPACING,
          paddingVertical: LIFT_SPACE,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  /*
    No `gap`: the list pads itself by LIFT_SPACE, and that padding is both the
    space under the heading and the room the centered card grows into when the
    pointer is over it. The margin carries the rest of the 28 under the row.
  */
  wrapper: { marginBottom: 28 - LIFT_SPACE },
  heading: { paddingHorizontal: 16 },
})
