import { AppBar } from '@rootnative/components/appbar'
import { IconButton } from '@rootnative/components/icon-button'
import { defaultTopAppBarTokens, useWindowDimensions } from '@rootnative/core'
import { openURL } from 'expo-linking'
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StateMessage } from '../../../components/StateMessage'
import { TrailerPlayer } from '../../../components/TrailerPlayer'
import { PageHead } from '@rootnative/seo/expo-router'
import { metadataFor, noindexMeta } from '../../../lib/head'
import { enterPip, pipSupported, setAutoEnterPip, useInPip } from '../../../lib/pip'
import { ON_STAGE, STAGE } from '../../../lib/stage'
import { useWebKey } from '../../../lib/useWebKey'
import { watchUrl } from '../../../lib/youtube'

export const generateMetadata = () => metadataFor(noindexMeta('Trailer'))

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

/** The height of the app bar over the video. */
const BAR_HEIGHT = defaultTopAppBarTokens.smallContainerHeight

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
  // The player is a YouTube frame. While it has the focus, the keys go to the
  // frame, not to this page, so Escape works once the focus is outside it.
  useWebKey('Escape', close)

  /**
   * Picture-in-picture, on an Android build that has the module.
   *
   * A swipe home while this screen has the focus shrinks the video to a
   * corner instead of leaving it. The flag is on the activity, so it goes off
   * the moment the screen loses the focus, or a swipe home from the film page
   * would shrink that page. See lib/pip.ts.
   */
  const focused = useIsFocused()
  const inPip = useInPip()
  useEffect(() => {
    if (!pipSupported || !key) return
    setAutoEnterPip(focused, title)
    return () => setAutoEnterPip(false)
  }, [focused, key, title])

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

  /**
   * In the small window there is no bar and no inset: the video takes the
   * whole window, which the system cut to 16:9. The bar below is `null` and
   * not removed from the tree, so the player keeps its place among the
   * children and the web view is not mounted again, which would restart the
   * video.
   */
  const frame = inPip ? { width, height } : { width: playerWidth, height: playerHeight }
  const paddingTop = inPip ? 0 : insets.top

  return (
    <View style={[styles.screen, { paddingTop }]}>
      <PageHead title={title ? `${title} trailer` : 'Trailer'} noindex />
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

      {inPip ? null : (
        <AppBar
          title={title ?? 'Trailer'}
          containerColor={STAGE}
          contentColor={ON_STAGE}
          leading={
            <IconButton
              icon="close"
              variant="standard"
              accessibilityLabel="Close the trailer"
              onPress={close}
            />
          }
          // The YouTube button is always present, and not a fallback that
          // appears after a failure. A video the studio blocked from embedding
          // still loads and still plays nothing, and the app cannot tell that
          // state apart from a slow start. See lib/youtube.ts.
          //
          // The PiP button is the way into the small window on Android 8 to
          // 11, which do not enter it on a swipe home. It is there on 12 and
          // later too, for a reader who wants the window without leaving.
          actions={
            key
              ? [
                  ...(pipSupported
                    ? [
                        {
                          icon: 'picture-in-picture-bottom-right',
                          accessibilityLabel: 'Watch in a small window',
                          onPress: () => enterPip(title),
                        },
                      ]
                    : []),
                  {
                    icon: 'open-in-new',
                    accessibilityLabel: 'Open in YouTube',
                    // A rejected promise means no installed app opens a YouTube
                    // link. There is nothing better to do than stay on the player.
                    onPress: () => void openURL(watchUrl(key)).catch(() => {}),
                  },
                ]
              : undefined
          }
        />
      )}

      <View style={styles.stage}>
        {key ? (
          <TrailerPlayer videoKey={key} width={frame.width} height={frame.height} />
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
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
