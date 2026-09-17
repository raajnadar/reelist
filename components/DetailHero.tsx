import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { StyleSheet, View } from 'react-native'
import { RemoteImage } from './RemoteImage'
import { Scrim, type ScrimStop } from './Scrim'

/**
 * The scrim that dissolves the backdrop into the page.
 *
 * The stops are weighted to the bottom third: the top half of the frame is left
 * alone, and the last quarter reaches the page colour before the image ends, so
 * there is no seam where the picture stops. This is what replaced the parallax —
 * the hero reads as part of the page rather than as a panel sliding behind it.
 */
const BACKDROP_SCRIM: readonly ScrimStop[] = [
  [0, 0],
  [0.45, 0.08],
  [0.65, 0.34],
  [0.82, 0.76],
  [1, 1],
]

/**
 * A short wash under the status bar, so the back button and the clock stay
 * legible on a bright frame. It is the theme `scrim` (black), not the page
 * colour: this one darkens the picture rather than fading it out.
 */
const TOP_SCRIM: readonly ScrimStop[] = [
  [0, 0.4],
  [1, 0],
]

type Props = {
  /** The backdrop, or the poster when the film has no backdrop. */
  uri: string | null
  height: number
  /** The room the floating header takes, which the top wash matches. */
  headerSpace: number
  recyclingKey: string
}

/**
 * The masthead: one frame of artwork that fades into the page.
 *
 * The picture does not move against the scroll. A backdrop that drifts at half
 * speed reads as a panel behind the page, and it put the title over a moving
 * image for the whole first screen.
 */
export function DetailHero({ uri, height, headerSpace, recyclingKey }: Props) {
  const theme = useTheme()

  return (
    <View style={[styles.frame, { height }]}>
      {uri ? (
        /*
          A slow settle out of a slight zoom, played once on arrival. The
          wrapper owns it rather than the picture: `Motion.View` takes the
          animated path because `animate` is present, and RemoteImage is not a
          Motion primitive.

          The zoom is all the wrapper does. The fade belongs to the image, which
          cross-dissolves when the bytes land — timed to the download rather
          than to the mount, so a slow connection no longer fades an empty box
          in and then snaps the picture into it.
        */
        <Motion.View
          style={styles.fill}
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition="enter"
        >
          <RemoteImage
            testID="detail-backdrop"
            uri={uri}
            recyclingKey={recyclingKey}
            // The picture the screen is built around.
            priority="high"
            style={styles.fill}
          />
        </Motion.View>
      ) : (
        <View
          style={[
            styles.fill,
            styles.fallback,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
            No image
          </Typography>
        </View>
      )}

      <Scrim color={theme.colors.background} stops={BACKDROP_SCRIM} />

      <View style={[styles.topScrim, { height: headerSpace }]}>
        <Scrim color={theme.colors.scrim} stops={TOP_SCRIM} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Clips the scrim and the zoom-out entrance to the frame. Without it the
  // image starts 6% wider than the window and widens the page on web.
  frame: { width: '100%', overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  // Pinned to the top of the frame rather than filling it, so the wash under
  // the status bar ends where the header does.
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
})
