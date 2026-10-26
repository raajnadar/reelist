import { act, renderHook } from '@testing-library/react-native'
import { Keyboard, Platform } from 'react-native'
import { useKeyboardShrinksWindow } from './useKeyboardShrinksWindow'

// As in useKeyboardHeight.test.ts: the test captures the listeners the hook
// registers and calls them, the way the native side would.
const listeners: Record<string, () => void> = {}
const remove = jest.fn()
const os = Platform.OS

beforeEach(() => {
  jest.clearAllMocks()
  for (const key of Object.keys(listeners)) delete listeners[key]
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    name: string,
    fn: () => void,
  ) => {
    listeners[name] = fn
    return { remove }
  }) as unknown as typeof Keyboard.addListener)
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false)
})

afterEach(() => {
  Platform.OS = os
})

it('follows the keyboard up and down on Android', () => {
  Platform.OS = 'android'
  const { result } = renderHook(() => useKeyboardShrinksWindow())

  expect(result.current).toBe(false)

  act(() => listeners.keyboardDidShow())
  expect(result.current).toBe(true)

  act(() => listeners.keyboardDidHide())
  expect(result.current).toBe(false)
})

it('starts shown when the keyboard is already up', () => {
  Platform.OS = 'android'
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true)

  const { result } = renderHook(() => useKeyboardShrinksWindow())

  expect(result.current).toBe(true)
})

it('removes both listeners on unmount', () => {
  Platform.OS = 'android'
  const { unmount } = renderHook(() => useKeyboardShrinksWindow())

  unmount()

  expect(remove).toHaveBeenCalledTimes(2)
})

// Jest runs as iOS by default.
it('listens to nothing on iOS, where the keyboard covers the window', () => {
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true)

  const { result } = renderHook(() => useKeyboardShrinksWindow())

  expect(result.current).toBe(false)
  expect(Keyboard.addListener).not.toHaveBeenCalled()
})
