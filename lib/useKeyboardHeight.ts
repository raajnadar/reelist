import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * The height of the software keyboard, or 0 while it is down.
 *
 * iOS only. Android resizes the window when the keyboard rises, because
 * `softwareKeyboardLayoutMode` is `resize` by default, so a screen there has
 * nothing to add; the web has no keyboard. On those platforms the hook returns
 * 0 and listens to nothing.
 *
 * This exists in place of `KeyboardAvoidingView`. On iOS that view calls
 * `LayoutAnimation.configureNext` when the keyboard rises, and the animation
 * it configures applies to every layout change in the next commit, not only
 * its own padding. The search sheet's pill was mid-flight at that moment, and
 * the layout animation snapped it. A number that a list adds to its own
 * bottom padding moves nothing else.
 *
 * `keyboardWillShow`, not `keyboardDidShow`: the list gets its padding as the
 * keyboard starts to rise, so the last row is reachable by the time it has.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    const show = Keyboard.addListener('keyboardWillShow', (event) =>
      setHeight(event.endCoordinates.height),
    )
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return height
}
