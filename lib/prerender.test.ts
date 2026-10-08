import {
  fromSeed,
  genreEntry,
  homeEntry,
  movieEntry,
  movieIds,
  type PrerenderSeed,
  type PrerenderedMovie,
} from './prerender'
import tracked from './prerender.json'

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
  vote_count: 11204,
}

const seed: PrerenderSeed = {
  movies: { '438631': entry },
  lists: { trending: [438631], popular: [], topRated: [438631, 999] },
  genres: [{ id: 878, name: 'Science Fiction' }],
}

const empty = tracked as PrerenderSeed

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

it('reads the films, the rows, and the genres from a seed', () => {
  expect(movieIds(seed)).toEqual([438631])
  expect(movieEntry(seed, '438631')).toBe(entry)
  expect(genreEntry(seed, '878')).toEqual({ id: 878, name: 'Science Fiction' })
  // A row carries the card fields only. A row id with no film in the seed is
  // left out, not drawn as a gap.
  const card = {
    id: 438631,
    title: 'Dune',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 7.8,
    release_date: '2021-09-15',
    overview: 'Paul Atreides travels to Arrakis.',
  }
  expect(homeEntry(seed)).toEqual({
    lists: { trending: [card], popular: [], topRated: [card] },
    genres: seed.genres,
  })
})

// The export also renders the route template, and a loader parameter is a
// string. A key that every object inherits must not read as a film.
it('finds no film for the template parameter or an inherited key', () => {
  expect(movieEntry(seed, '[id]')).toBeNull()
  expect(movieEntry(seed, 'constructor')).toBeNull()
  expect(genreEntry(seed, '[id]')).toBeNull()
})

// The tracked seed is empty. A native build and a local export run against
// it, and neither may find anything in it.
it('has no film, no row, and no genre in the tracked seed', () => {
  expect(movieIds(empty)).toEqual([])
  expect(movieEntry(empty, '438631')).toBeNull()
  expect(homeEntry(empty)).toEqual({ lists: null, genres: [] })
})
