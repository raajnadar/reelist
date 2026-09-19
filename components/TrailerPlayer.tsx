import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { embedPage, PLAYER_ORIGIN } from '../lib/youtube'

/**
 * The video surface, on iOS and Android.
 *
 * There is a second file beside this one, `TrailerPlayer.web.tsx`, which draws
 * an iframe. The split is not a preference: react-native-webview has no web
 * build, and a single file would pull a native-only module into the browser
 * bundle. Metro picks the `.web` file for the web target, so this one never
 * reaches it.
 *
 * The caller sizes the box. This component draws a player at the size it is
 * given and decides nothing about the layout around it.
 */
export type TrailerPlayerProps = {
  videoKey: string
  width: number
  height: number
}

export function TrailerPlayer({ videoKey, width, height }: TrailerPlayerProps) {
  return (
    <WebView
      testID="trailer-player"
      // HTML with a base URL, not the embed URL itself. YouTube checks the
      // referrer on an embed request and reports a bad one inside the frame,
      // where the app cannot catch it: no referrer is error 153, and a
      // referrer of youtube.com is error 152. The base URL is what the iframe
      // in this page sends instead. See lib/youtube.ts.
      source={{ html: embedPage(videoKey), baseUrl: PLAYER_ORIGIN }}
      style={[styles.player, { width, height }]}
      // The two halves of inline playback. The `playsinline=1` in the URL is
      // what YouTube reads; this is what the iOS web view honours. Without both
      // the video takes over the screen as it starts.
      allowsInlineMediaPlayback
      // Autoplay is blocked by default, and the URL asks for it.
      mediaPlaybackRequiresUserAction={false}
      // The fullscreen control inside the YouTube player, on Android.
      allowsFullscreenVideo
      // Android defaults both to off, and the YouTube player needs both.
      javaScriptEnabled
      domStorageEnabled
      // The embed fits the frame exactly, so any scroll is a rubber band over a
      // video rather than a way to reach content.
      scrollEnabled={false}
      // A link inside the player must not send the view to a custom scheme.
      // Everything this screen loads is https.
      originWhitelist={['https://*']}
    />
  )
}

const styles = StyleSheet.create({
  // A web view paints its own background before the page draws. The default is
  // white, which flashes against the black screen while YouTube loads.
  player: { backgroundColor: '#000000' },
})
