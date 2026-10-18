import { Chip } from '@rootnative/components/chip'
import { Icon } from '@rootnative/components/icon'
import { useTheme } from '@rootnative/core'
import { Motion, useInterpolatedStyle, useScroll } from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { Link } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { genreIcon } from '../lib/genreIcons'
import { entranceTransition } from '../lib/motion'
import type { Genre } from '../lib/types'
import { useServerPainted } from '../lib/useServerPainted'
import { Scrim, type ScrimStop } from './Scrim'

/**
 * The width of the fade at each end of the row, in points. It is also the
 * scroll distance over which a fade comes in or goes out.
 */
const FADE = 32

const FADE_IN: readonly ScrimStop[] = [
  [0, 0],
  [1, 1],
]
const FADE_OUT: readonly ScrimStop[] = [
  [0, 1],
  [1, 0],
]

/**
 * The genre shortcuts under the home header.
 *
 * The row renders nothing at all when the list is empty. Genres are a secondary
 * way into the catalogue — the film rows below are the primary one — so a failed
 * or still-loading genre request leaves no gap, no placeholder, and no error.
 * The caller passes an empty array for every one of those cases.
 *
 * `suggestion` is the variant, not `filter`: these chips navigate to another
 * screen rather than narrow what is on this one, and a filter chip carries a
 * selected state that would never be set here.
 *
 * Each chip is a tonal pill with an icon for its genre in the primary colour,
 * so the row reads at a glance and has no outlines to compete with the
 * posters. The row fades out at an edge where more chips wait, and the fades
 * follow the scroll: the left one comes in as the row leaves its start, and
 * the right one goes as the row reaches its end.
 *
 * `inset` is the row's own horizontal padding, which the home screen needs and
 * the detail screen does not: there the chips sit inside a body that already
 * pads itself, and a second inset would step them in from the title above them.
 * `gutter` is the space below the row, for the same reason — the detail body
 * spaces its own children.
 */
export function GenreChips({
  genres,
  inset = 16,
  gutter = 20,
}: {
  genres: Genre[]
  inset?: number
  gutter?: number
}) {
  const theme = useTheme()
  const { scrollX, onScroll } = useScroll()
  const painted = useServerPainted()

  // How far the row can scroll. Zero until both sizes are known, which keeps
  // the right fade away from a row that fits.
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const overflow = Math.max(content - viewport, 0)

  // A fade runs over FADE points of scroll, or over the whole scroll when the
  // row scrolls less than that. A short row is still fully faded at rest, so
  // the chip it cuts has no hard edge. A row that fits gets no fade at all.
  const reach = Math.max(Math.min(FADE, overflow), 1)
  const startFade = useInterpolatedStyle(
    scrollX,
    { opacity: [0, overflow > 0 ? 1 : 0] },
    { inputRange: [0, reach] },
  )
  const endFade = useInterpolatedStyle(
    scrollX,
    { opacity: [overflow > 0 ? 1 : 0, 0] },
    { inputRange: [overflow - reach, overflow] },
  )

  if (!genres.length) return null

  return (
    <View style={{ marginBottom: gutter }}>
      <Motion.FlatList
        data={genres}
        horizontal
        onScroll={onScroll}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(g) => String(g.id)}
        // Every chip on the first render, not the FlatList default of 10, so
        // the static home page links to each genre page. A chip has no image,
        // so the cost is small.
        initialNumToRender={genres.length}
        contentContainerStyle={{ paddingHorizontal: inset }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => (
          // The same staggered entrance the cards use, so the chips arrive as
          // part of the screen rather than as a separate element appearing over it.
          // Chips on the static page show at rest. See lib/useServerPainted.ts.
          <Motion.View
            initial={painted ? false : { opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={entranceTransition(index)}
          >
            {/* A link, so the web renders an anchor a crawler can follow. */}
            <Link
              href={`/genre/${item.id}?name=${encodeURIComponent(item.name)}`}
              asChild
            >
              <Chip
                variant="suggestion"
                leadingIcon={({ size }) => (
                  <Icon
                    source={genreIcon(item.id)}
                    size={size}
                    color={theme.colors.primary}
                  />
                )}
                containerColor={theme.colors.surfaceContainerHigh}
                contentColor={theme.colors.onSurface}
                style={styles.chip}
              >
                {item.name}
              </Chip>
            </Link>
          </Motion.View>
        )}
      />
      <Animated.View style={[styles.fade, styles.start, startFade]}>
        <Scrim color={theme.colors.background} stops={FADE_OUT} axis="horizontal" />
      </Animated.View>
      <Animated.View style={[styles.fade, styles.end, endFade]}>
        <Scrim color={theme.colors.background} stops={FADE_IN} axis="horizontal" />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  separator: { width: 8 },
  // A pill, to match the dots and the rounded cards of the carousel. The
  // tonal fill marks the edge, so the outline goes.
  chip: { borderRadius: 999, borderWidth: 0 },
  fade: { position: 'absolute', top: 0, bottom: 0, width: FADE, pointerEvents: 'none' },
  start: { left: 0 },
  end: { right: 0 },
})
