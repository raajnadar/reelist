import { RefreshControl, Text } from 'react-native'
import { PullToRefresh } from './PullToRefresh'
import { renderWithProviders } from '../lib/test-utils'

/**
 * On Android and on web the ScrollView does not render its refresh control
 * next to the list. It clones the control and passes the list in as
 * `children`, with the ScrollView `style`. A wrapper that drops either one
 * renders an empty screen. The Jest preset runs as iOS and its RefreshControl
 * mock renders nothing, so these tests read the props instead of the screen.
 */
it('passes the list and its style on to RefreshControl', () => {
  const list = <Text>list</Text>
  const style = { flex: 1 }
  const screen = renderWithProviders(
    <PullToRefresh refreshing={false} onRefresh={() => {}} style={style}>
      {list}
    </PullToRefresh>,
  )

  const control = screen.UNSAFE_getByType(RefreshControl)
  expect(control.props.children).toBe(list)
  expect(control.props.style).toBe(style)
})

it('keeps the theme colours', () => {
  const screen = renderWithProviders(
    <PullToRefresh refreshing={false} onRefresh={() => {}} />,
  )

  const control = screen.UNSAFE_getByType(RefreshControl)
  expect(control.props.tintColor).toEqual(expect.any(String))
  expect(control.props.colors).toEqual([control.props.tintColor])
})
