import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Motion } from '@rootnative/inertia'

/**
 * The bookmark on the save button. It pops when the reader saves the film, the
 * way a like pops on Instagram.
 *
 * `pop` counts the presses that saved the film. A new count remounts the view,
 * which replays `initial`. The pop is tied to the press, not to `saved`, so a
 * film that is already saved when the screen opens, or one that an undo puts
 * back, does not pop.
 */
export function BookmarkIcon({
  saved,
  pop,
  size,
  color,
}: {
  saved: boolean
  pop: number
  size: number
  color?: string
}) {
  return (
    <Motion.View
      key={pop}
      initial={pop ? { scale: 0.6 } : false}
      animate={{ scale: 1 }}
      transition="pop"
    >
      <MaterialCommunityIcons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={color}
      />
    </Motion.View>
  )
}
