import { requireOptionalNativeModule, type NativeModule } from 'expo'
import { useEffect, useState } from 'react'

/**
 * Picture-in-picture for the trailer, on Android.
 *
 * The native side is the `expo-pip` module. It is read here as an optional
 * module rather than through the package's own JavaScript: Expo Go has no
 * such module, and the package warns on the console each time a listener is
 * added without one. A build without the module gets `null`, every call below
 * becomes a no-op, and the screen draws no PiP button. That is what keeps an
 * EAS Update safe for a store build made before the module was added.
 *
 * iOS has no entry here. WKWebView offers the system PiP button inside its
 * own fullscreen controls, and the web has the browser's media control, so
 * neither needs a call from the app.
 */

type PipEvents = {
  onPipModeChange: (event: { isInPipMode: boolean }) => void
}

type PipParams = {
  width?: number | null
  height?: number | null
  title?: string | null
  seamlessResizeEnabled?: boolean | null
  autoEnterEnabled?: boolean | null
}

declare class PipModule extends NativeModule<PipEvents> {
  isInPipMode(): boolean
  setPictureInPictureParams(params: PipParams): void
  enterPipMode(params?: PipParams): void
}

const pip = requireOptionalNativeModule<PipModule>('ExpoPip')

/** Whether this build can shrink the trailer to a corner of the screen. */
export const pipSupported = pip !== null

/** The shape of the small window: the frame YouTube fills. */
const ASPECT: Pick<PipParams, 'width' | 'height'> = { width: 16, height: 9 }

/**
 * Whether a swipe home while the trailer plays shrinks it to a corner rather
 * than leaving it.
 *
 * Android 12 and later read this flag; an older device gets PiP from the
 * button alone. It is a setting on the whole activity, so the trailer screen
 * turns it on when it has the focus and off when it loses it. Left on, a
 * swipe home from the film page would shrink the film page.
 */
export const setAutoEnterPip = (enabled: boolean, title?: string): void => {
  pip?.setPictureInPictureParams({
    ...ASPECT,
    autoEnterEnabled: enabled,
    seamlessResizeEnabled: true,
    title: title ?? null,
  })
}

/** Shrinks the trailer now, for the button and for Android 8 to 11. */
export const enterPip = (title?: string): void => {
  pip?.enterPipMode({ ...ASPECT, title: title ?? null })
}

/**
 * Whether the activity is in the small window right now. The screen hides
 * its bar and lets the video fill the window while this is true.
 */
export const useInPip = (): boolean => {
  const [inPip, setInPip] = useState(() => pip?.isInPipMode() ?? false)

  useEffect(() => {
    if (!pip) return
    const subscription = pip.addListener('onPipModeChange', (event) =>
      setInPip(event.isInPipMode),
    )
    return () => subscription.remove()
  }, [])

  return inPip
}
