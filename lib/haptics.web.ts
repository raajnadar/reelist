import type { Haptic } from './haptics'

/**
 * No haptics on the web.
 *
 * A browser can only call `navigator.vibrate`, which runs the motor and
 * ignores the system touch feedback setting. This file also keeps
 * expo-haptics out of the web bundle.
 */
export function haptic(kind: Haptic): void {}
