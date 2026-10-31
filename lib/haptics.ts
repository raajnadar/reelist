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
 * removed or marked not watched (also a cleared watchlist), a pick: a filter,
 * a theme, a carousel slot landed on by a swipe, a cleared search box, a
 * closed gallery, a film picked in select mode, and a long press that opens
 * the menu of a film.
 */
export type Haptic = 'save' | 'unsave' | 'select' | 'menu'

// Android 14 is the first level with TOGGLE_ON, TOGGLE_OFF, and SEGMENT_TICK.
// On an older level the call rejects, so those devices get CONTEXT_CLICK,
// which every level has. LONG_PRESS is on every level too.
const ANDROID_14 = 34

const ANDROID: Record<Haptic, AndroidHaptics> = {
  save: AndroidHaptics.Toggle_On,
  unsave: AndroidHaptics.Toggle_Off,
  select: AndroidHaptics.Segment_Tick,
  menu: AndroidHaptics.Long_Press,
}

const IOS_IMPACT: Record<Exclude<Haptic, 'select'>, ImpactFeedbackStyle> = {
  save: ImpactFeedbackStyle.Light,
  unsave: ImpactFeedbackStyle.Soft,
  menu: ImpactFeedbackStyle.Medium,
}

const play = (kind: Haptic): Promise<void> => {
  if (Platform.OS === 'android') {
    return performAndroidHapticsAsync(
      kind === 'menu' || Platform.Version >= ANDROID_14
        ? ANDROID[kind]
        : AndroidHaptics.Context_Click,
    )
  }
  if (kind === 'select') return selectionAsync()
  return impactAsync(IOS_IMPACT[kind])
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
