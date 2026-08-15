/**
 * Where the app gets its data.
 *
 * The app holds no TMDB key. It calls a proxy, and the proxy holds the key on
 * the server and adds it to each upstream request.
 *
 * This is not a style choice. Expo's Babel preset replaces every
 * `process.env.EXPO_PUBLIC_*` read with the literal value at build time, so a
 * key behind that prefix is a plain string inside the shipped JavaScript — on
 * the web, and inside the .apk and .ipa, which are archives anyone can open and
 * read. Minifying does not hide it: a minifier renames variables, not string
 * values. No client-side measure fixes this, because whatever the app can
 * decrypt, a reader of the app can also decrypt. The key has to stay off the
 * device, which is what the proxy is for.
 *
 * The proxy URL is public by design. It is an address, not a credential.
 */
export const PROXY_URL = process.env.EXPO_PUBLIC_TMDB_PROXY_URL ?? ''

/**
 * Thrown when the proxy URL is absent. It is a distinct type so a screen can
 * tell a setup mistake from a network failure and print the instruction, rather
 * than "Could not load movies", which sends a developer to check their
 * connection.
 */
export class MissingProxyUrlError extends Error {
  constructor() {
    super(
      'No TMDB proxy URL. Copy .env.example to .env, set EXPO_PUBLIC_TMDB_PROXY_URL, then restart with `yarn start --clear`.',
    )
    this.name = 'MissingProxyUrlError'
  }
}

export const requireProxyUrl = (): string => {
  if (!PROXY_URL) throw new MissingProxyUrlError()
  // A trailing slash would produce a double slash in the request URL.
  return PROXY_URL.replace(/\/$/, '')
}
