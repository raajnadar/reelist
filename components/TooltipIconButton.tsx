import { IconButton, type IconButtonProps } from '@rootnative/components/icon-button'
import { Tooltip, type TooltipProps } from '@rootnative/components/tooltip'

/**
 * An icon button that shows its label in a tooltip: on a hover or a keyboard
 * focus on the web, and on a long press on a touch screen. Without it, a
 * reader with a mouse sees only the icon, and the label goes to a screen
 * reader alone.
 *
 * A `Menu` can take this as its anchor. The menu clones its anchor to add the
 * press and the `aria-*` props, and they go on to the button with the rest.
 *
 * The button is inside the wrapper view of the tooltip, so a button that has
 * its own place in the parent, such as an absolute one, needs that place in
 * `anchorStyle`. In a `transparentModal` route, pass the `hostName` of a host
 * inside the route: on iOS the root host is under it, out of view.
 */
export function TooltipIconButton({
  anchorStyle,
  hostName,
  ...props
}: IconButtonProps & Pick<TooltipProps, 'anchorStyle' | 'hostName'>) {
  return (
    <Tooltip
      anchor={<IconButton {...props} />}
      anchorStyle={anchorStyle}
      hostName={hostName}
    >
      {props.accessibilityLabel}
    </Tooltip>
  )
}
