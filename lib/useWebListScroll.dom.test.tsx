/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react-native'
import { releaseSnap, useWebListScroll } from './useWebListScroll'

// In the DOM project, so `Platform.OS` is `web` and the events are real.

const setup = (mounted = true) => {
  const node = document.createElement('div')
  const list = { current: { getScrollableNode: () => node } }
  const handlers = { onTouch: jest.fn(), onWheel: jest.fn(), onMoving: jest.fn() }
  const hook = renderHook(() => useWebListScroll(list, mounted, handlers))
  return { node, list, handlers, ...hook }
}

const fire = (node: HTMLElement, type: string) =>
  act(() => {
    node.dispatchEvent(type.startsWith('touch') ? new TouchEvent(type) : new Event(type))
  })

// The list scrolls to its first slot after the mount. With the snap on, WebKit
// re-snapped on each slot that mounted, and the list ran away on iOS.
it('snaps the list only once it first rests, and lets the code turn the snap off', () => {
  jest.useFakeTimers()
  const { node, list, unmount } = setup()
  expect(node.style.scrollSnapType).toBe('none')

  fire(node, 'scroll')
  act(() => jest.advanceTimersByTime(150))
  expect(node.style.scrollSnapType).toBe('x mandatory')

  releaseSnap(list.current)

  expect(node.style.scrollSnapType).toBe('none')

  unmount()
  jest.useRealTimers()
})

// The code turns the snap off before a jump to a slot that is not mounted.
// The reader's next scroll must snap again.
it.each(['touchstart', 'wheel'])('snaps again on a %s', (type) => {
  const { node, list } = setup()
  releaseSnap(list.current)

  fire(node, type)

  expect(node.style.scrollSnapType).toBe('x mandatory')
})

// A wheel scrolls before its listener runs, so the snap cannot wait for it.
it('snaps again when a scroll of the code comes to rest', () => {
  jest.useFakeTimers()
  const { node, list, unmount } = setup()
  releaseSnap(list.current)

  fire(node, 'scroll')
  expect(node.style.scrollSnapType).toBe('none')
  act(() => jest.advanceTimersByTime(150))

  expect(node.style.scrollSnapType).toBe('x mandatory')

  // The cleanup of the test library waits on real timers.
  unmount()
  jest.useRealTimers()
})

it('reports a finger that touches the list and leaves it', () => {
  const { node, handlers } = setup()

  fire(node, 'touchstart')
  expect(handlers.onTouch).toHaveBeenLastCalledWith(true)

  fire(node, 'touchend')
  expect(handlers.onTouch).toHaveBeenLastCalledWith(false)
})

it('reports a wheel', () => {
  const { node, handlers } = setup()

  fire(node, 'wheel')

  expect(handlers.onWheel).toHaveBeenCalledTimes(1)
})

// The autoplay must not step while the list is still on its way to a film.
it('reports the list as moving until it keeps still', () => {
  jest.useFakeTimers()
  const { node, handlers, unmount } = setup()

  fire(node, 'scroll')
  act(() => jest.advanceTimersByTime(100))
  fire(node, 'scroll')
  act(() => jest.advanceTimersByTime(100))

  expect(handlers.onMoving.mock.calls).toEqual([[true]])

  act(() => jest.advanceTimersByTime(100))

  expect(handlers.onMoving.mock.calls).toEqual([[true], [false]])

  // The cleanup of the test library waits on real timers.
  unmount()
  jest.useRealTimers()
})

it('does nothing while the list is not on the page', () => {
  const { node, handlers } = setup(false)

  fire(node, 'touchstart')
  fire(node, 'scroll')

  expect(node.style.scrollSnapType).toBe('')
  expect(handlers.onTouch).not.toHaveBeenCalled()
  expect(handlers.onMoving).not.toHaveBeenCalled()
})
