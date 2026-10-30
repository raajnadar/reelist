# Deployment

This page explains how each part of Reelist reaches its users: the web build,
the app update, the proxy, and the store build.

- [What deploys](#what-deploys)
- [Update channels](#update-channels)
- [Store build](#store-build)
- [Setup that this repository cannot do for itself](#setup-that-this-repository-cannot-do-for-itself)

## What deploys

Four things deploy. The proxy and the store build are separate from the two
workflows.

| What                                                    | Publishes             | Target                                  |
| ------------------------------------------------------- | --------------------- | --------------------------------------- |
| [`deploy.yml`](../.github/workflows/deploy.yml)         | The static web build  | GitHub Pages, at `reelist.raajnadar.in` |
| [`eas-update.yml`](../.github/workflows/eas-update.yml) | The JavaScript bundle | The EAS `main` channel, for the QR code |
| [`proxy/`](../proxy/README.md)                          | The TMDB proxy        | Vercel, by hand                         |
| [`eas.json`](../eas.json)                               | The Android app       | Google Play, by hand                    |

The two workflows run on every push to `main`. The proxy deploys separately, with
`vercel deploy --prod`, because it changes rarely and holds the key.

The QR image never changes. It points at the channel, and the workflow moves the
channel to the newest bundle.

To publish an app update by hand:

```bash
npx eas update --branch main --environment production --message "What changed"
```

`--environment production` loads the proxy URL from EAS. Without it, the update
takes the URL from your local `.env`. That is often a local proxy, and a phone
outside your network cannot reach it.

## Update channels

Each build profile in [eas.json](../eas.json) has its own channel. A build gets
updates only from its own channel.

| Channel       | Used by                      | Published by                             |
| ------------- | ---------------------------- | ---------------------------------------- |
| `main`        | Expo Go, through the QR code | `eas-update.yml`, on each push to `main` |
| `development` | A development build          | You, by hand                             |
| `preview`     | An internal test build       | You, by hand                             |
| `production`  | The Google Play build        | You, by hand                             |

The store build does not get the automatic updates. The workflow publishes
each commit on `main`, and an untested commit must not reach store users.

To publish an update to the store build:

```bash
npx eas update --channel production --environment production --message "What changed"
```

`--environment production` loads the proxy URL from EAS, the same value that the
store build uses.

Publish to `production` only for a change to JavaScript or to assets. The
runtime version follows the Expo SDK (`"policy": "sdkVersion"`), so the store
build also accepts an update that needs a new native module, and then it
crashes. A new native module, a new config plugin, or a change to a native
field in `app.json` needs a new store build.

The policy stays `sdkVersion` because Expo Go loads only an update whose
runtime version is the SDK version.

## Store build

The `production` profile builds an Android App Bundle (`.aab`) for Google Play.
EAS keeps the upload key and increases the version code on each build.

EAS Build does not receive `.env`, because git ignores it. The build reads the
proxy URL from its EAS environment: `production` for the store build, `preview`
for the test build. Step 7 below sets it.

Test a `preview` build on a device before each store build. It is an APK that
installs without the store:

```bash
npx eas build --platform android --profile preview
```

To build for Google Play:

```bash
npx eas build --platform android --profile production
```

Google Play accepts the first bundle only by hand. Download the `.aab` from the
build page, and upload it in Play Console. Send each later build with:

```bash
npx eas submit --platform android --profile production --latest
```

The submit profile sends the build to the internal testing track as a draft.
Google accepts only a draft until the app has a published release. Roll out the
draft in Play Console, by hand.

## Setup that this repository cannot do for itself

Eight steps need a web interface or an account login:

1. **Turn on Pages.** In `Settings → Pages`, set **Source** to **GitHub
   Actions**. The deploy workflow fails until this is set.
2. **Add the `EXPO_TOKEN` secret.** Make a token at
   [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens),
   then add it in `Settings → Secrets and variables → Actions`. The EAS workflow
   skips its steps without it.
3. **Add the `EXPO_PUBLIC_TMDB_PROXY_URL` variable.** In
   `Settings → Secrets and variables → Actions`, on the **Variables** tab — not
   the Secrets tab. The proxy URL is public, and storing it as a secret would
   suggest it needs protecting. Both workflows read it, and the published app
   cannot load data without it.
4. **Give the proxy its key.** `vercel env add TMDB_API_KEY production`, then
   deploy again. See [proxy/README.md](../proxy/README.md).
5. **Give the proxy its Redis credentials.** Create a database at
   [console.upstash.com](https://console.upstash.com/), then add
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them the
   proxy runs with **no rate limit** and reports nothing. See
   [proxy/README.md](../proxy/README.md).
6. **Require the CI check.** In `Settings → Branches`, add a rule for `main` and
   mark the `check` job as required. Until then CI reports a failure but does not
   stop a merge.
7. **Add the proxy URL to EAS.** Use the same URL as step 3. Without it, every
   screen of the store build shows the setup message.

   ```bash
   npx eas env:set --name EXPO_PUBLIC_TMDB_PROXY_URL --value <proxy URL> --visibility plaintext --environment production --environment preview
   ```

8. **Give EAS a Google service account key.** Create the account and give it
   access to the app in Play Console, as
   [expo.fyi/creating-google-service-account](https://expo.fyi/creating-google-service-account)
   shows. Upload its JSON key with `npx eas credentials --platform android`,
   under **Google Service Account**, then delete the file. `eas submit` reads
   the key from EAS, so the key never enters the repository.
