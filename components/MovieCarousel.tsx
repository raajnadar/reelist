import { Typography } from '@rootnative/components/typography'
import { Motion, useScroll } from '@rootnative/inertia'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import type { Movie } from '../lib/types'
import {
  CarouselCard,
  CAROUSEL_MAX_CARD_WIDTH,
  CAROUSEL_PEEK,
  CAROUSEL_SPACING,
} from './CarouselCard'

export function MovieCarousel({ title, movies }: { title: string; movies: Movie[] }) {
  const { width } = useWindowDimensions()

  // scrollX updates on the UI thread, so every card interpolates without a
  // React re-render.
  const { scrollX, onScroll } = useScroll()

  if (!movies.length) return null

  // Size the card from the screen, not from a constant: the leftover inset is
  // then exactly the peek strip plus one gap. Widening the card is what creates
  // the peek — the inset must stay (width - card) / 2 or the centered card is
  // no longer centered, and every scale peak drifts off the viewport center.
  // The ceiling stops the card growing on a tablet
  // rather than becoming one absurdly wide poster.
  const cardWidth = Math.min(
    CAROUSEL_MAX_CARD_WIDTH,
    width - 2 * (CAROUSEL_PEEK + CAROUSEL_SPACING),
  )

  // Side padding centers the first and last slot. Without this, slot 0 sits at
  // the left edge and can never reach the center stop of its input range.
  const sidePadding = (width - cardWidth) / 2
  const snap = cardWidth + CAROUSEL_SPACING

  return (
    <View style={styles.wrapper}>
      <Typography variant="titleMediumEmphasized" style={styles.heading}>
        {title}
      </Typography>

      <Motion.ScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        // Snap to the slot pitch so a card always lands centered.
        snapToInterval={snap}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{
          paddingHorizontal: sidePadding,
          // The trailing marginRight on the last slot doubles the end padding.
          paddingRight: sidePadding - CAROUSEL_SPACING,
        }}
      >
        {movies.map((movie, index) => (
          <CarouselCard
            key={movie.id}
            movie={movie}
            index={index}
            scrollX={scrollX}
            width={cardWidth}
            snap={snap}
          />
        ))}
      </Motion.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 12, marginBottom: 28 },
  heading: { paddingHorizontal: 16 },
})
