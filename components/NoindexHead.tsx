import { PageHead } from '@rootnative/seo/expo-router'
import { useShellHeadSweep } from '../lib/useShellHeadSweep'

/**
 * The head of a screen a crawler must not index.
 *
 * `PageHead` with `noindex`, plus the sweep of the server head that
 * lib/useShellHeadSweep.ts describes: on a page served from the home shell,
 * `PageHead` alone left the home canonical link beside the `noindex`.
 */
export function NoindexHead({ title }: { title: string }) {
  useShellHeadSweep()
  return <PageHead title={title} noindex />
}
