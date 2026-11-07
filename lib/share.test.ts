import { Platform, Share } from 'react-native'
import { mockMovieDetail, mockMovies } from './mock'
import {
  copyMovieLink,
  copyShareMessage,
  hasShareSheet,
  movieUrl,
  shareMessage,
  shareMovie,
  shareNote,
  shareTargets,
  shareTitle,
} from './share'
import { SITE_URL } from './site'

const [dune] = mockMovies

const FOUND = 'Reelist put this on my radar:'
const FULL = [
  '🎬 Dune: Part Two (2024)',
  '★ 8.2 · 2h 47m · Science Fiction, Adventure',
  '"Long live the fighters."',
  '',
  FOUND,
].join('\n')

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

describe('shareNote', () => {
  it('names what the reader did, and ranks watched over saved', () => {
    expect(shareNote(dune.id)).toBe(FOUND)
    expect(shareNote(dune.id, { saved: true })).toBe(
      'Saved this one on Reelist. Watch it with me?',
    )
    expect(shareNote(dune.id, { saved: true, watched: true })).toBe(
      'I watched this on Reelist. Your turn:',
    )
  })

  it('picks the line by the film id, so two films do not always read the same', () => {
    expect(shareNote(1)).not.toBe(shareNote(2))
    expect(shareNote(1)).toBe(shareNote(1))
  })
})

describe('shareMessage', () => {
  it('gives the title, the facts, the tagline, and the note', () => {
    expect(shareMessage(mockMovieDetail)).toBe(FULL)
  })

  it('drops the lines a list film cannot fill', () => {
    expect(shareMessage(dune)).toBe(`🎬 Dune: Part Two (2024)\n★ 8.2\n\n${FOUND}`)
  })

  it('drops the facts line for an unrated film with no cut and no genres', () => {
    expect(
      shareMessage({ ...dune, vote_average: 0, runtime: 0, genres: [], tagline: '' }),
    ).toBe(`🎬 Dune: Part Two (2024)\n\n${FOUND}`)
  })
})

describe('shareMovie', () => {
  it('sends the message and the link in the url field on iOS', async () => {
    shareSpy.mockResolvedValue({ action: Share.sharedAction, activityType: undefined })

    const outcome = await shareMovie(mockMovieDetail)

    expect(outcome).toBe('shared')
    expect(shareSpy).toHaveBeenCalledWith(
      { message: FULL, url: movieUrl(dune.id) },
      expect.objectContaining({ dialogTitle: 'Dune: Part Two (2024)' }),
    )
  })

  it('appends the link to the message on Android, which reads no url field', async () => {
    const os = Platform.OS
    Platform.OS = 'android'
    shareSpy.mockResolvedValue({ action: Share.sharedAction, activityType: undefined })

    await shareMovie(mockMovieDetail)

    Platform.OS = os
    expect(shareSpy).toHaveBeenCalledWith(
      { message: `${FULL}\n${movieUrl(dune.id)}` },
      expect.anything(),
    )
  })

  it('reports a dismissed sheet', async () => {
    shareSpy.mockResolvedValue({ action: Share.dismissedAction, activityType: undefined })

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

describe('copyShareMessage', () => {
  it('puts the message and the link on the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    })

    expect(await copyShareMessage(mockMovieDetail)).toBe(true)
    expect(writeText).toHaveBeenCalledWith(`${FULL}\n${movieUrl(dune.id)}`)
  })
})

describe('shareTargets', () => {
  const targets = shareTargets(mockMovieDetail)
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

  it('gives X a short post, and email the whole message', () => {
    const title = encodeURIComponent('Dune: Part Two (2024)')
    const post = encodeURIComponent(
      'Dune: Part Two (2024)\n"Long live the fighters."\nvia Reelist',
    )
    expect(byId('x').url).toContain(`text=${post}`)
    expect(byId('email').url).toContain(`subject=${title}`)
    expect(byId('email').url).toContain(
      `body=${encodeURIComponent(`${FULL}\n${movieUrl(dune.id)}`)}`,
    )
  })

  it('opens a mail draft for the email target', () => {
    expect(byId('email').url).toMatch(/^mailto:\?/)
  })
})
