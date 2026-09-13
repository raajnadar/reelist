import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useInterpolatedStyle, type SharedValue } from '@rootnative/inertia'
// The bar drives its own interpolated styles rather than an `animate` prop, so
// it needs Reanimated's animated primitives. A `Motion.View` carrying only
// `style` has no motion prop, takes the library's zero-cost plain path, and
// renders a host that cannot read an animated style — the fade would silently
// do nothing. This subpath is the documented interop for exactly that case.
import { Animated } from '@rootnative/inertia/reanimated'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** The MD3 small app bar height, under the status bar inset. */
export const HEADER_HEIGHT = 56

/**
 * How far the fade runs, in points of scroll.
 *
 * It ends at `revealAt`, so this is the distance above that point where the
 * bar starts to arrive. Short enough to feel tied to the gesture, long enough
 * that a flick does not flash it on.
 */
const REVEAL_SPAN = 90

type Props = {
  /** Shown only once the bar has a background to sit on. */
  title: string
  /** The scroll offset of the content below, from `useScroll`. */
  scrollY: SharedValue<number>
  /** The offset at which the bar is fully opaque and the title fully shown. */
  revealAt: number
  onBack: () => void
}

/**
 * The floating header over the detail hero.
 *
 * It starts as a back button alone on the artwork and becomes a filled app bar
 * with the film title once the hero has scrolled away. That is the reason the
 * screen no longer draws the title twice: the large one in the hero and the
 * small one here are never on screen together.
 *
 * It is hand-built rather than an `<AppBar>` for one reason — the title and the
 * background have to fade against the scroll position, and AppBar paints both
 * itself. app/index.tsx builds its own header for a similar reason.
 */
export function DetailHeader({ title, scrollY, revealAt, onBack }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  // The sweep the three styles below share. `end` stays above `start` even when
  // the caller asks for a bar that is opaque from the first pixel — an
  // interpolation across a zero-width range has no answer to give.
  const start = Math.max(revealAt - REVEAL_SPAN, 0)
  const inputRange = [start, Math.max(revealAt, start + 1)]

  // The bar background, arriving as the artwork leaves.
  const barStyle = useInterpolatedStyle(scrollY, { opacity: [0, 1] }, { inputRange })

  // The title rises the last few points into place rather than appearing flat.
  const titleStyle = useInterpolatedStyle(
    scrollY,
    { opacity: [0, 1], translateY: [8, 0] },
    { inputRange },
  )

  // The disc behind the back arrow. It is what keeps the icon legible on a
  // bright frame, so it fades out exactly as the bar behind it fades in — the
  // two are never both absent.
  const discStyle = useInterpolatedStyle(scrollY, { opacity: [1, 0] }, { inputRange })

  return (
    // `styles.header` carries `box-none`, so the hero scrolls under the
    // transparent part of the bar. A plain View would swallow every touch
    // across the top of the screen.
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Animated.View
        style={[
          styles.barBackground,
          { backgroundColor: theme.colors.surface },
          barStyle,
        ]}
      />

      <View style={styles.bar}>
        <View style={styles.backSlot}>
          <Animated.View
            style={[
              styles.disc,
              { backgroundColor: theme.colors.surfaceContainerHighest },
              discStyle,
            ]}
          />
          {/*
            `standard` — the disc behind it is the container. The icon keeps
            `onSurface` at every scroll position, which is correct against both
            the disc and the filled bar, so no colour has to animate.
          */}
          <IconButton
            icon="arrow-left"
            variant="standard"
            iconColor={theme.colors.onSurface}
            accessibilityLabel="Go back"
            onPress={onBack}
          />
        </View>

        {/*
          `as` swaps the host for an animated one. Typography is a plain Text,
          and a plain Text drops an animated style without reporting it.
        */}
        <Typography
          as={Animated.Text}
          variant="titleMedium"
          numberOfLines={1}
          style={[styles.title, titleStyle]}
        >
          {title}
        </Typography>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Absolute, so the artwork runs under the status bar instead of starting
  // below it. The hero is the one element on the screen that should.
  //
  // `pointerEvents` belongs in the style rather than in a prop of the same
  // name. React Native deprecated the prop form, and react-native-web reports
  // it on every render.
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    pointerEvents: 'box-none',
  },
  barBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  // Holds the disc and the button in one stack. The button sizes the slot; the
  // disc fills it from behind.
  backSlot: { marginLeft: 4, alignItems: 'center', justifyContent: 'center' },
  disc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    borderRadius: 9999,
  },
  // `flex: 1` with a zero basis, so a long title ellipsizes instead of pushing
  // the row wider than the screen.
  title: { flex: 1, flexBasis: 0, marginLeft: 4, marginRight: 16 },
})
