import { fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { mockPerson } from '../lib/mock'
import { renderWithProviders } from '../lib/test-utils'
import type { PersonDetail } from '../lib/types'
import { PersonProfile } from './PersonProfile'

const person: PersonDetail = mockPerson

const render = (overrides: Partial<PersonDetail> = {}) =>
  renderWithProviders(
    <PersonProfile person={{ ...person, ...overrides }} photoWidth={120} wide={false} />,
  )

describe('the photo', () => {
  /**
   * The large profile size, not the `w185` the cast card uses. This is the one
   * picture the screen is built around, and the card size is visibly soft at
   * this width.
   */
  it('builds the TMDB url at the large profile size', () => {
    const screen = render()

    // `source` arrives as an array: expo-image normalises a single source into
    // the list it selects from at render.
    expect(screen.getByTestId('person-photo').props.source).toEqual([
      { uri: `https://image.tmdb.org/t/p/h632${person.profile_path}` },
    ])
  })

  // The same regression the cards guard against: a remote picture has no
  // measurable size until it loads, so an image with no width lays out at zero.
  it('gives the image a real size, not a zero-height box', () => {
    const screen = render()

    const style = StyleSheet.flatten(screen.getByTestId('person-photo').props.style)

    expect(style.width).toBe(120)
    expect(style.aspectRatio).toBe(2 / 3)
  })

  // TMDB has no photo on file for many of the people it lists, so this is the
  // common case rather than an edge one.
  it('draws no picture for a person with no photo', () => {
    const screen = render({ profile_path: null })

    expect(screen.queryByTestId('person-photo')).toBeNull()
    // The rest of the profile still stands.
    expect(screen.getByText(person.name)).toBeTruthy()
  })
})

describe('the facts line', () => {
  it('joins the department and the years', () => {
    const screen = render()

    expect(screen.getByTestId('person-facts')).toHaveTextContent('Acting · Born 1995')
  })

  it('shows the department alone when TMDB holds no dates', () => {
    const screen = render({ birthday: '', deathday: '' })

    expect(screen.getByTestId('person-facts')).toHaveTextContent('Acting')
  })

  /**
   * Both parts are absent for a person TMDB holds little on. The line is then
   * absent too, rather than a separator printed around nothing.
   */
  it('draws no line at all when neither part is known', () => {
    const screen = render({ birthday: '', deathday: '', known_for_department: '' })

    expect(screen.queryByTestId('person-facts')).toBeNull()
  })

  it('drops the birthplace TMDB does not hold', () => {
    const screen = render({ place_of_birth: '' })

    expect(screen.queryByText(person.place_of_birth)).toBeNull()
  })
})

describe('the biography', () => {
  // Long enough to cross the fold threshold, in the same shape a TMDB
  // biography arrives in.
  const longBiography = 'He acted. '.repeat(60)

  it('shows the text TMDB sends', () => {
    const screen = render()

    expect(screen.getByTestId('person-biography')).toHaveTextContent(person.biography)
  })

  // TMDB sends an empty biography for a person it holds no text on in the
  // requested language, which is most of the people it lists.
  it('reports an empty biography rather than leaving a gap', () => {
    const screen = render({ biography: '' })

    expect(screen.getByText('No biography yet.')).toBeTruthy()
    expect(screen.queryByTestId('person-biography')).toBeNull()
  })

  it('folds a long biography', () => {
    const screen = render({ biography: longBiography })

    expect(screen.getByTestId('person-biography').props.numberOfLines).toBe(6)
    expect(screen.getByText('Show more')).toBeTruthy()
  })

  it('unfolds it on a press, and folds it again', () => {
    const screen = render({ biography: longBiography })

    fireEvent.press(screen.getByText('Show more'))

    expect(screen.getByTestId('person-biography').props.numberOfLines).toBeUndefined()

    fireEvent.press(screen.getByText('Show less'))

    expect(screen.getByTestId('person-biography').props.numberOfLines).toBe(6)
  })

  /**
   * A "Show more" under three sentences would promise text that is already on
   * screen, so the control is absent rather than disabled.
   */
  it('offers no control for a short biography', () => {
    const screen = render()

    expect(screen.queryByText('Show more')).toBeNull()
    expect(screen.getByTestId('person-biography').props.numberOfLines).toBeUndefined()
  })
})
