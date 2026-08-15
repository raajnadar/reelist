# The TMDB proxy

This function holds the TMDB key. The app calls this function, and this function
calls TMDB. The key stays on the server.

## Why the app cannot hold the key

Expo's Babel preset replaces every `process.env.EXPO_PUBLIC_*` read with the
literal value when it builds for production. The relevant line is in
`babel-preset-expo/build/inline-env-vars.js`:

```js
if (isProduction) {
  path.replaceWith(t.valueToNode(process.env[envVar]))
}
```

The value becomes a plain string in the bundle. This is true for the web build,
the `.apk`, and the `.ipa` — an Android package is an archive, and the bundle
inside it can be read with `grep`. Minifying does not help, because a minifier
renames variables and leaves string values alone.

No client-side measure fixes this. Whatever the app can decrypt, a person
holding the app can also decrypt. The key has to stay off the device.

## What the proxy does

| Rule               | Reason                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Allowlisted paths  | Without it, the URL is a free TMDB relay under this key.          |
| Allowlisted params | A caller cannot add their own `api_key` or reach other features.  |
| Edge cache, 10 min | One cached copy serves every user, so TMDB sees few requests.     |
| Errors not cached  | Caching a failure would pin it in place for the whole window.     |
| Status passed on   | The app turns a 404 into "no such film" and reports the rest.     |
| GET only           | Nothing here writes, so any other method is a mistake or a probe. |

## The interface

The app sends the TMDB path as a `path` parameter. The proxy checks it, adds the
key, and returns what TMDB answers.

```
GET /api/tmdb?path=/movie/popular
GET /api/tmdb?path=/search/movie&query=dune
```

| Path                   | Used by                       |
| ---------------------- | ----------------------------- |
| `/trending/movie/week` | The home carousel             |
| `/movie/popular`       | The "Popular" row             |
| `/movie/top_rated`     | The "Top rated" row           |
| `/movie/{id}`          | The detail screen             |
| `/search/movie`        | `searchMovies`, no screen yet |

Only `query` and `page` are forwarded. Any other parameter is dropped, including
an `api_key` supplied by the caller.

| Status | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| 200    | TMDB answered. The body is passed through unchanged.        |
| 204    | A CORS preflight. The web build sends one; native does not. |
| 400    | No `path` parameter.                                        |
| 403    | The path is not on the allowlist.                           |
| 404    | TMDB has no such film. `getMovie` turns this into `null`.   |
| 405    | A method other than GET.                                    |
| 500    | The server has no `TMDB_API_KEY`.                           |
| 502    | TMDB could not be reached.                                  |

Add a path to `ALLOWED_EXACT` or `ALLOWED_PATTERNS` in
[api/tmdb.ts](api/tmdb.ts) when a screen needs a new endpoint, and add a case to
[api/tmdb.test.ts](api/tmdb.test.ts) to cover it.

## Deploy it

1. Install the CLI and log in:

   ```bash
   npm i -g vercel
   vercel login
   ```

2. Deploy from this directory. It is a separate project from the app, so run
   the command here and not at the repository root:

   ```bash
   cd proxy
   vercel deploy --prod
   ```

