/**
 * A MaterialDesignIcons name for each TMDB movie genre, by genre id.
 *
 * The ids come from `/genre/movie/list` and do not change, while the names
 * follow the reader's language. A genre TMDB adds later gets the fallback.
 */
const ICONS: Record<number, string> = {
  28: 'lightning-bolt', // Action
  12: 'compass-outline', // Adventure
  16: 'palette-outline', // Animation
  35: 'emoticon-happy-outline', // Comedy
  80: 'handcuffs', // Crime
  99: 'video-vintage', // Documentary
  18: 'drama-masks', // Drama
  10751: 'home-heart', // Family
  14: 'auto-fix', // Fantasy
  36: 'bank-outline', // History
  27: 'ghost-outline', // Horror
  10402: 'music-note', // Music
  9648: 'incognito', // Mystery
  10749: 'heart-outline', // Romance
  878: 'rocket-launch-outline', // Science Fiction
  10770: 'television-classic', // TV Movie
  53: 'heart-pulse', // Thriller
  10752: 'shield-sword-outline', // War
  37: 'cactus', // Western
}

export const GENRE_FALLBACK_ICON = 'movie-open-outline'

export const genreIcon = (id: number) => ICONS[id] ?? GENRE_FALLBACK_ICON

/** Every id with an icon of its own, for the test that checks the names. */
export const GENRE_ICON_IDS = Object.keys(ICONS).map(Number)
