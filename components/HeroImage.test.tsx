import { Motion } from '@rootnative/inertia'
import { Animated } from '@rootnative/inertia/reanimated'
import { render } from '@testing-library/react-native'

/**
 * A guard for the trap that broke the detail-screen parallax.
 *
 * `Motion.*` primitives take a plain, non-animated fast path when no motion
 * prop (`animate` / `initial` / `gesture` / ...) is present. `style` is
 * deliberately not one of them. So a component that drives its own animated
 * style from `useInterpolatedStyle` and passes it only through `style` gets
 * the plain host, and the animation silently does nothing — no error, no
 * warning, just a static element.
 *
 * app/movie/[id].tsx therefore renders the hero with Reanimated's
 * `Animated.Image` from the interop subpath, and keeps `Motion.*` for the
 * declarative `animate` / `gesture` flow.
 *
 * The assertions below compare the two hosts through the rendered tree, so
 * they track what the library actually does rather than restating a list.
 */
describe('the Motion plain-path rule', () => {
  it('renders a different host for style-only and animated Motion.Image', () => {
    // Style-only: no motion prop, so this takes the plain path.
    const plain = render(<Motion.Image source={{ uri: 'x' }} style={{ opacity: 1 }} />)
    const plainTree = JSON.stringify(plain.toJSON())

    // The same element with a motion prop takes the animated path.
    const animated = render(
      <Motion.Image
        source={{ uri: 'x' }}
        style={{ opacity: 1 }}
        animate={{ opacity: 1 }}
      />,
    )
    const animatedTree = JSON.stringify(animated.toJSON())

    // If these ever match, `style` alone became enough to animate and the hero
    // could move back to Motion.Image.
    expect(plainTree).not.toEqual(animatedTree)
  })

  it('exposes Animated.Image, the host the hero parallax depends on', () => {
    // The hero passes a `useInterpolatedStyle` result straight to `style`, so
    // it needs a host that reads an animated style without a motion prop.
    expect(Animated.Image).toBeDefined()

    const tree = render(<Animated.Image source={{ uri: 'x' }} style={{ opacity: 1 }} />)
    expect(tree.toJSON()).toBeTruthy()
  })

  it('still exposes the Motion primitives the declarative components use', () => {
    // MovieCard and CarouselCard drive `gesture` / `animate`, so they stay on
    // Motion.*. If these disappear those components break.
    expect(Motion.View).toBeDefined()
    expect(Motion.Pressable).toBeDefined()
    expect(Motion.ScrollView).toBeDefined()
  })
})
