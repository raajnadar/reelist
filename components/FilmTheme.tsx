import { ThemeProvider, type Theme } from '@rootnative/core'
import { createMaterialTheme } from '@rootnative/core/create-theme'
import { useMemo, type ReactNode } from 'react'
import { darkTheme, lightTheme } from '../theme'

type ThemePair = { light: Theme; dark: Theme }

const APP_THEMES: ThemePair = { light: lightTheme, dark: darkTheme }

/**
 * The light and the dark theme for one poster colour, or the app themes when
 * the film has no colour.
 */
export function filmThemes(seed: string | null): ThemePair {
  if (!seed) return APP_THEMES
  const { lightTheme: light, darkTheme: dark } = createMaterialTheme(seed)
  return { light, dark }
}

type Props = {
  /** The main colour of the poster, as `#rrggbb`. Null keeps the app colours. */
  seed: string | null
  children: ReactNode
}

/**
 * Paints one film page in the colour of its poster.
 *
 * It is a second `ThemeProvider` inside the root one. Since core alpha.28 a
 * nested provider takes the mode, the icon resolver and the motion config of
 * its parent, so only `theme` is set here. The tests pin that the mode the
 * reader chose and the string icons reach the page.
 *
 * The provider is there before the film loads too, with the app themes. A
 * provider that appeared only when the colour arrived would change the shape
 * of the tree, and React would remount the whole page under it: the skeleton
 * would lose its exit, and the header would lose its scroll value.
 */
export function FilmTheme({ seed, children }: Props) {
  const themes = useMemo(() => filmThemes(seed), [seed])

  return <ThemeProvider theme={themes}>{children}</ThemeProvider>
}