3. Add the key to the deployment. This is the step that keeps it private:

   ```bash
   vercel env add TMDB_API_KEY production
   ```

   Paste the v3 API key from
   [your TMDB settings](https://www.themoviedb.org/settings/api). Redeploy after
   you add it, because a function reads its environment at deploy time.

4. Put the URL in the app's `.env`. **Use the stable alias, not the URL the
   deploy prints.** The printed one contains a build id such as
   `reelist-qadulvz91-...` and changes on every deploy, which breaks the app the
   next time you deploy. Find the alias with:

   ```bash
   vercel alias ls
   ```

   Then use it:

   ```
   EXPO_PUBLIC_TMDB_PROXY_URL=https://<project>.vercel.app/api/tmdb
   ```

   This URL is public by design. It is an address, not a credential.

## Run it locally

1. Give the local server the key. `vercel dev` reads `proxy/.env.local`, and it
   does **not** read a variable you export in the shell:

   ```bash
   cd proxy
   echo 'TMDB_API_KEY=your-32-character-v3-key' > .env.local
   ```

   `.env.local` is gitignored by the `.env*` rule at the repository root.

2. Start the server:

   ```bash
   vercel dev
   ```

   The first run links the directory to a Vercel project and asks a few
   questions. It prints the address it uses, which is `http://localhost:3000`
   unless that port is taken.

3. Point the app at it. In the app's `.env` at the repository root:

   ```
   EXPO_PUBLIC_TMDB_PROXY_URL=http://localhost:3000/api/tmdb
   ```

   Restart Metro with `yarn start --clear`. Metro reads `.env` when it starts,
   so a change without the restart has no effect.

**A phone cannot reach `localhost`.** On a device, `localhost` is the phone
itself. Use the computer's address on the network instead — for example
`http://192.168.1.20:3000/api/tmdb`. Find it with `ipconfig getifaddr en0` on
macOS. The simulator and the web build are fine with `localhost`.

## Test it

Three checks, from the fastest to the most complete.

**1. The unit tests.** They run from the repository root, mock `fetch`, and need
no key and no network:

```bash
yarn test --selectProjects proxy   # the proxy only
yarn test                          # the app and the proxy
```

**2. The smoke script.** It calls a running proxy and checks that the allowed
paths work and the refused ones fail. It works against a local server or a
deployment:

```bash
./smoke.sh                                          # http://localhost:3000/api/tmdb
./smoke.sh http://localhost:3001/api/tmdb           # another port
./smoke.sh https://your-app.vercel.app/api/tmdb     # a deployment
```

It reports a missing key, a rejected key, and a server that is not running as
one clear line each, rather than as a list of failed checks.

**3. The app.** Run `yarn start` from the repository root with the proxy
running. The three rows fill with films, and tapping a poster opens the detail
screen.

To confirm the key is not in the build, export the web bundle and search it:

```bash
yarn build:web
grep -c 'api_key' dist/_expo/static/js/web/entry-*.js   # expect 0
grep -c 'api.themoviedb.org' dist/_expo/static/js/web/entry-*.js  # expect 0
```

`image.tmdb.org` does appear, which is correct: the poster CDN needs no
credential.

## When it does not work

Three failures that each look like a broken key but are not. All three were hit
while setting this up.

### "TMDB_API_KEY is not set on the server" and `.env.local` exists

`vercel dev` runs in the **Development** environment. A variable added with
`vercel env add TMDB_API_KEY production` is scoped to Production only, so the
local server never sees it, whatever `.env.local` holds.

Check which environments have the variable:

```bash
vercel env ls
vercel env ls development     # this one must not be empty
```

Add it for development, then pull it to the file `vercel dev` prefers:

```bash
vercel env add TMDB_API_KEY development
vercel env pull .vercel/.env.development.local
```

Restart `vercel dev` afterwards. It reads its environment once at startup, so a
key added while it runs has no effect until the restart.

### The deployed proxy answers 500 and the key is set

A function reads its environment **when it is built**, not on each request. A key
added after the last deployment is not in the running function, however correct
`vercel env ls` looks.

Compare the two times:

```bash
vercel ls                                    # deployment age
vercel env ls                                # variable age
```

If the deployment is older than the variable, deploy again. Nothing else needs
to change:

```bash
vercel deploy --prod
```

This is the same mistake as the local one below, in a different place: the key
is right, and the process holding it is stale.

### The deployment redirects to a Vercel login

A request to the deployed proxy answers `302` with a `location` of
`vercel.com/sso-api`:

```bash
curl -s -o /dev/null -D - "https://<deployment>/api/tmdb?path=/movie/popular" | grep -i location
```

This is **Deployment Protection**, which Vercel turns on by default for new
projects. It stops the request before it reaches the function, so the app gets
an HTML login page instead of JSON. The app cannot authenticate.

Turn it off in `Settings → Deployment Protection → Vercel Authentication`. The
proxy is meant to be public — that is what makes it usable as an API, and the
allowlist and the cache are what bound the exposure.

### The app shows the setup error but the proxy answers `curl`

Metro reads `.env` when it starts and inlines the value. Restart it with
`yarn start --clear`. Check also that a phone is not being told to use
`localhost` — see the note above.

## If the key is already exposed

A key that shipped in a build is public from that moment. Revoking it is the
only fix, because the published bundle cannot be recalled.

1. Regenerate the key at
   [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
2. Give the new key to the proxy only. Never put it in the app's `.env`.
3. Deploy the app again, so the published bundles stop carrying the old value.
