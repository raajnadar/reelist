import { useMotionValue } from '@rootnative/inertia'
import { renderWithProviders } from '../lib/test-utils'
import { CastCard } from './CastCard'
import { MovieCard } from './MovieCard'
import type { CastMember, Movie } from '../lib/types'

/**
 * The safety net under the scroll-triggered entrance.
 *
 * MovieRow and CastRow hand their cards a 0-1 `useInView` sweep instead of a
 * mount animation, so a card that never reaches the end of its cascade window
 * would stay invisible — content missing, with no error and nothing in the
 * layout to show it. These tests pin both ends of that range.
 *
 * They assert the resolved style, not the movement between the two. The
 * Reanimated Jest mock computes an animated style at render and never refreshes
 * it afterwards, so a test that waited for the sweep would read the value from
 * the first frame whatever happened later. What it can prove is the part that
 * matters: no index resolves to a hidden card once the row has arrived.
 */

const movie: Movie = {
  id: 1,
  title: 'Film',
  poster_path: '/p.jpg',
  backdrop_path: null,
  overview: '',
  release_date: '2024-01-01',
  vote_average: 7,
}

const member: CastMember = {
  id: 1,
  name: 'Someone',
  character: 'Somebody',
  profile_path: '/f.jpg',
}

/** Every resolved animated style in the tree, outermost first. */
function animatedStyles(node: unknown, out: Record<string, number>[] = []) {
  if (!node || typeof node !== 'object') return out
  const { props, children } = node as {
    props?: { style?: unknown }
    children?: unknown[]
  }
  const style = props?.style
  for (const one of Array.isArray(style) ? style.flat() : [style]) {
    if (one && typeof one === 'object' && 'opacity' in one) {
      out.push(one as Record<string, number>)
    }
  }
  for (const child of children ?? []) animatedStyles(child, out)
  return out
}

/** Renders `card` with the row sweep pinned at `progress` and reads its style. */
function entranceAt(
  progress: number,
  card: (p: ReturnType<typeof useMotionValue<number>>) => React.ReactElement,
) {
  function Harness() {
    // Pinned, not animated: the mock reads an animated style once, so a value
    // that starts where the assertion needs it is the only readable form.
    return card(useMotionValue(progress))
  }

  const screen = renderWithProviders(<Harness />)

  return animatedStyles(screen.toJSON())[0]
}

describe('a card driven by its row', () => {
  // Past the cascade cap as well as inside it: the cap exists so a long row
  // cannot push a window past the end of the sweep, where it would never open.
  it.each([0, 1, 6, 7, 19])('MovieCard %i is visible once the row arrives', (index) => {
    const style = entranceAt(1, (progress) => (
      <MovieCard movie={movie} index={index} progress={progress} />
    ))

    expect(style).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] })
  })

  it.each([0, 1, 6, 7, 19])('CastCard %i is visible once the row arrives', (index) => {
    const style = entranceAt(1, (progress) => (
      <CastCard member={member} index={index} progress={progress} />
    ))

    expect(style).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] })
  })

  it('holds the first card hidden until the row is reached', () => {
    const style = entranceAt(0, (progress) => (
      <MovieCard movie={movie} index={0} progress={progress} />
    ))

    // Hidden at the start of the sweep is what makes the entrance an entrance.
    // Without this the tests above would pass on a card that never moves.
    expect(style).toMatchObject({ opacity: 0, transform: [{ translateY: 24 }] })
  })
})

describe('a card standing on its own', () => {
  it('keeps the mount entrance when no row drives it', () => {
    // The search and genre grids render MovieCard without a row. Their
    // FlatList mounts a card as it nears the screen, so the mount stagger
    // already fires at the right moment and must stay.
    const screen = renderWithProviders(<MovieCard movie={movie} index={0} />)

    expect(screen.getByText('Film')).toBeTruthy()
  })
})
