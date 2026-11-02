import { Menu } from '@rootnative/components/menu'
import { PortalHost } from '@rootnative/components/portal'
import { fireEvent, within } from '@testing-library/react-native'
import { View } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import { TooltipIconButton } from './TooltipIconButton'

/**
 * The icon button that shows its label in a tooltip.
 *
 * The tooltip wraps the button and clones it, so the risks are a press that
 * no longer reaches the caller, a `Menu` that can no longer open from it, and
 * a tooltip that lands in the root host when a screen asked for its own.
 */

it('passes a press through to the caller', () => {
  const onPress = jest.fn()
  const screen = renderWithProviders(
    <TooltipIconButton
      icon="close"
      accessibilityLabel="Close search"
      onPress={onPress}
    />,
  )

  fireEvent.press(screen.getByLabelText('Close search'))

  expect(onPress).toHaveBeenCalledTimes(1)
})

it('shows the label as the tooltip on a long press', () => {
  const screen = renderWithProviders(
    <TooltipIconButton icon="close" accessibilityLabel="Close search" />,
  )
  expect(screen.queryByText('Close search')).toBeNull()

  fireEvent(screen.getByLabelText('Close search'), 'longPress')

  expect(screen.getByText('Close search')).toBeTruthy()
})

it('opens a Menu when it is the anchor', () => {
  const screen = renderWithProviders(
    <Menu
      anchor={<TooltipIconButton icon="dots-vertical" accessibilityLabel="Options" />}
    >
      <Menu.Item label="Title" />
    </Menu>,
  )

  fireEvent.press(screen.getByLabelText('Options'))

  expect(screen.getByText('Title')).toBeTruthy()
})

// On iOS a `transparentModal` route draws over the root host, so the search
// sheet passes a host of its own.
it('draws the tooltip in the named host', () => {
  const screen = renderWithProviders(
    <View>
      <TooltipIconButton
        icon="close"
        accessibilityLabel="Close search"
        hostName="search"
      />
      <PortalHost name="search" testID="search-host" />
    </View>,
  )

  fireEvent(screen.getByLabelText('Close search'), 'longPress')

  expect(within(screen.getByTestId('search-host')).getByText('Close search')).toBeTruthy()
})
