import {
  fromSeed,
  prerenderedGenres,
  prerenderedIds,
  prerenderedLists,
  prerenderedMovie,
  type PrerenderedMovie,
} from './prerender'

const entry: PrerenderedMovie = {
  id: 438631,
  title: 'Dune',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 7.8,
  release_date: '2021-09-15',
  overview: 'Paul Atreides travels to Arrakis.',
  genres: [{ id: 878, name: 'Science Fiction' }],
  runtime: 155,
  tagline: 'Beyond fear, destiny awaits.',
}

it('widens a seed entry to a detail with every list empty', () => {
  expect(fromSeed(entry)).toEqual({
    ...entry,
    cast: [],
    trailer: null,
    recommendations: [],
    images: [],
    providers: {},
  })
})

// The tracked seed is empty. The tests, a native build, and a local export
// all run against it, and none of them may find anything in it.
it('has no film, no row, and no genre in the tracked seed', () => {
  expect(prerenderedMovie(438631)).toBeNull()
  expect(prerenderedIds()).toEqual([])
  expect(prerenderedLists()).toBeNull()
  expect(prerenderedGenres()).toBeNull()
})
