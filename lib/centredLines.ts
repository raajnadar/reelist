import { Platform, type TextStyle } from 'react-native'

/**
 * The style for centred text with a line limit, which ends in an ellipsis.
 *
 * Android draws the cut-short last line from the wrong start when the text
 * has letter spacing, so the line loses its first letters at the left edge:
 * "s crush's heart" for "his crush's heart". The spacing is the only trigger
 * (a plain React Native `Text` does the same), so on Android the line drops
 * the type scale's spacing and keeps the ellipsis. iOS and the web keep both.
 */
export function centredLinesFor(os: typeof Platform.OS): TextStyle {
  return os === 'android'
    ? { textAlign: 'center', letterSpacing: 0 }
    : { textAlign: 'center' }
}

export const centredLines = centredLinesFor(Platform.OS)
