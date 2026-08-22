import type { Movie, MovieDetail } from './types'

/**
 * Poster paths are real TMDB paths, so the images load without an API key.
 * The last three entries cover the edge cases every screen must handle:
 * a null poster, an empty release date, and a zero rating.
 */
export const mockMovies: Movie[] = [
  {
    id: 693134,
    title: 'Dune: Part Two',
    poster_path: '/1pdfLvkbY9ohJlCjQulnp6f5X5X.jpg',
    backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
    vote_average: 8.15,
    release_date: '2024-02-27',
    overview:
      'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdrop_path: '/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    vote_average: 8.1,
    release_date: '2023-07-19',
    overview:
      'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.',
  },
  {
    id: 157336,
    title: 'Interstellar',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    vote_average: 8.4,
    release_date: '2014-11-05',
    overview:
      'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survives.',
  },
  {
    id: 27205,
    title: 'Inception',
    poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdrop_path: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    vote_average: 8.4,
    release_date: '2010-07-15',
    overview:
      'Cobb steals secrets from within the subconscious, and is offered a chance to regain his old life.',
  },
  {
    id: 155,
    title: 'The Dark Knight',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdrop_path: '/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg',
    vote_average: 8.5,
    release_date: '2008-07-16',
    overview:
      'Batman raises the stakes in his war on crime as the Joker throws Gotham into anarchy.',
  },
  {
    id: 496243,
    title: 'Parasite',
    poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    backdrop_path: '/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',
    vote_average: 8.5,
    release_date: '2019-05-30',
    overview:
      'All unemployed, Ki-taek and his family take peculiar interest in the wealthy Park family.',
  },
  {
    id: 335984,
    title: 'Blade Runner 2049',
    poster_path: '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
    backdrop_path: '/ilRyazdMLwzOkWZ6EsaHTsyMc4d.jpg',
    vote_average: 7.6,
    release_date: '2017-10-04',
    overview:
      'A young blade runner uncovers a secret that leads him to track down former blade runner Rick Deckard.',
  },
  {
    id: 999001,
    title: 'Missing Poster Example',
    poster_path: null,
    backdrop_path: null,
    vote_average: 6.4,
    release_date: '2022-01-01',
    overview: 'Exercises the poster fallback branch in MovieCard.',
  },
  {
    id: 999002,
    title: 'Unreleased Example',
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    release_date: '',
    overview: 'Exercises the empty release date and zero rating branches.',
  },
]

/**
 * One film in the shape `/movie/{id}` returns, which is what the detail screen
 * reads.
 *
 * Separate from `mockMovies` rather than added to it. Those entries stand in for
 * the list endpoints, which never send `genres`, `runtime`, or `tagline` — giving
 * them those fields would let a card test pass against data the API never sends.
 */
export const mockMovieDetail: MovieDetail = {
  ...mockMovies[0],
  genres: [
    { id: 878, name: 'Science Fiction' },
    { id: 12, name: 'Adventure' },
  ],
  runtime: 167,
  tagline: 'Long live the fighters.',
}
