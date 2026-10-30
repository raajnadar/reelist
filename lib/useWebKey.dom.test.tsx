/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react-native'
import { useWebKey } from './useWebKey'

// In the DOM project, so `Platform.OS` is `web` and `window` is real.

let mockFocused = true
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }))

const press = (
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = document.body,
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  mockFocused = true
  document.body.innerHTML = ''
})

it('calls the handler for its key, and stops the browser default', () => {
  const onKey = jest.fn()
  renderHook(() => useWebKey('Escape', onKey))

  const event = press('Escape')

  expect(onKey).toHaveBeenCalledTimes(1)
  expect(event.defaultPrevented).toBe(true)
})

it('leaves every other key alone', () => {
  const onKey = jest.fn()
  renderHook(() => useWebKey('Escape', onKey))

  const event = press('Enter')

  expect(onKey).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
})

it('does nothing while it is not active', () => {
  const onKey = jest.fn()
  const { rerender } = renderHook(
    ({ active }: { active: boolean }) => useWebKey('Escape', onKey, { active }),
    {
      initialProps: { active: false },
    },
  )

  press('Escape')
  expect(onKey).not.toHaveBeenCalled()

  rerender({ active: true })
  press('Escape')
  expect(onKey).toHaveBeenCalledTimes(1)
})

it('does nothing while another screen is on top', () => {
  // A sheet above the screen. Its own keys must not reach the screen below.
  mockFocused = false
  const onKey = jest.fn()
  renderHook(() => useWebKey('Escape', onKey))

  press('Escape')

  expect(onKey).not.toHaveBeenCalled()
})

it('leaves a key with Ctrl, Cmd, or Alt to the browser', () => {
  const onKey = jest.fn()
  renderHook(() => useWebKey('/', onKey))

  press('/', { ctrlKey: true })
  press('/', { metaKey: true })
  press('/', { altKey: true })

  expect(onKey).not.toHaveBeenCalled()
})

it('leaves a key that a menu or dialog already took', () => {
  const onKey = jest.fn()
  renderHook(() => useWebKey('Escape', onKey))
  // What the library focus trap does in the capture phase.
  const trap = (event: KeyboardEvent) => event.preventDefault()
  document.addEventListener('keydown', trap, true)

  press('Escape')
  document.removeEventListener('keydown', trap, true)

  expect(onKey).not.toHaveBeenCalled()
})

it('leaves a key typed in a field to the field', () => {
  const onKey = jest.fn()
  renderHook(() => useWebKey('/', onKey))
  const input = document.body.appendChild(document.createElement('input'))
  const editor = document.body.appendChild(document.createElement('div'))
  // The attribute, not the property: jsdom does not reflect the property.
  editor.setAttribute('contenteditable', 'true')

  const typed = press('/', {}, input)
  press('/', {}, editor)
  expect(onKey).not.toHaveBeenCalled()
  // The slash goes into the field.
  expect(typed.defaultPrevented).toBe(false)

  press('/')
  expect(onKey).toHaveBeenCalledTimes(1)
})

it('calls the newest handler without listening again', () => {
  const first = jest.fn()
  const second = jest.fn()
  const add = jest.spyOn(window, 'addEventListener')
  const { rerender } = renderHook(
    ({ onKey }: { onKey: () => void }) => useWebKey('Escape', onKey),
    {
      initialProps: { onKey: first },
    },
  )
  const listens = add.mock.calls.filter(([type]) => type === 'keydown').length

  rerender({ onKey: second })
  press('Escape')

  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(listens)
  add.mockRestore()
})

it('stops listening when the screen goes away', () => {
  const onKey = jest.fn()
  const { unmount } = renderHook(() => useWebKey('Escape', onKey))

  unmount()
  press('Escape')

  expect(onKey).not.toHaveBeenCalled()
})
