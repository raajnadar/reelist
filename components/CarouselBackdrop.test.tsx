import { Platform } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import type { Movie } from '../lib/types'
import { ContentWidthContext } from '../lib/useContentWidth'
import { MovieCarousel } from './MovieCarousel'

jest.mock('expo-router', () =>
  jest.requireActual('../lib/test-utils').expoRouterMock(() => ({ push: jest.fn() })),
)

const movies: Movie[] = [
  {
    id: 1,
    title: 'Verity',
    poster_path: '/verity.jpg',
    backdrop_path: null,
    vote_average: 7.1,
    release_date: '2026-10-02',
    overview: '',
  },
  {
    id: 2,
    title: 'Wildwood',
    poster_path: '/wildwood.jpg',
    backdrop_path: null,
    vote_average: 6.4,
    release_date: '2026-09-18',
    overview: '',
  },
]

// A content width of 0 is the static web page: the server has no window, so
// the carousel has no pitch and draws its still card.
const staticPage = () =>
  renderWithProviders(
    <ContentWidthContext.Provider value={0}>
      <MovieCarousel title="Trending" movies={movies} />
    </ContentWidthContext.Provider>,
  )

const stillImg = (screen: ReturnType<typeof staticPage>) =>
  screen.UNSAFE_root.findAll(
    (node) =>
      node.type === 'img' && node.props['data-testid'] === 'carousel-backdrop-still',
  )

// The blurred layer behind the carousel is the largest element of the home
// page, so it is the Largest Contentful Paint. expo-image mounts its picture
// in an effect, so the static page held no layer and the browser painted it
// only after the script ran.
describe('on the web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('holds a blurred eager img of the first poster in the static page', () => {
    const [img] = stillImg(staticPage())
    expect(img.props).toMatchObject({
      src: 'https://image.tmdb.org/t/p/w500/verity.jpg',
      alt: '',
      loading: 'eager',
    })
    expect(img.props.style).toMatchObject({
      position: 'absolute',
      width: 'auto',
      height: 'auto',
      filter: 'blur(48px)',
    })
  })
})

it('draws no still layer on native', () => {
  expect(stillImg(staticPage())).toHaveLength(0)
})
