import { Motion } from '@rootnative/inertia'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../lib/test-utils'
import { mockVideos } from '../lib/mock'
import type { Video } from '../lib/types'
import { VideoRow } from './VideoRow'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

beforeEach(() => {
  mockPush.mockClear()
})

const [trailer, teaser] = mockVideos

// Inside a Motion.ScrollView, as on the detail screen: the row's in-view
// trigger reads its scroll offset from one, and warns without it.
const renderRow = (videos: Video[], lead: Video | null = trailer) =>
  renderWithProviders(
    <Motion.ScrollView>
      <VideoRow title="Dune: Part Two" videos={videos} trailer={lead} />
    </Motion.ScrollView>,
  )

it('shows the heading and the number of videos', () => {
  const screen = renderRow(mockVideos)

  expect(screen.getByText('Videos')).toBeTruthy()
  expect(screen.getByText('3 videos')).toBeTruthy()
})

it('names each video and its type', () => {
  const screen = renderRow(mockVideos)

  expect(screen.getAllByTestId('video-card')).toHaveLength(3)
  expect(screen.getByText('Paul and Chani')).toBeTruthy()
  expect(screen.getByText('Clip')).toBeTruthy()
})

it('renders nothing for a film with no videos', () => {
  const screen = renderRow([], null)

  expect(screen.queryByText('Videos')).toBeNull()
})

// The trailer button above the row already plays that one video.
it('renders nothing when the only video is the trailer', () => {
  const screen = renderRow([trailer])

  expect(screen.queryByText('Videos')).toBeNull()
})

// A film with a teaser and no trailer has no button, so the row is the only
// way to the teaser.
it('shows one video that is not the trailer', () => {
  const screen = renderRow([teaser], null)

  expect(screen.getByText('1 video')).toBeTruthy()
})

// The same player route as the trailer button, with the film title for the bar.
it('opens the player for the video that was pressed', () => {
  const screen = renderRow(mockVideos)

  fireEvent.press(screen.getByLabelText('Play Official Teaser. Teaser'))

  expect(mockPush).toHaveBeenCalledWith(
    `/trailer/${teaser.key}?title=${encodeURIComponent('Dune: Part Two')}`,
  )
})
