import { entranceTransition, stagger, transitions } from './motion'

describe('stagger', () => {
  it('gives the first item no delay', () => {
    expect(stagger(0)).toBe(0)
  })

  it('increases the delay with the index', () => {
    expect(stagger(2)).toBeGreaterThan(stagger(1))
  })

  it('caps the delay so a long row does not animate for seconds', () => {
    // The cap is the point of the helper: a flat index * step would leave the
    // 20th poster arriving long after the user started scrolling.
    expect(stagger(50)).toBe(stagger(6))
  })
})

describe('entranceTransition', () => {
  it('carries the stagger delay on every animated property', () => {
    const result = entranceTransition(3)

    expect(result.opacity.delay).toBe(stagger(3))
    expect(result.translateY.delay).toBe(stagger(3))
  })

  /**
   * This is the regression guard for the library rule that caused a silent
   * bug: Inertia treats a transition object as a top-level config only when
   * EVERY key is a config field, and as a per-property map otherwise. A
   * component that also declares a `gesture` layer therefore cannot put
   * `type: 'spring'` at the top level — the library reads that string as a
   * transition NAME, fails the registry lookup, and falls back to the default
   * spring, discarding the tuning without an error.
   *
   * Returning a per-property map is what keeps that from happening.
   */
  it('returns a per-property map, not a bare config', () => {
    const result = entranceTransition(0) as Record<string, unknown>

    // A bare config would expose `type` at the top level. This must not.
    expect(result.type).toBeUndefined()
    expect(result).toHaveProperty('opacity')
    expect(result).toHaveProperty('translateY')
  })

  it('uses the registered enter spring for each property', () => {
    const result = entranceTransition(0)

    expect(result.opacity).toMatchObject({
      type: transitions.enter.type,
      tension: transitions.enter.tension,
      friction: transitions.enter.friction,
    })
  })
})
