import { useIsFocused } from 'expo-router'
import { useEffect, useEffectEvent } from 'react'
import { Platform } from 'react-native'

type Options = {
  /** False turns the key off, for example outside the mode the key ends. */
  active?: boolean
}

const isField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null)

/**
 * Calls `onKey` when the reader presses `key` on the web, while the screen
 * that calls this is on top. Native has no key events.
 *
 * The listener is on `window`, in the bubble phase, so an open menu or dialog
 * of the library gets the key first: its focus trap stops Escape on
 * `document` in the capture phase, and one press closes one layer. A key held
 * with Ctrl, Cmd, or Alt is a browser shortcut, and is left alone.
 *
 * A key typed in a field belongs to the field: `/` there types a slash. A
 * React Native `TextInput` on the web stops each key it gets before it
 * reaches `window`, so a screen with a field reads Escape from the field's
 * `onKeyPress` too.
 */
export function useWebKey(
  key: string,
  onKey: () => void,
  { active = true }: Options = {},
): void {
  const focused = useIsFocused()
  const press = useEffectEvent(onKey)

  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !focused) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== key || event.defaultPrevented || event.isComposing) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isField(event.target)) return
      // For `/`, this stops the quick find of Firefox.
      event.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, active, focused])
}
