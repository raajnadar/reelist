import { embedUrl } from '../lib/youtube'
import type { TrailerPlayerProps } from './TrailerPlayer'

/**
 * The video surface, in a browser.
 *
 * Metro picks this file for the web target and `TrailerPlayer.tsx` for the
 * native ones. It imports the prop type from that file, and no value from it,
 * so the two surfaces cannot drift apart while react-native-webview stays out
 * of the web bundle.
 *
 * A plain `<iframe>` rather than a React Native element: this file only ever
 * renders through react-dom, and an iframe is what a browser gives a video the
 * full player for.
 */
export function TrailerPlayer({ videoKey, width, height }: TrailerPlayerProps) {
  return (
    <iframe
      data-testid="trailer-player"
      // The frame needs an accessible name, and the screen behind it already
      // prints the title of the film.
      title="Trailer"
      src={embedUrl(videoKey)}
      width={width}
      height={height}
      // Without `autoplay` here the browser refuses the `autoplay=1` the URL
      // asks for: a cross-origin frame is granted a feature by its parent.
      // `fullscreen` is the same grant for the control in the player.
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      style={styles.player}
    />
  )
}

// A plain object, not StyleSheet.create: these are DOM styles on a DOM element,
// and react-native-web does not resolve a registered style for one.
const styles = {
  player: { border: 'none', backgroundColor: '#000000' },
} as const
