import { useRouter } from 'expo-router'
import type { ComponentProps } from 'react'
import type { Failure } from '../lib/errors'
import { StateMessage } from './StateMessage'

type Props = Omit<
  ComponentProps<typeof StateMessage>,
  'icon' | 'tone' | 'title' | 'body' | 'actionLabel' | 'actionIcon' | 'onAction'
> & {
  failure: Failure
  /** The headline for a request that failed. A second attempt may work. */
  title: string
  /** Sends the request again. Without it the transient report has no button. */
  onRetry?: () => void
  /**
   * The headline for an id nothing answers. A list screen omits it: its ids
   * come from TMDB itself, so it never meets a `missing` failure.
   */
  missingTitle?: string
}

/**
 * The failure block, with the words and the action for each kind of failure.
 * See lib/errors.ts for the three kinds.
 *
 * `setup` has no action: the fix is a file on the developer's disk and a
 * restart, and no button on a screen can apply it. `missing` goes home, since
 * the page the link named is not there to retry.
 */
export function FailureMessage({
  failure,
  title,
  onRetry,
  missingTitle,
  ...rest
}: Props) {
  const router = useRouter()

  switch (failure.kind) {
    case 'setup':
      return (
        <StateMessage
          {...rest}
          icon="cog-outline"
          tone="neutral"
          title="Setup needed"
          body={failure.message}
        />
      )
    case 'missing':
      return missingTitle ? (
        <StateMessage
          {...rest}
          icon="link-off"
          tone="error"
          title={missingTitle}
          body={failure.message}
          actionLabel="Go home"
          actionIcon="home-outline"
          onAction={() => router.replace('/')}
        />
      ) : (
        <StateMessage
          {...rest}
          icon="movie-off-outline"
          tone="error"
          title="Nothing to show"
          body={failure.message}
        />
      )
    default:
      return (
        <StateMessage
          {...rest}
          icon="cloud-off-outline"
          tone="error"
          title={title}
          body={failure.message}
          actionLabel={onRetry ? 'Try again' : undefined}
          actionIcon="refresh"
          onAction={onRetry}
        />
      )
  }
}
