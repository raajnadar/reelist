import { act, renderHook } from '@testing-library/react-native'
import { Keyboard, Platform } from 'react-native'
import { useKeyboardHeight } from './useKeyboardHeight'

type Listener = (event: { endCoordinates: { height: number } }) => void

// The test does not raise a keyboard: it captures the listeners the hook
// registers and calls them, the way the native side would.
const listeners: Record<string, Listener> = {}
const remove = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  for (const key of Object.keys(listeners)) delete listeners[key]
  // The cast: the real listener takes a full KeyboardEvent, and the test
  // sends only the field the hook reads.
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    name: string,
    fn: Listener,
  ) => {
    listeners[name] = fn
    return { remove }
  }) as unknown as typeof Keyboard.addListener)
})

// Jest runs as iOS by default; the Android case sets the platform itself.
it('follows the keyboard up and down on iOS', () => {
  const { result } = renderHook(() => useKeyboardHeight())

  expect(result.current).toBe(0)

  act(() => listeners.keyboardWillShow({ endCoordinates: { height: 336 } }))
  expect(result.current).toBe(336)

  act(() => listeners.keyboardWillHide({ endCoordinates: { height: 0 } }))
  expect(result.current).toBe(0)
})

it('removes both listeners on unmount', () => {
  const { unmount } = renderHook(() => useKeyboardHeight())

  unmount()

  expect(remove).toHaveBeenCalledTimes(2)
})

it('listens to nothing on Android, where the window resizes itself', () => {
  const os = Platform.OS
  Platform.OS = 'android'

  const { result } = renderHook(() => useKeyboardHeight())

  expect(result.current).toBe(0)
  expect(Keyboard.addListener).not.toHaveBeenCalled()

  Platform.OS = os
})
