import { BrandMark } from './BrandMark'
import { renderWithProviders } from '../lib/test-utils'

/**
 * The mark is drawn by masking holes out of a filled circle, and a mask is
 * reached by id. These tests are about that id, because getting it wrong does
 * not throw: the mask silently fails to apply and the mark renders as a plain
 * filled circle, with no reel holes and no play button.
 *
 * `react-native-svg` normalises what the component writes — the `id` on the
 * mask arrives as `name`, and the `url(#...)` on the circle arrives as the
 * bare id — so the two are compared in that form.
 */

/** The declared mask ids, and the ids the shapes point at, in render order. */
function references(tree: unknown): { declared: string[]; used: string[] } {
  const declared: string[] = []
  const used: string[] = []

  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return

    const { type, props, children } = node as {
      type?: string
      props?: Record<string, unknown>
      children?: unknown
    }
    if (type === 'RNSVGMask' && typeof props?.name === 'string') declared.push(props.name)
    if (typeof props?.mask === 'string') used.push(props.mask)
    if (children) walk(children)
  }

  walk(tree)
  return { declared, used }
}

it('points the circle at the mask it just declared', () => {
  const screen = renderWithProviders(<BrandMark />)
  const { declared, used } = references(screen.toJSON())

  expect(declared).toHaveLength(1)
  expect(used).toEqual(declared)
})

it('gives each mark on screen its own mask id', () => {
  // Two marks in one document is the case that broke. On the web a mask is
  // resolved by `url(#...)` across the whole DOM, so a shared id points the
  // second mark at the first mark's mask. A navigator that hides the screen
  // holding the first one then leaves the visible mark unmasked.
  const screen = renderWithProviders(
    <>
      <BrandMark size={26} />
      <BrandMark size={34} />
    </>,
  )
  const { declared, used } = references(screen.toJSON())

  expect(declared).toHaveLength(2)
  expect(new Set(declared).size).toBe(2)
  // Each circle takes the mask declared beside it, not the other one.
  expect(used).toEqual(declared)
})

it('keeps the id usable inside a url() reference', () => {
  // React has emitted ids containing colons, which are legal in an id and not
  // in the reference that reads it. The web build writes the reference form.
  const screen = renderWithProviders(<BrandMark />)

  expect(references(screen.toJSON()).declared[0]).not.toContain(':')
})
