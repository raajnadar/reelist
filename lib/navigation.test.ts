import {
  activeDestination,
  activeDrawerItem,
  navigationHidden,
  navigationKind,
  stackRouteName,
} from './navigation'

describe('stackRouteName', () => {
  it('names the home after its index file', () => {
    expect(stackRouteName('/')).toBe('index')
  })

  it('names every other static path after its file', () => {
    expect(stackRouteName('/watchlist')).toBe('watchlist')
    expect(stackRouteName('/privacy')).toBe('privacy')
  })

  it('names no route for an href object', () => {
    expect(stackRouteName({ pathname: '/watchlist' })).toBeUndefined()
  })
})

describe('navigationKind', () => {
  it('gives a phone the bar', () => {
    expect(navigationKind('compact')).toBe('bar')
  })

  it('gives a tablet and a laptop the rail', () => {
    expect(navigationKind('medium')).toBe('rail')
    expect(navigationKind('expanded')).toBe('rail')
    expect(navigationKind('large')).toBe('rail')
  })

  it('gives a wide monitor the drawer', () => {
    expect(navigationKind('extraLarge')).toBe('drawer')
  })
})

describe('activeDestination', () => {
  it('names the destination the path is on', () => {
    expect(activeDestination('/')).toBe('home')
    expect(activeDestination('/search')).toBe('search')
    expect(activeDestination('/watchlist')).toBe('watchlist')
  })

  it('names nothing on a screen that is not a destination', () => {
    expect(activeDestination('/movie/550')).toBeUndefined()
    expect(activeDestination('/person/287')).toBeUndefined()
    expect(activeDestination('/genre/28')).toBeUndefined()
    expect(activeDestination('/about')).toBeUndefined()
  })
})

describe('activeDrawerItem', () => {
  it('names a destination, or a link at the end of the drawer', () => {
    expect(activeDrawerItem('/')).toBe('home')
    expect(activeDrawerItem('/watchlist')).toBe('watchlist')
    expect(activeDrawerItem('/about')).toBe('settings')
    expect(activeDrawerItem('/privacy')).toBe('privacy')
  })

  it('names nothing on a film, a person, or a genre', () => {
    expect(activeDrawerItem('/movie/550')).toBeUndefined()
    expect(activeDrawerItem('/person/287')).toBeUndefined()
    expect(activeDrawerItem('/genre/28')).toBeUndefined()
  })
})

describe('navigationHidden', () => {
  it('hides the navigation on the trailer and the gallery', () => {
    expect(navigationHidden('/trailer/dQw4w9WgXcQ')).toBe(true)
    expect(navigationHidden('/gallery/550')).toBe(true)
  })

  it('shows it everywhere else', () => {
    expect(navigationHidden('/')).toBe(false)
    expect(navigationHidden('/movie/550')).toBe(false)
    expect(navigationHidden('/search')).toBe(false)
  })
})
