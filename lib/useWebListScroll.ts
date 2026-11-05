import { useEffect, useEffectEvent } from 'react'
import { Platform } from 'react-native'

/** How long the list must keep still before it counts as at rest. */
const REST_MS = 150

const SNAP = 'x mandatory'

type List = { getScrollableNode(): unknown }

type Handlers = {
  /** Told true when a finger touches the list, and false when the last finger leaves. */
  onTouch: (down: boolean) => void
  /** Told when a wheel or a trackpad moves the list. */
  onWheel: () => void
  /** Told true when the list starts to move, and false when it keeps still for REST_MS. */
  onMoving: (moving: boolean) => void
}

const scrollNode = (list: List | null) => {
  if (Platform.OS !== 'web') return null
  const node = list?.getScrollableNode()
  return node instanceof HTMLElement ? node : null
}

/**
 * The scroll events that react-native-web does not give a horizontal list,
 * and the CSS snap that stands in for `snapToInterval`, which it ignores.
 *
 * The touch events stand in for `onScrollBeginDrag` and `onScrollEndDrag`.
 * `onMoving` is the only way to know that the list is at rest. A scroll of
 * the code counts the same as a scroll of the reader.
 *
 * Each slot of the list must be a snap area, with `scrollSnapAlign`. The list
 * snaps while the reader moves it. Call `releaseSnap` before the code moves
 * the list.
 *
 * The snap is off when the list mounts, and comes on when the list first
 * rests. The list scrolls to `initialScrollIndex` after this effect, and
 * mounts the slots on the left of it as it goes. WebKit re-snaps after each
 * layout to the snap area with the index it holds, so a slot that mounts on
 * the left moves the list to the slot before, which mounts another, and the
 * list runs away until a touch. Chromium follows the snapped element, not
 * its index, and never showed this.
 *
 * `mounted` is false while the list is not on the page.
 */
export function useWebListScroll(
  list: { current: List | null },
  mounted: boolean,
  handlers: Handlers,
) {
  const onTouch = useEffectEvent(handlers.onTouch)
  const onWheel = useEffectEvent(handlers.onWheel)
  const onMoving = useEffectEvent(handlers.onMoving)

  useEffect(() => {
    const node = mounted ? scrollNode(list.current) : null
    if (!node) return
    node.style.scrollSnapType = 'none'

    let rest: ReturnType<typeof setTimeout> | undefined
    const touchStart = () => {
      node.style.scrollSnapType = SNAP
      onTouch(true)
    }
    const touchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) onTouch(false)
    }
    const wheel = () => {
      node.style.scrollSnapType = SNAP
      onWheel()
    }
    const scroll = () => {
      if (rest === undefined) onMoving(true)
      else clearTimeout(rest)
      rest = setTimeout(() => {
        rest = undefined
        // A scroll of the code is on its slot now, and the slots near it are
        // mounted. A wheel does not wait for its listener, so the snap must be
        // on before the next wheel starts.
        node.style.scrollSnapType = SNAP
        onMoving(false)
      }, REST_MS)
    }

    node.addEventListener('touchstart', touchStart, { passive: true })
    node.addEventListener('touchend', touchEnd)
    node.addEventListener('touchcancel', touchEnd)
    node.addEventListener('wheel', wheel, { passive: true })
    node.addEventListener('scroll', scroll, { passive: true })
    return () => {
      node.removeEventListener('touchstart', touchStart)
      node.removeEventListener('touchend', touchEnd)
      node.removeEventListener('touchcancel', touchEnd)
      node.removeEventListener('wheel', wheel)
      node.removeEventListener('scroll', scroll)
      if (rest !== undefined) {
        clearTimeout(rest)
        onMoving(false)
      }
    }
  }, [list, mounted])
}

/**
 * Turns the snap of `useWebListScroll` off until the list comes to rest, or
 * until the next touch or wheel.
 *
 * A scroll of the code lands on a slot by itself. With the snap on, a jump to
 * a slot that is not mounted yet lands on the nearest slot that is mounted.
 */
export function releaseSnap(list: List | null) {
  const node = scrollNode(list)
  if (node) node.style.scrollSnapType = 'none'
}
