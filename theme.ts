import type { Theme } from '@rootnative/core'
import { createMaterialTheme } from '@rootnative/core/create-theme'

/**
 * `content` keeps the seed as the dark `primaryContainer`; the default
 * `tonalSpot` lowers the chroma and leaves only a muted maroon.
 *
 * The film pages keep the spec surfaces: the poster colour tints them, and
 * that tint is the point.
 */
export const FILM_SCHEME_OPTIONS = { variant: 'content' } as const

/** The app theme adds neutral surfaces, which drop the red tint from the dark greys. */
export const SCHEME_OPTIONS = { ...FILM_SCHEME_OPTIONS, surfaceTone: 'neutral' } as const

const SEED = '#BE123C'

const generated = createMaterialTheme(SEED, SCHEME_OPTIONS)

/**
 * `content` builds the secondary roles from the primary palette, so a tonal
 * button or a chip is the same pink as the primary. The muted rose that
 * `tonalSpot` gives the secondary roles reads better next to it.
 */
const muted = createMaterialTheme(SEED, { ...SCHEME_OPTIONS, variant: 'tonalSpot' })

/**
 * The navigation bar, rail, and drawer keep the red tint that the neutral
 * surfaces drop. The page is neutral, so the tint separates the navigation
 * from the page without a dividing line.
 */
const tinted = createMaterialTheme(SEED, { variant: 'tonalSpot' })

export const NAVIGATION_CONTAINER = {
  light: tinted.lightTheme.colors.surfaceContainer,
  dark: tinted.darkTheme.colors.surfaceContainer,
} as const

const secondaryRoles = (colors: Theme['colors']): Partial<Theme['colors']> =>
  Object.fromEntries(Object.entries(colors).filter(([role]) => /secondary/i.test(role)))

export const lightTheme: Theme = {
  ...generated.lightTheme,
  colors: { ...generated.lightTheme.colors, ...secondaryRoles(muted.lightTheme.colors) },
}

/**
 * Material puts the dark primary at tone 80, which is a pale pink for this
 * hue. The app uses a stronger red instead. It keeps 4.5:1 on the highest
 * dark surface, and `onPrimary` keeps 5.8:1 on it.
 */
export const darkTheme: Theme = {
  ...generated.darkTheme,
  colors: {
    ...generated.darkTheme.colors,
    ...secondaryRoles(muted.darkTheme.colors),
    primary: '#FB7185',
    onPrimary: '#4C0519',
  },
}
