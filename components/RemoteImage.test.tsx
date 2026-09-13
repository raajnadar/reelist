import { Image } from 'expo-image'
import { StyleSheet } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import { RemoteImage } from './RemoteImage'

/**
 * The wrapper carries the whole reason the app left the React Native `Image`
 * behind. Every setting here is invisible when it is wrong: a dropped
 * `recyclingKey` shows the previous film's poster on a fast scroll, a dropped
 * `cachePolicy` decodes the same poster on every appearance, and a dropped
 * `transition` makes the picture appear at full opacity on one frame. None of
 * the three fails a type check or throws.
 */

const props = () =>
  renderWithProviders(
    <RemoteImage uri="https://image.tmdb.org/t/p/w342/a.jpg" recyclingKey="42" />,
  ).UNSAFE_getByType(Image).props

it('blanks a recycled view rather than keeping the previous film on screen', () => {
  expect(props().recyclingKey).toBe('42')
})

// A poster appears in a row, again in the search grid, and again on the detail
// screen. The expo-image default is `disk`, which decodes it each time.
it('keeps decoded images in memory', () => {
  expect(props().cachePolicy).toBe('memory-disk')
})

it('cross-dissolves the picture in rather than snapping it', () => {
  expect(props().transition).toBeGreaterThan(0)
})

it('crops to fill the box it is given', () => {
  expect(props().contentFit).toBe('cover')
})

// The box has to be a filled shape while it waits, not a hole in the layout.
// There is no blurhash to place there: TMDB sends none.
it('sits on a surface colour before the bytes arrive', () => {
  expect(StyleSheet.flatten(props().style).backgroundColor).toBeTruthy()
})

// The caller's style comes second, so a call site can still set its own.
it('lets the call site override the background', () => {
  const screen = renderWithProviders(
    <RemoteImage
      uri="https://image.tmdb.org/t/p/w342/a.jpg"
      recyclingKey="42"
      style={{ backgroundColor: '#123456' }}
    />,
  )

  const style = StyleSheet.flatten(screen.UNSAFE_getByType(Image).props.style)

  expect(style.backgroundColor).toBe('#123456')
})

// `high` is reserved for the one picture a screen is built around, so the
// default must not claim it.
it('downloads at normal priority unless the call site asks for more', () => {
  expect(props().priority).toBe('normal')
})
