import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * Whether the software keyboard has shrunk the window.
 *
 * Android only. There the window resizes when the keyboard rises (see
 * lib/useKeyboardHeight.ts), and every screen in it shrinks too, including a
 * page under a sheet. iOS draws the keyboard over the window and the web has
 * none, so on those platforms the hook returns false and listens to nothing.
 *
 * `keyboardDidShow`, not `keyboardWillShow`: Android sends only the `did`
 * events.
 */
export function useKeyboardShrinksWindow(): boolean {
  const [shown, setShown] = useState(
    () => Platform.OS === 'android' && Keyboard.isVisible(),
  )

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return shown
}
