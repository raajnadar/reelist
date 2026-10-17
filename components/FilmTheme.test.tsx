import { mdiResolver } from '@rootnative/components/mdi'
import {
  ThemeProvider,
  useIconResolver,
  useTheme,
  useThemeMode,
  type ThemeMode,
} from '@rootnative/core'
import { createMaterialTheme } from '@rootnative/core/create-theme'
import { MotionConfig, useMotionConfig } from '@rootnative/inertia'
import { act, render } from '@testing-library/react-native'
import { useEffect, type ReactNode } from 'react'
import { transitions } from '../lib/motion'
import { darkTheme, lightTheme } from '../theme'
import { FilmTheme } from './FilmTheme'

/**
 * The film page sits under a second ThemeProvider. These tests check what the
 * page gets from that provider, and what it must still get from the root one.
 */

const SEED = '#1E3A8A'
const film = createMaterialTheme(SEED)

type Seen = {
  primary: string
  scheme: string
  hasIcons: boolean
  hasPress: boolean
}

let seen: Seen
let mounts = 0

function Probe() {
  const theme = useTheme()
  const { scheme } = useThemeMode()
  const iconResolver = useIconResolver()
  const motion = useMotionConfig()

  useEffect(() => {
    seen = {
      primary: theme.colors.primary,
      scheme,
      hasIcons: iconResolver !== null,
      hasPress: 'press' in motion.transitions,
    }
  })

  useEffect(() => {
    mounts += 1
  }, [])

  return null
}

/** The providers app/_layout.tsx puts above every screen. */
function Root({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  return (
    <ThemeProvider
      theme={{ light: lightTheme, dark: darkTheme }}
      mode={mode}
      iconResolver={mdiResolver}
    >
      <MotionConfig transitions={transitions}>{children}</MotionConfig>
    </ThemeProvider>
  )
}

beforeEach(() => {
  mounts = 0
})

it('gives the page the theme of the poster colour', () => {
  render(
    <Root mode="light">
      <FilmTheme seed={SEED}>
        <Probe />
      </FilmTheme>
    </Root>,
  )

  expect(seen.primary).toBe(film.lightTheme.colors.primary)
  expect(seen.primary).not.toBe(lightTheme.colors.primary)
})

it('keeps the app theme for a film with no colour', () => {
  render(
    <Root mode="light">
      <FilmTheme seed={null}>
        <Probe />
      </FilmTheme>
    </Root>,
  )

  expect(seen.primary).toBe(lightTheme.colors.primary)
})

// The reader picks the mode on the about screen, and the root provider holds
// it. A nested pair with no mode of its own would follow the OS instead.
it('follows the mode of the root provider', () => {
  render(
    <Root mode="dark">
      <FilmTheme seed={SEED}>
        <Probe />
      </FilmTheme>
    </Root>,
  )

  expect(seen.scheme).toBe('dark')
  expect(seen.primary).toBe(film.darkTheme.colors.primary)
})

// A provider with no `iconResolver` resets it to null, and a string icon then
// draws nothing.
it('passes the icon resolver of the root provider down', () => {
  render(
    <Root mode="light">
      <FilmTheme seed={SEED}>
        <Probe />
      </FilmTheme>
    </Root>,
  )

  expect(seen.hasIcons).toBe(true)
})

// The provider adds a MotionConfig of its own. The app names must survive it.
it('keeps the named transitions of the app', () => {
  render(
    <Root mode="light">
      <FilmTheme seed={SEED}>
        <Probe />
      </FilmTheme>
    </Root>,
  )

  expect(seen.hasPress).toBe(true)
})

// The colour arrives with the film, after the skeleton drew. A remount there
// would cut the skeleton exit and reset the header.
it('does not remount the page when the colour arrives', () => {
  const tree = render(
    <Root mode="light">
      <FilmTheme seed={null}>
        <Probe />
      </FilmTheme>
    </Root>,
  )

  act(() => {
    tree.rerender(
      <Root mode="light">
        <FilmTheme seed={SEED}>
          <Probe />
        </FilmTheme>
      </Root>,
    )
  })

  expect(seen.primary).toBe(film.lightTheme.colors.primary)
  expect(mounts).toBe(1)
})
