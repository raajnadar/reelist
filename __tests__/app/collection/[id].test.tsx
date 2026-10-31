import { fireEvent, waitFor } from '@testing-library/react-native'
import CollectionScreen from '../../../app/(main)/collection/[id]'
import { MissingProxyUrlError } from '../../../lib/config'
import { mockCollection, mockMovies } from '../../../lib/mock'
import { renderWithProviders } from '../../../lib/test-utils'

// Outside `app/` for the reason movie/[id].test.tsx records: Expo Router builds
// its route table from `require.context('./app')`, so a test file in there
// becomes a route and Metro then bundles the testing library into the app.

// `push` is here for MovieCard, which the grid renders: a card opens the film
// on a press.
const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockParams: Record<string, string> = { id: '726871' }

jest.mock('expo-router', () => ({
  ...jest.requireActual('../../../lib/test-utils').expoRouterMock(() => ({
    push: mockPush,
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  })),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('../../../lib/api', () => ({
  getCollection: jest.fn(),
}))

const { getCollection } = jest.requireMock('../../../lib/api')

// Two parts, so the grid has an order to show.
const collection = { ...mockCollection, parts: [mockMovies[1], mockMovies[0]] }

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { id: '726871' }
  getCollection.mockResolvedValue(collection)
})

it('asks for the collection named in the route, as a number', async () => {
  renderWithProviders(<CollectionScreen />)

  await waitFor(() => expect(getCollection).toHaveBeenCalledWith(726871))
})

/**
 * The name is in the heading and in the bar, which reveals it once the hero
 * has scrolled away. Both are in the tree at all times, so the check is that
 * the screen holds exactly the two.
 */
it('shows the name, the count, the synopsis, and the films', async () => {
  const screen = renderWithProviders(<CollectionScreen />)

  await waitFor(() => expect(screen.getAllByText(collection.name)).toHaveLength(2))
  expect(screen.getByText('2 films')).toBeTruthy()
  expect(screen.getByText(collection.overview)).toBeTruthy()
  expect(screen.getByText(mockMovies[0].title)).toBeTruthy()
  expect(screen.getByText(mockMovies[1].title)).toBeTruthy()
})

it('opens a film from the grid', async () => {
  const screen = renderWithProviders(<CollectionScreen />)

  fireEvent.press(await screen.findByText(mockMovies[0].title))

  expect(mockPush).toHaveBeenCalledWith(`/movie/${mockMovies[0].id}`)
})

it('omits the synopsis for a collection with none', async () => {
  getCollection.mockResolvedValue({ ...collection, overview: '' })

  const screen = renderWithProviders(<CollectionScreen />)

  await waitFor(() => expect(screen.getByText('2 films')).toBeTruthy())
  expect(screen.queryByText(collection.overview)).toBeNull()
})

it('reports an id that matches no collection, and offers a way home', async () => {
  mockParams = { id: '999999' }
  getCollection.mockResolvedValue(null)

  const screen = renderWithProviders(<CollectionScreen />)

  expect(await screen.findByText('TMDB has no collection with that id.')).toBeTruthy()
  fireEvent.press(screen.getByText('Go home'))
  expect(mockReplace).toHaveBeenCalledWith('/')
})

it('rejects a non-numeric id without calling the data layer', async () => {
  mockParams = { id: 'abc' }

  const screen = renderWithProviders(<CollectionScreen />)

  expect(
    await screen.findByText('That link does not point at a collection.'),
  ).toBeTruthy()
  expect(getCollection).not.toHaveBeenCalled()
})

describe('the failure state', () => {
  it('offers a retry that loads the collection again', async () => {
    getCollection.mockRejectedValueOnce(new Error('Network is down'))
    getCollection.mockResolvedValue(collection)

    const screen = renderWithProviders(<CollectionScreen />)

    expect(await screen.findByText('Network is down')).toBeTruthy()
    fireEvent.press(screen.getByText('Try again'))

    await waitFor(() => expect(screen.getByText(collection.overview)).toBeTruthy())
    expect(getCollection).toHaveBeenCalledTimes(2)
  })

  it('offers no retry for a setup mistake', async () => {
    getCollection.mockRejectedValue(new MissingProxyUrlError())

    const screen = renderWithProviders(<CollectionScreen />)

    await waitFor(() => expect(screen.getByText('Setup needed')).toBeTruthy())
    expect(screen.queryByText('Try again')).toBeNull()
  })
})
