import { externalLinks } from './externalLinks'

it('links to IMDb and to the official site', () => {
  expect(
    externalLinks({ imdb_id: 'tt15239678', homepage: 'https://www.dunemovie.com' }),
  ).toEqual([
    expect.objectContaining({
      id: 'imdb',
      label: 'IMDb',
      url: 'https://www.imdb.com/title/tt15239678/',
    }),
    expect.objectContaining({
      id: 'homepage',
      label: 'Official site',
      url: 'https://www.dunemovie.com',
    }),
  ])
})

// TMDB sends `null` for both when it holds nothing, and lib/api.ts maps that
// to ''. The section then has nothing to draw.
it('returns an empty list for a film with neither', () => {
  expect(externalLinks({ imdb_id: '', homepage: '' })).toEqual([])
})

// A value typed by hand on TMDB. A link that opens nothing reads as broken, and
// a `javascript:` value must never reach `openURL`.
it.each([
  ['a bare host', 'dunemovie.com'],
  ['a script', 'javascript:alert(1)'],
  ['a mail address', 'mailto:someone@example.com'],
])('drops a homepage that is %s', (_name, homepage) => {
  expect(externalLinks({ imdb_id: '', homepage })).toEqual([])
})

it('drops an IMDb id that is not a title id', () => {
  expect(externalLinks({ imdb_id: 'nm0000138', homepage: '' })).toEqual([])
})
