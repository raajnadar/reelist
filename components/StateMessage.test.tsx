import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../lib/test-utils'
import { StateMessage } from './StateMessage'

/**
 * The block every screen uses for a failure, an empty result, and a prompt.
 *
 * The one thing here that can break silently is the action. A label with no
 * handler draws a button that answers nothing, and a handler with no label has
 * nothing to press — both render, and neither reports anything.
 */

it('draws the headline and the detail', () => {
  const screen = renderWithProviders(
    <StateMessage
      icon="cloud-off-outline"
      title="Could not load movies"
      body="No network."
    />,
  )

  expect(screen.getByText('Could not load movies')).toBeTruthy()
  expect(screen.getByText('No network.')).toBeTruthy()
})

it('runs the action when the button is pressed', () => {
  const onAction = jest.fn()
  const screen = renderWithProviders(
    <StateMessage
      icon="cloud-off-outline"
      title="Could not load movies"
      actionLabel="Try again"
      onAction={onAction}
    />,
  )

  // The role is asserted here as well as absent below: a `queryByRole` that
  // never matches anything would pass the "no button" tests for the wrong
  // reason.
  expect(screen.getByRole('button')).toBeTruthy()

  fireEvent.press(screen.getByText('Try again'))

  expect(onAction).toHaveBeenCalledTimes(1)
})

// The three states this component covers do not all have somewhere to go. A
// button must not appear for the ones that do not.
it('draws no button when there is no action', () => {
  const screen = renderWithProviders(
    <StateMessage icon="movie-open-outline" title="Search for a movie" />,
  )

  expect(screen.getByText('Search for a movie')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

// A half-declared action is a call-site mistake, not a state. Both halves are
// required, so neither one alone may render a control.
it.each([
  ['a label with no handler', { actionLabel: 'Try again' }],
  ['a handler with no label', { onAction: () => {} }],
])('draws no button for %s', (_name, props) => {
  const screen = renderWithProviders(
    <StateMessage icon="cloud-off-outline" title="Could not load movies" {...props} />,
  )

  expect(screen.queryByText('Try again')).toBeNull()
})

// The body is optional: a prompt is sometimes one line.
it('renders without a body', () => {
  const screen = renderWithProviders(
    <StateMessage icon="movie-open-outline" title="Only a title" />,
  )

  expect(screen.getByText('Only a title')).toBeTruthy()
})
