import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons'
import { Motion } from '@rootnative/inertia'

const PAUSE_MS = 3000
const TURN_MS = 1200

/**
 * The settings cog: a pause, one full turn, and again, for as long as the home
 * screen is open.
 *
 * The pause comes first, so it is also the delay before the first turn and the
 * film rows arrive before anything in the header moves. The last step snaps
 * back to 0 with no animation. That jump is invisible, because 360° and 0° are
 * the same pose, and it lets the sequence restart from where it began.
 *
 * `<MotionConfig reducedMotion="user">` in app/_layout.tsx stops the spin when
 * the OS asks for reduced motion.
 */
export function SpinningCog({ size, color }: { size: number; color?: string }) {
  return (
    <Motion.View
      initial={{ rotate: 0 }}
      animate={{
        rotate: [
          { to: 0, duration: PAUSE_MS },
          { to: 360, duration: TURN_MS },
          { to: 0, type: 'no-animation' },
        ],
      }}
      transition={{ type: 'timing', repeat: 'infinite' }}
    >
      <MaterialDesignIcons name="cog-outline" size={size} color={color} />
    </Motion.View>
  )
}
