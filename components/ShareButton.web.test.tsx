import { fireEvent } from '@testing-library/react-native'
import { Linking, Share } from 'react-native'
import { mockMovieDetail } from '../lib/mock'
import { movieUrl, shareTargets } from '../lib/share'
import { renderWithProviders } from '../lib/test-utils'
// The full file name, because Jest resolves the platform as iOS and would
// otherwise pick the native button. The web menu is what this file covers.
import { ShareButton } from './ShareButton.web'

const movie = mockMovieDetail

const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
const shareSpy = jest.spyOn(Share, 'share')

const setNavigator = (value: object) =>
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true })

beforeEach(() => {
  openSpy.mockClear()
  shareSpy.mockReset()
  setNavigator({})
})

it('lists the clipboard and every site, and no browser sheet without the API', async () => {
  const screen = renderWithProviders(<ShareButton movie={movie} />)

  fireEvent.press(screen.getByTestId('share-button'))

  expect(await screen.findByText('Copy link')).toBeTruthy()
  for (const target of shareTargets(movie)) {
    expect(screen.getByText(target.label)).toBeTruthy()
  }
  expect(screen.queryByText('More apps')).toBeNull()
})

it('leads with the browser sheet when the browser has one', async () => {
  setNavigator({ share: jest.fn() })
  shareSpy.mockResolvedValue({ action: Share.sharedAction })

  const screen = renderWithProviders(<ShareButton movie={movie} />)

  fireEvent.press(screen.getByTestId('share-button'))
  fireEvent.press(await screen.findByText('More apps'))

  expect(shareSpy).toHaveBeenCalledWith(
    expect.objectContaining({ url: movieUrl(movie.id) }),
    expect.anything(),
  )
})

it('copies the link and says so', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  setNavigator({ clipboard: { writeText } })

  const screen = renderWithProviders(<ShareButton movie={movie} />)

  fireEvent.press(screen.getByTestId('share-button'))
  fireEvent.press(await screen.findByText('Copy link'))

  expect(await screen.findByText('Link copied')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith(movieUrl(movie.id))
})

it('opens a site target in a new tab', async () => {
  const screen = renderWithProviders(<ShareButton movie={movie} />)

  fireEvent.press(screen.getByTestId('share-button'))
  fireEvent.press(await screen.findByText('Facebook'))

  const facebook = shareTargets(movie).find((t) => t.id === 'facebook')!
  expect(openSpy).toHaveBeenCalledWith(facebook.url)
})
