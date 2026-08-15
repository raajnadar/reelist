// Expo reads this file instead of app.json when both exist. `app.json` stays
// the source of truth: this file loads it and changes one field.
//
// GitHub Pages serves a project site from a subpath (/reelist/), not from the
// domain root. The default export writes absolute asset paths (/_expo/...),
// which 404 under that subpath. `experiments.baseUrl` prefixes every bundled
// resource, so the export matches where Pages actually serves it.
//
// The variable is set only by the deploy workflow. A local `expo start` and a
// local `expo export` see no baseUrl and keep serving from the root.
const config = require('./app.json')

module.exports = () => {
  const baseUrl = process.env.EXPO_BASE_URL ?? ''

  return {
    ...config.expo,
    experiments: {
      ...config.expo.experiments,
      baseUrl,
    },
  }
}
