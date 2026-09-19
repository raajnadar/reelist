import { embedPage, embedUrl, PLAYER_ORIGIN, watchUrl } from './youtube'

/**
 * The two URLs the player screen builds.
 *
 * The parameters are the whole behaviour here: an embed with none of them is a
 * web page that plays nothing until the reader presses play a second time, and
 * one of them — `playsinline` — is what keeps the close button reachable on
 * iOS. A dropped parameter breaks the player without failing anything, so each
 * one is named here rather than matched as a whole string.
 */

const KEY = 'Way9Dexny3w'

describe('embedUrl', () => {
  it('points at the embed player for the key', () => {
    expect(embedUrl(KEY)).toContain(`https://www.youtube.com/embed/${KEY}?`)
  })

  it.each([
    ['autoplay=1', 'starts the video the reader already asked for'],
    ['playsinline=1', 'keeps iOS from taking the video fullscreen'],
    ['rel=0', 'holds the end suggestions to the same channel'],
  ])('carries %s, which %s', (param) => {
    expect(embedUrl(KEY)).toContain(param)
  })
})

describe('watchUrl', () => {
  it('points at the YouTube watch page for the key', () => {
    expect(watchUrl(KEY)).toBe(`https://www.youtube.com/watch?v=${KEY}`)
  })
})

/**
 * The key arrives from a route parameter, so a deep link controls it. An
 * unencoded value would let that link add a path segment or a parameter of its
 * own to the URL the player loads.
 */
describe('a key that is not a plain video id', () => {
  it('cannot add a path segment to the embed url', () => {
    expect(embedUrl('../../evil')).toBe(
      'https://www.youtube.com/embed/..%2F..%2Fevil?autoplay=1&playsinline=1&rel=0',
    )
  })

  it('cannot add a parameter to the watch url', () => {
    expect(watchUrl('abc&foo=bar')).toBe(
      'https://www.youtube.com/watch?v=abc%26foo%3Dbar',
    )
  })
})

/**
 * The page the native player loads.
 *
 * It exists because YouTube refuses an embed request with no referrer and
 * reports that inside the frame as error 153: the video never plays, and
 * nothing throws. A web view sent straight to the embed URL makes it the
 * top-level document, which has no referrer to send. The iframe here has a
 * parent page, and the player gives that page a YouTube `baseUrl`.
 */
describe('embedPage', () => {
  it('holds the embed in an iframe rather than navigating to it', () => {
    const page = embedPage(KEY)

    expect(page).toContain('<iframe')
    expect(page).toContain(`/embed/${KEY}`)
  })

  // Without this the browser refuses the `autoplay=1` the URL asks for: a
  // cross-origin frame is granted a feature by its parent.
  it('grants the frame autoplay and fullscreen', () => {
    expect(embedPage(KEY)).toContain('allow="autoplay; encrypted-media; fullscreen')
  })

  // An HTML attribute takes `&amp;`, and a bare `&` is what a parser may read
  // as the start of an entity. Every parameter after the first rides on one.
  it('writes the parameter separators as entities', () => {
    const page = embedPage(KEY)

    expect(page).toContain('autoplay=1&amp;playsinline=1&amp;rel=0')
    expect(page).not.toContain('autoplay=1&playsinline=1')
  })

  // The key is percent-encoded by embedUrl, so a deep link cannot close the
  // attribute and write markup of its own into the page.
  it('cannot be broken out of by a key carrying markup', () => {
    const page = embedPage('" onload="alert(1)')

    expect(page).not.toContain('onload="alert(1)"')
    expect(page).toContain('%22%20onload%3D%22alert(1)')
  })
})

/**
 * The origin the native page claims. It is the referrer YouTube checks, and the
 * two rules on it are the two errors the app met: a missing one is 153, and
 * youtube.com itself is 152.
 */
describe('PLAYER_ORIGIN', () => {
  // The whole point of the value. A YouTube origin is the one thing it cannot
  // be, because an embed of YouTube inside YouTube is what 152 refuses.
  it('is not a youtube origin', () => {
    expect(PLAYER_ORIGIN).not.toContain('youtube.com')
  })

  // A referrer YouTube accepts is a real site over https.
  it('is an https origin with no path and no trailing slash', () => {
    expect(PLAYER_ORIGIN).toMatch(/^https:\/\/[a-z0-9.-]+$/)
  })
})
