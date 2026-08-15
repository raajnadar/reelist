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

| Rule               | Reason                                                           |
| ------------------ | ---------------------------------------------------------------- |
| Allowlisted paths  | Without it, the URL is a free TMDB relay under this key.         |
| Allowlisted params | A caller cannot add their own `api_key` or reach other features. |
| Edge cache, 10 min | One cached copy serves every user, so TMDB sees few requests.    |
| Errors not cached  | Caching a failure would pin it in place for the whole window.    |
| Status passed on   | The app turns a 404 into "no such film" and reports the rest.    |

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

4. Put the resulting URL in the app's `.env`:

   ```
   EXPO_PUBLIC_TMDB_PROXY_URL=https://<your-deployment>.vercel.app/api/tmdb
   ```

   This URL is public by design. It is an address, not a credential.

## Run it locally

```bash
cd proxy
vercel dev
```

Then set `EXPO_PUBLIC_TMDB_PROXY_URL=http://localhost:3000/api/tmdb` in the
app's `.env` and restart Metro with `yarn start --clear`.

## Test it

The tests run from the repository root, with the rest of the suite:

```bash
yarn test            # both projects
yarn test --selectProjects proxy
```

They mock `fetch`, so they need no key and reach no network.

## If the key is already exposed

A key that shipped in a build is public from that moment. Revoking it is the
only fix, because the published bundle cannot be recalled.

1. Regenerate the key at
   [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
2. Give the new key to the proxy only. Never put it in the app's `.env`.
3. Deploy the app again, so the published bundles stop carrying the old value.
