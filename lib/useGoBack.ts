import { useRouter } from 'expo-router'

/**
 * Closes the screen: back when there is history, home when there is none.
 *
 * `router.back` alone dead-ends on a deep link, where the screen is the first
 * entry in the history and there is nothing to go back to.
 */
export function useGoBack(): () => void {
  const router = useRouter()
  return () => (router.canGoBack() ? router.back() : router.replace('/'))
}
