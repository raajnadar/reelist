import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  impactAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * A film saved or marked watched (also an undo that puts films back), a film
 * removed or marked not watched (also a cleared watchlist), and a pick: a
 * filter, a theme, a carousel slot landed on by a swipe, a cleared search box,
 * a closed gallery, a film picked in select mode.
 */
export type Haptic = 'save' | 'unsave' | 'select'

// Android 14 is the first level with TOGGLE_ON, TOGGLE_OFF, and SEGMENT_TICK.
// On an older level the call rejects, so those devices get CONTEXT_CLICK,
// which every level has.
const ANDROID_14 = 34

const ANDROID: Record<Haptic, AndroidHaptics> = {
  save: AndroidHaptics.Toggle_On,
  unsave: AndroidHaptics.Toggle_Off,
  select: AndroidHaptics.Segment_Tick,
}

const play = (kind: Haptic): Promise<void> => {
  if (Platform.OS === 'android') {
    return performAndroidHapticsAsync(
      Platform.Version >= ANDROID_14 ? ANDROID[kind] : AndroidHaptics.Context_Click,
    )
  }
  if (kind === 'select') return selectionAsync()
  return impactAsync(
    kind === 'save' ? ImpactFeedbackStyle.Light : ImpactFeedbackStyle.Soft,
  )
}

/**
 * Plays one haptic and does not wait for it.
 *
 * Android uses the haptics of the view, not `Vibrator`. They follow the system
 * touch feedback setting and need no `VIBRATE` permission, which app.json
 * blocks. A failure is dropped, because a missing haptic must not stop the
 * action that asked for it. The web version is in haptics.web.ts.
 */
export function haptic(kind: Haptic): void {
  play(kind).catch(() => {})
}
