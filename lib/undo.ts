/**
 * The snackbar that offers to undo what the reader just did.
 *
 * `long`, because the library makes a snackbar with an action wait forever by
 * default, and it would then stay on the screens the reader opens next.
 * `replace`, so a fast save and unsave does not queue two.
 */
export const undoSnackbar = (message: string, onAction: () => void) => ({
  message,
  actionLabel: 'Undo',
  duration: 'long' as const,
  replace: true,
  onAction,
})
