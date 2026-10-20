import type { ButtonProps } from '@rootnative/components/button'

/**
 * One Button size for each role in the app.
 *
 * A screen writes `size={BUTTON_SIZE.inline}`, and ESLint rejects a literal
 * size, so a new button cannot drift from the rule. The Button pads its touch
 * area to 48 dp on iOS and Android, so a 40 dp button is still large enough to
 * touch.
 */
export const BUTTON_SIZE = {
  /**
   * 40 dp. A button among other content: the film actions, the share button,
   * "Show more" on a biography, and the links on the about screen.
   */
  inline: 'small',
  /**
   * 56 dp. The one action of an empty or failed screen. It is the only control
   * on the screen and the only way forward, so it gets the larger target.
   */
  state: 'medium',
  // TODO(raajnadar): use `ButtonSize` when @rootnative/components exports it.
  // DX feedback R25.
} as const satisfies Record<string, NonNullable<ButtonProps['size']>>
