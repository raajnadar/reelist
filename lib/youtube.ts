/**
 * What the app builds from a YouTube key: two URLs, and the page the native
 * player loads.
 *
 * `lib/api.ts` already established that a playable video is a YouTube one, so
 * nothing here filters or decides. These functions take a key and build a
 * string.
 *
 * The key is encoded on the way in. It arrives from a route parameter, which a
 * deep link controls, and an unencoded value could add a path segment or a
 * parameter of its own to the URL the player loads.
 */

/**
 * The site the native player claims to be served from.
 *
 * This is the app's own web build, which GitHub Pages serves and which plays
 * these same trailers in a browser. That is the point: the referrer this
 * produces is the referrer the working web build already sends.
 *
 * It must not be a YouTube origin. YouTube rejects an embed whose referrer is
 * youtube.com itself — an embed of YouTube inside YouTube — and reports it as
 * error 152. See `embedPage` for the full sequence.
 *
 * No trailing slash and no path: this is an origin, and it is compared as one.
 */
export const PLAYER_ORIGIN = 'https://raajnadar.github.io'

/**
 * The URL the in-app player loads.
 *
 * The three parameters are what make an embed behave like a player:
 *
 * - `autoplay=1`, because the reader already pressed play on the detail screen.
 *   A second press to start the same video reports the first one as ignored. A
 *   browser can still refuse to start a video with sound, and then it shows its
 *   own play button.
 * - `playsinline=1`, or iOS takes the video fullscreen as it starts and puts
 *   its own chrome over the close button this screen draws.
 * - `rel=0` keeps the suggestions at the end of the video to the same channel.
 *   The default offers the whole of YouTube inside an app that browses films.
 */
export const embedUrl = (key: string): string =>
  `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&playsinline=1&rel=0`

/**
 * The URL that opens the video in YouTube itself.
 *
 * The player screen always offers this, and that is not a duplicate of the
 * embed. A studio can disable embedding for a video, and TMDB still lists it:
 * the embed then loads and plays nothing but the words "Video unavailable".
 * The app cannot detect that state without the YouTube frame API, so it keeps
 * the way out visible instead.
 */
export const watchUrl = (key: string): string =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`

/**
 * The page the native player loads, with the embed inside it.
 *
 * A web view cannot load `embedUrl` directly, and the reason is the `Referer`
 * header. YouTube checks it on every embed request and answers a bad one inside
 * the frame rather than failing: the player draws an error code, the video
 * never plays, and nothing throws that the app could catch. Two codes matter
 * here, and the app met both in turn:
 *
 * - **153**, "Video player configuration error": no referrer at all. A web view
 *   pointed straight at the embed URL makes that URL the top-level document,
 *   and a top-level document has none to send.
 * - **152**, "This video is not available": a referrer that YouTube refuses.
 *   Serving this page as youtube.com produced one, which is an embed of YouTube
 *   inside YouTube.
 *
 * So the page needs two things together, and neither works alone: the embed
 * must sit in an iframe with a parent document, and that document must claim a
 * real third-party site. `PLAYER_ORIGIN` is the caller's `baseUrl`, and it is
 * the app's own web build — the one that plays these trailers in a browser
 * today. The browser build needs none of this, because its iframe already sits
 * in a real page on that site.
 *
 * The `&` separators are written as `&amp;`, which is what an HTML attribute
 * takes. The key needs no escaping of its own: `embedUrl` percent-encodes it,
 * and that leaves no character an attribute could end on.
 */
export const embedPage = (key: string): string => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
      iframe { display: block; border: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <iframe
      src="${embedUrl(key).replace(/&/g, '&amp;')}"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
    ></iframe>
  </body>
</html>`
