import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import { openURL } from 'expo-linking'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StateMessage } from '../../components/StateMessage'
import { TrailerPlayer } from '../../components/TrailerPlayer'
import { watchUrl } from '../../lib/youtube'

/**
 * The player screen.
 *
 * A route rather than an overlay on the detail screen, which is what the app
 * did before: it handed the video to YouTube with `openURL` and left. A route
 * of its own gives the player the system back gesture and the Android hardware
 * back button for free, and it keeps the detail screen underneath it with its
 * scroll position intact.
 *
 * It needs no request. The detail screen already holds the video, and the key
 * is the whole of what the player needs, so this screen has no loading state.
 */

/** The height of the control row over the video. */
const BAR_HEIGHT = 56

/**
 * The letterbox around the video, and the bar over it.
 *
 * Black in both themes, and deliberately not a theme colour. Every player puts
 * a video on black, and a light surface beside a bright frame reads as a fault
 * in the video rather than as the page behind it.
 */
const STAGE = '#000000'

/** White on that stage, for the same reason: the bar is not a themed surface. */
const ON_STAGE = '#FFFFFF'

/** The shape of the frame YouTube fills. */
const ASPECT = 16 / 9

export default function TrailerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()

  /**
   * The video, and the film it belongs to.
   *
   * The title travels as a parameter rather than being fetched here. The screen
   * that pushed this one already holds it, and a request for one line of text
   * would put a loading state on a screen that otherwise has none.
   */
  const { key, title } = useLocalSearchParams<{ key: string; title?: string }>()

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'))

  /**
   * The largest 16:9 frame the window holds.
   *
   * The width is the limit on a phone held upright, and the remaining height is
   * the limit once the window is wider than it is tall — a tablet, a desktop
   * window, or a phone turned sideways. Taking the smaller of the two keeps the
   * whole frame on screen in all of them.
   */
  const stageHeight = height - insets.top - insets.bottom - BAR_HEIGHT
  const playerWidth = Math.min(width, stageHeight * ASPECT)
  const playerHeight = playerWidth / ASPECT

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/*
        `fullScreenModal` rather than `modal`: the iOS sheet leaves the screen
        behind it visible at the top and rounds the corners over the video, and
        a player is not a sheet. The fade is what suits a cut to black.
      */}
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'fade' }} />

      {/*
        The root bar follows the theme, and this screen is black whatever the
        theme says. The last mounted StatusBar wins, so this one applies while
        the player is on screen and the root one returns as it leaves.
      */}
      <StatusBar style="light" />

      <View style={styles.bar}>
        <IconButton
          icon="close"
          variant="standard"
          iconColor={ON_STAGE}
          accessibilityLabel="Close the trailer"
          onPress={close}
        />

        <Typography variant="titleMedium" numberOfLines={1} style={styles.title}>
          {title ?? 'Trailer'}
        </Typography>

        {/*
          Always present, and not a fallback that appears after a failure. A
          video the studio blocked from embedding still loads and still plays
          nothing, and the app cannot tell that state apart from a slow start.
          See lib/youtube.ts.
        */}
        {key ? (
          <IconButton
            icon="open-in-new"
            variant="standard"
            iconColor={ON_STAGE}
            accessibilityLabel="Open in YouTube"
            // A rejected promise means no installed app opens a YouTube link.
            // There is nothing better to do than stay on the player.
            onPress={() => void openURL(watchUrl(key)).catch(() => {})}
          />
        ) : null}
      </View>

      <View style={styles.stage}>
        {key ? (
          <TrailerPlayer videoKey={key} width={playerWidth} height={playerHeight} />
        ) : (
          /* A deep link with no key in it. There is no request to retry and no
             video to name, so the only action is the way out. */
          <StateMessage
            testID="trailer-error"
            icon="link-off"
            tone="error"
            title="No trailer to play"
            body="That link does not point at a video."
            actionLabel="Go back"
            actionIcon="arrow-left"
            onAction={close}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: STAGE },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  // `flexBasis: 0` with the grow, so a long film title ellipsizes instead of
  // pushing the YouTube button off the row.
  //
  // `lineHeight: undefined` drops the one the variant carries, and it is what
  // puts the title on the same centreline as the close button. MD3 gives
  // titleMedium 24 points of line height against a 16 point font, which is
  // leading for a paragraph. iOS puts all of that space above the glyphs
  // rather than around them, so the text draws low inside its own box while
  // `alignItems: 'center'` centres the box itself. Without a line height the
  // box hugs the text, and the row centres what a reader actually sees.
  title: { flex: 1, flexBasis: 0, color: ON_STAGE, lineHeight: undefined },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
