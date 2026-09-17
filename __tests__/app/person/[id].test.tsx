import { fireEvent, waitFor } from '@testing-library/react-native'
import PersonScreen from '../../../app/person/[id]'
import { MissingProxyUrlError } from '../../../lib/config'
import { mockPerson } from '../../../lib/mock'
import { renderWithProviders } from '../../../lib/test-utils'

// Outside `app/` for the reason movie/[id].test.tsx records: Expo Router builds
// its route table from `require.context('./app')`, so a test file in there
// becomes a route and Metro then bundles the testing library into the app.

// `push` is here for MovieCard, which the filmography grid renders: a card
// opens the film on a press. A mock missing the method throws inside the card
// rather than failing an assertion, so the whole screen renders as nothing.
const mockPush = jest.fn()
// Named, because the failure states offer a way home and the press has to be
// checked: a "Go home" button that calls nothing is a dead end on a deep link.
const mockReplace = jest.fn()
let mockParams: Record<string, string> = { id: '1082047' }

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('../../../lib/api', () => ({
  getPerson: jest.fn(),
}))

const { getPerson } = jest.requireMock('../../../lib/api')

const person = mockPerson

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { id: '1082047' }
  getPerson.mockResolvedValue(person)
})

describe('the person', () => {
  it('shows the profile once it loads', async () => {
    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getByTestId('person-facts')).toBeTruthy())
    expect(screen.getByTestId('person-biography')).toBeTruthy()
    expect(screen.getByText(person.place_of_birth)).toBeTruthy()
  })

  it('asks for the person named in the route', async () => {
    renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(getPerson).toHaveBeenCalledWith(1082047))
  })

  /**
   * The name belongs to the profile, and the bar carries the same name only to
   * reveal it once the profile has scrolled away. Both are in the tree at all
   * times — the bar's copy is transparent until the scroll reaches `revealAt` —
   * so the check is that the screen holds exactly the two, and not a third.
   */
  it('names the person in the profile and in the bar', async () => {
    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getAllByText(person.name)).toHaveLength(2))
  })

  // The bar has no name to reveal until the request lands, and an empty title
  // draws nothing.
  it('leaves the bar unnamed while the person loads', () => {
    const screen = renderWithProviders(<PersonScreen />)

    expect(screen.queryByText(person.name)).toBeNull()
  })

  it('shows the filmography under a heading', async () => {
    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getByText('Films')).toBeTruthy())
    expect(screen.getByText(person.credits[0].title)).toBeTruthy()
  })

  it('opens a film from the grid', async () => {
    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getByText(person.credits[0].title)).toBeTruthy())

    fireEvent.press(screen.getByText(person.credits[0].title))

    expect(mockPush).toHaveBeenCalledWith(`/movie/${person.credits[0].id}`)
  })

  /**
   * The screen is not empty when the filmography is: it has a profile on it.
   * The centred block the other screens use for an empty result would report
   * the whole screen as nothing, so the line goes where the heading would be.
   */
  it('reports an empty filmography in place of the heading', async () => {
    getPerson.mockResolvedValue({ ...person, credits: [] })

    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getByTestId('person-no-films')).toBeTruthy())
    expect(screen.queryByText('Films')).toBeNull()
    // The profile is still drawn.
    expect(screen.getByTestId('person-biography')).toBeTruthy()
  })
})

describe('the failure state', () => {
  it('offers a retry that asks again', async () => {
    getPerson.mockRejectedValueOnce(new Error('TMDB is unavailable'))
    getPerson.mockResolvedValue(person)

    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() =>
      expect(screen.getByText('Could not load the person')).toBeTruthy(),
    )
    expect(screen.getByText('TMDB is unavailable')).toBeTruthy()

    fireEvent.press(screen.getByText('Try again'))

    await waitFor(() => expect(screen.getByTestId('person-biography')).toBeTruthy())
    expect(getPerson).toHaveBeenCalledTimes(2)
  })

  // Same reason as the other screens: the fix is a file on disk and a restart,
  // and a second request cannot apply it.
  it('offers no retry for a setup mistake', async () => {
    getPerson.mockRejectedValue(new MissingProxyUrlError())

    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getByText('Setup needed')).toBeTruthy())
    expect(screen.queryByText('Try again')).toBeNull()
  })

  /**
   * A 404 is `null` from lib/api.ts, not a rejection: the id parsed and the
   * request succeeded, so a retry would return the same nothing. The screen
   * offers the way out instead.
   */
  it('reports an id TMDB has nobody for, and offers a way home', async () => {
    getPerson.mockResolvedValue(null)

    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() => expect(screen.getByText('Person not found')).toBeTruthy())
    expect(screen.getByText('TMDB has nobody with that id.')).toBeTruthy()
    expect(screen.queryByText('Try again')).toBeNull()

    fireEvent.press(screen.getByText('Go home'))

    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  /**
   * A route parameter comes from an untrusted source: a deep link can carry
   * anything. A bad id must not reach the data layer at all.
   */
  it.each(['abc', '0', '-3', ''])('refuses the invalid id %p', async (id) => {
    mockParams = { id }

    const screen = renderWithProviders(<PersonScreen />)

    await waitFor(() =>
      expect(screen.getByText('That link does not point at a person.')).toBeTruthy(),
    )
    expect(getPerson).not.toHaveBeenCalled()
  })
})
