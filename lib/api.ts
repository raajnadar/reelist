import { mockMovies } from './mock'
import type { Movie, Paged } from './types'

/**
 * The single seam between the UI and the data source. Every screen imports from
 * here and nowhere else, so swapping mock data for TMDB changes only this file.
 *
 * The functions are async against static data on purpose: screens write `await`
 * and handle loading states now, so integration changes no call site.
 */

const rotate = (offset: number): Movie[] => [
  ...mockMovies.slice(offset),
  ...mockMovies.slice(0, offset),
]

export const getTrending = async (): Promise<Paged> => ({
  results: mockMovies,
})

export const getPopular = async (): Promise<Paged> => ({
  results: rotate(2),
})

export const getTopRated = async (): Promise<Paged> => ({
  results: [...mockMovies].sort((a, b) => b.vote_average - a.vote_average),
})

export const getMovie = async (id: number): Promise<Movie | null> =>
  mockMovies.find((m) => m.id === id) ?? null

// TODO: no caller yet. This waits for the search screen. Delete it with this
// comment if that screen is dropped, so the seam does not collect dead code.
export const searchMovies = async (query: string): Promise<Paged> => {
  const q = query.trim().toLowerCase()
  if (!q) return { results: [] }
  return { results: mockMovies.filter((m) => m.title.toLowerCase().includes(q)) }
}
