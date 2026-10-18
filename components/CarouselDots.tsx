import { useTheme } from '@rootnative/core'
import { useInterpolatedStyle, useTransform, type SharedValue } from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { StyleSheet, View } from 'react-native'

const DOT = 6
const PILL = 24

type Props = {
  count: number
  scrollX: SharedValue<number>
  snap: number
  /** The slot under the viewport center. */
  active: number
  /**
   * The autoplay wait as a share from 0 to 1, or null when the carousel does
   * not move by itself.
   */
  progress: SharedValue<number> | null
}

/**
 * The position in the carousel, as one dot for each film.
 *
 * The dot of the centred film grows into a pill, and both follow the finger.
 * The row keeps one width through a swipe: the pill gives up exactly the width
 * the next dot takes, so the dots beside them do not move.
 *
 * While the carousel moves on by itself, the pill fills from the left over the
 * wait, so the reader can see when the next film comes. The fill stops when
 * the wait stops, and continues from the same point.
 */
export function CarouselDots({ count, scrollX, snap, active, progress }: Props) {
  // The film under the center as a number from 0 to `count`, where a value
  // between two films is part of a swipe. The loop repeats the films, so the
  // slot wraps to its film.
  const position = useTransform(() => {
    'worklet'
    const slots = scrollX.value / snap
    return ((slots % count) + count) % count
  })

  return (
    <View aria-hidden style={styles.row}>
      {Array.from({ length: count }, (_, film) => (
        <Dot
          key={film}
          film={film}
          count={count}
          position={position}
          wait={film === active % count ? progress : null}
        />
      ))}
    </View>
  )
}

function Dot({
  film,
  count,
  position,
  wait,
}: {
  film: number
  count: number
  position: SharedValue<number>
  /** The wait this dot fills with, or null for a full fill. */
  wait: SharedValue<number> | null
}) {
  const theme = useTheme()

  // 1 when this film is centred, 0 one film or more away. The distance is
  // taken both ways around the loop, so the last dot hands the pill to the
  // first one as the row passes the end of the list.
  const focus = useTransform(() => {
    'worklet'
    const distance = Math.abs(position.value - film)
    return Math.max(0, 1 - Math.min(distance, count - distance))
  })

  const dotStyle = useInterpolatedStyle(focus, {
    width: [DOT, PILL],
    backgroundColor: [theme.colors.outlineVariant, theme.colors.primaryContainer],
  })
  const fadeStyle = useInterpolatedStyle(focus, { opacity: [0, 1] })
  const fill = { backgroundColor: theme.colors.primary }

  return (
    <Animated.View style={[styles.dot, dotStyle]}>
      <Animated.View style={[styles.layer, fadeStyle]}>
        {wait ? (
          <WaitFill wait={wait} color={fill} />
        ) : (
          <View style={[styles.layer, fill]} />
        )}
      </Animated.View>
    </Animated.View>
  )
}

/** A separate component, so only the dot that fills reads the wait. */
function WaitFill({
  wait,
  color,
}: {
  wait: SharedValue<number>
  color: { backgroundColor: string }
}) {
  const style = useInterpolatedStyle(wait, { scaleX: [0, 1] })

  return <Animated.View style={[styles.layer, styles.fromLeft, color, style]} />
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: DOT },
  dot: { height: DOT, borderRadius: DOT / 2, overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  fromLeft: { transformOrigin: 'left' },
})
