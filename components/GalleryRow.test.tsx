import { Motion } from '@rootnative/inertia'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../lib/test-utils'
import { mockImages } from '../lib/mock'
import type { GalleryImage } from '../lib/types'
import { GalleryRow } from './GalleryRow'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

beforeEach(() => {
  mockPush.mockClear()
})

// Inside a Motion.ScrollView, as on the detail screen: the row's in-view
// trigger reads its scroll offset from one, and warns without it.
const renderRow = (images: GalleryImage[]) =>
  renderWithProviders(
    <Motion.ScrollView>
      <GalleryRow movieId={693134} images={images} />
    </Motion.ScrollView>,
  )

it('shows the heading and the number of stills', () => {
  const screen = renderRow(mockImages)

  expect(screen.getByText('Gallery')).toBeTruthy()
  expect(screen.getByText('4 stills')).toBeTruthy()
})

it('counts one still in the singular', () => {
  const screen = renderRow(mockImages.slice(0, 1))

  expect(screen.getByText('1 still')).toBeTruthy()
})

// Absent, not empty: a film with no stills shows no heading above nothing.
it('renders nothing for a film with no stills', () => {
  const screen = renderRow([])

  expect(screen.queryByText('Gallery')).toBeNull()
})

// The viewer is a route, and it opens on the still that was pressed. The
// position travels as a parameter so the viewer needs no state handed over.
it('opens the viewer at the still that was pressed', () => {
  const screen = renderRow(mockImages)

  fireEvent.press(screen.getByLabelText('Still 3 of 4'))

  expect(mockPush).toHaveBeenCalledWith('/gallery/693134?at=2')
})

it('draws one still for each image', () => {
  const screen = renderRow(mockImages)

  expect(screen.getAllByTestId('gallery-still')).toHaveLength(4)
})
