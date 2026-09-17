import { fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import type { CastMember } from '../lib/types'
import { CastCard } from './CastCard'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

beforeEach(() => {
  mockPush.mockClear()
})

const member: CastMember = {
  id: 819,
  name: 'Edward Norton',
  character: 'The Narrator',
  profile_path: '/face.jpg',
}

describe('the photo', () => {
  it('builds the TMDB url at the profile size', () => {
    const screen = renderWithProviders(<CastCard member={member} />)

    // `source` arrives as an array: expo-image normalises a single source
    // into the list it selects from at render.
    expect(screen.getByTestId('cast-photo').props.source).toEqual([
      { uri: 'https://image.tmdb.org/t/p/w185/face.jpg' },
    ])
  })

  /**
   * The same regression MovieCard guards against. A remote picture has no measurable
   * size until it loads, so an image with no width and height lays out at
   * zero and the photo never appears.
   */
  it('gives the image a real size, not a zero-height box', () => {
    const screen = renderWithProviders(<CastCard member={member} />)

    const style = StyleSheet.flatten(screen.getByTestId('cast-photo').props.style)

    expect(style.width).toBe('100%')
    expect(style.aspectRatio).toBe(2 / 3)
  })

  // TMDB has no photo on file for many of the people it bills, so this is the
  // common case rather than an edge one.
  // The same guard MovieCard carries: the cast row recycles its views too, and
  // a stale photo under the right name is worse than a blank box.
  it('keys the photo to the person, so a recycled card cannot show the last one', () => {
    const screen = renderWithProviders(<CastCard member={member} />)

    expect(screen.getByTestId('cast-photo').props.recyclingKey).toBe(String(member.id))
  })

  it('shows the fallback when the person has no photo', () => {
    const screen = renderWithProviders(
      <CastCard member={{ ...member, profile_path: null }} />,
    )

    expect(screen.getByText('No photo')).toBeTruthy()
    expect(screen.queryByTestId('cast-photo')).toBeNull()
  })
})

describe('the text', () => {
  it('shows the name and the character', () => {
    const screen = renderWithProviders(<CastCard member={member} />)

    expect(screen.getByText('Edward Norton')).toBeTruthy()
    expect(screen.getByText('The Narrator')).toBeTruthy()
  })

  /**
   * Both lines reserve their height, so a row of cards keeps one bottom edge.
   * The name is compared against a longer name rather than a number, so the
   * check survives a change to the type scale.
   */
  it('reserves the same name height for a short and a long name', () => {
    const short = renderWithProviders(<CastCard member={member} />)
    const shortHeight = StyleSheet.flatten(
      short.getByText('Edward Norton').props.style,
    ).height

    short.unmount()

    const longName = 'Helena Bonham Carter de Something Else'
    const long = renderWithProviders(<CastCard member={{ ...member, name: longName }} />)
    const longHeight = StyleSheet.flatten(long.getByText(longName).props.style).height

    expect(shortHeight).toBe(longHeight)
    expect(shortHeight).toBeGreaterThan(0)
  })

  /**
   * TMDB sends an empty character for an uncredited part, and an empty
   * Typography collapses to nothing. Without a reserved height that card would
   * stand one line shorter than the card beside it.
   */
  it('reserves the character height even with no character', () => {
    const named = renderWithProviders(<CastCard member={member} />)
    const namedHeight = StyleSheet.flatten(
      named.getByTestId('cast-character').props.style,
    ).height

    named.unmount()

    const blank = renderWithProviders(<CastCard member={{ ...member, character: '' }} />)
    const blankHeight = StyleSheet.flatten(
      blank.getByTestId('cast-character').props.style,
    ).height

    expect(blankHeight).toBe(namedHeight)
    expect(blankHeight).toBeGreaterThan(0)
  })
})

describe('the press', () => {
  it('opens the person screen', () => {
    const screen = renderWithProviders(<CastCard member={member} />)

    fireEvent.press(screen.getByText('Edward Norton'))

    expect(mockPush).toHaveBeenCalledWith(`/person/${member.id}`)
  })

  /**
   * The two lines under the photo are read together, so the label carries
   * both. A screen reader that announced the name alone would drop the reason
   * this person is on the film's screen.
   */
  it('announces the name and the role together', () => {
    const screen = renderWithProviders(<CastCard member={member} />)

    expect(screen.getByLabelText('Edward Norton. The Narrator')).toBeTruthy()
  })

  // TMDB sends an empty character for an uncredited part. The label must not
  // end in a stray full stop with nothing after it.
  it('announces the name alone for an uncredited part', () => {
    const screen = renderWithProviders(<CastCard member={{ ...member, character: '' }} />)

    expect(screen.getByLabelText('Edward Norton')).toBeTruthy()
  })
})
