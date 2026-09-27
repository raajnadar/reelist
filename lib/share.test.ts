import { Platform, Share } from 'react-native'
import { mockMovies } from './mock'
import {
  copyMovieLink,
  hasShareSheet,
  movieUrl,
  shareMovie,
  shareTargets,
  shareTitle,
  SITE_URL,
} from './share'

const [dune] = mockMovies

const shareSpy = jest.spyOn(Share, 'share')

afterEach(() => {
  shareSpy.mockReset()
})

describe('movieUrl', () => {
  it('points at the web build, not the app scheme', () => {
    expect(movieUrl(dune.id)).toBe(`${SITE_URL}/movie/${dune.id}`)
    expect(movieUrl(dune.id)).toMatch(/^https:\/\//)
  })
})

describe('shareTitle', () => {
  it('names the film and the year', () => {
    expect(shareTitle(dune)).toBe('Dune: Part Two (2024)')
  })

  it('drops the year for an announced film with no date', () => {
    expect(shareTitle({ ...dune, release_date: '' })).toBe('Dune: Part Two')
  })
})

describe('shareMovie', () => {
  it('sends the link in the url field on iOS', async () => {
    shareSpy.mockResolvedValue({ action: Share.sharedAction })

    const outcome = await shareMovie(dune)

    expect(outcome).toBe('shared')
    expect(shareSpy).toHaveBeenCalledWith(
      { message: 'Dune: Part Two (2024)', url: movieUrl(dune.id) },
      expect.objectContaining({ dialogTitle: 'Dune: Part Two (2024)' }),
    )
  })

  it('appends the link to the message on Android, which reads no url field', async () => {
    const os = Platform.OS
    Platform.OS = 'android'
    shareSpy.mockResolvedValue({ action: Share.sharedAction })

    await shareMovie(dune)

    Platform.OS = os
    expect(shareSpy).toHaveBeenCalledWith(
      { message: `Dune: Part Two (2024)\n${movieUrl(dune.id)}` },
      expect.anything(),
    )
  })

  it('reports a dismissed sheet', async () => {
    shareSpy.mockResolvedValue({ action: Share.dismissedAction })

    expect(await shareMovie(dune)).toBe('dismissed')
  })

  it('copies the link when the sheet is not available', async () => {
    shareSpy.mockRejectedValue(new Error('Share is not supported in this browser'))
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    })

    const outcome = await shareMovie(dune)

    expect(outcome).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(movieUrl(dune.id))
  })

  it('reports a failure when neither the sheet nor the clipboard exists', async () => {
    shareSpy.mockRejectedValue(new Error('Share is not supported in this browser'))
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })

    expect(await shareMovie(dune)).toBe('failed')
  })
})

describe('hasShareSheet', () => {
  it('is true only when the browser has navigator.share', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: jest.fn() },
      configurable: true,
    })
    expect(hasShareSheet()).toBe(true)

    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
    expect(hasShareSheet()).toBe(false)
  })
})

describe('copyMovieLink', () => {
  it('puts the web link on the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    })

    expect(await copyMovieLink(dune)).toBe(true)
    expect(writeText).toHaveBeenCalledWith(movieUrl(dune.id))
  })

  it('reports a browser that refuses the write', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      },
      configurable: true,
    })

    expect(await copyMovieLink(dune)).toBe(false)
  })
})

describe('shareTargets', () => {
  const targets = shareTargets(dune)
  const byId = (id: string) => targets.find((t) => t.id === id)!

  it('lists the three sites in order', () => {
    expect(targets.map((t) => t.id)).toEqual(['facebook', 'x', 'email'])
  })

  it('encodes the link into every target', () => {
    const encoded = encodeURIComponent(movieUrl(dune.id))
    for (const target of targets) {
      expect(target.url).toContain(encoded)
    }
  })

  it('encodes the title where the site takes one', () => {
    const title = encodeURIComponent('Dune: Part Two (2024)')
    expect(byId('x').url).toContain(`text=${title}`)
    expect(byId('email').url).toContain(`subject=${title}`)
  })

  it('opens a mail draft for the email target', () => {
    expect(byId('email').url).toMatch(/^mailto:\?/)
  })
})
