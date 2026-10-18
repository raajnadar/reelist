import glyphs from '@react-native-vector-icons/material-design-icons/glyphmaps/MaterialDesignIcons.json'
import { GENRE_FALLBACK_ICON, GENRE_ICON_IDS, genreIcon } from './genreIcons'

// A name the icon font does not hold renders as an empty box, with no error
// and no warning. The font's own glyph map is the list to check against.
it.each(GENRE_ICON_IDS)('gives genre %i an icon the font holds', (id) => {
  expect(glyphs).toHaveProperty(genreIcon(id))
})

it('gives a genre TMDB adds later the fallback, which the font holds', () => {
  expect(genreIcon(-1)).toBe(GENRE_FALLBACK_ICON)
  expect(glyphs).toHaveProperty(GENRE_FALLBACK_ICON)
})
