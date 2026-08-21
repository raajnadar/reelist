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
| 30 requests/minute | The allowlist bounds what a caller asks for, not how much.        |
| Edge cache, 10 min | One cached copy serves every user, so TMDB sees few requests.     |
| Errors not cached  | Caching a failure would pin it in place for the whole window.     |
| Status passed on   | The app turns a 404 into "no such film" and reports the rest.     |
| GET only           | Nothing here writes, so any other method is a mistake or a probe. |

## The rate limit

The allowlist decides **what** a caller may request. The limit decides **how
much**. Both are needed: the URL is public by design, so anyone who reads it out
of the web bundle can call it in a loop, and every call spends this project's
TMDB quota.

The edge cache already absorbs the repeated list requests, because one cached
copy serves every user. It does nothing for `?path=/search/movie&query=<random>`
or `/movie/<random id>` — each is a new cache key, so each is a miss that
reaches TMDB. That is what the limit closes.

**30 requests each minute for each IP address**, in a sliding window. The app
makes 3 requests to paint the home screen and 1 for each film opened, so a
person browsing quickly stays near 10. The gap leaves room for a shared address
— a household, an office, or a mobile carrier NAT, where many real users appear
as one IP.

The window slides rather than resetting on a clock boundary. A fixed window lets
a caller spend the whole allowance at the end of one window and the whole
allowance again at the start of the next, and so pass twice the limit at once.

The counter lives in Upstash Redis, not in memory. An edge function runs as many
short-lived isolates across several regions, so an in-memory counter would reset
on every cold start and would never be shared between regions.

### It fails open

Every one of these **allows** the request:

- Redis is not configured.
- Redis is configured wrongly, so the client cannot even be built.
- Redis is unreachable, refuses the connection, or rejects the credentials.
- Redis is slow. It is given 1 second.
- The request has no client IP header, which is the case under `vercel dev`.

The limit is a cost control, not a security boundary. The key is protected by
the allowlist and by staying on the server; the limit only bounds the bill. A
counter that cannot be reached must not take the whole app down with it, so a
failure here is logged and the request proceeds.

The consequence is worth stating plainly: **if you do not configure Redis, there
is no rate limit.** The proxy will work and say nothing. Run `./smoke.sh`
against the deployment to confirm the limit is live.

### Set it up

1. Create a free Redis database at [console.upstash.com](https://console.upstash.com/).
   Pick the region closest to the proxy's region.

2. Copy the two REST values from the database page and add them to the
   deployment:

   ```bash
   cd proxy
   vercel env add UPSTASH_REDIS_REST_URL production
   vercel env add UPSTASH_REDIS_REST_TOKEN production
   ```

   Use the **REST** URL and token, not the `redis://` connection string. The
   edge runtime has no TCP socket, so this client speaks HTTP.

   Check the two values before you paste them. They are easy to swap, and the
   Upstash console shows them next to each other:

   | Variable                   | Looks like                             |
   | -------------------------- | -------------------------------------- |
   | `UPSTASH_REDIS_REST_URL`   | `https://<name>-<id>.upstash.io`       |
   | `UPSTASH_REDIS_REST_TOKEN` | a long opaque string beginning `gQ...` |

   The URL **must** start with `https://`. A token pasted into the URL variable
   makes the Redis client fail to build. The proxy treats that as "no limit" and
   keeps serving, so watch for the log line named below rather than expecting an
   error from the app.

3. Deploy again. A function reads its environment when it is built, so the
   variables do not reach the running function until the next deploy:

   ```bash
   vercel deploy --prod
   ```

4. Confirm it is live:

   ```bash
   ./smoke.sh https://your-app.vercel.app/api/tmdb
   ```

   The rate limit check sends requests until one is refused. It reports a
   failure if 40 requests all pass, which means the variables are missing.

To change the allowance, edit `LIMIT` and `WINDOW` in [api/rate-limit.ts](api/rate-limit.ts).

Add the same two variables to the `development` environment if you want the
limit while running `vercel dev` — but note it still will not count, because
`vercel dev` sets no client IP header. Test the limit against a deployment.

## The interface

The app sends the TMDB path as a `path` parameter. The proxy checks it, adds the
key, and returns what TMDB answers.

```
GET /api/tmdb?path=/movie/popular
GET /api/tmdb?path=/search/movie&query=dune
```

| Path                   | Used by                            |
| ---------------------- | ---------------------------------- |
| `/trending/movie/week` | The home carousel                  |
| `/movie/popular`       | The "Popular" row                  |
| `/movie/top_rated`     | The "Top rated" row                |
| `/movie/{id}`          | The detail screen                  |
| `/search/movie`        | The search screen                  |
| `/genre/movie/list`    | The genre chips on the home screen |
| `/discover/movie`      | The genre screen                   |

Only `query`, `page`, and `with_genres` are forwarded. Any other parameter is
dropped, including an `api_key` supplied by the caller.

`/discover/movie` is the one path whose filter travels as a parameter rather
than in the path. TMDB ignores a `with_genres` value it cannot parse and answers
with an unfiltered list, so `app/genre/[id].tsx` checks the id before it asks —
an unchecked bad id would render as a working screen showing every film.

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 200    | TMDB answered. The body is passed through unchanged.          |
| 204    | A CORS preflight. The web build sends one; native does not.   |
| 400    | No `path` parameter.                                          |
| 403    | The path is not on the allowlist.                             |
| 404    | TMDB has no such film. `getMovie` turns this into `null`.     |
| 405    | A method other than GET.                                      |
| 429    | Over the rate limit. `retry-after` holds the seconds to wait. |
| 500    | The server has no `TMDB_API_KEY`.                             |
| 502    | TMDB could not be reached.                                    |

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

### Every request answers 500 `FUNCTION_INVOCATION_FAILED`

The function crashed while loading, so no request reaches the handler. Read the
runtime log — the message names the cause, and the body never will:

```bash
vercel logs <your-deployment>.vercel.app
```

`UrlError: Upstash Redis client was passed an invalid URL` means
`UPSTASH_REDIS_REST_URL` holds the **token** rather than the URL. Set it to the
`https://<name>-<id>.upstash.io` value and deploy again.

The rate limit is built lazily and wrapped now, so this misconfiguration falls
open and logs instead of crashing. A deployment made before that fix still shows
the old behavior until you deploy again.

### The smoke test reports a 32-character hex string came back

Check whether the requests are also failing. That check looks for a key-shaped
string anywhere in the response, and a Vercel **error page** carries a hex
request id that matches the same shape:

```
bom1::965jp-1786839904867-e9d6d398eaba
```

A false positive, in other words. Fix the failing requests first and run the
script again. Treat it as a real leak only when the requests succeed and the
body still holds a 32-character hex string.

### The app answers 429 while you are working on it

The limit counts by IP address, and everyone behind one office or home router
shares that address. A reload loop, a second developer, and a device on the same
network all spend the same allowance.

Wait for the window to pass — the `retry-after` header holds the number of
seconds — or raise `LIMIT` in [api/rate-limit.ts](api/rate-limit.ts) and deploy
again. Run against `vercel dev` instead if it is only in the way: the limit does
not count locally.

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
